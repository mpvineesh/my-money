import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellRing, Briefcase, CalendarRange, Repeat, Target, Wallet } from 'lucide-react';
import NativePickerField from '../components/NativePickerField';
import { useApp } from '../context/useApp';
import { formatCurrency, getExpenseCategoryInfo } from '../utils/constants';
import './MonthlyReview.css';

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
      const monthHistory = (investment.history || []).filter((entry) => getPeriodKey(entry.date) === periodKey);
      if (monthHistory.length) return sum + monthHistory.reduce((entrySum, entry) => entrySum + (Number(entry.investedAmount) || 0), 0);
      return sum + (Number(investment.investedAmount) || 0);
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

    return {
      monthlyExpenses,
      totalSpent,
      categoryBreakdown,
      monthlyInvestmentAdds,
      investedThisMonth,
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
