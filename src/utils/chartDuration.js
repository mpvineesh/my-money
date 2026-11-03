export const CHART_DURATIONS = [
  { value: '6m', label: '6M', months: 6 },
  { value: '1y', label: '1Y', months: 12 },
  { value: 'all', label: 'All', months: null },
];

export function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function validMonth(key) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key) && Number(key.slice(0, 4)) >= 1970;
}

// Windows include the selected end month. All begins at the first recorded month.
export function durationMonths(duration, end = currentMonthKey(), recorded = []) {
  const endKey = validMonth(end) ? end : currentMonthKey();
  const [year, month] = endKey.split('-').map(Number);
  const endIndex = year * 12 + month - 1;
  const option = CHART_DURATIONS.find((item) => item.value === duration) || CHART_DURATIONS[0];
  const first = recorded.filter((key) => validMonth(key) && key <= endKey).sort()[0] || endKey;
  const [firstYear, firstMonth] = first.split('-').map(Number);
  const startIndex = option.months === null ? firstYear * 12 + firstMonth - 1 : endIndex - option.months + 1;
  return Array.from({ length: endIndex - startIndex + 1 }, (_, index) => {
    const value = startIndex + index;
    return `${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, '0')}`;
  });
}

export function filterByDuration(items, duration, dateOf, end = currentMonthKey()) {
  const months = durationMonths(duration, end, items.map((item) => String(dateOf(item) || '').slice(0, 7)));
  const start = months[0];
  const finish = months.at(-1);
  return items.filter((item) => {
    const month = String(dateOf(item) || '').slice(0, 7);
    return validMonth(month) && month >= start && month <= finish;
  });
}

// Aggregate balances only after applying the monthly window; annual points are
// closing balances, not sums of monthly balances.
export function groupBalanceSeries(series, grouping) {
  if (grouping !== 'year') return series;
  const years = new Map();
  series.forEach((point) => {
    const year = point.key.slice(0, 4);
    years.set(year, { ...point, key: year, label: year });
  });
  return [...years.values()];
}
