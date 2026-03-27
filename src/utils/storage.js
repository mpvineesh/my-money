const STORAGE_KEYS = {
  INVESTMENTS: 'myMoney_investments',
  GOALS: 'myMoney_goals',
  LOANS: 'myMoney_loans',
  CASH: 'myMoney_cash',
  EXPENSES: 'myMoney_expenses',
  EXPENSE_PAYERS: 'myMoney_expense_payers',
  EXPENSE_CATEGORIES: 'myMoney_expense_categories',
  EXPENSE_SUBCATEGORIES: 'myMoney_expense_subcategories',
  EXPENSE_TYPES: 'myMoney_expense_types',
  AI_REPORTS: 'myMoney_ai_reports',
};

export function loadInvestments() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.INVESTMENTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveInvestments(investments) {
  localStorage.setItem(STORAGE_KEYS.INVESTMENTS, JSON.stringify(investments));
}

export function loadGoals() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.GOALS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveGoals(goals) {
  localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
}

export function loadLoans() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOANS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLoans(loans) {
  localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
}

export function loadCash() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CASH);
    return data ? Number(JSON.parse(data)) : 0;
  } catch {
    return 0;
  }
}

export function saveCash(amount) {
  try {
    localStorage.setItem(STORAGE_KEYS.CASH, JSON.stringify(Number(amount) || 0));
  } catch {
    // ignore
  }
}

export function loadExpenses() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveExpenses(expenses) {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  } catch {
    // ignore
  }
}

export function loadExpensePayers() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSE_PAYERS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveExpensePayers(payers) {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSE_PAYERS, JSON.stringify(payers));
  } catch {
    // ignore
  }
}

export function loadExpenseCategories() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSE_CATEGORIES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveExpenseCategories(categories) {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSE_CATEGORIES, JSON.stringify(categories));
  } catch {
    // ignore
  }
}

export function loadExpenseSubcategories() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSE_SUBCATEGORIES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveExpenseSubcategories(subcategories) {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSE_SUBCATEGORIES, JSON.stringify(subcategories));
  } catch {
    // ignore
  }
}

export function loadExpenseTypes() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSE_TYPES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveExpenseTypes(expenseTypes) {
  try {
    localStorage.setItem(STORAGE_KEYS.EXPENSE_TYPES, JSON.stringify(expenseTypes));
  } catch {
    // ignore
  }
}

export function loadAiReports() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.AI_REPORTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAiReports(aiReports) {
  try {
    localStorage.setItem(STORAGE_KEYS.AI_REPORTS, JSON.stringify(aiReports));
  } catch {
    // ignore
  }
}
