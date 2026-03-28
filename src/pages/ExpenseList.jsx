import { useMemo, useState } from 'react';
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
  const [selectedProject, setSelectedProject] = useState('');

  const projectOptions = useMemo(
    () => [...new Set(expenses.map((expense) => String(expense.project || '').trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [expenses],
  );

  const filteredExpenses = useMemo(
    () => (selectedProject ? expenses.filter((expense) => String(expense.project || '').trim() === selectedProject) : expenses),
    [expenses, selectedProject],
  );

  const sortedExpenses = useMemo(
    () => [...filteredExpenses].sort((left, right) => getExpenseTimestamp(right) - getExpenseTimestamp(left)),
    [filteredExpenses],
  );

  const totalSpent = useMemo(
    () => filteredExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
    [filteredExpenses],
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

      {projectOptions.length ? (
        <section className="expense-list-filter-bar">
          <label className="expense-list-filter">
            <span>Project</span>
            <select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}>
              <option value="">All expenses</option>
              {projectOptions.map((project) => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {sortedExpenses.length > 0 ? (
        <>
          <section className="expense-list-summary">
            <article className="expense-list-stat expense-list-stat-highlight">
              <span className="expense-list-stat-label">Recorded expenses</span>
              <strong className="expense-list-stat-value">{sortedExpenses.length}</strong>
              <span>{selectedProject ? `Filtered for ${selectedProject}` : 'All recorded expenses'}</span>
            </article>

            <article className="expense-list-stat">
              <span className="expense-list-stat-label">Total spent</span>
              <strong className="expense-list-stat-value">{formatCurrency(totalSpent)}</strong>
              <span>{selectedProject ? 'For selected project' : 'Across every expense'}</span>
            </article>

            <article className="expense-list-stat">
              <span className="expense-list-stat-label">Tracked projects</span>
              <strong className="expense-list-stat-value">{projectOptions.length}</strong>
              <span>
                {projectOptions.length
                  ? `Examples: ${projectOptions.slice(0, 3).join(', ')}${projectOptions.length > 3 ? '...' : ''}`
                  : 'No projects yet'}
              </span>
            </article>
          </section>

          <section className="expense-list-panel">
            <div className="expense-list-panel-header">
              <p className="expense-list-panel-label">Latest First</p>
              <h2 className="expense-list-panel-title">{selectedProject ? `${selectedProject} expenses` : 'Added expenses'}</h2>
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
          <h2>{selectedProject ? 'No expenses for this project yet' : 'No expenses yet'}</h2>
          <p>{selectedProject ? 'Try another project filter or add a new expense for this project.' : 'Add your first expense to start building the list.'}</p>
          <Link to="/expenses/new" state={{ returnTo: '/expenses/list' }} className="btn-primary">
            Add Expense
          </Link>
        </div>
      )}
    </div>
  );
}
