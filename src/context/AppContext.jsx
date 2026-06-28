import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  loadInvestments,
  saveInvestments,
  loadSwingTrades,
  saveSwingTrades,
  loadFamilyMembers,
  saveFamilyMembers,
  loadGoals,
  saveGoals,
  loadLoans,
  saveLoans,
  loadCash,
  saveCash,
  loadCashHistory,
  saveCashHistory,
  loadNetWorthSnapshots,
  saveNetWorthSnapshots,
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
  loadCalendarEvents,
  saveCalendarEvents,
} from '../utils/storage';
import {
  getDemoInvestments,
  getDemoGoals,
  getDemoLoans,
  getDemoCash,
  getDemoExpenses,
  DEFAULT_FAMILY_MEMBER,
  FAMILY_GOAL_SCOPE,
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
  EXPENSE_PAYMENT_METHODS,
  isValidDateValue,
  getCalendarCategoryInfo,
} from '../utils/constants';
import { AppContext } from './AppContextDef';
import { THEME_IDS, DEFAULT_THEME, getThemeInfo } from '../utils/themes';
import { BACKUP_VERSION, BACKUP_COLLECTIONS } from '../utils/backup';
import { fetchLatestNav, fetchNavOnDate } from '../utils/navService';
import { useAuth } from './useAuth';
import { db } from '../firebase';
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { requestAiAsk, requestMonthlyAiReport, requestReceiptParse } from '../utils/aiServer';

function formatStoredExpenseDateTime(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  return String(value).slice(0, 16);
}

function writeMemberAccess(ownerUid, ownerName, member) {
  if (!ownerUid || !member?.email) return;
  setDoc(doc(db, 'memberAccess', member.email), {
    ownerUid,
    ownerName: String(ownerName || '').trim(),
    memberId: member.id,
    memberName: String(member.name || '').trim(),
    role: 'reader',
  });
}

function removeMemberAccess(email) {
  if (!email) return;
  deleteDoc(doc(db, 'memberAccess', email));
}

function getTodayDateValue() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 10);
}

function normalizeHistoryDate(value, fallbackDate = getTodayDateValue()) {
  return isValidDateValue(value) ? String(value).trim() : fallbackDate;
}

function normalizeAmountHistory(history, currentAmount = 0, fallbackDate = getTodayDateValue()) {
  const entries = Array.isArray(history) ? history : [];
  const byDate = new Map();

  entries.forEach((entry) => {
    const date = normalizeHistoryDate(entry?.date, fallbackDate);
    byDate.set(date, {
      date,
      amount: Number(entry?.amount ?? entry?.value) || 0,
    });
  });

  if (!byDate.size || currentAmount > 0) {
    byDate.set(fallbackDate, {
      date: fallbackDate,
      amount: Number(currentAmount) || 0,
    });
  }

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function appendAmountSnapshot(history, amount, date = getTodayDateValue()) {
  const snapshotDate = normalizeHistoryDate(date, getTodayDateValue());
  const byDate = new Map((Array.isArray(history) ? history : []).map((entry) => [
    normalizeHistoryDate(entry?.date, snapshotDate),
    {
      date: normalizeHistoryDate(entry?.date, snapshotDate),
      amount: Number(entry?.amount ?? entry?.value) || 0,
    },
  ]));

  byDate.set(snapshotDate, {
    date: snapshotDate,
    amount: Number(amount) || 0,
  });

  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
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
    autoCreate: Boolean(entry?.autoCreate),
    categoryValue: category?.value || '',
    categoryLabel: category?.label || '',
    subcategoryValue: subcategory?.value || '',
    subcategoryLabel: subcategory?.label || '',
    investmentType: String(entry?.investmentType || entry?.type || 'mutual_funds').trim().toLowerCase() || 'mutual_funds',
    linkedInvestmentId: kind === 'investment' ? String(entry?.linkedInvestmentId || '').trim() : '',
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

function normalizeCalendarEvent(event) {
  const category = getCalendarCategoryInfo(event?.category);
  return {
    id: event?.id || uuidv4(),
    title: String(event?.title || event?.name || '').trim(),
    category: category.value,
    amount: Number(event?.amount) || 0,
    date: normalizeHistoryDate(event?.date || event?.dueDate, getTodayDateValue()),
    recurrence: ['once', 'monthly', 'quarterly', 'yearly'].includes(event?.recurrence)
      ? event.recurrence
      : 'once',
    notes: String(event?.notes || '').trim(),
  };
}

function normalizeCalendarEvents(events) {
  return (Array.isArray(events) ? events : [])
    .map((event) => normalizeCalendarEvent(event))
    .filter((event) => event.title && event.amount > 0)
    .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title));
}

const DEFAULT_APP_SETTINGS = {
  dashboardSections: {
    netWorth: true,
    portfolioStats: true,
    assetAllocation: true,
    goalProgress: true,
    topInvestments: true,
  },
  investmentVisibilityMemberId: 'all',
  showProjectedValue: true,
  showMotivationBanner: true,
  theme: DEFAULT_THEME,
  mode: 'light',
  ownerName: DEFAULT_FAMILY_MEMBER.name,
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
    investmentVisibilityMemberId:
      typeof appSettings?.investmentVisibilityMemberId === 'string' && appSettings.investmentVisibilityMemberId.trim()
        ? appSettings.investmentVisibilityMemberId.trim()
        : 'all',
    showProjectedValue: appSettings?.showProjectedValue !== false,
    showMotivationBanner: appSettings?.showMotivationBanner !== false,
    theme: THEME_IDS.includes(appSettings?.theme) ? appSettings.theme : DEFAULT_THEME,
    mode: ['light', 'dark', 'system'].includes(appSettings?.mode) ? appSettings.mode : 'light',
    ownerName:
      typeof appSettings?.ownerName === 'string' && appSettings.ownerName.trim()
        ? appSettings.ownerName.trim().slice(0, 40)
        : DEFAULT_FAMILY_MEMBER.name,
  };
}

function buildInvestmentMemberOptions(familyMembers = [], investments = []) {
  const options = new Map([[DEFAULT_FAMILY_MEMBER.id, DEFAULT_FAMILY_MEMBER]]);

  familyMembers.forEach((member) => {
    options.set(member.id, member);
  });

  investments.forEach((investment) => {
    const memberId = investment.memberId || DEFAULT_FAMILY_MEMBER.id;
    const memberName = investment.memberName || DEFAULT_FAMILY_MEMBER.name;
    options.set(memberId, { id: memberId, name: memberName });
  });

  return [...options.values()].sort((left, right) => {
    if (left.id === DEFAULT_FAMILY_MEMBER.id) return -1;
    if (right.id === DEFAULT_FAMILY_MEMBER.id) return 1;
    return left.name.localeCompare(right.name);
  });
}

function normalizeInvestmentVisibilityMemberId(memberId, memberOptions = []) {
  if (memberId === 'all') return 'all';
  return memberOptions.some((member) => member.id === memberId) ? memberId : 'all';
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
  const memberName = String(
    investment?.memberName || investment?.ownerName || investment?.familyMemberName || DEFAULT_FAMILY_MEMBER.name,
  ).trim() || DEFAULT_FAMILY_MEMBER.name;
  const fallbackMemberId =
    memberName === DEFAULT_FAMILY_MEMBER.name
      ? DEFAULT_FAMILY_MEMBER.id
      : `member:${memberName.toLowerCase().replace(/\s+/g, '-')}`;
  const memberId = String(
    investment?.memberId || investment?.ownerId || investment?.familyMemberId || fallbackMemberId,
  ).trim() || fallbackMemberId;
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
    memberId,
    memberName,
    history,
    lastUpdated: normalizeHistoryDate(investment?.lastUpdated || latestSnapshot?.date, getTodayDateValue()),
  };
}

function normalizeGoal(goal) {
  const rawMemberId = String(goal?.memberId || goal?.scopeMemberId || '').trim();
  const memberName = String(goal?.memberName || goal?.scopeMemberName || '').trim();
  const memberId = rawMemberId || (memberName ? `member:${memberName.toLowerCase().replace(/\s+/g, '-')}` : FAMILY_GOAL_SCOPE.id);
  const isFamilyGoal = memberId === FAMILY_GOAL_SCOPE.id;
  const allocations = Array.isArray(goal?.allocations)
    ? goal.allocations
        .map((allocation) => ({
          assetId: String(allocation?.assetId || '').trim(),
          assetName: String(allocation?.assetName || '').trim(),
          assetType: allocation?.assetType === 'cash' ? 'cash' : 'investment',
          amount: Number(allocation?.amount) || 0,
        }))
        .filter((allocation) => allocation.assetId && allocation.amount > 0)
    : [];
  const currentAmount = Number(goal?.currentAmount) || allocations.reduce((sum, allocation) => sum + allocation.amount, 0);

  return {
    ...(goal || {}),
    targetAmount: Number(goal?.targetAmount) || 0,
    currentAmount,
    memberId: isFamilyGoal ? FAMILY_GOAL_SCOPE.id : memberId,
    memberName: isFamilyGoal ? FAMILY_GOAL_SCOPE.name : (memberName || DEFAULT_FAMILY_MEMBER.name),
    allocations,
    history: normalizeAmountHistory(goal?.history, currentAmount, normalizeHistoryDate(goal?.snapshotDate || goal?.updatedAt, getTodayDateValue())),
  };
}

function calculateGoalCurrentAmount(goal, investments = [], cash = 0) {
  if (Array.isArray(goal?.allocations) && goal.allocations.length) {
    return goal.allocations.reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0);
  }

  const memberId = goal?.memberId || FAMILY_GOAL_SCOPE.id;
  const scopedInvestments = memberId === FAMILY_GOAL_SCOPE.id
    ? investments
    : investments.filter((investment) => (investment.memberId || DEFAULT_FAMILY_MEMBER.id) === memberId);
  const investmentValue = scopedInvestments.reduce((sum, investment) => sum + (Number(investment.currentValue) || 0), 0);

  return memberId === FAMILY_GOAL_SCOPE.id ? investmentValue + (Number(cash) || 0) : investmentValue;
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

function normalizeSwingTrade(trade) {
  const sellDate = trade?.sellDate ? normalizeHistoryDate(trade.sellDate, '') : '';
  const sellPrice = Number(trade?.sellPrice) || 0;
  const isClosed = Boolean(sellDate) && sellPrice > 0;
  return {
    id: trade?.id || uuidv4(),
    symbol: String(trade?.symbol || '').trim().toUpperCase(),
    segment: trade?.segment === 'intraday' ? 'intraday' : 'delivery',
    quantity: Number(trade?.quantity) || 0,
    buyPrice: Number(trade?.buyPrice) || 0,
    buyDate: normalizeHistoryDate(trade?.buyDate || trade?.date, getTodayDateValue()),
    buyNotes: String(trade?.buyNotes || '').trim(),
    sellPrice,
    sellDate,
    sellNotes: String(trade?.sellNotes || '').trim(),
    brokerageOverride:
      trade?.brokerageOverride === '' || trade?.brokerageOverride === null || trade?.brokerageOverride === undefined
        ? ''
        : Number(trade.brokerageOverride),
    status: isClosed ? 'closed' : 'open',
    lastUpdated: normalizeHistoryDate(trade?.lastUpdated || trade?.buyDate, getTodayDateValue()),
  };
}

function normalizeLoan(loan) {
  const principal = Number(loan?.principal || loan?.loanAmount || loan?.principalAmount) || 0;
  const outstandingBalance = Number(
    loan?.outstandingBalance ?? loan?.outstandingPrincipal ?? loan?.balance ?? principal,
  ) || 0;
  const balanceDate = normalizeHistoryDate(loan?.balanceDate || loan?.snapshotDate || loan?.startDate, getTodayDateValue());

  return {
    ...(loan || {}),
    principal,
    outstandingBalance,
    balanceDate,
    annualRate: Number(loan?.annualRate) || 0,
    termMonths: Number(loan?.termMonths) || 0,
    monthlyEMI: loan?.monthlyEMI || loan?.monthlyEmi ? Number(loan.monthlyEMI || loan.monthlyEmi) || 0 : null,
    history: normalizeAmountHistory(loan?.history, outstandingBalance || principal, balanceDate),
  };
}

function buildLoanForSave(loan, previousLoan = null) {
  const mergedLoan = normalizeLoan({
    ...(previousLoan || {}),
    ...(loan || {}),
    history: previousLoan?.history || loan?.history,
  });
  const balanceDate = normalizeHistoryDate(loan?.balanceDate || mergedLoan.balanceDate, getTodayDateValue());

  return {
    ...mergedLoan,
    history: appendAmountSnapshot(mergedLoan.history, mergedLoan.outstandingBalance, balanceDate),
  };
}

function normalizeExpensePayers(payers) {
  return payers
    .filter((payer) => payer?.name && payer.id !== DEFAULT_EXPENSE_PAYER.id)
    .map((payer) => ({ id: payer.id, name: payer.name.trim() }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeFamilyMembers(familyMembers) {
  const seenIds = new Set();
  const seenNames = new Set();

  return familyMembers
    .map((member) => ({
      id: String(member?.id || '').trim(),
      name: String(member?.name || '').trim(),
      relation: String(member?.relation || '').trim(),
      email: String(member?.email || '').trim().toLowerCase(),
    }))
    .filter((member) => {
      const normalizedName = member.name.toLowerCase();
      if (!member.id || !member.name || member.id === DEFAULT_FAMILY_MEMBER.id) return false;
      if (seenIds.has(member.id) || seenNames.has(normalizedName)) return false;
      seenIds.add(member.id);
      seenNames.add(normalizedName);
      return true;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeCashHistory(history, currentCash = 0) {
  return normalizeAmountHistory(history, Number(currentCash) || 0, getTodayDateValue());
}

function normalizeNetWorthSnapshots(snapshots) {
  if (!Array.isArray(snapshots)) return [];
  return snapshots
    .map((snapshot) => {
      const periodKey = String(snapshot?.periodKey || '').trim();
      const [keyYear, keyMonth] = periodKey.split('-').map(Number);
      const hasValidPeriodKey = /^\d{4}-\d{2}$/.test(periodKey) && keyYear >= 1970 && keyMonth >= 1 && keyMonth <= 12;
      return {
        periodKey: hasValidPeriodKey ? periodKey : normalizeHistoryDate(snapshot?.date, getTodayDateValue()).slice(0, 7),
        date: normalizeHistoryDate(snapshot?.date, getTodayDateValue()),
        portfolioValue: Number(snapshot?.portfolioValue) || 0,
        cashReserve: Number(snapshot?.cashReserve) || 0,
        loanPrincipal: Number(snapshot?.loanPrincipal) || 0,
        goalSaved: Number(snapshot?.goalSaved) || 0,
        netWorth: Number(snapshot?.netWorth) || 0,
      };
    })
    .sort((left, right) => left.periodKey.localeCompare(right.periodKey));
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

function loadPersistedFamilyMembers() {
  return normalizeFamilyMembers(loadFamilyMembers());
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

function loadPersistedCalendarEvents() {
  return normalizeCalendarEvents(loadCalendarEvents());
}

const INITIAL_EXPENSE_CATEGORIES = loadPersistedExpenseCategories();
const INITIAL_EXPENSE_SUBCATEGORIES = loadPersistedExpenseSubcategories();
const INITIAL_EXPENSE_TYPES = loadPersistedExpenseTypes();
const INITIAL_EXPENSE_BUDGETS = loadPersistedExpenseBudgets();
const INITIAL_RECURRING_ENTRIES = loadPersistedRecurringEntries();
const INITIAL_REMINDERS = loadPersistedReminders();
const INITIAL_APP_SETTINGS = loadPersistedAppSettings();
const INITIAL_AI_REPORTS = loadPersistedAiReports();
const INITIAL_CALENDAR_EVENTS = loadPersistedCalendarEvents();

export function AppProvider({ children }) {
  const { user, household } = useAuth();
  const effectiveUid = household?.mode === 'member' ? household.ownerUid : user?.uid;
  const isReadOnly = household?.mode === 'member';
  const readOnlyRef = useRef(false);
  useEffect(() => { readOnlyRef.current = isReadOnly; }, [isReadOnly]);

  const [investments, setInvestments] = useState(() => loadPersistedInvestments().map((investment) => normalizeInvestment(investment)));
  const [swingTrades, setSwingTrades] = useState(() => loadSwingTrades().map((trade) => normalizeSwingTrade(trade)));
  const [familyMembers, setFamilyMembers] = useState(loadPersistedFamilyMembers);
  const [storedGoals, setStoredGoals] = useState(() => loadPersistedGoals().map((goal) => normalizeGoal(goal)));
  const [loans, setLoans] = useState(() => loadPersistedLoans().map((loan) => normalizeLoan(loan)));
  const [cash, setCashState] = useState(loadCash);
  const [cashHistory, setCashHistory] = useState(() => normalizeCashHistory(loadCashHistory(), loadCash()));
  const [netWorthSnapshots, setNetWorthSnapshots] = useState(() => normalizeNetWorthSnapshots(loadNetWorthSnapshots()));
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
  const [calendarEvents, setCalendarEvents] = useState(INITIAL_CALENDAR_EVENTS);

  // Snapshot callbacks for budgets/recurring read the latest categories via refs, so
  // the listener effect does NOT depend on those state values. Depending on them caused
  // every snapshot (new array reference) to tear down and re-open all listeners — an
  // infinite re-subscription loop that hammered Firestore and burned the read quota.
  const expenseCategoriesRef = useRef(expenseCategories);
  const expenseSubcategoriesRef = useRef(expenseSubcategories);
  useEffect(() => { expenseCategoriesRef.current = expenseCategories; }, [expenseCategories]);
  useEffect(() => { expenseSubcategoriesRef.current = expenseSubcategories; }, [expenseSubcategories]);

  // Keep budget/recurring labels fresh as categories change — derived via memo (no extra
  // state, no listeners), which replaces the freshness the old re-subscription loop gave.
  const displayExpenseBudgets = useMemo(
    () => normalizeExpenseBudgets(expenseBudgets, expenseCategories, expenseSubcategories),
    [expenseBudgets, expenseCategories, expenseSubcategories],
  );
  const displayRecurringEntries = useMemo(
    () => normalizeRecurringEntries(recurringEntries, expenseCategories, expenseSubcategories),
    [recurringEntries, expenseCategories, expenseSubcategories],
  );

  const theme = THEME_IDS.includes(appSettings?.theme) ? appSettings.theme : DEFAULT_THEME;
  const themePrimary = getThemeInfo(theme).primary;

  // Apply the selected theme to the document root so the CSS variables in
  // styles/themes.css re-skin the whole app.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Light/dark mode: 'system' follows the OS and updates live; otherwise honour the choice.
  const mode = ['light', 'dark', 'system'].includes(appSettings?.mode) ? appSettings.mode : 'light';
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && media.matches);
      if (dark) root.setAttribute('data-mode', 'dark');
      else root.removeAttribute('data-mode');
    };
    apply();
    if (mode === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
    return undefined;
  }, [mode]);

  const investmentMemberOptions = useMemo(
    () => buildInvestmentMemberOptions(familyMembers, investments),
    [familyMembers, investments],
  );
  const investmentVisibilityMemberId = useMemo(
    () => {
      if (household?.mode === 'member' && household.memberId) return household.memberId;
      return normalizeInvestmentVisibilityMemberId(appSettings?.investmentVisibilityMemberId || 'all', investmentMemberOptions);
    },
    [appSettings?.investmentVisibilityMemberId, household, investmentMemberOptions],
  );
  const investmentVisibilityMember = useMemo(
    () =>
      investmentVisibilityMemberId === 'all'
        ? null
        : investmentMemberOptions.find((member) => member.id === investmentVisibilityMemberId) || null,
    [investmentMemberOptions, investmentVisibilityMemberId],
  );
  const visibleInvestments = useMemo(
    () =>
      investmentVisibilityMemberId === 'all'
        ? investments
        : investments.filter((investment) => (investment.memberId || DEFAULT_FAMILY_MEMBER.id) === investmentVisibilityMemberId),
    [investmentVisibilityMemberId, investments],
  );
  const goals = useMemo(
    () =>
      storedGoals.map((goal) => ({
        ...normalizeGoal(goal),
        currentAmount: calculateGoalCurrentAmount(goal, investments, cash),
      })),
    [cash, investments, storedGoals],
  );

  const currentNetWorthSnapshot = useMemo(() => {
    const date = getTodayDateValue();
    const periodKey = date.slice(0, 7);
    const portfolioValue = investments.reduce((sum, investment) => sum + (Number(investment.currentValue) || 0), 0);
    const loanPrincipal = loans.reduce((sum, loan) => sum + (Number(loan.outstandingBalance ?? loan.principal) || 0), 0);
    const goalSaved = goals.reduce((sum, goal) => sum + (Number(goal.currentAmount) || 0), 0);
    const cashReserve = Number(cash) || 0;
    return {
      periodKey,
      date,
      portfolioValue,
      cashReserve,
      loanPrincipal,
      goalSaved,
      netWorth: portfolioValue + cashReserve - loanPrincipal,
    };
  }, [cash, goals, investments, loans]);
  const derivedNetWorthSnapshots = useMemo(
    () => normalizeNetWorthSnapshots([
      ...netWorthSnapshots.filter((item) => item.periodKey !== currentNetWorthSnapshot.periodKey),
      currentNetWorthSnapshot,
    ]),
    [currentNetWorthSnapshot, netWorthSnapshots],
  );

  useEffect(() => {
    const storedSnapshot = netWorthSnapshots.find((item) => item.periodKey === currentNetWorthSnapshot.periodKey);
    const isSameSnapshot = storedSnapshot
      && storedSnapshot.portfolioValue === currentNetWorthSnapshot.portfolioValue
      && storedSnapshot.cashReserve === currentNetWorthSnapshot.cashReserve
      && storedSnapshot.loanPrincipal === currentNetWorthSnapshot.loanPrincipal
      && storedSnapshot.goalSaved === currentNetWorthSnapshot.goalSaved
      && storedSnapshot.netWorth === currentNetWorthSnapshot.netWorth;

    if (isSameSnapshot) return;
    if (isReadOnly) return;

    saveNetWorthSnapshots(derivedNetWorthSnapshots);
    if (user) {
      const ref = doc(db, 'users', user.uid, 'netWorthSnapshots', currentNetWorthSnapshot.periodKey);
      setDoc(ref, currentNetWorthSnapshot);
    }
  }, [currentNetWorthSnapshot, derivedNetWorthSnapshots, isReadOnly, netWorthSnapshots, user]);

  useEffect(() => {
    // Listen to the active household's Firestore collections (owner OR member view).
    if (!effectiveUid) return undefined;

    const invCol = collection(db, 'users', effectiveUid, 'investments');
    const familyMembersCol = collection(db, 'users', effectiveUid, 'familyMembers');
    const goalsCol = collection(db, 'users', effectiveUid, 'goals');
    const loansCol = collection(db, 'users', effectiveUid, 'loans');
    const cashHistoryCol = collection(db, 'users', effectiveUid, 'cashHistory');
    const netWorthSnapshotsCol = collection(db, 'users', effectiveUid, 'netWorthSnapshots');

    const unsubInv = onSnapshot(invCol, (snap) => {
      const items = snap.docs.map((d) => normalizeInvestment({ id: d.id, ...d.data() }));
      setInvestments(items);
      // also persist locally for offline fallback
      saveInvestments(items);
    });

    const swingTradesCol = collection(db, 'users', effectiveUid, 'swingTrades');
    const unsubSwingTrades = onSnapshot(swingTradesCol, (snap) => {
      const items = snap.docs.map((d) => normalizeSwingTrade({ id: d.id, ...d.data() }));
      setSwingTrades(items);
      saveSwingTrades(items);
    });

    const unsubFamilyMembers = onSnapshot(familyMembersCol, (snap) => {
      const items = normalizeFamilyMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setFamilyMembers(items);
      saveFamilyMembers(items);
    });

    const unsubGoals = onSnapshot(goalsCol, (snap) => {
      const items = snap.docs.map((d) => normalizeGoal({ id: d.id, ...d.data() }));
      setStoredGoals(items);
      saveGoals(items);
    });

    const unsubLoans = onSnapshot(loansCol, (snap) => {
      const items = snap.docs.map((d) => normalizeLoan({ id: d.id, ...d.data() }));
      setLoans(items);
      saveLoans(items);
    });

    const unsubCashHistory = onSnapshot(cashHistoryCol, (snap) => {
      const items = normalizeCashHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })), loadCash());
      setCashHistory(items);
      saveCashHistory(items);
      const latest = items[items.length - 1];
      if (latest) {
        setCashState(latest.amount);
        saveCash(latest.amount);
      }
    });

    const unsubNetWorthSnapshots = onSnapshot(netWorthSnapshotsCol, (snap) => {
      const items = normalizeNetWorthSnapshots(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setNetWorthSnapshots(items);
      saveNetWorthSnapshots(items);
    });

    const expensesCol = collection(db, 'users', effectiveUid, 'expenses');
    const unsubExpenses = onSnapshot(expensesCol, (snap) => {
      const items = snap.docs.map((d) => normalizeExpense({ id: d.id, ...d.data() }));
      setExpenses(items);
      saveExpenses(items);
    });

    const expensePayersCol = collection(db, 'users', effectiveUid, 'expensePayers');
    const unsubExpensePayers = onSnapshot(expensePayersCol, (snap) => {
      const items = normalizeExpensePayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setExpensePayers(items);
      saveExpensePayers(items);
    });

    const expenseProjectsCol = collection(db, 'users', effectiveUid, 'expenseProjects');
    const unsubExpenseProjects = onSnapshot(expenseProjectsCol, (snap) => {
      const items = normalizeExpenseProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setExpenseProjects(items);
      saveExpenseProjects(items);
    });

    const expenseCategoriesCol = collection(db, 'users', effectiveUid, 'expenseCategories');
    const unsubExpenseCategories = onSnapshot(expenseCategoriesCol, (snap) => {
      const items = normalizeExpenseCategories(snap.docs.map((d, index) => ({ id: d.id, ...d.data(), sortIndex: index })));
      setExpenseCategories(items);
      saveExpenseCategories(items);
    });

    const expenseSubcategoriesCol = collection(db, 'users', effectiveUid, 'expenseSubcategories');
    const unsubExpenseSubcategories = onSnapshot(expenseSubcategoriesCol, (snap) => {
      const items = normalizeExpenseSubcategories(
        snap.docs.map((d, index) => ({ id: d.id, ...d.data(), sortIndex: index })),
      );
      setExpenseSubcategories(items);
      saveExpenseSubcategories(items);
    });

    const expenseTypesCol = collection(db, 'users', effectiveUid, 'expenseTypes');
    const unsubExpenseTypes = onSnapshot(expenseTypesCol, (snap) => {
      const items = normalizeExpenseTypes(
        snap.docs.map((d, index) => ({ id: d.id, ...d.data(), sortIndex: index })),
      );
      setExpenseTypes(items);
      saveExpenseTypes(items);
    });

    const expenseBudgetsCol = collection(db, 'users', effectiveUid, 'expenseBudgets');
    const unsubExpenseBudgets = onSnapshot(expenseBudgetsCol, (snap) => {
      const items = normalizeExpenseBudgets(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        expenseCategoriesRef.current,
        expenseSubcategoriesRef.current,
      );
      setExpenseBudgets(items);
      saveExpenseBudgets(items);
    });

    const recurringEntriesCol = collection(db, 'users', effectiveUid, 'recurringEntries');
    const unsubRecurringEntries = onSnapshot(recurringEntriesCol, (snap) => {
      const items = normalizeRecurringEntries(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        expenseCategoriesRef.current,
        expenseSubcategoriesRef.current,
      );
      setRecurringEntries(items);
      saveRecurringEntries(items);
    });

    const remindersCol = collection(db, 'users', effectiveUid, 'reminders');
    const unsubReminders = onSnapshot(remindersCol, (snap) => {
      const items = normalizeReminders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setReminders(items);
      saveReminders(items);
    });

    const appSettingsRef = doc(db, 'users', effectiveUid, 'settings', 'preferences');
    const unsubAppSettings = onSnapshot(appSettingsRef, (snap) => {
      const nextSettings = normalizeAppSettings(snap.exists() ? snap.data() : {});
      setAppSettings(nextSettings);
      saveAppSettings(nextSettings);
    });

    const aiReportsQuery = query(collection(db, 'users', effectiveUid, 'aiReports'), orderBy('generatedAt', 'desc'));
    const unsubAiReports = onSnapshot(aiReportsQuery, (snap) => {
      const items = sortAiReports(snap.docs.map((d) => normalizeAiReport({ id: d.id, ...d.data() })));
      setAiReports(items);
      saveAiReports(items);
    });

    const calendarEventsCol = collection(db, 'users', effectiveUid, 'calendarEvents');
    const unsubCalendarEvents = onSnapshot(calendarEventsCol, (snap) => {
      const items = normalizeCalendarEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCalendarEvents(items);
      saveCalendarEvents(items);
    });

    return () => {
      unsubInv();
      unsubSwingTrades();
      unsubFamilyMembers();
      unsubGoals();
      unsubLoans();
      unsubCashHistory();
      unsubNetWorthSnapshots();
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
      unsubCalendarEvents();
    };
  }, [effectiveUid]);

  const addExpenseProject = useCallback((projectName) => {
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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

  const addSwingTrade = useCallback((trade) => {
    if (readOnlyRef.current) return null;
    const newItem = normalizeSwingTrade({ ...trade, id: uuidv4() });
    if (user) {
      const ref = doc(db, 'users', user.uid, 'swingTrades', newItem.id);
      setDoc(ref, newItem);
      return;
    }
    setSwingTrades((prev) => {
      const updated = [...prev, newItem];
      saveSwingTrades(updated);
      return updated;
    });
  }, [user]);

  const updateSwingTrade = useCallback((id, trade) => {
    if (readOnlyRef.current) return null;
    const normalizedTrade = normalizeSwingTrade({ ...trade, id, lastUpdated: getTodayDateValue() });
    if (user) {
      const ref = doc(db, 'users', user.uid, 'swingTrades', id);
      updateDoc(ref, { ...normalizedTrade });
      return;
    }
    setSwingTrades((prev) => {
      const updated = prev.map((item) => (item.id === id ? normalizedTrade : item));
      saveSwingTrades(updated);
      return updated;
    });
  }, [user]);

  const deleteSwingTrade = useCallback((id) => {
    if (readOnlyRef.current) return null;
    if (user) {
      const ref = doc(db, 'users', user.uid, 'swingTrades', id);
      deleteDoc(ref);
      return;
    }
    setSwingTrades((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveSwingTrades(updated);
      return updated;
    });
  }, [user]);

  const addFamilyMember = useCallback((member) => {
    if (readOnlyRef.current) return null;
    const trimmedName = String(member?.name || '').trim();
    if (!trimmedName) return null;

    if (trimmedName.toLowerCase() === DEFAULT_FAMILY_MEMBER.name.toLowerCase()) return DEFAULT_FAMILY_MEMBER;

    const existingMember = familyMembers.find((item) => item.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingMember) return existingMember;

    const newMember = {
      id: uuidv4(),
      name: trimmedName,
      relation: String(member?.relation || '').trim(),
      email: String(member?.email || '').trim().toLowerCase(),
    };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'familyMembers', newMember.id);
      setDoc(ref, newMember);
      writeMemberAccess(user.uid, user.displayName || user.email, newMember);
      return newMember;
    }

    setFamilyMembers((prev) => {
      const updated = normalizeFamilyMembers([...prev, newMember]);
      saveFamilyMembers(updated);
      return updated;
    });

    return newMember;
  }, [familyMembers, user]);

  const updateFamilyMember = useCallback((id, member) => {
    if (readOnlyRef.current) return null;
    if (!id || id === DEFAULT_FAMILY_MEMBER.id) return null;

    const currentMember = familyMembers.find((item) => item.id === id);
    if (!currentMember) return null;

    const trimmedName = String(member?.name || '').trim();
    if (!trimmedName) return null;

    const duplicateMember = familyMembers.find(
      (item) => item.id !== id && item.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicateMember) return duplicateMember;

    const nextMember = {
      ...currentMember,
      name: trimmedName,
      relation: member?.relation !== undefined ? String(member.relation || '').trim() : currentMember.relation,
      email: member?.email !== undefined ? String(member.email || '').trim().toLowerCase() : currentMember.email,
    };
    const linkedInvestments = investments.filter((investment) => investment.memberId === id);

    if (user) {
      const memberRef = doc(db, 'users', user.uid, 'familyMembers', id);
      setDoc(memberRef, nextMember, { merge: true });
      if (currentMember.email && currentMember.email !== nextMember.email) {
        removeMemberAccess(currentMember.email);
      }
      writeMemberAccess(user.uid, user.displayName || user.email, nextMember);
      linkedInvestments.forEach((investment) => {
        const investmentRef = doc(db, 'users', user.uid, 'investments', investment.id);
        updateDoc(investmentRef, { memberId: id, memberName: trimmedName });
      });
      return nextMember;
    }

    setFamilyMembers((prev) => {
      const updated = normalizeFamilyMembers(prev.map((item) => (item.id === id ? nextMember : item)));
      saveFamilyMembers(updated);
      return updated;
    });

    if (linkedInvestments.length) {
      setInvestments((prev) => {
        const updated = prev.map((investment) =>
          investment.memberId === id ? normalizeInvestment({ ...investment, memberId: id, memberName: trimmedName }) : investment,
        );
        saveInvestments(updated);
        return updated;
      });
    }

    return nextMember;
  }, [familyMembers, investments, user]);

  const deleteFamilyMember = useCallback((id) => {
    if (readOnlyRef.current) return null;
    if (!id || id === DEFAULT_FAMILY_MEMBER.id) return;

    const fallbackMember = DEFAULT_FAMILY_MEMBER;
    const memberToDelete = familyMembers.find((item) => item.id === id);
    const linkedInvestments = investments.filter((investment) => investment.memberId === id);

    if (user) {
      const memberRef = doc(db, 'users', user.uid, 'familyMembers', id);
      deleteDoc(memberRef);
      if (memberToDelete?.email) removeMemberAccess(memberToDelete.email);
      linkedInvestments.forEach((investment) => {
        const investmentRef = doc(db, 'users', user.uid, 'investments', investment.id);
        updateDoc(investmentRef, { memberId: fallbackMember.id, memberName: fallbackMember.name });
      });
      return;
    }

    setFamilyMembers((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveFamilyMembers(updated);
      return updated;
    });

    if (linkedInvestments.length) {
      setInvestments((prev) => {
        const updated = prev.map((investment) =>
          investment.memberId === id
            ? normalizeInvestment({ ...investment, memberId: fallbackMember.id, memberName: fallbackMember.name })
            : investment,
        );
        saveInvestments(updated);
        return updated;
      });
    }
  }, [familyMembers, investments, user]);

  useEffect(() => {
    if (!user || isReadOnly) return;
    const ownerName = user.displayName || user.email || '';
    familyMembers.forEach((member) => {
      if (member.email) writeMemberAccess(user.uid, ownerName, member);
    });
  }, [familyMembers, isReadOnly, user]);

  const addLoan = useCallback((loan) => {
    if (readOnlyRef.current) return null;
    const newItem = buildLoanForSave({ ...loan, id: uuidv4() });
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
    if (readOnlyRef.current) return null;
    const previousLoan = loans.find((item) => item.id === id);
    const nextLoan = buildLoanForSave({ ...loan, id }, previousLoan);
    if (user) {
      const ref = doc(db, 'users', user.uid, 'loans', id);
      updateDoc(ref, { ...nextLoan });
      return;
    }
    setLoans((prev) => {
      const updated = prev.map((l) => (l.id === id ? nextLoan : l));
      saveLoans(updated);
      return updated;
    });
  }, [loans, user]);

  const deleteLoan = useCallback((id) => {
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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

  const updateInvestment = useCallback((id, investment) => {
    if (readOnlyRef.current) return null;
    const previousInvestment = investments.find((item) => item.id === id);
    // Invested amount (cost basis) and current value (market value) are independent: changing the
    // current value never alters the invested amount. New contributions are recorded only when the
    // user explicitly edits the invested amount.
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

  // Revalue mutual funds linked to an AMFI scheme: currentValue = units × latest NAV.
  const refreshNavPrices = useCallback(async () => {
    if (readOnlyRef.current) return { ok: false, updated: 0, error: 'Read-only access.' };
    const linked = investments.filter((inv) => inv.schemeCode && Number(inv.units) > 0);
    if (!linked.length) return { ok: true, updated: 0, message: 'No funds are linked to a scheme yet.' };
    const today = getTodayDateValue();
    let updated = 0;
    for (const inv of linked) {
      try {
        const { nav, date } = await fetchLatestNav(inv.schemeCode);
        const newValue = Math.round(Number(inv.units) * nav);
        updateInvestment(inv.id, { ...inv, currentValue: newValue, snapshotDate: today, navValue: nav, navDate: date });
        updated += 1;
      } catch {
        // skip funds whose NAV could not be fetched
      }
    }
    return { ok: true, updated, total: linked.length };
  }, [investments, updateInvestment]);

  // Record a fresh contribution (money added) to an existing investment: both the invested amount
  // (cost basis) and current value rise by the contribution as of the given date, which writes a
  // history snapshot so it shows up as an addition in transactions and the monthly review.
  const contributeToInvestment = useCallback((id, { amount, date } = {}) => {
    if (readOnlyRef.current) return null;
    const contribution = Number(amount) || 0;
    if (contribution <= 0) return null;
    const previousInvestment = investments.find((item) => item.id === id);
    if (!previousInvestment) return null;
    updateInvestment(id, {
      investedAmount: (Number(previousInvestment.investedAmount) || 0) + contribution,
      currentValue: (Number(previousInvestment.currentValue) || 0) + contribution,
      snapshotDate: normalizeHistoryDate(date, getTodayDateValue()),
    });
  }, [investments, updateInvestment]);

  const recordRecurringEntryNow = useCallback(async (id, recordedDate = getTodayDateValue()) => {
    if (readOnlyRef.current) return null;
    const entry = recurringEntries.find((item) => item.id === id);
    if (!entry) return null;

    const nextRecordedDate = normalizeHistoryDate(recordedDate, getTodayDateValue());
    if (entry.kind === 'investment') {
      const linkedInvestment = entry.linkedInvestmentId
        ? investments.find((item) => item.id === entry.linkedInvestmentId)
        : null;

      if (linkedInvestment) {
        const amount = Number(entry.amount) || 0;
        // SIP into a NAV-tracked mutual fund: buy units at that day's NAV, then
        // re-value the holding so invested/units/current/returns all stay correct.
        if (linkedInvestment.schemeCode) {
          try {
            const { nav, date } = await fetchNavOnDate(linkedInvestment.schemeCode, nextRecordedDate);
            if (nav > 0) {
              const newUnits = (Number(linkedInvestment.units) || 0) + amount / nav;
              updateInvestment(linkedInvestment.id, {
                units: newUnits,
                investedAmount: (Number(linkedInvestment.investedAmount) || 0) + amount,
                currentValue: Math.round(newUnits * nav),
                navValue: nav,
                navDate: date,
                snapshotDate: nextRecordedDate,
              });
              return markRecurringEntryRecorded(id, nextRecordedDate);
            }
          } catch {
            // NAV unavailable — fall through to a plain invested top-up below.
          }
        }
        updateInvestment(linkedInvestment.id, {
          investedAmount: (Number(linkedInvestment.investedAmount) || 0) + amount,
          currentValue: (Number(linkedInvestment.currentValue) || 0) + amount,
          snapshotDate: nextRecordedDate,
        });
      } else {
        addInvestment({
          name: entry.title,
          type: entry.investmentType,
          investedAmount: entry.amount,
          currentValue: entry.amount,
          snapshotDate: nextRecordedDate,
          notes: entry.notes,
        });
      }
    } else {
      addExpense({
        name: entry.title,
        amount: entry.amount,
        dateTime: `${nextRecordedDate}T09:00`,
        category: entry.categoryValue,
        categoryLabel: entry.categoryLabel,
        subcategory: entry.subcategoryValue,
        subcategoryLabel: entry.subcategoryLabel,
        notes: entry.notes,
      });
    }

    return markRecurringEntryRecorded(id, nextRecordedDate);
  }, [addExpense, addInvestment, investments, markRecurringEntryRecorded, recurringEntries, updateInvestment]);

  // Guard against re-recording the same due entry while its advanced nextDueDate is still in flight
  // to Firestore. Recording triggers async writes (the new investment and the advanced nextDueDate)
  // that round-trip through listeners; until they return, the entry still looks due and the effect
  // can re-fire, which previously created dozens of duplicate records. Keying by id + due date means
  // each occurrence is recorded once, while genuine future occurrences (a new nextDueDate) still run.
  const autoRecordedRef = useRef(new Set());
  useEffect(() => {
    recurringEntries
      .filter((entry) => entry.autoCreate && entry.nextDueDate <= getTodayDateValue())
      .forEach((entry) => {
        const occurrenceKey = `${entry.id}:${entry.nextDueDate}`;
        if (autoRecordedRef.current.has(occurrenceKey)) return;
        autoRecordedRef.current.add(occurrenceKey);
        recordRecurringEntryNow(entry.id, entry.nextDueDate);
      });
  }, [recordRecurringEntryNow, recurringEntries]);

  const addReminder = useCallback((reminder) => {
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
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

  const addCalendarEvent = useCallback((event) => {
    if (readOnlyRef.current) return null;
    const newEvent = normalizeCalendarEvent({ ...event, id: uuidv4() });
    if (!newEvent.title || newEvent.amount <= 0) return null;

    if (user) {
      const ref = doc(db, 'users', user.uid, 'calendarEvents', newEvent.id);
      setDoc(ref, newEvent);
      return newEvent;
    }

    setCalendarEvents((prev) => {
      const updated = normalizeCalendarEvents([...prev, newEvent]);
      saveCalendarEvents(updated);
      return updated;
    });

    return newEvent;
  }, [user]);

  const updateCalendarEvent = useCallback((id, event) => {
    if (readOnlyRef.current) return null;
    const currentEvent = calendarEvents.find((item) => item.id === id);
    const normalizedEvent = normalizeCalendarEvent({ ...currentEvent, ...event, id });
    if (!normalizedEvent.title || normalizedEvent.amount <= 0) return null;

    if (user) {
      const ref = doc(db, 'users', user.uid, 'calendarEvents', id);
      updateDoc(ref, { ...normalizedEvent });
      return normalizedEvent;
    }

    setCalendarEvents((prev) => {
      const updated = normalizeCalendarEvents(prev.map((item) => (item.id === id ? normalizedEvent : item)));
      saveCalendarEvents(updated);
      return updated;
    });

    return normalizedEvent;
  }, [calendarEvents, user]);

  const deleteCalendarEvent = useCallback((id) => {
    if (readOnlyRef.current) return null;
    if (user) {
      const ref = doc(db, 'users', user.uid, 'calendarEvents', id);
      deleteDoc(ref);
      return;
    }

    setCalendarEvents((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveCalendarEvents(updated);
      return updated;
    });
  }, [user]);

  const updateAppSettings = useCallback((nextSettings) => {
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
    const value = Number(amount) || 0;
    const date = getTodayDateValue();
    const nextHistory = appendAmountSnapshot(cashHistory, value, date);
    if (user) {
      const ref = doc(db, 'users', user.uid, 'cashHistory', date);
      setDoc(ref, { date, amount: value });
    }
    setCashState(value);
    setCashHistory(nextHistory);
    saveCash(value);
    saveCashHistory(nextHistory);
  }, [cashHistory, user]);

  const generateMonthlyAiReport = useCallback(async (periodKey, options = {}) => {
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
    if (!user) throw new Error('Sign in is required to ask AI.');
    return requestAiAsk(user, payload);
  }, [user]);

  const parseReceipt = useCallback(async ({ image, mimeType, provider }) => {
    if (readOnlyRef.current) return null;
    if (!user) throw new Error('Sign in is required to scan receipts.');
    const categories = expenseCategories.map((category) => category.value).filter(Boolean);
    const subcategories = expenseSubcategories
      .map((subcategory) => ({ category: subcategory.categoryValue, value: subcategory.value }))
      .filter((entry) => entry.category && entry.value);
    const paymentMethods = EXPENSE_PAYMENT_METHODS.map((method) => method.value);
    return requestReceiptParse(user, {
      image,
      mimeType,
      provider,
      today: getTodayDateValue(),
      categories,
      subcategories,
      paymentMethods,
    });
  }, [user, expenseCategories, expenseSubcategories]);

  const deleteInvestment = useCallback((id) => {
    if (readOnlyRef.current) return null;
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
    if (readOnlyRef.current) return null;
    const normalizedGoal = normalizeGoal({ ...goal, id: uuidv4() });
    const newItem = {
      ...normalizedGoal,
      history: appendAmountSnapshot(normalizedGoal.history, normalizedGoal.currentAmount, goal?.snapshotDate || getTodayDateValue()),
    };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'goals', newItem.id);
      setDoc(ref, newItem);
      return;
    }
    setStoredGoals((prev) => {
      const updated = [...prev, newItem];
      saveGoals(updated);
      return updated;
    });
  }, [user]);

  const updateGoal = useCallback((id, goal) => {
    if (readOnlyRef.current) return null;
    const previousGoal = storedGoals.find((item) => item.id === id);
    const normalizedGoal = normalizeGoal({ ...previousGoal, ...goal, id });
    const nextGoal = {
      ...normalizedGoal,
      history: appendAmountSnapshot(normalizedGoal.history, normalizedGoal.currentAmount, goal?.snapshotDate || getTodayDateValue()),
    };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'goals', id);
      updateDoc(ref, { ...nextGoal });
      return;
    }
    setStoredGoals((prev) => {
      const updated = prev.map((g) => (g.id === id ? nextGoal : g));
      saveGoals(updated);
      return updated;
    });
  }, [storedGoals, user]);

  const deleteGoal = useCallback((id) => {
    if (readOnlyRef.current) return null;
    if (user) {
      const ref = doc(db, 'users', user.uid, 'goals', id);
      deleteDoc(ref);
      return;
    }
    setStoredGoals((prev) => {
      const updated = prev.filter((g) => g.id !== id);
      saveGoals(updated);
      return updated;
    });
  }, [user]);

  const resetToDemo = useCallback(() => {
    if (readOnlyRef.current) return null;
    const demoInv = getDemoInvestments().map((investment) => normalizeInvestment(investment));
    const demoGoals = getDemoGoals().map((goal) => normalizeGoal(goal));
    const demoLoans = getDemoLoans();
    const demoCash = getDemoCash();
    const demoCashHistory = normalizeCashHistory([], demoCash);
    const demoExpenses = getDemoExpenses();
    setInvestments(demoInv);
    setSwingTrades([]);
    saveSwingTrades([]);
    setFamilyMembers([]);
    setStoredGoals(demoGoals);
    setLoans(demoLoans.map((loan) => normalizeLoan(loan)));
    setCashState(demoCash);
    setCashHistory(demoCashHistory);
    setNetWorthSnapshots([]);
    setExpenses(demoExpenses.map(normalizeExpense));
    setExpensePayers([]);
    setExpenseProjects([]);
    saveInvestments(demoInv);
    saveFamilyMembers([]);
    saveGoals(demoGoals);
    saveLoans(demoLoans.map((loan) => normalizeLoan(loan)));
    saveCash(demoCash);
    saveCashHistory(demoCashHistory);
    saveNetWorthSnapshots([]);
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

  // Restore a JSON backup: writes each record back to Firestore by id (merge), for
  // the allow-listed collections only. Additive — it does not delete records that
  // are absent from the backup.
  const restoreBackup = useCallback(async (backup) => {
    if (!user || readOnlyRef.current) return { ok: false, error: 'Restore is available to the account owner only.' };
    if (!backup || backup.version !== BACKUP_VERSION || !backup.collections) {
      return { ok: false, error: 'That is not a valid My Money backup file.' };
    }
    const uid = user.uid;
    let count = 0;
    try {
      for (const coll of BACKUP_COLLECTIONS) {
        const items = backup.collections[coll];
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          if (!item || typeof item !== 'object' || !item.id) continue;
          const { id, ...rest } = item;
          await setDoc(doc(db, 'users', uid, coll, String(id)), rest, { merge: true });
          count += 1;
        }
      }
      if (backup.settings && typeof backup.settings === 'object') {
        await setDoc(doc(db, 'users', uid, 'settings', 'preferences'), normalizeAppSettings(backup.settings), { merge: true });
      }
      return { ok: true, count };
    } catch {
      return { ok: false, error: 'Restore failed partway through. Some records may not have been written.' };
    }
  }, [user]);

  // --- Member-mode scoping --------------------------------------------------
  // When a family member is signed in (read-only), restrict every section to
  // just their own data. Investments, swing trades and goals link by memberId;
  // expenses link only by payer name (payers are a separate id space from
  // family members); loans and cash are household-level, so they are hidden.
  const memberScopeId = household?.mode === 'member' ? (household.memberId || null) : null;
  const memberScopeName = String(household?.memberName || '').trim().toLowerCase();

  const scopedInvestments = memberScopeId ? visibleInvestments : investments;
  const scopedSwingTrades = memberScopeId
    ? swingTrades.filter((trade) => (trade.memberId || DEFAULT_FAMILY_MEMBER.id) === memberScopeId)
    : swingTrades;
  const scopedGoals = memberScopeId ? goals.filter((goal) => goal.memberId === memberScopeId) : goals;
  const scopedExpenses = !memberScopeId
    ? expenses
    : (memberScopeName
        ? expenses.filter((expense) => String(expense.paidByName || '').trim().toLowerCase() === memberScopeName)
        : []);
  const scopedLoans = memberScopeId ? [] : loans;
  const scopedCash = memberScopeId ? 0 : cash;
  const scopedCashHistory = memberScopeId ? [] : cashHistory;
  const scopedNetWorthSnapshots = memberScopeId ? [] : derivedNetWorthSnapshots;

  // --- Owner display name ---------------------------------------------------
  // The owner is the fixed member id 'me'. Its label is editable (Settings) and
  // stored as appSettings.ownerName. Substitute it for the stored 'Me' default
  // wherever the owner's name is displayed, without rewriting saved records.
  const ownerName = String(appSettings?.ownerName || '').trim() || DEFAULT_FAMILY_MEMBER.name;
  const renameOwner = (list, idField, nameField) =>
    ownerName === DEFAULT_FAMILY_MEMBER.name
      ? list
      : list.map((item) =>
          (item?.[idField] || DEFAULT_FAMILY_MEMBER.id) === DEFAULT_FAMILY_MEMBER.id
            ? { ...item, [nameField]: ownerName }
            : item);
  const ownerMemberOptions = ownerName === DEFAULT_FAMILY_MEMBER.name
    ? investmentMemberOptions
    : investmentMemberOptions.map((member) =>
        member.id === DEFAULT_FAMILY_MEMBER.id ? { ...member, name: ownerName } : member);
  const ownerVisibilityMember = investmentVisibilityMember && investmentVisibilityMember.id === DEFAULT_FAMILY_MEMBER.id
    ? { ...investmentVisibilityMember, name: ownerName }
    : investmentVisibilityMember;

  const value = {
    household,
    isReadOnly,
    ownerName,
    investments: renameOwner(scopedInvestments, 'memberId', 'memberName'),
    familyMembers,
    investmentMemberOptions: ownerMemberOptions,
    investmentVisibilityMemberId,
    investmentVisibilityMember: ownerVisibilityMember,
    visibleInvestments: renameOwner(visibleInvestments, 'memberId', 'memberName'),
    swingTrades: renameOwner(scopedSwingTrades, 'memberId', 'memberName'),
    goals: renameOwner(scopedGoals, 'memberId', 'memberName'),
    loans: scopedLoans,
    cash: scopedCash,
    cashHistory: scopedCashHistory,
    netWorthSnapshots: scopedNetWorthSnapshots,
    expenses: renameOwner(scopedExpenses, 'paidById', 'paidByName'),
    expensePayers,
    expenseProjects,
    expenseCategories,
    expenseSubcategories,
    expenseTypes,
    expenseBudgets: displayExpenseBudgets,
    recurringEntries: displayRecurringEntries,
    reminders,
    calendarEvents,
    appSettings,
    theme,
    themePrimary,
    aiReports,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    contributeToInvestment,
    refreshNavPrices,
    addSwingTrade,
    updateSwingTrade,
    deleteSwingTrade,
    addFamilyMember,
    updateFamilyMember,
    deleteFamilyMember,
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
    recordRecurringEntryNow,
    addReminder,
    updateReminder,
    deleteReminder,
    markReminderDone,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    updateAppSettings,
    restoreBackup,
    generateMonthlyAiReport,
    askAi,
    parseReceipt,
    resetToDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
