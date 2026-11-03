import { Link } from 'react-router-dom';
import { Briefcase, CreditCard, ScanLine, Target, Wallet, Repeat } from 'lucide-react';
import './AddPage.css';

const actions = [
  ['/expenses/new', 'Expense', 'Record a purchase or payment', Wallet],
  ['/expenses/scan', 'Scan a bill', 'Review expenses extracted from a receipt', ScanLine],
  ['/investments/new', 'Investment', 'Add stocks, mutual funds, deposits, and more', Briefcase],
  ['/recurring/new', 'Recurring payment', 'Schedule a SIP, rent, or subscription', Repeat],
  ['/goals/add', 'Goal', 'Plan and allocate money toward a target', Target],
  ['/loans/new', 'Loan', 'Track a loan and its outstanding balance', CreditCard],
];
export default function AddPage() {
  return (
    <div className="add-page">
      <header className="add-header">
        <h1 className="add-title">Add to My Money</h1>
        <p className="add-subtitle">Choose what you want to record</p>
      </header>
      <div className="add-options">
        {actions.map(([to, title, description, Icon]) => { const ActionIcon = Icon; return (
          <Link className="add-option-card" style={{ textDecoration: 'none' }} to={to} key={to}>
            <div className="add-option-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-500)' }}><ActionIcon size={24} /></div>
            <div className="add-option-text"><h3>{title}</h3><p>{description}</p></div>
          </Link>
        ); })}
      </div>
    </div>
  );
}
