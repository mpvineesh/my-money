import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useApp } from '../context/useApp';
import ExpenseCard from '../components/ExpenseCard';
import { formatCurrency, getExpenseCategoryInfo } from '../utils/constants';
import './Expenses.css';

function getExpenseTimestamp(expense) {
  const value = expense?.dateTime || expense?.date;
  if (!value) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`).getTime();
  return new Date(value).getTime();
}

function ExpenseChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const { name, value } = payload[0];
  return (
    <div className="expense-chart-tooltip">
      <p>{name}</p>
      <strong>{formatCurrency(value)}</strong>
    </div>
  );
}

export default function Expenses() {
  const { expenses } = useApp();

  const sortedExpenses = useMemo(
    () => [...expenses].sort((left, right) => getExpenseTimestamp(right) - getExpenseTimestamp(left)),
    [expenses],
  );

  const totalSpent = useMemo(
    () => expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
    [expenses],
  );

  const categoryBreakdown = useMemo(() => {
    const totals = new Map();

    expenses.forEach((expense) => {
      const category = getExpenseCategoryInfo(expense.category);
      const currentTotal = totals.get(category.value)?.amount || 0;
      totals.set(category.value, {
        key: category.value,
        name: category.label,
        amount: currentTotal + (Number(expense.amount) || 0),
        color: category.color,
      });
    });

    return [...totals.values()].sort((left, right) => right.amount - left.amount);
  }, [expenses]);

  const topCategory = categoryBreakdown[0];

  return (
    <div className="expenses-page">
      <header className="expense-home-header">
        <div>
          <p className="expense-home-label">My Money</p>
          <h1 className="expense-home-title">Expense Home</h1>
          <p className="expense-home-subtitle">Track where your money is going at a glance.</p>
        </div>
        <Link to="/expenses/new" className="btn-primary expense-home-cta">Add Expense</Link>
      </header>

      {sortedExpenses.length > 0 ? (
        <>
          <section className="expense-home-summary">
            <article className="expense-stat-card expense-stat-highlight">
              <span className="expense-stat-label">Total spent</span>
              <strong className="expense-stat-value">{formatCurrency(totalSpent)}</strong>
              <span className="expense-stat-note">Across {sortedExpenses.length} recorded expenses</span>
            </article>

            <article className="expense-stat-card">
              <span className="expense-stat-label">Top category</span>
              <strong className="expense-stat-value">{topCategory?.name || 'Other'}</strong>
              <span className="expense-stat-note">
                {topCategory ? formatCurrency(topCategory.amount) : 'No category data yet'}
              </span>
            </article>
          </section>

          <section className="expense-home-grid">
            <article className="expense-panel expense-chart-panel">
              <div className="expense-panel-header">
                <div>
                  <p className="expense-panel-label">Allocation</p>
                  <h2 className="expense-panel-title">Expense split by category</h2>
                </div>
              </div>

              <div className="expense-chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={68}
                      outerRadius={98}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ExpenseChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="expense-chart-center">
                  <span>Total</span>
                  <strong>{formatCurrency(totalSpent)}</strong>
                </div>
              </div>
            </article>

            <article className="expense-panel">
              <div className="expense-panel-header">
                <div>
                  <p className="expense-panel-label">Breakdown</p>
                  <h2 className="expense-panel-title">Where most of it goes</h2>
                </div>
              </div>

              <div className="expense-breakdown-list">
                {categoryBreakdown.map((item) => (
                  <div key={item.key} className="expense-breakdown-item">
                    <div className="expense-breakdown-main">
                      <span className="expense-breakdown-dot" style={{ backgroundColor: item.color }} />
                      <div>
                        <strong>{item.name}</strong>
                        <span>{totalSpent ? `${Math.round((item.amount / totalSpent) * 100)}% of total` : '0%'}</span>
                      </div>
                    </div>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="expense-list-section">
            <div className="expense-panel-header">
              <div>
                <p className="expense-panel-label">Recent</p>
                <h2 className="expense-panel-title">Latest expenses</h2>
              </div>
            </div>

            <div className="expense-cards-list">
              {sortedExpenses.map((expense) => <ExpenseCard key={expense.id} expense={expense} />)}
            </div>
          </section>
        </>
      ) : (
        <div className="expense-empty-state">
          <h2>No expenses yet</h2>
          <p>Add your first expense to unlock category allocation and recent spending insights.</p>
          <Link to="/expenses/new" className="btn-primary">Add Expense</Link>
        </div>
      )}
    </div>
  );
}
