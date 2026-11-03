import { durationMonths, groupBalanceSeries } from './chartDuration.js';
import { isValidDateValue } from './constants.js';

function getPeriodKey(dateValue, range) {
  const value = String(dateValue || '');
  if (!isValidDateValue(value)) return '';
  return range === 'year' ? value.slice(0, 4) : value.slice(0, 7);
}

function formatPeriodLabel(periodKey, range) {
  if (!periodKey) return '';
  const [year, month] = periodKey.split('-').map(Number);
  if (!(year >= 1970)) return '';
  if (range === 'year') return periodKey;
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

// Period key for a net-worth snapshot, guarding against legacy/garbage values (e.g. "0000-00") so
// the axis can never render a "0000" tick.
function getSnapshotPeriodKey(snapshot, range) {
  const periodKey = String(snapshot?.periodKey || '').trim();
  const [year, month] = periodKey.split('-').map(Number);
  if (!(/^\d{4}-\d{2}$/.test(periodKey) && year >= 1970 && month >= 1 && month <= 12)) return '';
  return range === 'year' ? periodKey.slice(0, 4) : periodKey;
}

function getCurrentPeriodKey(range) {
  const now = new Date();
  return range === 'year'
    ? String(now.getFullYear())
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayDateValue() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 10);
}

export function getCurrentMonthValue() {
  return getTodayDateValue().slice(0, 7);
}

export function getDaysUntil(dateValue) {
  const today = new Date(`${getTodayDateValue()}T00:00:00`);
  const dueDate = new Date(`${dateValue}T00:00:00`);
  return Math.round((dueDate.getTime() - today.getTime()) / 86400000);
}

export function getExpensePeriodKey(expense) {
  const value = String(expense?.dateTime || expense?.date || '').trim();
  return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : '';
}

function buildAmountSeries(history, range) {
  const periodSnapshots = new Map();
  (history || []).forEach((entry) => {
    const periodKey = getPeriodKey(entry.date, range);
    if (!periodKey) return;
    periodSnapshots.set(periodKey, Number(entry.amount ?? entry.value) || 0);
  });
  return periodSnapshots;
}

export function buildNetWorthSeries(investments, grouping, period, cashHistory, loans, goals, netWorthSnapshots, currentTotals) {
  const range = 'month';
  const investmentSnapshots = investments.map((investment) => {
    const periodSnapshots = new Map();

    (investment.history || []).forEach((entry) => {
      const periodKey = getPeriodKey(entry.date, range);
      if (!periodKey) return;
      periodSnapshots.set(periodKey, {
        investedAmount: Number(entry.investedAmount) || 0,
        currentValue: Number(entry.currentValue) || 0,
      });
    });

    return { id: investment.id, periodSnapshots };
  });
  const cashSnapshots = buildAmountSeries(cashHistory, range);
  const loanSnapshots = loans.map((loan) => ({
    id: loan.id,
    periodSnapshots: buildAmountSeries(loan.history, range),
    fallbackAmount: Number(loan.outstandingBalance ?? loan.principal) || 0,
  }));
  const goalSnapshots = goals.map((goal) => ({
    id: goal.id,
    periodSnapshots: buildAmountSeries(goal.history, range),
    fallbackAmount: Number(goal.currentAmount) || 0,
  }));
  const netWorthSnapshotMap = new Map(
    (netWorthSnapshots || [])
      .map((snapshot) => [getSnapshotPeriodKey(snapshot, range), snapshot])
      .filter(([periodKey]) => periodKey),
  );

  const allPeriodKeys = [...new Set(
    [
      ...investmentSnapshots.flatMap((investment) => [...investment.periodSnapshots.keys()]),
      ...cashSnapshots.keys(),
      ...loanSnapshots.flatMap((loan) => [...loan.periodSnapshots.keys()]),
      ...goalSnapshots.flatMap((goal) => [...goal.periodSnapshots.keys()]),
      ...netWorthSnapshotMap.keys(),
    ],
  )].sort();
  const latestByInvestment = new Map();
  const latestByLoan = new Map();
  const latestByGoal = new Map();
  let latestCash = Number(currentTotals.cashReserve) || 0;
  const visiblePeriodKeys = durationMonths(period, getCurrentPeriodKey('month'), allPeriodKeys);

  const monthlySeries = [...new Set([...allPeriodKeys, ...visiblePeriodKeys])].sort().map((periodKey) => {
    let investedAmount = 0;
    let portfolioValue = 0;

    investmentSnapshots.forEach((investment) => {
      const nextSnapshot = investment.periodSnapshots.get(periodKey);
      if (nextSnapshot) latestByInvestment.set(investment.id, nextSnapshot);

      const activeSnapshot = latestByInvestment.get(investment.id);
      if (!activeSnapshot) return;

      investedAmount += activeSnapshot.investedAmount;
      portfolioValue += activeSnapshot.currentValue;
    });
    const nextCash = cashSnapshots.get(periodKey);
    if (nextCash !== undefined) latestCash = nextCash;

    let loanPrincipal = 0;
    loanSnapshots.forEach((loan) => {
      const nextSnapshot = loan.periodSnapshots.get(periodKey);
      if (nextSnapshot !== undefined) latestByLoan.set(loan.id, nextSnapshot);
      loanPrincipal += latestByLoan.get(loan.id) ?? loan.fallbackAmount;
    });

    let goalSaved = 0;
    goalSnapshots.forEach((goal) => {
      const nextSnapshot = goal.periodSnapshots.get(periodKey);
      if (nextSnapshot !== undefined) latestByGoal.set(goal.id, nextSnapshot);
      goalSaved += latestByGoal.get(goal.id) ?? goal.fallbackAmount;
    });

    const savedSnapshot = netWorthSnapshotMap.get(periodKey);

    return {
      key: periodKey,
      label: formatPeriodLabel(periodKey, range),
      investedAmount: savedSnapshot?.investedAmount ?? investedAmount,
      portfolioValue: savedSnapshot?.portfolioValue ?? portfolioValue,
      cashReserve: savedSnapshot?.cashReserve ?? latestCash,
      loanPrincipal: savedSnapshot?.loanPrincipal ?? loanPrincipal,
      goalSaved: savedSnapshot?.goalSaved ?? goalSaved,
      netWorth: savedSnapshot?.netWorth ?? (portfolioValue + latestCash - loanPrincipal),
    };
  }).filter((point) => visiblePeriodKeys.includes(point.key));
  return groupBalanceSeries(monthlySeries, grouping);
}

