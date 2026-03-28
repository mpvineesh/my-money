import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import {
  formatCurrency,
  formatDateTime,
  getExpenseCategoryInfo,
  getExpenseSubcategoryInfo,
  getPaymentMethodInfo,
} from '../utils/constants';
import './ExpenseCard.css';

export default function ExpenseCard({ expense, returnTo = '' }) {
  const navigate = useNavigate();
  const { expenseCategories, expenseSubcategories } = useApp();
  const category = getExpenseCategoryInfo(expense.category, expenseCategories, expense.categoryLabel);
  const subcategory = getExpenseSubcategoryInfo(
    category.value,
    expense.subcategory,
    expenseSubcategories,
    expense.subcategoryLabel,
  );
  const paymentMethod = getPaymentMethodInfo(expense.paymentMethod);
  const paidByName = expense.paidByName || 'Me';
  const navigationState = returnTo ? { returnTo } : undefined;

  return (
    <button
      type="button"
      className="expense-card"
      onClick={() => navigate(`/expenses/edit/${expense.id}`, navigationState ? { state: navigationState } : undefined)}
    >
      <div className="expense-card-top">
        <div>
          <div className="expense-card-name">{expense.name}</div>
          <div className="expense-card-date">{formatDateTime(expense.dateTime || expense.date)}</div>
        </div>
        <div className="expense-card-amount">{formatCurrency(expense.amount)}</div>
      </div>

      <div className="expense-card-meta">
        {expense.project ? <span className="expense-chip expense-chip-project">{expense.project}</span> : null}
        <span className="expense-chip" style={{ backgroundColor: `${category.color}18`, color: category.color }}>
          {category.label}
        </span>
        {subcategory ? <span className="expense-chip expense-chip-subtle">{subcategory.label}</span> : null}
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
