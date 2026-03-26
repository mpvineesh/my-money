import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/constants';
import './InvestmentCard.css';

export default function LoanCard({ loan }) {
  const navigate = useNavigate();
  const { id, name, principal, annualRate, termMonths, monthlyEMI, startDate, notes } = loan;

  return (
    <div className="inv-card" onClick={() => navigate(`/loans/edit/${id}`)}>
      <div className="inv-top">
        <div className="inv-title">{name}</div>
        <div className="inv-sub">{startDate || '-'}</div>
      </div>
      <div className="inv-body">
        <div className="inv-row">
          <div>
            <div className="inv-label">Principal</div>
            <div className="inv-value">{formatCurrency(principal)}</div>
          </div>
          <div>
            <div className="inv-label">EMI</div>
            <div className="inv-value">{formatCurrency(monthlyEMI || 0)}</div>
          </div>
        </div>

        <div className="inv-row">
          <div>
            <div className="inv-label">Rate</div>
            <div className="inv-value">{annualRate ? `${annualRate}%` : '-'}</div>
          </div>
          <div>
            <div className="inv-label">Term</div>
            <div className="inv-value">{termMonths ? `${termMonths} mo` : '-'}</div>
          </div>
        </div>

        {notes && <div className="inv-notes">{notes}</div>}
      </div>
    </div>
  );
}
