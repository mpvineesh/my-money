export const INVESTMENT_TYPES = [
  { value: 'stocks', label: 'Stocks', color: '#6366f1' },
  { value: 'mutual_funds', label: 'Mutual Funds', color: '#8b5cf6' },
  { value: 'fixed_deposit', label: 'Fixed Deposit', color: '#06b6d4' },
  { value: 'recurring_deposit', label: 'Recurring Deposit', color: '#14b8a6' },
  { value: 'ppf', label: 'PPF', color: '#f59e0b' },
  { value: 'epf', label: 'EPF / PF', color: '#ef4444' },
  { value: 'nps', label: 'NPS', color: '#ec4899' },
  { value: 'gold', label: 'Gold', color: '#eab308' },
  { value: 'real_estate', label: 'Real Estate', color: '#22c55e' },
  { value: 'bonds', label: 'Bonds', color: '#3b82f6' },
  { value: 'crypto', label: 'Crypto', color: '#f97316' },
  { value: 'insurance', label: 'Insurance / ULIP', color: '#a855f7' },
  { value: 'savings', label: 'Savings Account', color: '#64748b' },
  { value: 'ssy', label: 'SSY', color: '#d946ef' },
  { value: 'elss', label: 'ELSS', color: '#0ea5e9' },
  { value: 'other', label: 'Other', color: '#78716c' },
];

export const RISK_LEVELS = [
  { value: 'low', label: 'Low Risk', color: '#22c55e' },
  { value: 'medium', label: 'Medium Risk', color: '#f59e0b' },
  { value: 'high', label: 'High Risk', color: '#ef4444' },
];

export const EXPENSE_CATEGORIES = [
  { value: 'groceries', label: 'Groceries', color: '#22c55e' },
  { value: 'construction', label: 'House Construction', color: '#e20f5d' },
  { value: 'utilities', label: 'Utilities', color: '#3b82f6' },
  { value: 'transport', label: 'Transport', color: '#f97316' },
  { value: 'food', label: 'Food & Dining', color: '#ec4899' },
  { value: 'shopping', label: 'Shopping', color: '#8b5cf6' },
  { value: 'health', label: 'Health', color: '#ef4444' },
  { value: 'entertainment', label: 'Entertainment', color: '#14b8a6' },
  { value: 'education', label: 'Education', color: '#f59e0b' },
  { value: 'travel', label: 'Travel', color: '#06b6d4' },
  { value: 'rent', label: 'Rent', color: '#6366f1' },
  { value: 'other', label: 'Other', color: '#64748b' },
];

export const EXPENSE_PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

export const DEFAULT_EXPENSE_PAYER = { id: 'me', name: 'Me' };

export function getTypeInfo(typeValue) {
  return INVESTMENT_TYPES.find((t) => t.value === typeValue) || INVESTMENT_TYPES[INVESTMENT_TYPES.length - 1];
}

export function getRiskInfo(riskValue) {
  return RISK_LEVELS.find((r) => r.value === riskValue) || RISK_LEVELS[0];
}

export function getExpenseCategoryInfo(categoryValue) {
  if (!categoryValue) return EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

  const normalized = String(categoryValue).trim().toLowerCase();
  return (
    EXPENSE_CATEGORIES.find((category) => category.value === normalized || category.label.toLowerCase() === normalized) ||
    EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]
  );
}

export function getPaymentMethodInfo(paymentMethod) {
  if (!paymentMethod) return EXPENSE_PAYMENT_METHODS[0];

  const normalized = String(paymentMethod).trim().toLowerCase();
  return (
    EXPENSE_PAYMENT_METHODS.find(
      (method) => method.value === normalized || method.label.toLowerCase() === normalized,
    ) || EXPENSE_PAYMENT_METHODS[EXPENSE_PAYMENT_METHODS.length - 1]
  );
}

export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parsedDate = parseDateValue(dateStr);
  if (!parsedDate) return '-';

  return parsedDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const parsedDate = parseDateValue(dateStr);
  if (!parsedDate) return '-';

  return parsedDate.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function calculateReturns(invested, current) {
  if (!invested || invested === 0) return 0;
  return (((current - invested) / invested) * 100).toFixed(1);
}

export function getDemoInvestments() {
  return [
    {
      id: '1',
      name: 'Nifty 50 Index Fund',
      type: 'mutual_funds',
      investedAmount: 200000,
      currentValue: 248000,
      risk: 'medium',
      startDate: '2024-01-15',
      maturityDate: '',
      interestRate: '',
      notes: 'SIP of ₹10,000/month',
    },
    {
      id: '2',
      name: 'SBI Fixed Deposit',
      type: 'fixed_deposit',
      investedAmount: 500000,
      currentValue: 537500,
      risk: 'low',
      startDate: '2024-06-01',
      maturityDate: '2027-06-01',
      interestRate: 7.5,
      notes: '3 year FD',
    },
    {
      id: '3',
      name: 'Employee PF',
      type: 'epf',
      investedAmount: 350000,
      currentValue: 378000,
      risk: 'low',
      startDate: '2022-04-01',
      maturityDate: '',
      interestRate: 8.15,
      notes: 'Monthly contribution ₹5,000',
    },
    {
      id: '4',
      name: 'PPF Account',
      type: 'ppf',
      investedAmount: 450000,
      currentValue: 498000,
      risk: 'low',
      startDate: '2021-04-01',
      maturityDate: '2036-04-01',
      interestRate: 7.1,
      notes: 'Annual deposit ₹1.5L',
    },
    {
      id: '5',
      name: 'HDFC Mid-Cap Fund',
      type: 'mutual_funds',
      investedAmount: 150000,
      currentValue: 186000,
      risk: 'high',
      startDate: '2024-03-10',
      maturityDate: '',
      interestRate: '',
      notes: 'Lump sum investment',
    },
    {
      id: '6',
      name: 'Sovereign Gold Bond',
      type: 'gold',
      investedAmount: 100000,
      currentValue: 128000,
      risk: 'medium',
      startDate: '2023-11-01',
      maturityDate: '2031-11-01',
      interestRate: 2.5,
      notes: 'SGB Series III',
    },
    {
      id: '7',
      name: 'Reliance Industries',
      type: 'stocks',
      investedAmount: 80000,
      currentValue: 95000,
      risk: 'high',
      startDate: '2024-02-14',
      maturityDate: '',
      interestRate: '',
      notes: '30 shares',
    },
    {
      id: '8',
      name: 'NPS Tier 1',
      type: 'nps',
      investedAmount: 200000,
      currentValue: 226000,
      risk: 'medium',
      startDate: '2023-01-01',
      maturityDate: '',
      interestRate: '',
      notes: 'Aggressive lifecycle fund',
    },
  ];
}

export function getDemoGoals() {
  return [
    {
      id: 'g1',
      name: 'Emergency Fund',
      targetAmount: 500000,
      currentAmount: 380000,
      targetDate: '2026-12-31',
      priority: 'high',
      notes: '6 months expenses',
    },
    {
      id: 'g2',
      name: 'House Down Payment',
      targetAmount: 2500000,
      currentAmount: 950000,
      targetDate: '2029-06-01',
      priority: 'high',
      notes: '20% of ₹1.25 Cr property',
    },
    {
      id: 'g3',
      name: 'Retirement Corpus',
      targetAmount: 50000000,
      currentAmount: 2200000,
      targetDate: '2050-01-01',
      priority: 'medium',
      notes: 'Target ₹5 Cr by 60',
    },
    {
      id: 'g4',
      name: 'Europe Trip',
      targetAmount: 400000,
      currentAmount: 120000,
      targetDate: '2027-05-01',
      priority: 'low',
      notes: 'Family vacation fund',
    },
  ];
}

export function getDemoLoans() {
  return [
    {
      id: 'l1',
      name: 'Car Loan - SBI',
      principal: 600000,
      annualRate: 8.5,
      termMonths: 60,
      startDate: '2023-07-01',
      monthlyEMI: null,
      notes: '5 year auto loan',
    },
    {
      id: 'l2',
      name: 'Personal Loan',
      principal: 150000,
      annualRate: 11.0,
      termMonths: 36,
      startDate: '2024-01-15',
      monthlyEMI: null,
      notes: 'Short term personal loan',
    },
  ];
}

export function getDemoCash() {
  return 50000; // sample cash balance for demo
}

export function getDemoExpenses() {
  return [
    {
      id: 'e1',
      name: 'Grocery Shopping',
      amount: 4200,
      date: '2026-03-15',
      dateTime: '2026-03-15T19:15',
      category: 'groceries',
      paidById: 'me',
      paidByName: 'Me',
      paymentMethod: 'upi',
      notes: 'Weekly essentials',
    },
    {
      id: 'e2',
      name: 'Electricity Bill',
      amount: 3200,
      date: '2026-03-10',
      dateTime: '2026-03-10T09:45',
      category: 'utilities',
      paidById: 'me',
      paidByName: 'Me',
      paymentMethod: 'upi',
      notes: '',
    },
    {
      id: 'e3',
      name: 'Cab to Airport',
      amount: 1450,
      date: '2026-03-18',
      dateTime: '2026-03-18T06:40',
      category: 'transport',
      paidById: 'me',
      paidByName: 'Me',
      paymentMethod: 'card',
      notes: 'Morning airport drop',
    },
    {
      id: 'e4',
      name: 'Dinner with Friends',
      amount: 2800,
      date: '2026-03-20',
      dateTime: '2026-03-20T21:05',
      category: 'food',
      paidById: 'p1',
      paidByName: 'Akhil',
      paymentMethod: 'cash',
      notes: 'Split later',
    },
  ];
}

function parseDateValue(value) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return new Date(value);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
