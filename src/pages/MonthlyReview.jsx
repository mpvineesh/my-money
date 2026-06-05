import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellRing, Briefcase, CalendarRange, Repeat, Target, Wallet } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import NativePickerField from '../components/NativePickerField';
import { useApp } from '../context/useApp';
import { formatCurrency, formatCompactCurrency, getExpenseCategoryInfo, isValidDateValue } from '../utils/constants';
import './MonthlyReview.css';

const TREND_MONTHS = 12;

function formatMonthShort(periodKey) {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) return periodKey;
  const [year, month] = periodKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

// Build a rolling window of month keys ending at (and including) endKey.
function buildMonthRange(endKey, count) {
  if (!/^\d{4}-\d{2}$/.test(endKey)) return [];
  const [year, month] = endKey.split('-').map(Number);
  const keys = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(year, month - 1 - offset, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

// New invested principal per month = increase in cumulative invested principal from the prior month.
// Each history entry's investedAmount is the cumulative total as of that snapshot, so we carry the
// latest snapshot forward and difference consecutive months. An extra leading month seeds the
// baseline so the first visible month reflects money invested before the window too.
function buildMonthlyInvestmentSeries(investments, endKey, count) {
  const perInvestment = investments.map((investment) => {
    const byMonth = new Map();
    (investment.history || []).forEach((entry) => {
      if (!isValidDateValue(entry.date)) return;
      byMonth.set(entry.date.slice(0, 7), Number(entry.investedAmount) || 0);
    });
    return [...byMonth.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  });

  const cumulativeAsOf = (snapshots, monthKey) => {
    let value = 0;
    for (const [key, amount] of snapshots) {
      if (key <= monthKey) value = amount;
      else break;
    }
    return value;
  };

  const months = buildMonthRange(endKey, count + 1);
  const totals = months.map((monthKey) =>
    perInvestment.reduce((sum, snapshots) => sum + cumulativeAsOf(snapshots, monthKey), 0),
  );

  return months.slice(1).map((monthKey, index) => ({
    key: monthKey,
    label: formatMonthShort(monthKey),
    invested: totals[index + 1] - totals[index],
    cumulative: totals[index + 1],
  }));
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="monthly-review-trend-tooltip">
      <strong>{point.label}</strong>
      <span>Invested: {formatCurrency(point.invested)}</span>
      <span>Total invested: {formatCurrency(point.cumulative)}</span>
    </div>
  );
}

function getCurrentMonthValue() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 7);
}

function getPeriodKey(value) {
  const normalizedValue = String(value || '').trim();
  return /^\d{4}-\d{2}/.test(normalizedValue) ? normalizedValue.slice(0, 7) : '';
}

function formatMonthLabel(periodKey) {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) return 'Selected month';
  const [year, month] = periodKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function getDaysUntil(dateValue) {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`);
  const dueDate = new Date(`${dateValue}T00:00:00`);
  return Math.round((dueDate.getTime() - today.getTime()) / 86400000);
}

export default function MonthlyReview() {
  const {
    expenses,
    expenseBudgets,
    expenseCategories,
    expenseSubcategories,
    investments,
    goals,
    recurringEntries,
    reminders,
  } = useApp();
  const [periodKey, setPeriodKey] = useState(getCurrentMonthValue);

  const review = useMemo(() => {
    const monthlyExpenses = expenses.filter((expense) => getPeriodKey(expense.dateTime || expense.date) === periodKey);
    const totalSpent = monthlyExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    const categoryMap = new Map();

    monthlyExpenses.forEach((expense) => {
      const category = getExpenseCategoryInfo(expense.category, expenseCategories, expense.categoryLabel);
      const current = categoryMap.get(category.value) || { label: category.label, amount: 0, count: 0 };
      categoryMap.set(category.value, {
        ...current,
        amount: current.amount + (Number(expense.amount) || 0),
        count: current.count + 1,
      });
    });

    const categoryBreakdown = [...categoryMap.values()].sort((left, right) => right.amount - left.amount);
    const monthlyInvestmentAdds = investments.filter((investment) =>
      getPeriodKey(investment.startDate || investment.lastUpdated) === periodKey
      || (investment.history || []).some((entry) => getPeriodKey(entry.date) === periodKey),
    );
    const investedThisMonth = monthlyInvestmentAdds.reduce((sum, investment) => {
      // Each history entry's investedAmount is the cumulative invested principal as of that
      // snapshot date, not a per-period contribution. New money invested during the month is the
      // increase from the latest snapshot before the month to the latest snapshot within it.
      const history = [...(investment.history || [])].sort((left, right) => left.date.localeCompare(right.date));
      const monthEntries = history.filter((entry) => getPeriodKey(entry.date) === periodKey);
      if (!monthEntries.length) return sum;
      const endOfMonthInvested = Number(monthEntries[monthEntries.length - 1].investedAmount) || 0;
      const priorEntry = [...history].reverse().find((entry) => getPeriodKey(entry.date) < periodKey);
      const baselineInvested = priorEntry ? (Number(priorEntry.investedAmount) || 0) : 0;
      return sum + (endOfMonthInvested - baselineInvested);
    }, 0);

    const budgetItems = expenseBudgets
      .filter((budget) => budget.periodKey === periodKey)
      .map((budget) => {
        const category = getExpenseCategoryInfo(budget.categoryValue, expenseCategories, budget.categoryLabel);
        const actual = monthlyExpenses.reduce((sum, expense) => {
          if (expense.category !== budget.categoryValue) return sum;
          if (!budget.subcategoryValue) return sum + (Number(expense.amount) || 0);
          return expense.subcategory === budget.subcategoryValue ? sum + (Number(expense.amount) || 0) : sum;
        }, 0);
        const subcategory = expenseSubcategories.find(
          (item) => item.categoryValue === budget.categoryValue && item.value === budget.subcategoryValue,
        );

        return {
          ...budget,
          label: subcategory ? `${category.label} / ${subcategory.label}` : category.label,
          actual,
          remaining: budget.amount - actual,
        };
      });
    const overBudgetItems = budgetItems.filter((budget) => budget.remaining < 0);
    const dueRecurring = recurringEntries.filter((entry) => getPeriodKey(entry.nextDueDate) === periodKey || getDaysUntil(entry.nextDueDate) <= 7);
    const dueReminders = reminders.filter(
      (reminder) => reminder.status !== 'completed' && (getPeriodKey(reminder.nextDueDate) === periodKey || getDaysUntil(reminder.nextDueDate) <= 7),
    );
    const totalGoalTarget = goals.reduce((sum, goal) => sum + (Number(goal.targetAmount) || 0), 0);
    const totalGoalCurrent = goals.reduce((sum, goal) => sum + (Number(goal.currentAmount) || 0), 0);
    const investmentTrend = buildMonthlyInvestmentSeries(investments, periodKey, TREND_MONTHS);

    return {
      monthlyExpenses,
      totalSpent,
      categoryBreakdown,
      monthlyInvestmentAdds,
      investedThisMonth,
      investmentTrend,
      budgetItems,
      overBudgetItems,
      dueRecurring,
      dueReminders,
      totalGoalTarget,
      totalGoalCurrent,
    };
  }, [expenseBudgets, expenseCategories, expenseSubcategories, expenses, goals, investments, periodKey, recurringEntries, reminders]);

  const goalProgress = review.totalGoalTarget > 0 ? Math.min(100, Math.round((review.totalGoalCurrent / review.totalGoalTarget) * 100)) : 0;

  return (
    <div className="monthly-review-page">
      <header className="monthly-review-header">
        <div>
          <p className="monthly-review-label">Review</p>
          <h1>Monthly Review</h1>
          <p>Expenses, budgets, investments, goals, and due items for {formatMonthLabel(periodKey)}.</p>
        </div>
        <NativePickerField
          type="month"
          className="monthly-review-picker"
          value={periodKey}
          max={getCurrentMonthValue()}
          onChange={(event) => setPeriodKey(event.target.value)}
          displayValue={formatMonthLabel(periodKey)}
          ariaLabel="Review month"
          leading={<CalendarRange size={18} />}
        />
      </header>

      <section className="monthly-review-grid">
        <article className="monthly-review-stat highlight">
          <Wallet size={20} />
          <span>Spent</span>
          <strong>{formatCurrency(review.totalSpent)}</strong>
          <p>{review.monthlyExpenses.length} expense{review.monthlyExpenses.length === 1 ? '' : 's'}</p>
        </article>
        <article className="monthly-review-stat">
          <Briefcase size={20} />
          <span>Invested</span>
          <strong>{formatCurrency(review.investedThisMonth)}</strong>
          <p>{review.monthlyInvestmentAdds.length} updated holding{review.monthlyInvestmentAdds.length === 1 ? '' : 's'}</p>
        </article>
        <article className={`monthly-review-stat ${review.overBudgetItems.length ? 'danger' : ''}`}>
          <AlertTriangle size={20} />
          <span>Budget alerts</span>
          <strong>{review.overBudgetItems.length}</strong>
          <p>{review.budgetItems.length ? `${review.budgetItems.length} budgets tracked` : 'No budgets set'}</p>
        </article>
        <article className="monthly-review-stat">
          <Target size={20} />
          <span>Goal coverage</span>
          <strong>{goalProgress}%</strong>
          <p>{formatCurrency(review.totalGoalCurrent)} of {formatCurrency(review.totalGoalTarget)}</p>
        </article>
      </section>

      <section className="monthly-review-trend">
        <div className="monthly-review-panel-head">
          <h2>Monthly investment</h2>
          <Link to="/investments">Open investments</Link>
        </div>
        <p className="monthly-review-trend-caption">
          New money invested each month over the last {TREND_MONTHS} months, ending {formatMonthLabel(periodKey)}.
        </p>
        {review.investmentTrend.some((point) => point.invested !== 0) ? (
          <div className="monthly-review-trend-chart">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={review.investmentTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => formatCompactCurrency(value)}
                  width={52}
                />
                <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(15, 118, 110, 0.06)' }} />
                <Bar dataKey="invested" fill="#0f766e" radius={[6, 6, 0, 0]} maxBarSize={36} name="Invested" />
                <Line type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2} dot={false} name="Total invested" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="monthly-review-empty">No investment activity recorded in this period.</p>
        )}
      </section>

      <section className="monthly-review-panels">
        <article className="monthly-review-panel">
          <div className="monthly-review-panel-head">
            <h2>Top spending</h2>
            <Link to="/expenses">Open expenses</Link>
          </div>
          {review.categoryBreakdown.length ? (
            review.categoryBreakdown.slice(0, 5).map((category) => (
              <div key={category.label} className="monthly-review-row">
                <span>{category.label}</span>
                <strong>{formatCurrency(category.amount)}</strong>
              </div>
            ))
          ) : (
            <p className="monthly-review-empty">No expenses recorded for this month.</p>
          )}
        </article>

        <article className="monthly-review-panel">
          <div className="monthly-review-panel-head">
            <h2>Budget status</h2>
            <Link to="/expenses">Review budgets</Link>
          </div>
          {review.budgetItems.length ? (
            review.budgetItems.slice(0, 5).map((budget) => (
              <div key={budget.id} className={`monthly-review-row ${budget.remaining < 0 ? 'danger' : ''}`}>
                <span>{budget.label}</span>
                <strong>{budget.remaining < 0 ? `Over ${formatCurrency(Math.abs(budget.remaining))}` : `${formatCurrency(budget.remaining)} left`}</strong>
              </div>
            ))
          ) : (
            <p className="monthly-review-empty">No budget targets for this month.</p>
          )}
        </article>

        <article className="monthly-review-panel">
          <div className="monthly-review-panel-head">
            <h2>Due queue</h2>
            <Link to="/recurring">Open recurring</Link>
          </div>
          <div className="monthly-review-due">
            <Repeat size={18} />
            <span>{review.dueRecurring.length} recurring due or upcoming</span>
          </div>
          <div className="monthly-review-due">
            <BellRing size={18} />
            <span>{review.dueReminders.length} reminders due or upcoming</span>
          </div>
        </article>
      </section>
    </div>
  );
}
