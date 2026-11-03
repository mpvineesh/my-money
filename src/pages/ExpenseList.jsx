import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import ExpenseCard from '../components/ExpenseCard';
import { formatCurrency, getPaymentMethodInfo } from '../utils/constants';
import { filterExpenses } from '../utils/expenseFilters';
import './ExpenseList.css';

export default function ExpenseList() {
  const { expenses } = useApp();
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(params);
  const returnTo = `/expenses/list${params.size ? `?${params}` : ''}`;
  function setFilter(key, value) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }
  const sorted = filterExpenses(expenses, filters).sort((a, b) => String(b.dateTime || b.date || '').localeCompare(String(a.dateTime || a.date || '')));
  const total = sorted.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const options = (key, label = (value) => value) => [...new Set(expenses.map((expense) => expense[key]).filter(Boolean))].sort().map((value) => <option key={value} value={value}>{label(value)}</option>);
  const categoryLabels = Object.fromEntries(expenses.map((expense) => [expense.category, expense.categoryLabel || expense.category]));
  return (
    <div className="expense-list-page">
      <header className="expense-list-header">
        <div><p className="expense-list-label">Transactions</p><h1 className="expense-list-title">Expenses</h1></div>
        <div className="expense-list-actions">
          <Link to="/expenses" className="expense-list-link">Expense overview</Link>
          <Link to="/expenses/new" state={{ returnTo }} className="btn-primary">Add Expense</Link>
        </div>
      </header>
      <section className="expense-list-filter-bar expense-filter-grid" aria-label="Filter expenses">
        <label className="expense-list-filter expense-search"><span>Search</span><input type="search" placeholder="Name, notes, project, or payer" value={filters.q || ''} onChange={(e) => setFilter('q', e.target.value)} /></label>
        <label className="expense-list-filter"><span>From</span><input type="date" value={filters.from || ''} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} /></label>
        <label className="expense-list-filter"><span>To</span><input type="date" value={filters.to || ''} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} /></label>
        <label className="expense-list-filter"><span>Category</span><select value={filters.category || ''} onChange={(e) => setFilter('category', e.target.value)}><option value="">All categories</option>{options('category', (value) => categoryLabels[value])}</select></label>
        <label className="expense-list-filter"><span>Project</span><select value={filters.project || ''} onChange={(e) => setFilter('project', e.target.value)}><option value="">All projects</option>{options('project')}</select></label>
        <details className="expense-search">
          <summary>More filters</summary>
          <div className="expense-filter-grid">
            <label className="expense-list-filter"><span>Paid by</span><select value={filters.payer || ''} onChange={(e) => setFilter('payer', e.target.value)}><option value="">Anyone</option>{options('paidByName')}</select></label>
            <label className="expense-list-filter"><span>Payment method</span><select value={filters.payment || ''} onChange={(e) => setFilter('payment', e.target.value)}><option value="">All methods</option>{options('paymentMethod', (value) => getPaymentMethodInfo(value).label)}</select></label>
            <label className="expense-list-filter"><span>Minimum ₹</span><input type="number" min="0" step="0.01" value={filters.min || ''} onChange={(e) => setFilter('min', e.target.value)} /></label>
            <label className="expense-list-filter"><span>Maximum ₹</span><input type="number" min="0" step="0.01" value={filters.max || ''} onChange={(e) => setFilter('max', e.target.value)} /></label>
          </div>
        </details>
        {params.size > 0 && <button type="button" className="expense-list-link" onClick={() => setParams({})}>Clear filters</button>}
      </section>
      <p className="form-feedback" role="status">{sorted.length} expenses · {formatCurrency(total)}{params.size ? ' matching your filters' : ' across all dates'}</p>
      {sorted.length ? (
        <section className="expense-list-panel" aria-label="Matching expenses"><div className="expense-list-cards">
          {sorted.map((expense) => <ExpenseCard key={expense.id} expense={expense} returnTo={returnTo} />)}
        </div></section>
      ) : (
        <div className="expense-list-empty"><h2>{expenses.length ? 'No matching expenses' : 'No expenses yet'}</h2><p>{expenses.length ? 'Change or clear your filters to see more transactions.' : 'Add your first expense to start tracking spending.'}</p>
          {expenses.length ? <button className="btn-primary" onClick={() => setParams({})}>Clear filters</button> : <Link to="/expenses/new" state={{ returnTo }} className="btn-primary">Add Expense</Link>}
        </div>
      )}
    </div>
  );
}
