// Rule-based spending insights computed entirely from in-memory data (zero reads).
import { getExpenseCategoryInfo } from './constants';

export function expensePeriodKey(expense) {
  const raw = expense?.date || expense?.dateTime || '';
  return String(raw).slice(0, 7); // YYYY-MM
}

function expenseDate(expense) {
  return expense?.date || String(expense?.dateTime || '').slice(0, 10) || '';
}

function median(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Recurring charges visible in expenses that aren't already tracked as recurring entries.
export function detectSubscriptions(expenses, recurringEntries = []) {
  const tracked = new Set(
    (recurringEntries || []).map((entry) => String(entry.title || '').trim().toLowerCase()).filter(Boolean),
  );
  const groups = new Map();
  (expenses || []).forEach((expense) => {
    const name = String(expense.name || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name, entries: [] });
    groups.get(key).entries.push({ amount: Number(expense.amount) || 0, period: expensePeriodKey(expense), date: expenseDate(expense) });
  });

  const subs = [];
  groups.forEach((group, key) => {
    if (tracked.has(key)) return;
    const months = new Set(group.entries.map((e) => e.period).filter(Boolean));
    if (months.size < 2) return;
    const amounts = group.entries.map((e) => e.amount).filter((a) => a > 0);
    if (!amounts.length) return;
    const typical = median(amounts);
    const consistent = amounts.filter((a) => Math.abs(a - typical) <= typical * 0.2).length >= Math.ceil(amounts.length * 0.6);
    if (!consistent) return;
    const lastDate = group.entries.map((e) => e.date).filter(Boolean).sort().pop() || '';
    subs.push({ name: group.name, typicalAmount: Math.round(typical), months: months.size, lastDate });
  });
  return subs.sort((a, b) => b.typicalAmount - a.typicalAmount);
}

// This month vs last month total + the categories that grew the most.
export function monthlyComparison(expenses, categories = []) {
  const periods = [...new Set((expenses || []).map(expensePeriodKey).filter(Boolean))].sort();
  const current = periods[periods.length - 1] || '';
  const previous = periods[periods.length - 2] || '';

  const sumFor = (period) => (expenses || [])
    .filter((e) => expensePeriodKey(e) === period)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const byCategory = (period) => {
    const map = new Map();
    (expenses || []).filter((e) => expensePeriodKey(e) === period).forEach((e) => {
      const cat = e.category || 'other';
      map.set(cat, (map.get(cat) || 0) + (Number(e.amount) || 0));
    });
    return map;
  };

  const curTotal = current ? sumFor(current) : 0;
  const prevTotal = previous ? sumFor(previous) : 0;
  const curCat = current ? byCategory(current) : new Map();
  const prevCat = previous ? byCategory(previous) : new Map();

  const movers = [];
  curCat.forEach((amount, cat) => {
    const prev = prevCat.get(cat) || 0;
    movers.push({
      category: cat,
      label: getExpenseCategoryInfo(cat, categories, cat).label,
      current: Math.round(amount),
      previous: Math.round(prev),
      delta: Math.round(amount - prev),
    });
  });
  movers.sort((a, b) => b.delta - a.delta);

  return {
    current,
    previous,
    currentTotal: Math.round(curTotal),
    previousTotal: Math.round(prevTotal),
    deltaPct: prevTotal ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : null,
    topMovers: movers.filter((m) => m.delta > 0).slice(0, 3),
  };
}

// Unusually large expenses this month (≥ 3× the typical expense, and at least ₹1,000).
export function largeTransactions(expenses, limit = 4) {
  const amounts = (expenses || []).map((e) => Number(e.amount) || 0).filter((a) => a > 0);
  if (amounts.length < 5) return [];
  const med = median(amounts);
  const threshold = Math.max(med * 3, 1000);
  const periods = [...new Set((expenses || []).map(expensePeriodKey).filter(Boolean))].sort();
  const current = periods[periods.length - 1] || '';

  return (expenses || [])
    .filter((e) => expensePeriodKey(e) === current && (Number(e.amount) || 0) >= threshold)
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, limit)
    .map((e) => ({
      name: e.name || 'Expense',
      amount: Math.round(Number(e.amount) || 0),
      date: expenseDate(e),
      multiple: med ? Math.round(((Number(e.amount) || 0) / med) * 10) / 10 : null,
    }));
}
