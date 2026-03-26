const STORAGE_KEYS = {
  INVESTMENTS: 'myMoney_investments',
  GOALS: 'myMoney_goals',
  LOANS: 'myMoney_loans',
  CASH: 'myMoney_cash',
  EXPENSES: 'myMoney_expenses',
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
