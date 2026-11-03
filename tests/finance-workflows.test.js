import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNetWorthSeries, getDaysUntil } from '../src/utils/netWorthHistory.js';
import { filterExpenses } from '../src/utils/expenseFilters.js';

const openingHolding = { id: 'long-term', history: [{ date: '2020-01-01', investedAmount: 900, currentValue: 1000 }] };
const activity = { id: 'active', history: Array.from({ length: 8 }, (_, index) => ({ date: `2021-${String(index + 1).padStart(2, '0')}-01`, investedAmount: 100, currentValue: 100 + index })) };

test('short chart windows retain holdings and cash established before the window', () => {
  const series = buildNetWorthSeries([openingHolding, activity], 'month', '6m', [{ date: '2020-01-01', amount: 50 }], [{ id: 'loan', history: [{ date: '2020-01-01', amount: 200 }], outstandingBalance: 0 }], [], [], { cashReserve: 0 });
  assert.equal(series.length, 6);
  assert.ok(series.every((point) => point.portfolioValue >= 1100));
  assert.ok(series.every((point) => point.cashReserve === 50));
  assert.ok(series.every((point) => point.loanPrincipal === 200));
  assert.equal(series.at(-1).netWorth, 957);
});

test('saved monthly net-worth snapshots override reconstructed estimates', () => {
  const series = buildNetWorthSeries([openingHolding], 'month', 'all', [], [], [], [{ periodKey: '2020-01', netWorth: 450, portfolioValue: 500 }], { cashReserve: 0 });
  assert.equal(series.find((point) => point.key === '2020-01').netWorth, 450);
});

test('invalid snapshot dates are excluded and empty portfolios stay finite', () => {
  const series = buildNetWorthSeries([], 'month', 'all', [], [], [], [{ periodKey: '0000-00', netWorth: 999 }], { cashReserve: 0 });
  assert.equal(series.length, 1);
  assert.equal(series[0].netWorth, 0);
  assert.ok(!series.some((point) => point.key === '0000-00'));
});

test('overdue dates stay negative and upcoming dates stay positive', () => {
  const date = new Date();
  const iso = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  assert.equal(getDaysUntil(iso(date)), 0);
  date.setDate(date.getDate() - 3);
  assert.equal(getDaysUntil(iso(date)), -3);
  date.setDate(date.getDate() + 5);
  assert.equal(getDaysUntil(iso(date)), 2);
});

const expenses = [
  { id: '1', name: 'Groceries', amount: 500, dateTime: '2026-11-01T08:00', category: 'food', paidByName: 'Me', paymentMethod: 'upi', project: 'Home' },
  { id: '2', name: 'Lunch', amount: 200, dateTime: '2026-11-30T23:59', category: 'food', paidByName: 'Sam', paymentMethod: 'cash' },
  { id: '3', name: 'Groceries', amount: 700, dateTime: '2026-10-31T23:59', category: 'food', paidByName: 'Me', paymentMethod: 'upi' },
];
test('expense date ranges include the full final day', () => {
  assert.deepEqual(filterExpenses(expenses, { from: '2026-11-01', to: '2026-11-30' }).map((item) => item.id), ['1', '2']);
});
test('expense search and filters combine without mutating source records', () => {
  const result = filterExpenses(expenses, { q: '  GROCERIES ', payer: 'Me', payment: 'upi', category: 'food', project: 'Home', min: '500', max: '500' });
  assert.deepEqual(result.map((item) => item.id), ['1']);
  assert.equal(expenses.length, 3);
  assert.equal(filterExpenses(expenses, { q: 'absent' }).length, 0);
});

test('backdated SIP buys units at historical NAV but preserves latest valuation', async () => {
  const { recurringInvestmentChanges } = await import('../src/utils/recurringInvestment.js');
  const changes = recurringInvestmentChanges({ id: 'fund', schemeCode: '123', investedAmount: 1000, units: 100, navValue: 20, navDate: '2026-11-01' }, 500, '2026-10-01', { nav: 10, date: '2026-10-01' });
  assert.equal(changes.units, 150);
  assert.equal(changes.investedAmount, 1500);
  assert.equal(changes.currentValue, 3000);
  assert.equal(changes.navDate, '2026-11-01');
});

test('missing NAV and invalid contributions cannot silently change a fund balance', async () => {
  const { recurringInvestmentChanges } = await import('../src/utils/recurringInvestment.js');
  const fund = { id: 'fund', schemeCode: '123', investedAmount: 1000, units: 100 };
  assert.throws(() => recurringInvestmentChanges(fund, 500, '2026-11-01', null), /NAV/);
  assert.throws(() => recurringInvestmentChanges(fund, -1, '2026-11-01', { nav: 10 }), /positive/);
  assert.equal(fund.units, 100);
});
