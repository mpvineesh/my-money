import { Link } from 'react-router-dom';
import { useApp } from '../context/useApp';
import LoanCard from '../components/LoanCard';
import './Investments.css';

export default function Loans() {
  const { loans } = useApp();

  return (
    <div className="investments-page">
      <header className="inv-page-header">
        <div>
          <p className="inv-page-label">My Money</p>
          <h1 className="inv-page-title">Loans</h1>
        </div>
        <Link to="/loans/new" className="btn-primary">Add Loan</Link>
      </header>

      {loans && loans.length > 0 ? (
        <div className="inv-cards-list">
          {loans.map((l) => <LoanCard key={l.id} loan={l} />)}
        </div>
      ) : (
        <div className="inv-empty">
          <p>No loans yet. Add one to track EMIs and balances.</p>
          <div style={{ textAlign: 'center' }}>
            <Link to="/loans/new" className="btn-primary">Add Loan</Link>
          </div>
        </div>
      )}
    </div>
  );
}
