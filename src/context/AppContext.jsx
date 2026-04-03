import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  loadInvestments,
  saveInvestments,
  loadGoals,
  saveGoals,
  loadLoans,
  saveLoans,
  loadCash,
  saveCash,
  loadExpenses,
  saveExpenses,
  loadExpensePayers,
  saveExpensePayers,
  loadExpenseProjects,
  saveExpenseProjects,
  loadExpenseCategories,
  saveExpenseCategories,
  loadExpenseSubcategories,
  saveExpenseSubcategories,
  loadExpenseTypes,
  saveExpenseTypes,
  loadExpenseBudgets,
  saveExpenseBudgets,
  loadRecurringEntries,
  saveRecurringEntries,
  loadReminders,
  saveReminders,
  loadAppSettings,
  saveAppSettings,
  loadAiReports,
  saveAiReports,
} from '../utils/storage';
import {
  getDemoInvestments,
  getDemoGoals,
  getDemoLoans,
  getDemoCash,
  getDemoExpenses,
  DEFAULT_EXPENSE_PAYER,
  getExpenseCategoryInfo,
  getExpenseCategoryOptions,
  normalizeExpenseCategoryOption,
  createExpenseCategoryValue,
  getExpenseSubcategories,
  normalizeExpenseSubcategoryOption,
  createExpenseSubcategoryValue,
  getExpenseSubcategoryInfo,
  normalizeExpenseTypeOption,
  createExpenseTypeValue,
  getExpenseTypes,
  getExpenseChartColor,
  getPaymentMethodInfo,
} from '../utils/constants';
import { AppContext } from './AppContextDef';
import { useAuth } from './useAuth';
import { db } from '../firebase';
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { requestAiAsk, requestMonthlyAiReport } from '../utils/aiServer';

function formatStoredExpenseDateTime(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  return String(value).slice(0, 16);
}

function getTodayDateValue() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 10);
}

function normalizeHistoryDate(value, fallbackDate = getTodayDateValue()) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim()) ? String(value).trim() : fallbackDate;
}

function normalizeExpenseCategories(categories) {
  const seen = new Set();

  return categories
    .map((category, index) => normalizeExpenseCategoryOption(category, index))
    .filter((category) => {
      if (!category.label || !category.value) return false;
      if (getExpenseCategoryOptions([]).some((option) => option.value === category.value)) return false;
      if (seen.has(category.value)) return false;
      seen.add(category.value);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

function normalizeExpenseSubcategories(subcategories) {
  const seen = new Set();

  return subcategories
    .map((subcategory, index) => normalizeExpenseSubcategoryOption(subcategory, index))
    .filter((subcategory) => {
      if (!subcategory.label || !subcategory.value || !subcategory.categoryValue) return false;

      const dedupeKey = `${subcategory.categoryValue}:${subcategory.value}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .sort((left, right) => {
      if (left.categoryValue === right.categoryValue) return left.label.localeCompare(right.label);
      return left.categoryValue.localeCompare(right.categoryValue);
    });
}

function normalizeExpenseTypes(expenseTypes) {
  const seen = new Set();

  return expenseTypes
    .map((expenseType, index) => normalizeExpenseTypeOption(expenseType, index))
    .filter((expenseType) => {
      if (!expenseType.label || !expenseType.value || !expenseType.categoryValue || !expenseType.subcategoryValue) {
        return false;
      }

      const dedupeKey = `${expenseType.categoryValue}:${expenseType.subcategoryValue}:${expenseType.value}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .sort((left, right) => {
      if (left.categoryValue === right.categoryValue) {
        if (left.subcategoryValue === right.subcategoryValue) return left.label.localeCompare(right.label);
        return left.subcategoryValue.localeCompare(right.subcategoryValue);
      }
      return left.categoryValue.localeCompare(right.categoryValue);
    });
}

function normalizeExpenseBudget(budget, customCategories = [], customSubcategories = []) {
  const categoryInfo = getExpenseCategoryInfo(budget?.categoryValue || budget?.category, customCategories, budget?.categoryLabel);
  const subcategoryInfo = budget?.subcategoryValue || budget?.subcategory
    ? getExpenseSubcategoryInfo(
        categoryInfo.value,
        budget?.subcategoryValue || budget?.subcategory,
        customSubcategories,
        budget?.subcategoryLabel,
      )
    : null;

  return {
    id: budget?.id || uuidv4(),
    periodKey: /^\d{4}-\d{2}$/.test(String(budget?.periodKey || '').trim()) ? String(budget.periodKey).trim() : new Date().toISOString().slice(0, 7),
    categoryValue: categoryInfo.value,
    categoryLabel: categoryInfo.label,
    subcategoryValue: subcategoryInfo?.value || '',
    subcategoryLabel: subcategoryInfo?.label || '',
    amount: Number(budget?.amount) || 0,
  };
}

function normalizeExpenseBudgets(expenseBudgets, customCategories = [], customSubcategories = []) {
  const seen = new Map();

  expenseBudgets
    .map((budget) => normalizeExpenseBudget(budget, customCategories, customSubcategories))
    .filter((budget) => budget.categoryValue && budget.periodKey && budget.amount > 0)
    .forEach((budget) => {
      seen.set(`${budget.periodKey}:${budget.categoryValue}:${budget.subcategoryValue || 'all'}`, budget);
    });

  return [...seen.values()].sort((left, right) => {
    if (left.periodKey === right.periodKey) {
      if (left.categoryLabel === right.categoryLabel) return left.subcategoryLabel.localeCompare(right.subcategoryLabel);
      return left.categoryLabel.localeCompare(right.categoryLabel);
    }
    return right.periodKey.localeCompare(left.periodKey);
  });
}

function addMonthsToDate(dateValue, monthsToAdd) {
  const [year, month, day] = String(dateValue || '').split('-').map(Number);
  if (!year || !month || !day) return getTodayDateValue();

  const nextDate = new Date(year, month - 1, day);
  nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
  return nextDate.toISOString().slice(0, 10);
}

function addFrequencyToDate(dateValue, frequency) {
  switch (frequency) {
    case 'quarterly':
      return addMonthsToDate(dateValue, 3);
    case 'yearly':
      return addMonthsToDate(dateValue, 12);
    case 'monthly':
    default:
      return addMonthsToDate(dateValue, 1);
  }
}

function normalizeRecurringEntry(entry, customCategories = [], customSubcategories = []) {
  const kind = entry?.kind === 'investment' ? 'investment' : 'expense';
  const category = kind === 'expense'
    ? getExpenseCategoryInfo(entry?.categoryValue || entry?.category, customCategories, entry?.categoryLabel)
    : null;
  const subcategory = kind === 'expense' && (entry?.subcategoryValue || entry?.subcategory)
    ? getExpenseSubcategoryInfo(
        category?.value || '',
        entry?.subcategoryValue || entry?.subcategory,
        customSubcategories,
        entry?.subcategoryLabel,
      )
    : null;

  return {
    id: entry?.id || uuidv4(),
    title: String(entry?.title || entry?.name || '').trim(),
    kind,
    amount: Number(entry?.amount) || 0,
    frequency: ['monthly', 'quarterly', 'yearly'].includes(entry?.frequency) ? entry.frequency : 'monthly',
    nextDueDate: normalizeHistoryDate(entry?.nextDueDate || entry?.dueDate, getTodayDateValue()),
    lastRecordedDate: normalizeHistoryDate(entry?.lastRecordedDate || '', ''),
    categoryValue: category?.value || '',
    categoryLabel: category?.label || '',
    subcategoryValue: subcategory?.value || '',
    subcategoryLabel: subcategory?.label || '',
    investmentType: String(entry?.investmentType || entry?.type || 'mutual_funds').trim().toLowerCase() || 'mutual_funds',
    notes: String(entry?.notes || '').trim(),
  };
}

function normalizeRecurringEntries(recurringEntries, customCategories = [], customSubcategories = []) {
  return recurringEntries
    .map((entry) => normalizeRecurringEntry(entry, customCategories, customSubcategories))
    .filter((entry) => entry.title && entry.amount > 0)
    .sort((left, right) => left.nextDueDate.localeCompare(right.nextDueDate) || left.title.localeCompare(right.title));
}

function normalizeReminder(reminder) {
  const frequency = ['once', 'monthly', 'quarterly', 'yearly'].includes(reminder?.frequency)
    ? reminder.frequency
    : 'monthly';
  const status = reminder?.status === 'completed' && frequency === 'once' ? 'completed' : 'active';

  return {
    id: reminder?.id || uuidv4(),
    title: String(reminder?.title || reminder?.name || '').trim(),
    kind: reminder?.kind === 'debt_repayment' ? 'debt_repayment' : 'payment',
    amount: Number(reminder?.amount) || 0,
    frequency,
    nextDueDate: normalizeHistoryDate(reminder?.nextDueDate || reminder?.dueDate, getTodayDateValue()),
    lastCompletedDate: normalizeHistoryDate(reminder?.lastCompletedDate || reminder?.completedDate, ''),
    status,
    linkedLoanId: String(reminder?.linkedLoanId || '').trim(),
    linkedLoanName: String(reminder?.linkedLoanName || reminder?.loanName || '').trim(),
    notes: String(reminder?.notes || '').trim(),
  };
}

function normalizeReminders(reminders) {
  return reminders
    .map((reminder) => normalizeReminder(reminder))
    .filter((reminder) => reminder.title && reminder.amount > 0)
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === 'completed' ? 1 : -1;
      return left.nextDueDate.localeCompare(right.nextDueDate) || left.title.localeCompare(right.title);
    });
}

const DEFAULT_APP_SETTINGS = {
  dashboardSections: {
    netWorth: true,
    portfolioStats: true,
    assetAllocation: true,
    goalProgress: true,
    topInvestments: true,
  },
};

function normalizeAppSettings(appSettings) {
  const dashboardSections = appSettings?.dashboardSections && typeof appSettings.dashboardSections === 'object'
    ? appSettings.dashboardSections
    : {};

  return {
    dashboardSections: {
      netWorth: dashboardSections.netWorth !== false,
      portfolioStats: dashboardSections.portfolioStats !== false,
      assetAllocation: dashboardSections.assetAllocation !== false,
      goalProgress: dashboardSections.goalProgress !== false,
      topInvestments: dashboardSections.topInvestments !== false,
    },
  };
}

function normalizeExpense(expense, customCategories = [], customSubcategories = []) {
  const categoryInfo = getExpenseCategoryInfo(expense?.category, customCategories, expense?.categoryLabel);
  const subcategoryInfo = getExpenseSubcategoryInfo(
    categoryInfo.value,
    expense?.subcategory || expense?.subCategory,
    customSubcategories,
    expense?.subcategoryLabel || expense?.subCategoryLabel,
  );
  const paymentMethodInfo = getPaymentMethodInfo(expense?.paymentMethod);
  const dateTime = formatStoredExpenseDateTime(expense?.dateTime || expense?.date);
  const paidByName = expense?.paidByName || expense?.paidBy || DEFAULT_EXPENSE_PAYER.name;
  const fallbackPayerId = `payer:${paidByName.toLowerCase().replace(/\s+/g, '-')}`;

  return {
    ...expense,
    amount: Number(expense?.amount) || 0,
    project: String(expense?.project || expense?.projectName || '').trim(),
    category: categoryInfo.value,
    categoryLabel: categoryInfo.label,
    subcategory: subcategoryInfo?.value || '',
    subcategoryLabel: subcategoryInfo?.label || '',
    expenseType: '',
    expenseTypeLabel: '',
    paymentMethod: paymentMethodInfo.value,
    paymentMethodOther:
      paymentMethodInfo.value === 'other'
        ? expense?.paymentMethodOther || expense?.paymentMethodLabel || expense?.paymentMethod || ''
        : expense?.paymentMethodOther || '',
    paidById: expense?.paidById || (paidByName === DEFAULT_EXPENSE_PAYER.name ? DEFAULT_EXPENSE_PAYER.id : fallbackPayerId),
    paidByName,
    dateTime,
    date: dateTime ? dateTime.slice(0, 10) : '',
    notes: expense?.notes || '',
  };
}

function normalizeInvestmentHistoryEntry(entry, fallbackDate = getTodayDateValue()) {
  return {
    date: normalizeHistoryDate(entry?.date || entry?.snapshotDate || entry?.lastUpdated, fallbackDate),
    investedAmount: Number(entry?.investedAmount) || 0,
    currentValue: Number(entry?.currentValue) || 0,
  };
}

function normalizeInvestmentHistory(history, investment) {
  const fallbackDate = normalizeHistoryDate(
    investment?.lastUpdated || investment?.snapshotDate,
    getTodayDateValue(),
  );
  const entries = Array.isArray(history) ? history : [];

  if (!entries.length) {
    return [
      normalizeInvestmentHistoryEntry(
        {
          date: fallbackDate,
          investedAmount: investment?.investedAmount,
          currentValue: investment?.currentValue,
        },
        fallbackDate,
      ),
    ];
  }

  const byDate = new Map();
  entries.forEach((entry) => {
    const normalizedEntry = normalizeInvestmentHistoryEntry(entry, fallbackDate);
    byDate.set(normalizedEntry.date, normalizedEntry);
  });

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function normalizeInvestment(investment) {
  const investedAmount = Number(investment?.investedAmount) || 0;
  const currentValue = Number(investment?.currentValue) || 0;
  const interestRate = investment?.interestRate === '' || investment?.interestRate === null || investment?.interestRate === undefined
    ? ''
    : Number(investment.interestRate) || 0;
  const history = normalizeInvestmentHistory(investment?.history, {
    ...investment,
    investedAmount,
    currentValue,
  });
  const latestSnapshot = history[history.length - 1];
  const { snapshotDate: _snapshotDate, ...rest } = investment || {};

  return {
    ...rest,
    investedAmount,
    currentValue,
    interestRate,
    history,
    lastUpdated: normalizeHistoryDate(investment?.lastUpdated || latestSnapshot?.date, getTodayDateValue()),
  };
}

function buildInvestmentForSave(investment, previousInvestment = null) {
  const mergedInvestment = normalizeInvestment({
    ...(previousInvestment || {}),
    ...(investment || {}),
    history: previousInvestment?.history || investment?.history,
  });
  const snapshotDate = normalizeHistoryDate(
    investment?.snapshotDate || investment?.lastUpdated || mergedInvestment.lastUpdated,
    getTodayDateValue(),
  );
  const historyByDate = new Map(
    mergedInvestment.history.map((entry) => [entry.date, normalizeInvestmentHistoryEntry(entry, snapshotDate)]),
  );

  historyByDate.set(
    snapshotDate,
    normalizeInvestmentHistoryEntry(
      {
        date: snapshotDate,
        investedAmount: mergedInvestment.investedAmount,
        currentValue: mergedInvestment.currentValue,
      },
      snapshotDate,
    ),
  );

  const { snapshotDate: _snapshotDate, ...rest } = {
    ...mergedInvestment,
    history: [...historyByDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
    lastUpdated: snapshotDate,
  };

  return normalizeInvestment(rest);
}

function normalizeExpensePayers(payers) {
  return payers
    .filter((payer) => payer?.name && payer.id !== DEFAULT_EXPENSE_PAYER.id)
    .map((payer) => ({ id: payer.id, name: payer.name.trim() }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeExpenseProjects(projects) {
  const seen = new Set();

  return projects
    .map((project) => String(project?.name || project || '').trim())
    .filter((project) => {
      const normalized = project.toLowerCase();
      if (!project || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .sort((left, right) => left.localeCompare(right));
}

function normalizeAiReport(aiReport) {
  const generatedAt =
    typeof aiReport?.generatedAt === 'string'
      ? aiReport.generatedAt
      : aiReport?.generatedAt?.toDate?.()?.toISOString?.() || '';

  return {
    ...aiReport,
    id: aiReport?.id || aiReport?.periodKey || '',
    periodKey: aiReport?.periodKey || '',
    periodLabel: aiReport?.periodLabel || aiReport?.periodKey || 'Monthly Report',
    provider: aiReport?.provider || 'openai',
    generatedAt,
    summary: aiReport?.summary || '',
    wins: Array.isArray(aiReport?.wins) ? aiReport.wins.filter(Boolean) : [],
    risks: Array.isArray(aiReport?.risks) ? aiReport.risks.filter(Boolean) : [],
    investmentInsights: Array.isArray(aiReport?.investmentInsights) ? aiReport.investmentInsights.filter(Boolean) : [],
    recommendations: Array.isArray(aiReport?.recommendations)
      ? aiReport.recommendations
          .filter((item) => item?.title || item?.reason)
          .map((item) => ({
            title: item?.title || 'Recommendation',
            reason: item?.reason || '',
            priority: item?.priority || 'medium',
          }))
      : [],
    anomalies: Array.isArray(aiReport?.anomalies)
      ? aiReport.anomalies
          .filter((item) => item?.area || item?.finding)
          .map((item) => ({
            area: item?.area || 'Observation',
            finding: item?.finding || '',
          }))
      : [],
    breakdown: {
      categories: Array.isArray(aiReport?.breakdown?.categories) ? aiReport.breakdown.categories : [],
      subcategories: Array.isArray(aiReport?.breakdown?.subcategories) ? aiReport.breakdown.subcategories : [],
      expenseTypes: Array.isArray(aiReport?.breakdown?.expenseTypes) ? aiReport.breakdown.expenseTypes : [],
      projects: Array.isArray(aiReport?.breakdown?.projects) ? aiReport.breakdown.projects : [],
      investmentTypes: Array.isArray(aiReport?.breakdown?.investmentTypes) ? aiReport.breakdown.investmentTypes : [],
      holdings: Array.isArray(aiReport?.breakdown?.holdings) ? aiReport.breakdown.holdings : [],
    },
    metrics: aiReport?.metrics && typeof aiReport.metrics === 'object' ? aiReport.metrics : {},
    model: aiReport?.model || '',
  };
}

function sortAiReports(aiReports) {
  return [...aiReports].sort((left, right) => {
    const leftDate = new Date(left.generatedAt || 0).getTime();
    const rightDate = new Date(right.generatedAt || 0).getTime();
    return rightDate - leftDate;
  });
}

function isSameDemoData(storedItems, demoItems) {
  if (!storedItems.length || storedItems.length !== demoItems.length) return false;

  const demoIds = new Set(demoItems.map((item) => item.id));
  return storedItems.every((item) => demoIds.has(item.id));
}

function loadPersistedInvestments() {
  const stored = loadInvestments();
  return isSameDemoData(stored, getDemoInvestments()) ? [] : stored;
}

function loadPersistedGoals() {
  const stored = loadGoals();
  return isSameDemoData(stored, getDemoGoals()) ? [] : stored;
}

function loadPersistedLoans() {
  const stored = loadLoans();
  return isSameDemoData(stored, getDemoLoans()) ? [] : stored;
}

function loadPersistedExpenses() {
  const stored = loadExpenses();
  const sanitized = isSameDemoData(stored, getDemoExpenses()) ? [] : stored;
  return sanitized;
}

function loadPersistedExpenseCategories() {
  return normalizeExpenseCategories(loadExpenseCategories());
}

function loadPersistedExpenseSubcategories() {
  return normalizeExpenseSubcategories(loadExpenseSubcategories());
}

function loadPersistedExpenseTypes() {
  return normalizeExpenseTypes(loadExpenseTypes());
}

function loadPersistedExpenseBudgets() {
  return normalizeExpenseBudgets(
    loadExpenseBudgets(),
    loadPersistedExpenseCategories(),
    loadPersistedExpenseSubcategories(),
  );
}

function loadPersistedRecurringEntries() {
  return normalizeRecurringEntries(
    loadRecurringEntries(),
    loadPersistedExpenseCategories(),
    loadPersistedExpenseSubcategories(),
  );
}

function loadPersistedReminders() {
  return normalizeReminders(loadReminders());
}

function loadPersistedAppSettings() {
  return normalizeAppSettings(loadAppSettings());
}

function loadPersistedAiReports() {
  return sortAiReports(loadAiReports().map(normalizeAiReport));
}

const INITIAL_EXPENSE_CATEGORIES = loadPersistedExpenseCategories();
const INITIAL_EXPENSE_SUBCATEGORIES = loadPersistedExpenseSubcategories();
const INITIAL_EXPENSE_TYPES = loadPersistedExpenseTypes();
const INITIAL_EXPENSE_BUDGETS = loadPersistedExpenseBudgets();
const INITIAL_RECURRING_ENTRIES = loadPersistedRecurringEntries();
const INITIAL_REMINDERS = loadPersistedReminders();
const INITIAL_APP_SETTINGS = loadPersistedAppSettings();
const INITIAL_AI_REPORTS = loadPersistedAiReports();

export function AppProvider({ children }) {
  const { user } = useAuth();

  const [investments, setInvestments] = useState(() => loadPersistedInvestments().map((investment) => normalizeInvestment(investment)));
  const [goals, setGoals] = useState(loadPersistedGoals);
  const [loans, setLoans] = useState(loadPersistedLoans);
  const [cash, setCashState] = useState(loadCash);
  const [expenses, setExpenses] = useState(() =>
    loadPersistedExpenses().map((expense) =>
      normalizeExpense(expense, INITIAL_EXPENSE_CATEGORIES, INITIAL_EXPENSE_SUBCATEGORIES, INITIAL_EXPENSE_TYPES),
    ),
  );
  const [expensePayers, setExpensePayers] = useState(() => normalizeExpensePayers(loadExpensePayers()));
  const [expenseProjects, setExpenseProjects] = useState(() => normalizeExpenseProjects(loadExpenseProjects()));
  const [expenseCategories, setExpenseCategories] = useState(INITIAL_EXPENSE_CATEGORIES);
  const [expenseSubcategories, setExpenseSubcategories] = useState(INITIAL_EXPENSE_SUBCATEGORIES);
  const [expenseTypes, setExpenseTypes] = useState(INITIAL_EXPENSE_TYPES);
  const [expenseBudgets, setExpenseBudgets] = useState(INITIAL_EXPENSE_BUDGETS);
  const [recurringEntries, setRecurringEntries] = useState(INITIAL_RECURRING_ENTRIES);
  const [reminders, setReminders] = useState(INITIAL_REMINDERS);
  const [appSettings, setAppSettings] = useState(INITIAL_APP_SETTINGS);
  const [aiReports, setAiReports] = useState(INITIAL_AI_REPORTS);

  useEffect(() => {
    // If user is signed in, listen to their Firestore collections and sync locally
    if (!user) return undefined;

    const invCol = collection(db, 'users', user.uid, 'investments');
    const goalsCol = collection(db, 'users', user.uid, 'goals');
    const loansCol = collection(db, 'users', user.uid, 'loans');

    const unsubInv = onSnapshot(invCol, (snap) => {
      const items = snap.docs.map((d) => normalizeInvestment({ id: d.id, ...d.data() }));
      setInvestments(items);
      // also persist locally for offline fallback
      saveInvestments(items);
    });

    const unsubGoals = onSnapshot(goalsCol, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGoals(items);
      saveGoals(items);
    });

    const unsubLoans = onSnapshot(loansCol, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLoans(items);
      saveLoans(items);
    });

    const expensesCol = collection(db, 'users', user.uid, 'expenses');
    const unsubExpenses = onSnapshot(expensesCol, (snap) => {
      const items = snap.docs.map((d) => normalizeExpense({ id: d.id, ...d.data() }));
      setExpenses(items);
      saveExpenses(items);
    });

    const expensePayersCol = collection(db, 'users', user.uid, 'expensePayers');
    const unsubExpensePayers = onSnapshot(expensePayersCol, (snap) => {
      const items = normalizeExpensePayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setExpensePayers(items);
      saveExpensePayers(items);
    });

    const expenseProjectsCol = collection(db, 'users', user.uid, 'expenseProjects');
    const unsubExpenseProjects = onSnapshot(expenseProjectsCol, (snap) => {
      const items = normalizeExpenseProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setExpenseProjects(items);
      saveExpenseProjects(items);
    });

    const expenseCategoriesCol = collection(db, 'users', user.uid, 'expenseCategories');
    const unsubExpenseCategories = onSnapshot(expenseCategoriesCol, (snap) => {
      const items = normalizeExpenseCategories(snap.docs.map((d, index) => ({ id: d.id, ...d.data(), sortIndex: index })));
      setExpenseCategories(items);
      saveExpenseCategories(items);
    });

    const expenseSubcategoriesCol = collection(db, 'users', user.uid, 'expenseSubcategories');
    const unsubExpenseSubcategories = onSnapshot(expenseSubcategoriesCol, (snap) => {
      const items = normalizeExpenseSubcategories(
        snap.docs.map((d, index) => ({ id: d.id, ...d.data(), sortIndex: index })),
      );
      setExpenseSubcategories(items);
      saveExpenseSubcategories(items);
    });

    const expenseTypesCol = collection(db, 'users', user.uid, 'expenseTypes');
    const unsubExpenseTypes = onSnapshot(expenseTypesCol, (snap) => {
      const items = normalizeExpenseTypes(
        snap.docs.map((d, index) => ({ id: d.id, ...d.data(), sortIndex: index })),
      );
      setExpenseTypes(items);
      saveExpenseTypes(items);
    });

    const expenseBudgetsCol = collection(db, 'users', user.uid, 'expenseBudgets');
    const unsubExpenseBudgets = onSnapshot(expenseBudgetsCol, (snap) => {
      const items = normalizeExpenseBudgets(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        expenseCategories,
        expenseSubcategories,
      );
      setExpenseBudgets(items);
      saveExpenseBudgets(items);
    });

    const recurringEntriesCol = collection(db, 'users', user.uid, 'recurringEntries');
    const unsubRecurringEntries = onSnapshot(recurringEntriesCol, (snap) => {
      const items = normalizeRecurringEntries(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        expenseCategories,
        expenseSubcategories,
      );
      setRecurringEntries(items);
      saveRecurringEntries(items);
    });

    const remindersCol = collection(db, 'users', user.uid, 'reminders');
    const unsubReminders = onSnapshot(remindersCol, (snap) => {
      const items = normalizeReminders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setReminders(items);
      saveReminders(items);
    });

    const appSettingsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
    const unsubAppSettings = onSnapshot(appSettingsRef, (snap) => {
      const nextSettings = normalizeAppSettings(snap.exists() ? snap.data() : {});
      setAppSettings(nextSettings);
      saveAppSettings(nextSettings);
    });

    const aiReportsQuery = query(collection(db, 'users', user.uid, 'aiReports'), orderBy('generatedAt', 'desc'));
    const unsubAiReports = onSnapshot(aiReportsQuery, (snap) => {
      const items = sortAiReports(snap.docs.map((d) => normalizeAiReport({ id: d.id, ...d.data() })));
      setAiReports(items);
      saveAiReports(items);
    });

    return () => {
      unsubInv();
      unsubGoals();
      unsubLoans();
      unsubExpenses();
      unsubExpensePayers();
      unsubExpenseProjects();
      unsubExpenseCategories();
      unsubExpenseSubcategories();
      unsubExpenseTypes();
      unsubExpenseBudgets();
      unsubRecurringEntries();
      unsubReminders();
      unsubAppSettings();
      unsubAiReports();
    };
  }, [expenseCategories, expenseSubcategories, user]);

  const addExpenseProject = useCallback((projectName) => {
    const trimmedName = String(projectName || '').trim();
    if (!trimmedName) return null;

    const existingProject = expenseProjects.find((project) => project.toLowerCase() === trimmedName.toLowerCase());
    if (existingProject) return existingProject;

    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenseProjects', uuidv4());
      setDoc(ref, { name: trimmedName });
      return trimmedName;
    }

    setExpenseProjects((prev) => {
      const updated = normalizeExpenseProjects([...prev, trimmedName]);
      saveExpenseProjects(updated);
      return updated;
    });

    return trimmedName;
  }, [expenseProjects, user]);

  const addInvestment = useCallback((investment) => {
    const newItem = buildInvestmentForSave({ ...investment, id: uuidv4() });
    if (user) {
      const ref = doc(db, 'users', user.uid, 'investments', newItem.id);
      setDoc(ref, newItem);
      return;
    }
    setInvestments((prev) => {
      const updated = [...prev, newItem];
      saveInvestments(updated);
      return updated;
    });
  }, [user]);

  const addLoan = useCallback((loan) => {
    const newItem = { ...loan, id: uuidv4() };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'loans', newItem.id);
      setDoc(ref, newItem);
      return;
    }
    setLoans((prev) => {
      const updated = [...prev, newItem];
      saveLoans(updated);
      return updated;
    });
  }, [user]);

  const updateLoan = useCallback((id, loan) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'loans', id);
      updateDoc(ref, { ...loan });
      return;
    }
    setLoans((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, ...loan } : l));
      saveLoans(updated);
      return updated;
    });
  }, [user]);

  const deleteLoan = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'loans', id);
      deleteDoc(ref);
      return;
    }
    setLoans((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      saveLoans(updated);
      return updated;
    });
  }, [user]);

  const addExpense = useCallback((expense) => {
    const newItem = normalizeExpense({ ...expense, id: uuidv4() }, expenseCategories, expenseSubcategories, expenseTypes);
    if (newItem.project) addExpenseProject(newItem.project);
    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenses', newItem.id);
      setDoc(ref, newItem);
      return;
    }
    setExpenses((prev) => {
      const updated = [...prev, newItem];
      saveExpenses(updated);
      return updated;
    });
  }, [addExpenseProject, expenseCategories, expenseSubcategories, expenseTypes, user]);

  const updateExpense = useCallback((id, expense) => {
    const normalizedExpense = normalizeExpense(expense, expenseCategories, expenseSubcategories, expenseTypes);
    if (normalizedExpense.project) addExpenseProject(normalizedExpense.project);
    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenses', id);
      updateDoc(ref, { ...normalizedExpense });
      return;
    }
    setExpenses((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, ...normalizedExpense } : e));
      saveExpenses(updated);
      return updated;
    });
  }, [addExpenseProject, expenseCategories, expenseSubcategories, expenseTypes, user]);

  const deleteExpense = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenses', id);
      deleteDoc(ref);
      return;
    }
    setExpenses((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      saveExpenses(updated);
      return updated;
    });
  }, [user]);

  const addExpensePayer = useCallback((payer) => {
    const trimmedName = payer?.name?.trim();
    if (!trimmedName) return null;

    const newPayer = { id: uuidv4(), name: trimmedName };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'expensePayers', newPayer.id);
      setDoc(ref, newPayer);
      return newPayer;
    }

    setExpensePayers((prev) => {
      const updated = normalizeExpensePayers([...prev, newPayer]);
      saveExpensePayers(updated);
      return updated;
    });

    return newPayer;
  }, [user]);

  const addExpenseCategory = useCallback((category) => {
    const trimmedLabel = category?.label?.trim();
    if (!trimmedLabel) return null;

    const existingCategory = getExpenseCategoryOptions(expenseCategories).find(
      (item) => item.label.toLowerCase() === trimmedLabel.toLowerCase(),
    );
    if (existingCategory) return existingCategory;

    const newCategory = normalizeExpenseCategoryOption({
      id: uuidv4(),
      label: trimmedLabel,
      value: createExpenseCategoryValue(trimmedLabel, expenseCategories),
      color: getExpenseChartColor(getExpenseCategoryOptions(expenseCategories).length),
    });

    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenseCategories', newCategory.id);
      setDoc(ref, newCategory);
      return newCategory;
    }

    setExpenseCategories((prev) => {
      const updated = normalizeExpenseCategories([...prev, newCategory]);
      saveExpenseCategories(updated);
      return updated;
    });

    return newCategory;
  }, [expenseCategories, user]);

  const addExpenseSubcategory = useCallback((subcategory) => {
    const trimmedLabel = subcategory?.label?.trim();
    const categoryValue = String(subcategory?.categoryValue || '').trim().toLowerCase();
    if (!trimmedLabel || !categoryValue) return null;

    const existingSubcategory = getExpenseSubcategories(categoryValue, expenseSubcategories).find(
      (item) => item.label.toLowerCase() === trimmedLabel.toLowerCase(),
    );
    if (existingSubcategory) return existingSubcategory;

    const newSubcategory = normalizeExpenseSubcategoryOption({
      id: uuidv4(),
      label: trimmedLabel,
      categoryValue,
      value: createExpenseSubcategoryValue(trimmedLabel, categoryValue, expenseSubcategories),
      color: getExpenseChartColor(getExpenseSubcategories(categoryValue, expenseSubcategories).length),
    });

    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenseSubcategories', newSubcategory.id);
      setDoc(ref, newSubcategory);
      return newSubcategory;
    }

    setExpenseSubcategories((prev) => {
      const updated = normalizeExpenseSubcategories([...prev, newSubcategory]);
      saveExpenseSubcategories(updated);
      return updated;
    });

    return newSubcategory;
  }, [expenseSubcategories, user]);

  const addExpenseType = useCallback((expenseType) => {
    const trimmedLabel = expenseType?.label?.trim();
    const categoryValue = String(expenseType?.categoryValue || '').trim().toLowerCase();
    const subcategoryValue = String(expenseType?.subcategoryValue || '').trim().toLowerCase();
    if (!trimmedLabel || !categoryValue || !subcategoryValue) return null;

    const existingExpenseType = getExpenseTypes(categoryValue, subcategoryValue, expenseTypes).find(
      (item) => item.label.toLowerCase() === trimmedLabel.toLowerCase(),
    );
    if (existingExpenseType) return existingExpenseType;

    const newExpenseType = normalizeExpenseTypeOption({
      id: uuidv4(),
      label: trimmedLabel,
      categoryValue,
      subcategoryValue,
      value: createExpenseTypeValue(trimmedLabel, categoryValue, subcategoryValue, expenseTypes),
      color: getExpenseChartColor(getExpenseTypes(categoryValue, subcategoryValue, expenseTypes).length),
    });

    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenseTypes', newExpenseType.id);
      setDoc(ref, newExpenseType);
      return newExpenseType;
    }

    setExpenseTypes((prev) => {
      const updated = normalizeExpenseTypes([...prev, newExpenseType]);
      saveExpenseTypes(updated);
      return updated;
    });

    return newExpenseType;
  }, [expenseTypes, user]);

  const addExpenseBudget = useCallback((expenseBudget) => {
    const normalizedBudget = normalizeExpenseBudget(expenseBudget, expenseCategories, expenseSubcategories);
    if (!normalizedBudget.categoryValue || normalizedBudget.amount <= 0) return null;

    const existingBudget = expenseBudgets.find((item) =>
      item.periodKey === normalizedBudget.periodKey
      && item.categoryValue === normalizedBudget.categoryValue
      && (item.subcategoryValue || '') === (normalizedBudget.subcategoryValue || ''),
    );

    if (existingBudget) {
      const nextBudget = { ...normalizedBudget, id: existingBudget.id };
      if (user) {
        const ref = doc(db, 'users', user.uid, 'expenseBudgets', existingBudget.id);
        setDoc(ref, nextBudget);
        return nextBudget;
      }

      setExpenseBudgets((prev) => {
        const updated = normalizeExpenseBudgets(
          prev.map((item) => (item.id === existingBudget.id ? nextBudget : item)),
          expenseCategories,
          expenseSubcategories,
        );
        saveExpenseBudgets(updated);
        return updated;
      });
      return nextBudget;
    }

    const newBudget = { ...normalizedBudget, id: normalizedBudget.id || uuidv4() };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenseBudgets', newBudget.id);
      setDoc(ref, newBudget);
      return newBudget;
    }

    setExpenseBudgets((prev) => {
      const updated = normalizeExpenseBudgets([...prev, newBudget], expenseCategories, expenseSubcategories);
      saveExpenseBudgets(updated);
      return updated;
    });

    return newBudget;
  }, [expenseBudgets, expenseCategories, expenseSubcategories, user]);

  const updateExpenseBudget = useCallback((id, expenseBudget) => {
    const previousBudget = expenseBudgets.find((item) => item.id === id);
    const normalizedBudget = normalizeExpenseBudget({ ...previousBudget, ...expenseBudget, id }, expenseCategories, expenseSubcategories);
    if (!normalizedBudget.categoryValue || normalizedBudget.amount <= 0) return null;
    const conflictingBudget = expenseBudgets.find((item) =>
      item.id !== id
      && item.periodKey === normalizedBudget.periodKey
      && item.categoryValue === normalizedBudget.categoryValue
      && (item.subcategoryValue || '') === (normalizedBudget.subcategoryValue || ''),
    );

    if (conflictingBudget) {
      if (user) {
        const conflictRef = doc(db, 'users', user.uid, 'expenseBudgets', conflictingBudget.id);
        const currentRef = doc(db, 'users', user.uid, 'expenseBudgets', id);
        setDoc(conflictRef, { ...normalizedBudget, id: conflictingBudget.id });
        deleteDoc(currentRef);
        return { ...normalizedBudget, id: conflictingBudget.id };
      }

      setExpenseBudgets((prev) => {
        const updated = normalizeExpenseBudgets(
          prev
            .filter((item) => item.id !== id)
            .map((item) => (item.id === conflictingBudget.id ? { ...normalizedBudget, id: conflictingBudget.id } : item)),
          expenseCategories,
          expenseSubcategories,
        );
        saveExpenseBudgets(updated);
        return updated;
      });
      return { ...normalizedBudget, id: conflictingBudget.id };
    }

    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenseBudgets', id);
      updateDoc(ref, { ...normalizedBudget });
      return normalizedBudget;
    }

    setExpenseBudgets((prev) => {
      const updated = normalizeExpenseBudgets(
        prev.map((item) => (item.id === id ? normalizedBudget : item)),
        expenseCategories,
        expenseSubcategories,
      );
      saveExpenseBudgets(updated);
      return updated;
    });

    return normalizedBudget;
  }, [expenseBudgets, expenseCategories, expenseSubcategories, user]);

  const deleteExpenseBudget = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenseBudgets', id);
      deleteDoc(ref);
      return;
    }

    setExpenseBudgets((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveExpenseBudgets(updated);
      return updated;
    });
  }, [user]);

  const addRecurringEntry = useCallback((recurringEntry) => {
    const newEntry = normalizeRecurringEntry({ ...recurringEntry, id: uuidv4() }, expenseCategories, expenseSubcategories);
    if (!newEntry.title || newEntry.amount <= 0) return null;

    if (user) {
      const ref = doc(db, 'users', user.uid, 'recurringEntries', newEntry.id);
      setDoc(ref, newEntry);
      return newEntry;
    }

    setRecurringEntries((prev) => {
      const updated = normalizeRecurringEntries([...prev, newEntry], expenseCategories, expenseSubcategories);
      saveRecurringEntries(updated);
      return updated;
    });

    return newEntry;
  }, [expenseCategories, expenseSubcategories, user]);

  const updateRecurringEntry = useCallback((id, recurringEntry) => {
    const currentEntry = recurringEntries.find((item) => item.id === id);
    const normalizedEntry = normalizeRecurringEntry({ ...currentEntry, ...recurringEntry, id }, expenseCategories, expenseSubcategories);
    if (!normalizedEntry.title || normalizedEntry.amount <= 0) return null;

    if (user) {
      const ref = doc(db, 'users', user.uid, 'recurringEntries', id);
      updateDoc(ref, { ...normalizedEntry });
      return normalizedEntry;
    }

    setRecurringEntries((prev) => {
      const updated = normalizeRecurringEntries(
        prev.map((item) => (item.id === id ? normalizedEntry : item)),
        expenseCategories,
        expenseSubcategories,
      );
      saveRecurringEntries(updated);
      return updated;
    });

    return normalizedEntry;
  }, [expenseCategories, expenseSubcategories, recurringEntries, user]);

  const deleteRecurringEntry = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'recurringEntries', id);
      deleteDoc(ref);
      return;
    }

    setRecurringEntries((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveRecurringEntries(updated);
      return updated;
    });
  }, [user]);

  const markRecurringEntryRecorded = useCallback((id, recordedDate = getTodayDateValue()) => {
    const entry = recurringEntries.find((item) => item.id === id);
    if (!entry) return null;

    const nextRecordedDate = normalizeHistoryDate(recordedDate, getTodayDateValue());
    const updatedEntry = {
      ...entry,
      lastRecordedDate: nextRecordedDate,
      nextDueDate: addFrequencyToDate(nextRecordedDate, entry.frequency),
    };

    if (user) {
      const ref = doc(db, 'users', user.uid, 'recurringEntries', id);
      updateDoc(ref, {
        lastRecordedDate: updatedEntry.lastRecordedDate,
        nextDueDate: updatedEntry.nextDueDate,
      });
      return updatedEntry;
    }

    setRecurringEntries((prev) => {
      const updated = normalizeRecurringEntries(
        prev.map((item) => (item.id === id ? updatedEntry : item)),
        expenseCategories,
        expenseSubcategories,
      );
      saveRecurringEntries(updated);
      return updated;
    });

    return updatedEntry;
  }, [expenseCategories, expenseSubcategories, recurringEntries, user]);

  const addReminder = useCallback((reminder) => {
    const newReminder = normalizeReminder({ ...reminder, id: uuidv4() });
    if (!newReminder.title || newReminder.amount <= 0) return null;

    if (user) {
      const ref = doc(db, 'users', user.uid, 'reminders', newReminder.id);
      setDoc(ref, newReminder);
      return newReminder;
    }

    setReminders((prev) => {
      const updated = normalizeReminders([...prev, newReminder]);
      saveReminders(updated);
      return updated;
    });

    return newReminder;
  }, [user]);

  const updateReminder = useCallback((id, reminder) => {
    const currentReminder = reminders.find((item) => item.id === id);
    const normalizedReminder = normalizeReminder({ ...currentReminder, ...reminder, id });
    if (!normalizedReminder.title || normalizedReminder.amount <= 0) return null;

    if (user) {
      const ref = doc(db, 'users', user.uid, 'reminders', id);
      updateDoc(ref, { ...normalizedReminder });
      return normalizedReminder;
    }

    setReminders((prev) => {
      const updated = normalizeReminders(
        prev.map((item) => (item.id === id ? normalizedReminder : item)),
      );
      saveReminders(updated);
      return updated;
    });

    return normalizedReminder;
  }, [reminders, user]);

  const deleteReminder = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'reminders', id);
      deleteDoc(ref);
      return;
    }

    setReminders((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveReminders(updated);
      return updated;
    });
  }, [user]);

  const markReminderDone = useCallback((id, completedDate = getTodayDateValue()) => {
    const reminder = reminders.find((item) => item.id === id);
    if (!reminder) return null;

    const doneDate = normalizeHistoryDate(completedDate, getTodayDateValue());
    const updatedReminder = reminder.frequency === 'once'
      ? {
          ...reminder,
          status: 'completed',
          lastCompletedDate: doneDate,
          nextDueDate: doneDate,
        }
      : {
          ...reminder,
          status: 'active',
          lastCompletedDate: doneDate,
          nextDueDate: addFrequencyToDate(doneDate, reminder.frequency),
        };

    if (user) {
      const ref = doc(db, 'users', user.uid, 'reminders', id);
      updateDoc(ref, {
        status: updatedReminder.status,
        lastCompletedDate: updatedReminder.lastCompletedDate,
        nextDueDate: updatedReminder.nextDueDate,
      });
      return updatedReminder;
    }

    setReminders((prev) => {
      const updated = normalizeReminders(
        prev.map((item) => (item.id === id ? updatedReminder : item)),
      );
      saveReminders(updated);
      return updated;
    });

    return updatedReminder;
  }, [reminders, user]);

  const updateAppSettings = useCallback((nextSettings) => {
    const normalizedSettings = normalizeAppSettings({
      ...appSettings,
      ...(typeof nextSettings === 'function' ? nextSettings(appSettings) : nextSettings),
    });

    if (user) {
      const ref = doc(db, 'users', user.uid, 'settings', 'preferences');
      setDoc(ref, normalizedSettings, { merge: true });
      return normalizedSettings;
    }

    setAppSettings(normalizedSettings);
    saveAppSettings(normalizedSettings);
    return normalizedSettings;
  }, [appSettings, user]);

  const setCash = useCallback((amount) => {
    const value = Number(amount) || 0;
    setCashState(value);
    saveCash(value);
  }, []);

  const generateMonthlyAiReport = useCallback(async (periodKey, options = {}) => {
    if (!user) throw new Error('Sign in is required to generate AI reports.');

    const result = await requestMonthlyAiReport(user, {
      periodKey,
      forceRefresh: Boolean(options.forceRefresh),
      provider: options.provider || 'openai',
    });
    const normalizedReport = normalizeAiReport(result?.report || {});

    if (normalizedReport.id) {
      setAiReports((prev) => {
        const updated = sortAiReports([
          normalizedReport,
          ...prev.filter((report) => report.id !== normalizedReport.id),
        ]);
        saveAiReports(updated);
        return updated;
      });
    }

    return {
      ...result,
      report: normalizedReport,
    };
  }, [user]);

  const askAi = useCallback(async (payload) => {
    if (!user) throw new Error('Sign in is required to ask AI.');
    return requestAiAsk(user, payload);
  }, [user]);

  const updateInvestment = useCallback((id, investment) => {
    const previousInvestment = investments.find((item) => item.id === id);
    const normalizedInvestment = buildInvestmentForSave({ ...investment, id }, previousInvestment);
    if (user) {
      const ref = doc(db, 'users', user.uid, 'investments', id);
      updateDoc(ref, { ...normalizedInvestment });
      return;
    }
    setInvestments((prev) => {
      const updated = prev.map((inv) => (inv.id === id ? normalizedInvestment : inv));
      saveInvestments(updated);
      return updated;
    });
  }, [investments, user]);

  const deleteInvestment = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'investments', id);
      deleteDoc(ref);
      return;
    }
    setInvestments((prev) => {
      const updated = prev.filter((inv) => inv.id !== id);
      saveInvestments(updated);
      return updated;
    });
  }, [user]);

  const addGoal = useCallback((goal) => {
    const newItem = { ...goal, id: uuidv4() };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'goals', newItem.id);
      setDoc(ref, newItem);
      return;
    }
    setGoals((prev) => {
      const updated = [...prev, newItem];
      saveGoals(updated);
      return updated;
    });
  }, [user]);

  const updateGoal = useCallback((id, goal) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'goals', id);
      updateDoc(ref, { ...goal });
      return;
    }
    setGoals((prev) => {
      const updated = prev.map((g) => (g.id === id ? { ...g, ...goal } : g));
      saveGoals(updated);
      return updated;
    });
  }, [user]);

  const deleteGoal = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'goals', id);
      deleteDoc(ref);
      return;
    }
    setGoals((prev) => {
      const updated = prev.filter((g) => g.id !== id);
      saveGoals(updated);
      return updated;
    });
  }, [user]);

  const resetToDemo = useCallback(() => {
    const demoInv = getDemoInvestments().map((investment) => normalizeInvestment(investment));
    const demoGoals = getDemoGoals();
    const demoLoans = getDemoLoans();
    const demoCash = getDemoCash();
    const demoExpenses = getDemoExpenses();
    setInvestments(demoInv);
    setGoals(demoGoals);
    setLoans(demoLoans);
    setCashState(demoCash);
    setExpenses(demoExpenses.map(normalizeExpense));
    setExpensePayers([]);
    setExpenseProjects([]);
    saveInvestments(demoInv);
    saveGoals(demoGoals);
    saveLoans(demoLoans);
    saveCash(demoCash);
    saveExpenses(demoExpenses.map(normalizeExpense));
    saveExpensePayers([]);
    saveExpenseProjects([]);
    saveExpenseCategories([]);
    saveExpenseSubcategories([]);
    saveExpenseTypes([]);
    saveExpenseBudgets([]);
    saveRecurringEntries([]);
    saveReminders([]);
    saveAppSettings(DEFAULT_APP_SETTINGS);
    saveAiReports([]);
    setExpenseCategories([]);
    setExpenseSubcategories([]);
    setExpenseTypes([]);
    setExpenseBudgets([]);
    setRecurringEntries([]);
    setReminders([]);
    setAppSettings(DEFAULT_APP_SETTINGS);
    setAiReports([]);
  }, []);

  const value = {
    investments,
    goals,
    loans,
    cash,
    expenses,
    expensePayers,
    expenseProjects,
    expenseCategories,
    expenseSubcategories,
    expenseTypes,
    expenseBudgets,
    recurringEntries,
    reminders,
    appSettings,
    aiReports,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    addGoal,
    updateGoal,
    deleteGoal,
    addLoan,
    updateLoan,
    deleteLoan,
    setCash,
    addExpense,
    updateExpense,
    deleteExpense,
    addExpensePayer,
    addExpenseProject,
    addExpenseCategory,
    addExpenseSubcategory,
    addExpenseType,
    addExpenseBudget,
    updateExpenseBudget,
    deleteExpenseBudget,
    addRecurringEntry,
    updateRecurringEntry,
    deleteRecurringEntry,
    markRecurringEntryRecorded,
    addReminder,
    updateReminder,
    deleteReminder,
    markReminderDone,
    updateAppSettings,
    generateMonthlyAiReport,
    askAi,
    resetToDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
