import { useNavigate } from 'react-router-dom';
import { Briefcase, Target, TrendingUp, Wallet } from 'lucide-react';
import './AddPage.css';

export default function AddPage() {
  const navigate = useNavigate();

  return (
    <div className="add-page">
      <header className="add-header">
        <div className="add-icon-circle">
          <TrendingUp size={28} />
        </div>
        <h1 className="add-title">What would you like to add?</h1>
        <p className="add-subtitle">Track your financial journey</p>
      </header>

      <div className="add-options">
        <button className="add-option-card" onClick={() => navigate('/investments/new')}>
          <div className="add-option-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
            <Briefcase size={28} />
          </div>
          <div className="add-option-text">
            <h3>New Investment</h3>
            <p>Stocks, Mutual Funds, FD, PF, PPF, Gold, NPS, Bonds & more</p>
          </div>
        </button>

        <button className="add-option-card" onClick={() => navigate('/goals/add')}>
          <div className="add-option-icon" style={{ background: '#f0fdf4', color: '#22c55e' }}>
            <Target size={28} />
          </div>
          <div className="add-option-text">
            <h3>New Goal</h3>
            <p>Set financial goals like Emergency Fund, House, Retirement & more</p>
          </div>
        </button>

        <button className="add-option-card" onClick={() => navigate('/expenses/new')}>
          <div className="add-option-icon" style={{ background: '#ecfeff', color: '#0f766e' }}>
            <Wallet size={28} />
          </div>
          <div className="add-option-text">
            <h3>New Expense</h3>
            <p>Record amount, date, paid by, payment method, and category allocation</p>
          </div>
        </button>
      </div>
    </div>
  );
}
