import { Link } from 'react-router-dom';
import { useApp } from '../context/useApp';
import ExpenseCard from '../components/ExpenseCard';
import './Investments.css';

export default function Expenses() {
  const { expenses } = useApp();

  return (
    <div className="investments-page">
      <header className="inv-page-header">
        <div>
          <p className="inv-page-label">My Money</p>
          <h1 className="inv-page-title">Expenses</h1>
        </div>
        <Link to="/expenses/new" className="btn-primary">Add Expense</Link>
      </header>

      {expenses && expenses.length > 0 ? (
        <div className="inv-cards-list">
          {expenses.map((e) => <ExpenseCard key={e.id} expense={e} />)}
        </div>
      ) : (
        <div className="inv-empty">
          <p>No expenses yet. Add one to start tracking your spending.</p>
          <div style={{ textAlign: 'center' }}>
            <Link to="/expenses/new" className="btn-primary">Add Expense</Link>
          </div>
        </div>
      )}
    </div>
  );
}
