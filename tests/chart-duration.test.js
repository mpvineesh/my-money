import test from 'node:test';
import assert from 'node:assert/strict';
import { durationMonths, filterByDuration, groupBalanceSeries, currentMonthKey } from '../src/utils/chartDuration.js';
import { buildNetWorthSeries } from '../src/utils/netWorthHistory.js';

test('6M is six consecutive calendar months including the ending month', () => {
  assert.deepEqual(durationMonths('6m', '2026-03'), ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
  assert.deepEqual(durationMonths('unknown', '2026-03'), durationMonths('6m', '2026-03'));
});

test('1Y covers twelve months, even with sparse records', () => {
  const months = durationMonths('1y', '2026-11', ['2019-01', '2026-11']);
  assert.equal(months.length, 12);
  assert.equal(months[0], '2025-12');
  assert.equal(months.at(-1), '2026-11');
});

test('All begins with oldest valid history and excludes future months', () => {
  assert.deepEqual(durationMonths('all', '2026-03', ['0000-00', '2025-13', '2025-12', '2027-01']), ['2025-12', '2026-01', '2026-02', '2026-03']);
  assert.deepEqual(durationMonths('all', '2026-03', []), ['2026-03']);
});

test('expense breakdowns include boundary months and exclude older/future data', () => {
  const expenses = ['2025-12-31', '2026-01-01T00:00', '2026-06-30T23:59', '2026-07-01', ''].map((date) => ({ date }));
  assert.deepEqual(filterByDuration(expenses, '6m', (item) => item.date, '2026-06').map((item) => item.date), ['2026-01-01T00:00', '2026-06-30T23:59']);
  assert.equal(filterByDuration(expenses, 'all', (item) => item.date, '2026-06').length, 3);
});

test('annual aggregation uses closing balance within the selected duration', () => {
  const monthly = [
    { key: '2025-11', netWorth: 100 }, { key: '2025-12', netWorth: 150 },
    { key: '2026-01', netWorth: 200 }, { key: '2026-02', netWorth: 220 },
  ];
  assert.deepEqual(groupBalanceSeries(monthly, 'year'), [{ key: '2025', label: '2025', netWorth: 150 }, { key: '2026', label: '2026', netWorth: 220 }]);
});

test('net-worth durations retain opening balances without showing years-old points in 6M', () => {
  const holdings = [{ id: 'old', history: [{ date: '2020-01-01', investedAmount: 100, currentValue: 150 }] }];
  const series = (duration, group = 'month') => buildNetWorthSeries(holdings, group, duration, [], [], [], [], { cashReserve: 0 });
  assert.equal(series('6m').length, 6);
  assert.equal(series('1y').length, 12);
  assert.equal(series('6m')[0].key, durationMonths('6m')[0]);
  assert.equal(series('6m').at(-1).key, currentMonthKey());
  assert.ok(series('6m').every((point) => point.netWorth === 150));
  assert.equal(series('all')[0].key, '2020-01');
  assert.equal(series('6m', 'year').length, new Set(durationMonths('6m').map((month) => month.slice(0, 4))).size);
});
