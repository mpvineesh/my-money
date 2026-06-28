import { useNavigate } from 'react-router-dom';
import { BellRing, Briefcase, CalendarDays, CandlestickChart, Layers, PiggyBank, ScanLine, Target, TrendingUp, Wallet, Repeat } from 'lucide-react';
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
          <div className="add-option-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-500)' }}>
            <Briefcase size={28} />
          </div>
          <div className="add-option-text">
            <h3>New Investment</h3>
            <p>Stocks, FD, PF, PPF, Gold, NPS, Bonds & more</p>
          </div>
        </button>

        <button className="add-option-card" onClick={() => navigate('/mutual-funds')}>
          <div className="add-option-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-500)' }}>
            <Layers size={28} />
          </div>
          <div className="add-option-text">
            <h3>Mutual Funds</h3>
            <p>Manage funds with units & SIP — total value updates from live NAV</p>
          </div>
        </button>

        <button className="add-option-card" onClick={() => navigate('/stocks')}>
          <div className="add-option-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-500)' }}>
            <CandlestickChart size={28} />
          </div>
          <div className="add-option-text">
            <h3>Stocks</h3>
            <p>Track individual stocks with quantity and value — consolidated into one total</p>
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

        <button className="add-option-card" onClick={() => navigate('/expenses/scan')}>
          <div className="add-option-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-500)' }}>
            <ScanLine size={28} />
          </div>
          <div className="add-option-text">
            <h3>Scan a Bill</h3>
            <p>Snap a receipt or handwritten list — AI extracts the expense(s) for review</p>
          </div>
        </button>

        <button className="add-option-card" onClick={() => navigate('/recurring')}>
          <div className="add-option-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>
            <Repeat size={28} />
          </div>
          <div className="add-option-text">
            <h3>Recurring Entry</h3>
            <p>Set up SIPs, rent, subscriptions, insurance, and other repeatable entries</p>
          </div>
        </button>

        <button className="add-option-card" onClick={() => navigate('/reminders')}>
          <div className="add-option-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-600)' }}>
            <BellRing size={28} />
          </div>
          <div className="add-option-text">
            <h3>Reminder</h3>
            <p>Track bill payments and debt repayments before they become overdue</p>
          </div>
        </button>

        <button className="add-option-card" onClick={() => navigate('/calendar')}>
          <div className="add-option-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
            <CalendarDays size={28} />
          </div>
          <div className="add-option-text">
            <h3>Money Calendar</h3>
            <p>See SIPs, EMIs, insurance, taxes, salary, dividends & FD maturities on a timeline</p>
          </div>
        </button>

        <button className="add-option-card" onClick={() => navigate('/retirement')}>
          <div className="add-option-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <PiggyBank size={28} />
          </div>
          <div className="add-option-text">
            <h3>Retirement Planner</h3>
            <p>Find your target corpus and the monthly SIP needed to retire comfortably</p>
          </div>
        </button>
      </div>
    </div>
  );
}
