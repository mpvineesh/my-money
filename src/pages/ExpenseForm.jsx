import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import './InvestmentForm.css';

function getInitialForm(expenses, id) {
  if (id) {
    const e = expenses.find((x) => x.id === id);
    if (e) {
      return {
        name: e.name || '',
        amount: e.amount || '',
        date: e.date || '',
        category: e.category || '',
        notes: e.notes || '',
      };
    }
  }
  return {
    name: '',
    amount: '',
    date: '',
    category: '',
    notes: '',
  };
}

export default function ExpenseForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { expenses, addExpense, updateExpense, deleteExpense } = useApp();

  const [form, setForm] = useState(() => getInitialForm(expenses, id));
  const [showDelete, setShowDelete] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      amount: Number(form.amount) || 0,
    };

    if (isEdit) {
      updateExpense(id, data);
    } else {
      addExpense(data);
    }
    navigate('/expenses');
  };

  const handleDelete = () => {
    deleteExpense(id);
    navigate('/expenses');
  };

  const isValid = form.name.trim() && form.amount;

  return (
    <div className="form-page">
      <header className="form-header">
        <button className="form-back-btn" onClick={() => navigate(-1)}>
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
            placeholder="e.g., Grocery"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
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
              onChange={(e) => handleChange('amount', e.target.value)}
              required
              min="0"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={form.date}
              onChange={(e) => handleChange('date', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Category</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., Groceries, Transport"
            value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input form-textarea"
            placeholder="Any notes..."
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary form-submit-btn" disabled={!isValid}>
            <Save size={18} />
            {isEdit ? 'Update Expense' : 'Add Expense'}
          </button>

          {isEdit && (
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
          )}
        </div>
      </form>
    </div>
  );
}
