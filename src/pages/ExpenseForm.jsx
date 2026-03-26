import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, X } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  DEFAULT_EXPENSE_PAYER,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  getExpenseCategoryInfo,
  getPaymentMethodInfo,
} from '../utils/constants';
import './InvestmentForm.css';

const ADD_OTHER_PAYER_VALUE = '__add_other_payer__';

function getCurrentDateTimeValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toDateTimeInputValue(value) {
  if (!value) return getCurrentDateTimeValue();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  return String(value).slice(0, 16);
}

function getInitialForm(expenses, id) {
  if (id) {
    const expense = expenses.find((item) => item.id === id);
    if (expense) {
      const category = getExpenseCategoryInfo(expense.category);
      const paymentMethod = getPaymentMethodInfo(expense.paymentMethod);

      return {
        name: expense.name || '',
        amount: expense.amount || '',
        dateTime: toDateTimeInputValue(expense.dateTime || expense.date),
        category: category.value,
        paidById: expense.paidById || DEFAULT_EXPENSE_PAYER.id,
        paidByName: expense.paidByName || DEFAULT_EXPENSE_PAYER.name,
        paymentMethod: paymentMethod.value,
        paymentMethodOther:
          paymentMethod.value === 'other'
            ? expense.paymentMethodOther || expense.paymentMethodLabel || expense.paymentMethod || ''
            : '',
        notes: expense.notes || '',
      };
    }
  }

  return {
    name: '',
    amount: '',
    dateTime: getCurrentDateTimeValue(),
    category: 'other',
    paidById: DEFAULT_EXPENSE_PAYER.id,
    paidByName: DEFAULT_EXPENSE_PAYER.name,
    paymentMethod: 'upi',
    paymentMethodOther: '',
    notes: '',
  };
}

export default function ExpenseForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const {
    expenses,
    expensePayers,
    addExpense,
    updateExpense,
    deleteExpense,
    addExpensePayer,
  } = useApp();

  const [form, setForm] = useState(() => getInitialForm(expenses, id));
  const [showDelete, setShowDelete] = useState(false);
  const [showPayerModal, setShowPayerModal] = useState(false);
  const [payerName, setPayerName] = useState('');

  const payerOptions = useMemo(() => {
    const options = new Map([[DEFAULT_EXPENSE_PAYER.id, DEFAULT_EXPENSE_PAYER]]);

    expensePayers.forEach((payer) => {
      options.set(payer.id, payer);
    });

    expenses.forEach((expense) => {
      if (expense.paidByName) {
        options.set(expense.paidById || `payer:${expense.paidByName.toLowerCase().replace(/\s+/g, '-')}`, {
          id: expense.paidById || `payer:${expense.paidByName.toLowerCase().replace(/\s+/g, '-')}`,
          name: expense.paidByName,
        });
      }
    });

    if (form.paidByName) {
      options.set(form.paidById || `payer:${form.paidByName.toLowerCase().replace(/\s+/g, '-')}`, {
        id: form.paidById || `payer:${form.paidByName.toLowerCase().replace(/\s+/g, '-')}`,
        name: form.paidByName,
      });
    }

    return [...options.values()].sort((left, right) => {
      if (left.id === DEFAULT_EXPENSE_PAYER.id) return -1;
      if (right.id === DEFAULT_EXPENSE_PAYER.id) return 1;
      return left.name.localeCompare(right.name);
    });
  }, [expensePayers, expenses, form.paidById, form.paidByName]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePayerSelection = (value) => {
    if (value === ADD_OTHER_PAYER_VALUE) {
      setShowPayerModal(true);
      return;
    }

    const selectedPayer = payerOptions.find((payer) => payer.id === value) || DEFAULT_EXPENSE_PAYER;
    setForm((prev) => ({
      ...prev,
      paidById: selectedPayer.id,
      paidByName: selectedPayer.name,
    }));
  };

  const handleAddPayer = () => {
    const trimmedName = payerName.trim();
    if (!trimmedName) return;

    const existingPayer = payerOptions.find((payer) => payer.name.toLowerCase() === trimmedName.toLowerCase());
    const nextPayer = existingPayer || addExpensePayer({ name: trimmedName });
    if (!nextPayer) return;

    setForm((prev) => ({
      ...prev,
      paidById: nextPayer.id,
      paidByName: nextPayer.name,
    }));
    setPayerName('');
    setShowPayerModal(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      name: form.name.trim(),
      amount: Number(form.amount) || 0,
      dateTime: form.dateTime,
      date: form.dateTime.slice(0, 10),
      paymentMethodOther: form.paymentMethod === 'other' ? form.paymentMethodOther.trim() : '',
      notes: form.notes.trim(),
    };

    if (isEdit) {
      updateExpense(id, payload);
    } else {
      addExpense(payload);
    }

    navigate('/expenses');
  };

  const handleDelete = () => {
    deleteExpense(id);
    navigate('/expenses');
  };

  const isValid =
    form.name.trim() &&
    form.amount &&
    form.category &&
    form.dateTime &&
    form.paidByName.trim() &&
    (form.paymentMethod !== 'other' || form.paymentMethodOther.trim());

  return (
    <div className="form-page">
      <header className="form-header">
        <button type="button" className="form-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-title">{isEdit ? 'Edit Expense' : 'Add Expense'}</h1>
        <div style={{ width: 36 }} />
      </header>

      <form onSubmit={handleSubmit} className="form-body">
        <div className="form-group">
          <label className="form-label">Expense Name *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., Grocery shopping"
            value={form.name}
            onChange={(event) => handleChange('name', event.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={form.amount}
              onChange={(event) => handleChange('amount', event.target.value)}
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date & Time *</label>
            <input
              type="datetime-local"
              className="form-input"
              value={form.dateTime}
              onChange={(event) => handleChange('dateTime', event.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Paid By *</label>
            <div className="form-inline-select">
              <select
                className="form-input"
                value={form.paidById}
                onChange={(event) => handlePayerSelection(event.target.value)}
              >
                {payerOptions.map((payer) => (
                  <option key={payer.id} value={payer.id}>
                    {payer.name}
                  </option>
                ))}
                <option value={ADD_OTHER_PAYER_VALUE}>Add other payer...</option>
              </select>
              <button type="button" className="form-inline-btn" onClick={() => setShowPayerModal(true)}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method *</label>
            <select
              className="form-input"
              value={form.paymentMethod}
              onChange={(event) => handleChange('paymentMethod', event.target.value)}
            >
              {EXPENSE_PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.paymentMethod === 'other' ? (
          <div className="form-group">
            <label className="form-label">Payment Method Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Wallet, cheque"
              value={form.paymentMethodOther}
              onChange={(event) => handleChange('paymentMethodOther', event.target.value)}
              required
            />
          </div>
        ) : null}

        <div className="form-group">
          <label className="form-label">Category *</label>
          <div className="form-type-grid">
            {EXPENSE_CATEGORIES.map((category) => (
              <button
                key={category.value}
                type="button"
                className={`form-type-btn ${form.category === category.value ? 'active' : ''}`}
                style={
                  form.category === category.value
                    ? { backgroundColor: `${category.color}15`, color: category.color, borderColor: `${category.color}50` }
                    : {}
                }
                onClick={() => handleChange('category', category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input form-textarea"
            placeholder="Any notes..."
            value={form.notes}
            onChange={(event) => handleChange('notes', event.target.value)}
            rows={3}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary form-submit-btn" disabled={!isValid}>
            <Save size={18} />
            {isEdit ? 'Update Expense' : 'Add Expense'}
          </button>

          {isEdit ? (
            <>
              {!showDelete ? (
                <button type="button" className="btn-danger-outline" onClick={() => setShowDelete(true)}>
                  <Trash2 size={16} />
                  Delete
                </button>
              ) : (
                <div className="delete-confirm">
                  <p>Are you sure? This cannot be undone.</p>
                  <div className="delete-confirm-actions">
                    <button type="button" className="btn-danger" onClick={handleDelete}>
                      Yes, Delete
                    </button>
                    <button type="button" className="btn-cancel" onClick={() => setShowDelete(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </form>

      {showPayerModal ? (
        <div className="form-modal-backdrop" onClick={() => setShowPayerModal(false)}>
          <div className="form-modal" onClick={(event) => event.stopPropagation()}>
            <div className="form-modal-header">
              <div>
                <p className="form-modal-label">Paid By</p>
                <h2 className="form-modal-title">Add other payer</h2>
              </div>
              <button type="button" className="form-modal-close" onClick={() => setShowPayerModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Akhil"
                value={payerName}
                onChange={(event) => setPayerName(event.target.value)}
                autoFocus
              />
            </div>

            <div className="form-modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowPayerModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary form-modal-submit" onClick={handleAddPayer}>
                Save payer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
