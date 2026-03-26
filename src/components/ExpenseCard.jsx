import { useNavigate } from 'react-router-dom';
import {
  formatCurrency,
  formatDateTime,
  getExpenseCategoryInfo,
  getPaymentMethodInfo,
} from '../utils/constants';
import './ExpenseCard.css';

export default function ExpenseCard({ expense }) {
  const navigate = useNavigate();
  const category = getExpenseCategoryInfo(expense.category);
  const paymentMethod = getPaymentMethodInfo(expense.paymentMethod);
  const paidByName = expense.paidByName || 'Me';

  return (
    <button type="button" className="expense-card" onClick={() => navigate(`/expenses/edit/${expense.id}`)}>
      <div className="expense-card-top">
        <div>
          <div className="expense-card-name">{expense.name}</div>
          <div className="expense-card-date">{formatDateTime(expense.dateTime || expense.date)}</div>
        </div>
        <div className="expense-card-amount">{formatCurrency(expense.amount)}</div>
      </div>

      <div className="expense-card-meta">
        <span className="expense-chip" style={{ backgroundColor: `${category.color}18`, color: category.color }}>
          {category.label}
        </span>
        <span className="expense-chip">{paidByName}</span>
        <span className="expense-chip">
          {paymentMethod.value === 'other' && expense.paymentMethodOther
            ? expense.paymentMethodOther
            : paymentMethod.label}
        </span>
      </div>

      {expense.notes ? <p className="expense-card-notes">{expense.notes}</p> : null}
    </button>
  );
}
