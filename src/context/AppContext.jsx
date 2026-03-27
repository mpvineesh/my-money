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
  loadExpenseCategories,
  saveExpenseCategories,
  loadExpenseSubcategories,
  saveExpenseSubcategories,
  loadExpenseTypes,
  saveExpenseTypes,
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
  getExpenseTypeInfo,
  getExpenseChartColor,
  getPaymentMethodInfo,
} from '../utils/constants';
import { AppContext } from './AppContextDef';
import { useAuth } from './useAuth';
import { db } from '../firebase';
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { requestMonthlyAiReport } from '../utils/aiServer';

function formatStoredExpenseDateTime(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  return String(value).slice(0, 16);
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

function normalizeExpense(expense, customCategories = [], customSubcategories = [], customExpenseTypes = []) {
  const categoryInfo = getExpenseCategoryInfo(expense?.category, customCategories, expense?.categoryLabel);
  const subcategoryInfo = getExpenseSubcategoryInfo(
    categoryInfo.value,
    expense?.subcategory || expense?.subCategory,
    customSubcategories,
    expense?.subcategoryLabel || expense?.subCategoryLabel,
  );
  const expenseTypeInfo = getExpenseTypeInfo(
    categoryInfo.value,
    subcategoryInfo?.value || '',
    expense?.expenseType || expense?.typeOfExpense,
    customExpenseTypes,
    expense?.expenseTypeLabel || expense?.typeOfExpenseLabel,
  );
  const paymentMethodInfo = getPaymentMethodInfo(expense?.paymentMethod);
  const dateTime = formatStoredExpenseDateTime(expense?.dateTime || expense?.date);
  const paidByName = expense?.paidByName || expense?.paidBy || DEFAULT_EXPENSE_PAYER.name;
  const fallbackPayerId = `payer:${paidByName.toLowerCase().replace(/\s+/g, '-')}`;

  return {
    ...expense,
    amount: Number(expense?.amount) || 0,
    category: categoryInfo.value,
    categoryLabel: categoryInfo.label,
    subcategory: subcategoryInfo?.value || '',
    subcategoryLabel: subcategoryInfo?.label || '',
    expenseType: expenseTypeInfo?.value || '',
    expenseTypeLabel: expenseTypeInfo?.label || '',
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

function normalizeExpensePayers(payers) {
  return payers
    .filter((payer) => payer?.name && payer.id !== DEFAULT_EXPENSE_PAYER.id)
    .map((payer) => ({ id: payer.id, name: payer.name.trim() }))
    .sort((left, right) => left.name.localeCompare(right.name));
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

function loadPersistedAiReports() {
  return sortAiReports(loadAiReports().map(normalizeAiReport));
}

const INITIAL_EXPENSE_CATEGORIES = loadPersistedExpenseCategories();
const INITIAL_EXPENSE_SUBCATEGORIES = loadPersistedExpenseSubcategories();
const INITIAL_EXPENSE_TYPES = loadPersistedExpenseTypes();
const INITIAL_AI_REPORTS = loadPersistedAiReports();

export function AppProvider({ children }) {
  const { user } = useAuth();

  const [investments, setInvestments] = useState(loadPersistedInvestments);
  const [goals, setGoals] = useState(loadPersistedGoals);
  const [loans, setLoans] = useState(loadPersistedLoans);
  const [cash, setCashState] = useState(loadCash);
  const [expenses, setExpenses] = useState(() =>
    loadPersistedExpenses().map((expense) =>
      normalizeExpense(expense, INITIAL_EXPENSE_CATEGORIES, INITIAL_EXPENSE_SUBCATEGORIES, INITIAL_EXPENSE_TYPES),
    ),
  );
  const [expensePayers, setExpensePayers] = useState(() => normalizeExpensePayers(loadExpensePayers()));
  const [expenseCategories, setExpenseCategories] = useState(INITIAL_EXPENSE_CATEGORIES);
  const [expenseSubcategories, setExpenseSubcategories] = useState(INITIAL_EXPENSE_SUBCATEGORIES);
  const [expenseTypes, setExpenseTypes] = useState(INITIAL_EXPENSE_TYPES);
  const [aiReports, setAiReports] = useState(INITIAL_AI_REPORTS);

  useEffect(() => {
    // If user is signed in, listen to their Firestore collections and sync locally
    if (!user) return undefined;

    const invCol = collection(db, 'users', user.uid, 'investments');
    const goalsCol = collection(db, 'users', user.uid, 'goals');
    const loansCol = collection(db, 'users', user.uid, 'loans');

    const unsubInv = onSnapshot(invCol, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
      unsubExpenseCategories();
      unsubExpenseSubcategories();
      unsubExpenseTypes();
      unsubAiReports();
    };
  }, [user]);

  const addInvestment = useCallback((investment) => {
    const newItem = { ...investment, id: uuidv4() };
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
  }, [expenseCategories, expenseSubcategories, expenseTypes, user]);

  const updateExpense = useCallback((id, expense) => {
    const normalizedExpense = normalizeExpense(expense, expenseCategories, expenseSubcategories, expenseTypes);
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
  }, [expenseCategories, expenseSubcategories, expenseTypes, user]);

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

  const updateInvestment = useCallback((id, investment) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'investments', id);
      updateDoc(ref, { ...investment });
      return;
    }
    setInvestments((prev) => {
      const updated = prev.map((inv) => (inv.id === id ? { ...inv, ...investment } : inv));
      saveInvestments(updated);
      return updated;
    });
  }, [user]);

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
    const demoInv = getDemoInvestments();
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
    saveInvestments(demoInv);
    saveGoals(demoGoals);
    saveLoans(demoLoans);
    saveCash(demoCash);
    saveExpenses(demoExpenses.map(normalizeExpense));
    saveExpensePayers([]);
    saveExpenseCategories([]);
    saveExpenseSubcategories([]);
    saveExpenseTypes([]);
    saveAiReports([]);
    setExpenseCategories([]);
    setExpenseSubcategories([]);
    setExpenseTypes([]);
    setAiReports([]);
  }, []);

  const value = {
    investments,
    goals,
    loans,
    cash,
    expenses,
    expensePayers,
    expenseCategories,
    expenseSubcategories,
    expenseTypes,
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
    addExpenseCategory,
    addExpenseSubcategory,
    addExpenseType,
    generateMonthlyAiReport,
    resetToDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
