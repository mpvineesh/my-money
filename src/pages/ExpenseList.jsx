import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/useApp';
import ExpenseCard from '../components/ExpenseCard';
import { formatCurrency } from '../utils/constants';
import './ExpenseList.css';

function getExpenseTimestamp(expense) {
  const value = expense?.dateTime || expense?.date;
  if (!value) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`).getTime();
  return new Date(value).getTime();
}

export default function ExpenseList() {
  const { expenses } = useApp();

  const sortedExpenses = useMemo(
    () => [...expenses].sort((left, right) => getExpenseTimestamp(right) - getExpenseTimestamp(left)),
    [expenses],
  );

  const totalSpent = useMemo(
    () => expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
    [expenses],
  );

  return (
    <div className="expense-list-page">
      <header className="expense-list-header">
        <div>
          <p className="expense-list-label">Expense Browser</p>
          <h1 className="expense-list-title">All Expenses</h1>
          <p className="expense-list-subtitle">Browse every recorded expense without stretching the analytics page.</p>
        </div>

        <div className="expense-list-actions">
          <Link to="/expenses" className="expense-list-link">
            Back to Dashboard
          </Link>
          <Link to="/expenses/new" state={{ returnTo: '/expenses/list' }} className="btn-primary expense-list-cta">
            Add Expense
          </Link>
        </div>
      </header>

      {sortedExpenses.length > 0 ? (
        <>
          <section className="expense-list-summary">
            <article className="expense-list-stat expense-list-stat-highlight">
              <span className="expense-list-stat-label">Recorded expenses</span>
              <strong className="expense-list-stat-value">{sortedExpenses.length}</strong>
            </article>

            <article className="expense-list-stat">
              <span className="expense-list-stat-label">Total spent</span>
              <strong className="expense-list-stat-value">{formatCurrency(totalSpent)}</strong>
            </article>
          </section>

          <section className="expense-list-panel">
            <div className="expense-list-panel-header">
              <p className="expense-list-panel-label">Latest First</p>
              <h2 className="expense-list-panel-title">Added expenses</h2>
            </div>

            <div className="expense-list-cards">
              {sortedExpenses.map((expense) => (
                <ExpenseCard key={expense.id} expense={expense} returnTo="/expenses/list" />
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="expense-list-empty">
          <h2>No expenses yet</h2>
          <p>Add your first expense to start building the list.</p>
          <Link to="/expenses/new" state={{ returnTo: '/expenses/list' }} className="btn-primary">
            Add Expense
          </Link>
        </div>
      )}
    </div>
  );
}
