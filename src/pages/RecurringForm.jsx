import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  INVESTMENT_TYPES,
  formatCurrency,
  getExpenseCategoryOptions,
  getExpenseSubcategories,
} from '../utils/constants';
import './InvestmentForm.css';

function getTodayDateValue() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 10);
}

function getInitialForm(entries, id) {
  const fallbackInvestmentType = INVESTMENT_TYPES[1]?.value || INVESTMENT_TYPES[0].value;

  if (id) {
    const entry = entries.find((item) => item.id === id);
    if (entry) {
      return {
        title: entry.title || '',
        kind: entry.kind || 'expense',
        amount: entry.amount != null ? String(entry.amount) : '',
        frequency: entry.frequency || 'monthly',
        nextDueDate: entry.nextDueDate || getTodayDateValue(),
        categoryValue: entry.categoryValue || 'other',
        subcategoryValue: entry.subcategoryValue || '',
        investmentType: entry.investmentType || fallbackInvestmentType,
        linkedInvestmentId: entry.linkedInvestmentId || '',
        autoCreate: Boolean(entry.autoCreate),
        notes: entry.notes || '',
      };
    }
  }

  return {
    title: '',
    kind: 'expense',
    amount: '',
    frequency: 'monthly',
    nextDueDate: getTodayDateValue(),
    categoryValue: 'other',
    subcategoryValue: '',
    investmentType: fallbackInvestmentType,
    linkedInvestmentId: '',
    autoCreate: false,
    notes: '',
  };
}

export default function RecurringForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const {
    investments,
    recurringEntries,
    expenseCategories,
    expenseSubcategories,
    addRecurringEntry,
    updateRecurringEntry,
    deleteRecurringEntry,
  } = useApp();

  const [form, setForm] = useState(() => getInitialForm(recurringEntries, id));
  const [showDelete, setShowDelete] = useState(false);

  const categoryOptions = useMemo(
    () => getExpenseCategoryOptions(expenseCategories),
    [expenseCategories],
  );

  const subcategoryOptions = useMemo(
    () => (form.kind === 'expense' ? getExpenseSubcategories(form.categoryValue, expenseSubcategories) : []),
    [expenseSubcategories, form.categoryValue, form.kind],
  );

  const investmentOptions = useMemo(
    () => [...investments].sort((left, right) => (Number(right.currentValue) || 0) - (Number(left.currentValue) || 0)),
    [investments],
  );

  function handleChange(field, value) {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
        ...(field === 'kind' && value === 'investment'
          ? { categoryValue: 'other', subcategoryValue: '' }
          : {}),
        ...(field === 'kind' && value === 'expense'
          ? { investmentType: INVESTMENT_TYPES[1]?.value || INVESTMENT_TYPES[0].value, linkedInvestmentId: '' }
          : {}),
        ...(field === 'categoryValue' ? { subcategoryValue: '' } : {}),
      };

      if (field === 'linkedInvestmentId' && value) {
        const linked = investments.find((inv) => inv.id === value);
        if (linked) {
          if (!prev.title.trim()) next.title = linked.name;
          next.investmentType = linked.type || prev.investmentType;
        }
      }

      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      title: form.title.trim(),
      kind: form.kind,
      amount: Number(form.amount) || 0,
      frequency: form.frequency,
      nextDueDate: form.nextDueDate,
      categoryValue: form.kind === 'expense' ? form.categoryValue : '',
      subcategoryValue: form.kind === 'expense' ? form.subcategoryValue : '',
      investmentType: form.kind === 'investment' ? form.investmentType : '',
      linkedInvestmentId: form.kind === 'investment' ? form.linkedInvestmentId : '',
      autoCreate: form.autoCreate,
      notes: form.notes.trim(),
    };

    if (!payload.title || payload.amount <= 0) return;

    if (isEdit) updateRecurringEntry(id, payload);
    else addRecurringEntry(payload);

    navigate('/recurring');
  }

  function handleDelete() {
    deleteRecurringEntry(id);
    navigate('/recurring');
  }

  const isValid = form.title.trim() && Number(form.amount) > 0;

  return (
    <div className="form-page">
      <header className="form-header">
        <button className="form-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-title">{isEdit ? 'Edit Recurring Entry' : 'New Recurring Entry'}</h1>
        <div style={{ width: 36 }} />
      </header>

      <form onSubmit={handleSubmit} className="form-body">
        <div className="form-group">
          <label className="form-label">Type</label>
          <div className="form-risk-row">
            <button
              type="button"
              className={`form-risk-btn ${form.kind === 'expense' ? 'active' : ''}`}
              style={form.kind === 'expense' ? { backgroundColor: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-200)' } : {}}
              onClick={() => handleChange('kind', 'expense')}
            >
              Expense
            </button>
            <button
              type="button"
              className={`form-risk-btn ${form.kind === 'investment' ? 'active' : ''}`}
              style={form.kind === 'investment' ? { backgroundColor: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-200)' } : {}}
              onClick={() => handleChange('kind', 'investment')}
            >
              Investment
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Title *</label>
          <input
            type="text"
            className="form-input"
            value={form.title}
            onChange={(event) => handleChange('title', event.target.value)}
            placeholder={form.kind === 'investment' ? 'e.g., Monthly SIP - Index Fund' : 'e.g., House Rent'}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Amount *</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={form.amount}
                onChange={(event) => handleChange('amount', event.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Frequency</label>
            <select className="form-input" value={form.frequency} onChange={(event) => handleChange('frequency', event.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Next due date *</label>
          <input
            type="date"
            className="form-input"
            value={form.nextDueDate}
            onChange={(event) => handleChange('nextDueDate', event.target.value)}
            required
          />
        </div>

        {form.kind === 'expense' ? (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={form.categoryValue} onChange={(event) => handleChange('categoryValue', event.target.value)}>
                {categoryOptions.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subcategory</label>
              <select className="form-input" value={form.subcategoryValue} onChange={(event) => handleChange('subcategoryValue', event.target.value)}>
                <option value="">Optional</option>
                {subcategoryOptions.map((subcategory) => (
                  <option key={`${subcategory.categoryValue}:${subcategory.value}`} value={subcategory.value}>
                    {subcategory.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Contribute to</label>
              <select
                className="form-input"
                value={form.linkedInvestmentId}
                onChange={(event) => handleChange('linkedInvestmentId', event.target.value)}
              >
                <option value="">Create a new investment each time</option>
                {investmentOptions.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} · {inv.memberName} ({formatCurrency(inv.currentValue)})
                  </option>
                ))}
              </select>
              <p className="form-helper-text">
                {form.linkedInvestmentId
                  ? 'Each recording will add this amount to the selected investment’s invested and current value.'
                  : 'Each recording will create a new investment entry.'}
              </p>
            </div>

            {!form.linkedInvestmentId ? (
              <div className="form-group">
                <label className="form-label">Investment type</label>
                <select className="form-input" value={form.investmentType} onChange={(event) => handleChange('investmentType', event.target.value)}>
                  {INVESTMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </>
        )}

        <div className="form-group">
          <label className="form-label">Automation</label>
          <label className="form-check-row">
            <input
              type="checkbox"
              checked={form.autoCreate}
              onChange={(event) => handleChange('autoCreate', event.target.checked)}
            />
            <span>Auto-create records when due</span>
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input form-textarea"
            rows={3}
            value={form.notes}
            onChange={(event) => handleChange('notes', event.target.value)}
            placeholder="Optional details"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary form-submit-btn" disabled={!isValid}>
            <Save size={18} />
            {isEdit ? 'Update Entry' : 'Add Entry'}
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
                  <p>Delete this recurring entry? This cannot be undone.</p>
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
