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

export function getTypeInfo(typeValue) {
  return INVESTMENT_TYPES.find((t) => t.value === typeValue) || INVESTMENT_TYPES[INVESTMENT_TYPES.length - 1];
}

export function getRiskInfo(riskValue) {
  return RISK_LEVELS.find((r) => r.value === riskValue) || RISK_LEVELS[0];
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
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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
