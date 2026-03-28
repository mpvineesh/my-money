import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Repeat, Save, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  INVESTMENT_TYPES,
  formatCurrency,
  formatDate,
  getExpenseCategoryInfo,
  getExpenseCategoryOptions,
  getExpenseSubcategories,
  getExpenseSubcategoryInfo,
  getTypeInfo,
} from '../utils/constants';
import './Recurring.css';

function getTodayDateValue() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 10);
}

function getEmptyForm() {
  return {
    id: '',
    title: '',
    kind: 'expense',
    amount: '',
    frequency: 'monthly',
    nextDueDate: getTodayDateValue(),
    categoryValue: 'other',
    subcategoryValue: '',
    investmentType: INVESTMENT_TYPES[1]?.value || INVESTMENT_TYPES[0].value,
    notes: '',
  };
}

function getMonthlyEquivalent(entry) {
  if (entry.frequency === 'quarterly') return entry.amount / 3;
  if (entry.frequency === 'yearly') return entry.amount / 12;
  return entry.amount;
}

function formatFrequencyLabel(frequency) {
  if (frequency === 'quarterly') return 'Quarterly';
  if (frequency === 'yearly') return 'Yearly';
  return 'Monthly';
}

function getDueStatus(nextDueDate) {
  const today = new Date(`${getTodayDateValue()}T00:00:00`);
  const dueDate = new Date(`${nextDueDate}T00:00:00`);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return { label: 'Overdue', tone: 'danger' };
  if (diffDays <= 7) return { label: 'Due Soon', tone: 'warning' };
  return { label: 'Upcoming', tone: 'neutral' };
}

export default function Recurring() {
  const navigate = useNavigate();
  const {
    recurringEntries,
    expenseCategories,
    expenseSubcategories,
    addRecurringEntry,
    updateRecurringEntry,
    deleteRecurringEntry,
  } = useApp();
  const [form, setForm] = useState(getEmptyForm);

  const categoryOptions = useMemo(
    () => getExpenseCategoryOptions(expenseCategories),
    [expenseCategories],
  );

  const subcategoryOptions = useMemo(
    () => (form.kind === 'expense' ? getExpenseSubcategories(form.categoryValue, expenseSubcategories) : []),
    [expenseSubcategories, form.categoryValue, form.kind],
  );

  const summary = useMemo(() => {
    const overdueCount = recurringEntries.filter((entry) => getDueStatus(entry.nextDueDate).tone === 'danger').length;
    const dueSoonCount = recurringEntries.filter((entry) => getDueStatus(entry.nextDueDate).tone !== 'neutral').length;
    const estimatedMonthly = recurringEntries.reduce((sum, entry) => sum + getMonthlyEquivalent(entry), 0);

    return {
      overdueCount,
      dueSoonCount,
      estimatedMonthly,
    };
  }, [recurringEntries]);

  function handleChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'kind' && value === 'investment'
        ? { categoryValue: 'other', subcategoryValue: '' }
        : {}),
      ...(field === 'kind' && value === 'expense'
        ? { investmentType: INVESTMENT_TYPES[1]?.value || INVESTMENT_TYPES[0].value }
        : {}),
      ...(field === 'categoryValue' ? { subcategoryValue: '' } : {}),
    }));
  }

  function resetForm() {
    setForm(getEmptyForm());
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
      notes: form.notes.trim(),
    };

    if (!payload.title || payload.amount <= 0) return;

    if (form.id) updateRecurringEntry(form.id, payload);
    else addRecurringEntry(payload);

    resetForm();
  }

  function handleEdit(entry) {
    setForm({
      id: entry.id,
      title: entry.title,
      kind: entry.kind,
      amount: String(entry.amount),
      frequency: entry.frequency,
      nextDueDate: entry.nextDueDate,
      categoryValue: entry.categoryValue || 'other',
      subcategoryValue: entry.subcategoryValue || '',
      investmentType: entry.investmentType || INVESTMENT_TYPES[0].value,
      notes: entry.notes || '',
    });
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this recurring entry?')) return;
    deleteRecurringEntry(id);
    if (form.id === id) resetForm();
  }

  function handleRecordNow(entry) {
    if (entry.kind === 'investment') {
      navigate('/investments/new', {
        state: {
          returnTo: '/recurring',
          sourceRecurringId: entry.id,
          prefill: {
            name: entry.title,
            type: entry.investmentType,
            investedAmount: entry.amount,
            currentValue: entry.amount,
            snapshotDate: entry.nextDueDate,
            notes: entry.notes,
          },
        },
      });
      return;
    }

    navigate('/expenses/new', {
      state: {
        returnTo: '/recurring',
        sourceRecurringId: entry.id,
        prefill: {
          name: entry.title,
          amount: entry.amount,
          dateTime: `${entry.nextDueDate}T09:00`,
          category: entry.categoryValue,
          categoryLabel: entry.categoryLabel,
          subcategory: entry.subcategoryValue,
          subcategoryLabel: entry.subcategoryLabel,
          notes: entry.notes,
        },
      },
    });
  }

  return (
    <div className="recurring-page">
      <header className="recurring-header">
        <div>
          <p className="recurring-label">Planner</p>
          <h1 className="recurring-title">Recurring Entries</h1>
          <p className="recurring-subtitle">Manage repeatable expenses and investments, then record them with one tap.</p>
        </div>
      </header>

      <section className="recurring-summary-grid">
        <article className="recurring-stat recurring-stat-highlight">
          <span className="recurring-stat-label">Active templates</span>
          <strong>{recurringEntries.length}</strong>
          <span>{recurringEntries.length ? 'Recurring planners currently active' : 'No recurring entries yet'}</span>
        </article>
        <article className="recurring-stat">
          <span className="recurring-stat-label">Need attention</span>
          <strong>{summary.dueSoonCount}</strong>
          <span>{summary.overdueCount ? `${summary.overdueCount} overdue right now` : 'Nothing overdue right now'}</span>
        </article>
        <article className="recurring-stat">
          <span className="recurring-stat-label">Monthly impact</span>
          <strong>{formatCurrency(summary.estimatedMonthly)}</strong>
          <span>Estimated monthly equivalent across all templates</span>
        </article>
      </section>

      <section className="recurring-layout">
        <form className="recurring-form" onSubmit={handleSubmit}>
          <div className="recurring-form-head">
            <div>
              <h2>{form.id ? 'Edit recurring entry' : 'Add recurring entry'}</h2>
              <p>Use this for SIPs, subscriptions, rent, insurance, and repeat purchases.</p>
            </div>
            {form.id ? (
              <button type="button" className="recurring-secondary-btn" onClick={resetForm}>
                Reset
              </button>
            ) : null}
          </div>

          <div className="recurring-kind-toggle">
            <button
              type="button"
              className={form.kind === 'expense' ? 'active' : ''}
              onClick={() => handleChange('kind', 'expense')}
            >
              Expense
            </button>
            <button
              type="button"
              className={form.kind === 'investment' ? 'active' : ''}
              onClick={() => handleChange('kind', 'investment')}
            >
              Investment
            </button>
          </div>

          <div className="recurring-form-grid">
            <label className="recurring-field recurring-field-wide">
              <span>Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => handleChange('title', event.target.value)}
                placeholder={form.kind === 'investment' ? 'e.g., Monthly SIP - Index Fund' : 'e.g., House Rent'}
                required
              />
            </label>

            <label className="recurring-field">
              <span>Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => handleChange('amount', event.target.value)}
                placeholder="0.00"
                required
              />
            </label>

            <label className="recurring-field">
              <span>Frequency</span>
              <select value={form.frequency} onChange={(event) => handleChange('frequency', event.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>

            <label className="recurring-field">
              <span>Next due date</span>
              <input
                type="date"
                value={form.nextDueDate}
                onChange={(event) => handleChange('nextDueDate', event.target.value)}
                required
              />
            </label>

            {form.kind === 'expense' ? (
              <>
                <label className="recurring-field">
                  <span>Category</span>
                  <select value={form.categoryValue} onChange={(event) => handleChange('categoryValue', event.target.value)}>
                    {categoryOptions.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="recurring-field">
                  <span>Subcategory</span>
                  <select value={form.subcategoryValue} onChange={(event) => handleChange('subcategoryValue', event.target.value)}>
                    <option value="">Optional</option>
                    {subcategoryOptions.map((subcategory) => (
                      <option key={`${subcategory.categoryValue}:${subcategory.value}`} value={subcategory.value}>
                        {subcategory.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label className="recurring-field recurring-field-wide">
                <span>Investment type</span>
                <select value={form.investmentType} onChange={(event) => handleChange('investmentType', event.target.value)}>
                  {INVESTMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="recurring-field recurring-field-wide">
              <span>Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => handleChange('notes', event.target.value)}
                placeholder="Optional details"
              />
            </label>
          </div>

          <div className="recurring-form-actions">
            <button type="submit" className="btn-primary">
              <Save size={16} />
              <span>{form.id ? 'Update Entry' : 'Save Entry'}</span>
            </button>
          </div>
        </form>

        <section className="recurring-list-panel">
          <div className="recurring-list-head">
            <div>
              <p className="recurring-list-label">Upcoming</p>
              <h2>Planned entries</h2>
            </div>
          </div>

          {recurringEntries.length ? (
            <div className="recurring-list">
              {recurringEntries.map((entry) => {
                const status = getDueStatus(entry.nextDueDate);
                const category = entry.kind === 'expense'
                  ? getExpenseCategoryInfo(entry.categoryValue, expenseCategories, entry.categoryLabel)
                  : null;
                const subcategory = entry.kind === 'expense' && entry.subcategoryValue
                  ? getExpenseSubcategoryInfo(
                      entry.categoryValue,
                      entry.subcategoryValue,
                      expenseSubcategories,
                      entry.subcategoryLabel,
                    )
                  : null;
                const scopeLabel = entry.kind === 'investment'
                  ? getTypeInfo(entry.investmentType).label
                  : [category?.label, subcategory?.label].filter(Boolean).join(' / ') || 'Expense';

                return (
                  <article key={entry.id} className="recurring-card">
                    <div className="recurring-card-top">
                      <div>
                        <div className="recurring-card-title-row">
                          <strong>{entry.title}</strong>
                          <span className={`recurring-status recurring-status-${status.tone}`}>{status.label}</span>
                        </div>
                        <p>{entry.kind === 'investment' ? 'Investment' : 'Expense'} · {formatFrequencyLabel(entry.frequency)} · {scopeLabel}</p>
                      </div>
                      <div className="recurring-card-amount">{formatCurrency(entry.amount)}</div>
                    </div>

                    <div className="recurring-card-meta">
                      <span>Next due: {formatDate(entry.nextDueDate)}</span>
                      <span>Monthly impact: {formatCurrency(getMonthlyEquivalent(entry))}</span>
                    </div>

                    <div className="recurring-card-actions">
                      <button type="button" className="recurring-primary-btn" onClick={() => handleRecordNow(entry)}>
                        <Sparkles size={16} />
                        <span>Record Now</span>
                      </button>
                      <button type="button" className="recurring-icon-btn" onClick={() => handleEdit(entry)}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" className="recurring-icon-btn danger" onClick={() => handleDelete(entry.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="recurring-empty">
              <Repeat size={32} />
              <h3>No recurring entries yet</h3>
              <p>Create your first recurring template to speed up monthly tracking and keep due items visible.</p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
