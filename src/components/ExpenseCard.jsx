import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/constants';
import './InvestmentCard.css';

export default function ExpenseCard({ expense }) {
  const navigate = useNavigate();
  const { id, name, amount, date, category, notes } = expense;

  return (
    <div className="inv-card" onClick={() => navigate(`/expenses/edit/${id}`)}>
      <div className="inv-top">
        <div className="inv-title">{name}</div>
        <div className="inv-sub">{date || '-'}</div>
      </div>
      <div className="inv-body">
        <div className="inv-row">
          <div>
            <div className="inv-label">Amount</div>
            <div className="inv-value">{formatCurrency(amount)}</div>
          </div>
          <div>
            <div className="inv-label">Category</div>
            <div className="inv-value">{category || '-'}</div>
          </div>
        </div>

        {notes && <div className="inv-notes">{notes}</div>}
      </div>
    </div>
  );
}
