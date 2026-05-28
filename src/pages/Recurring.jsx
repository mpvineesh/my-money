import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Repeat, Save, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  formatCurrency,
  formatDate,
  getExpenseCategoryInfo,
  getExpenseSubcategoryInfo,
  getTypeInfo,
} from '../utils/constants';
import './Recurring.css';

function getTodayDateValue() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 10);
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
    deleteRecurringEntry,
    recordRecurringEntryNow,
  } = useApp();

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
  const dueEntries = useMemo(
    () => recurringEntries.filter((entry) => getDueStatus(entry.nextDueDate).tone !== 'neutral'),
    [recurringEntries],
  );

  function handleEdit(entry) {
    navigate(`/recurring/edit/${entry.id}`);
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this recurring entry?')) return;
    deleteRecurringEntry(id);
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

  function handleRecordDue(entry) {
    recordRecurringEntryNow(entry.id, entry.nextDueDate);
  }

  function handleRecordAllDue() {
    dueEntries.forEach((entry) => recordRecurringEntryNow(entry.id, entry.nextDueDate));
  }

  return (
    <div className="recurring-page">
      <header className="recurring-header">
        <div>
          <p className="recurring-label">Planner</p>
          <h1 className="recurring-title">Recurring Entries</h1>
        </div>
        <button type="button" className="recurring-add-btn" onClick={() => navigate('/recurring/new')}>
          <Plus size={18} />
          <span>New Recurring</span>
        </button>
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

      {dueEntries.length ? (
        <section className="recurring-due-panel">
          <div>
            <p className="recurring-list-label">Due Queue</p>
            <h2>{dueEntries.length} recurring entr{dueEntries.length === 1 ? 'y' : 'ies'} need recording</h2>
          </div>
          <button type="button" className="btn-primary" onClick={handleRecordAllDue}>
            Record all due
          </button>
        </section>
      ) : null}

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
                    {status.tone !== 'neutral' ? (
                      <button type="button" className="recurring-primary-btn recurring-record-due" onClick={() => handleRecordDue(entry)}>
                        <Save size={16} />
                        <span>Record Due</span>
                      </button>
                    ) : null}
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
            <button type="button" className="btn-primary" onClick={() => navigate('/recurring/new')}>
              Add recurring entry
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
