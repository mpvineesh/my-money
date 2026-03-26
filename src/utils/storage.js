const STORAGE_KEYS = {
  INVESTMENTS: 'myMoney_investments',
  GOALS: 'myMoney_goals',
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
