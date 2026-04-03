import { useMemo, useState } from 'react';
import { BellRing, Check, Pencil, Save, Trash2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import { formatCurrency, formatDate } from '../utils/constants';
import './Reminders.css';

function getTodayDateValue() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 10);
}

function getEmptyForm() {
  return {
    id: '',
    title: '',
    kind: 'payment',
    amount: '',
    frequency: 'monthly',
    nextDueDate: getTodayDateValue(),
    linkedLoanId: '',
    linkedLoanName: '',
    notes: '',
  };
}

function formatFrequencyLabel(frequency) {
  if (frequency === 'once') return 'One time';
  if (frequency === 'quarterly') return 'Quarterly';
  if (frequency === 'yearly') return 'Yearly';
  return 'Monthly';
}

function getReminderStatus(reminder) {
  if (reminder.status === 'completed') return { label: 'Completed', tone: 'success' };

  const today = new Date(`${getTodayDateValue()}T00:00:00`);
  const dueDate = new Date(`${reminder.nextDueDate}T00:00:00`);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)}d`, tone: 'danger' };
  if (diffDays === 0) return { label: 'Due today', tone: 'warning' };
  if (diffDays <= 7) return { label: `Due in ${diffDays}d`, tone: 'warning' };
  return { label: 'Upcoming', tone: 'neutral' };
}

export default function Reminders() {
  const {
    reminders,
    loans,
    addReminder,
    updateReminder,
    deleteReminder,
    markReminderDone,
  } = useApp();
  const [form, setForm] = useState(getEmptyForm);

  const activeReminders = useMemo(
    () => reminders.filter((reminder) => reminder.status !== 'completed'),
    [reminders],
  );
  const completedReminders = useMemo(
    () => reminders.filter((reminder) => reminder.status === 'completed'),
    [reminders],
  );

  const summary = useMemo(() => {
    const dueSoonCount = activeReminders.filter((reminder) => getReminderStatus(reminder).tone !== 'neutral').length;
    const overdueCount = activeReminders.filter((reminder) => getReminderStatus(reminder).tone === 'danger').length;
    const scheduledAmount = activeReminders.reduce((sum, reminder) => sum + reminder.amount, 0);

    return {
      dueSoonCount,
      overdueCount,
      scheduledAmount,
    };
  }, [activeReminders]);

  function handleChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'kind' && value !== 'debt_repayment'
        ? { linkedLoanId: '', linkedLoanName: '' }
        : {}),
    }));
  }

  function handleLoanSelection(loanId) {
    const loan = loans.find((item) => item.id === loanId);

    setForm((prev) => ({
      ...prev,
      linkedLoanId: loan?.id || '',
      linkedLoanName: loan?.name || '',
      title: prev.title || (loan ? `${loan.name} repayment` : ''),
      amount: prev.amount || (loan?.monthlyEMI ? String(loan.monthlyEMI) : ''),
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
      linkedLoanId: form.kind === 'debt_repayment' ? form.linkedLoanId : '',
      linkedLoanName: form.kind === 'debt_repayment' ? form.linkedLoanName : '',
      notes: form.notes.trim(),
    };

    if (!payload.title || payload.amount <= 0) return;

    if (form.id) updateReminder(form.id, payload);
    else addReminder(payload);

    resetForm();
  }

  function handleEdit(reminder) {
    setForm({
      id: reminder.id,
      title: reminder.title,
      kind: reminder.kind,
      amount: String(reminder.amount),
      frequency: reminder.frequency,
      nextDueDate: reminder.nextDueDate,
      linkedLoanId: reminder.linkedLoanId || '',
      linkedLoanName: reminder.linkedLoanName || '',
      notes: reminder.notes || '',
    });
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this reminder?')) return;
    deleteReminder(id);
    if (form.id === id) resetForm();
  }

  return (
    <div className="reminders-page">
      <header className="reminders-header">
        <div>
          <p className="reminders-label">Planner</p>
          <h1 className="reminders-title">Payment Reminders</h1>
          <p className="reminders-subtitle">Stay ahead of bills, EMIs, and debt repayments with one place for due dates.</p>
        </div>
      </header>

      <section className="reminders-summary-grid">
        <article className="reminders-stat reminders-stat-highlight">
          <span className="reminders-stat-label">Active reminders</span>
          <strong>{activeReminders.length}</strong>
          <span>{activeReminders.length ? 'Scheduled payment alerts currently active' : 'No active reminders yet'}</span>
        </article>
        <article className="reminders-stat">
          <span className="reminders-stat-label">Need attention</span>
          <strong>{summary.dueSoonCount}</strong>
          <span>{summary.overdueCount ? `${summary.overdueCount} overdue right now` : 'Nothing overdue right now'}</span>
        </article>
        <article className="reminders-stat">
          <span className="reminders-stat-label">Scheduled amount</span>
          <strong>{formatCurrency(summary.scheduledAmount)}</strong>
          <span>Across all active reminders</span>
        </article>
      </section>

      <section className="reminders-layout">
        <form className="reminders-form" onSubmit={handleSubmit}>
          <div className="reminders-form-head">
            <div>
              <h2>{form.id ? 'Edit reminder' : 'Add reminder'}</h2>
              <p>Use this for card payments, rent, EMIs, or any debt you do not want to miss.</p>
            </div>
            {form.id ? (
              <button type="button" className="reminders-secondary-btn" onClick={resetForm}>
                Reset
              </button>
            ) : null}
          </div>

          <div className="reminders-kind-toggle">
            <button
              type="button"
              className={form.kind === 'payment' ? 'active' : ''}
              onClick={() => handleChange('kind', 'payment')}
            >
              Payment
            </button>
            <button
              type="button"
              className={form.kind === 'debt_repayment' ? 'active' : ''}
              onClick={() => handleChange('kind', 'debt_repayment')}
            >
              Debt Repayment
            </button>
          </div>

          <div className="reminders-form-grid">
            <label className="reminders-field reminders-field-wide">
              <span>Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => handleChange('title', event.target.value)}
                placeholder={form.kind === 'debt_repayment' ? 'e.g., Car loan EMI' : 'e.g., Credit card bill'}
                required
              />
            </label>

            <label className="reminders-field">
              <span>Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => handleChange('amount', event.target.value)}
                placeholder="0"
                required
              />
            </label>

            <label className="reminders-field">
              <span>Next due date</span>
              <input
                type="date"
                value={form.nextDueDate}
                onChange={(event) => handleChange('nextDueDate', event.target.value)}
                required
              />
            </label>

            <label className="reminders-field">
              <span>Frequency</span>
              <select value={form.frequency} onChange={(event) => handleChange('frequency', event.target.value)}>
                <option value="once">One time</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>

            {form.kind === 'debt_repayment' ? (
              <label className="reminders-field">
                <span>Linked loan</span>
                <select value={form.linkedLoanId} onChange={(event) => handleLoanSelection(event.target.value)}>
                  <option value="">Select loan (optional)</option>
                  {loans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="reminders-field reminders-field-wide">
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => handleChange('notes', event.target.value)}
                placeholder="Add context like lender, account, or payment reference"
                rows={3}
              />
            </label>
          </div>

          <div className="reminders-form-actions">
            <button type="submit" className="btn-primary reminders-primary-btn">
              <Save size={16} />
              {form.id ? 'Update Reminder' : 'Add Reminder'}
            </button>
          </div>
        </form>

        <section className="reminders-list-panel">
          <div className="reminders-list-head">
            <div>
              <p className="reminders-list-label">Your reminders</p>
              <h2>Upcoming and completed</h2>
            </div>
            <BellRing size={18} className="reminders-list-icon" />
          </div>

          {reminders.length ? (
            <div className="reminders-list">
              {activeReminders.map((reminder) => {
                const status = getReminderStatus(reminder);

                return (
                  <article key={reminder.id} className={`reminder-card ${status.tone}`}>
                    <div className="reminder-card-top">
                      <div>
                        <div className="reminder-card-title-row">
                          <strong>{reminder.title}</strong>
                          <span className={`reminder-kind-badge ${reminder.kind}`}>
                            {reminder.kind === 'debt_repayment' ? 'Debt' : 'Payment'}
                          </span>
                        </div>
                        <p>{formatFrequencyLabel(reminder.frequency)}</p>
                      </div>
                      <span className={`reminder-status ${status.tone}`}>{status.label}</span>
                    </div>

                    <div className="reminder-card-amount">{formatCurrency(reminder.amount)}</div>

                    <div className="reminder-card-meta">
                      <span>Due: {formatDate(reminder.nextDueDate)}</span>
                      {reminder.linkedLoanName ? <span>Loan: {reminder.linkedLoanName}</span> : null}
                      {reminder.lastCompletedDate ? <span>Last done: {formatDate(reminder.lastCompletedDate)}</span> : null}
                    </div>

                    {reminder.notes ? <p className="reminder-card-notes">{reminder.notes}</p> : null}

                    <div className="reminder-card-actions">
                      <button
                        type="button"
                        className="btn-primary reminders-action-btn"
                        onClick={() => markReminderDone(reminder.id)}
                      >
                        <Check size={16} />
                        Mark done
                      </button>
                      <button type="button" className="reminders-icon-btn" onClick={() => handleEdit(reminder)}>
                        <Pencil size={16} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="reminders-icon-btn danger"
                        onClick={() => handleDelete(reminder.id)}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}

              {completedReminders.length ? (
                <div className="reminders-completed-block">
                  <p className="reminders-list-label">Completed</p>
                  <div className="reminders-list reminders-list-completed">
                    {completedReminders.map((reminder) => (
                      <article key={reminder.id} className="reminder-card success">
                        <div className="reminder-card-top">
                          <div>
                            <div className="reminder-card-title-row">
                              <strong>{reminder.title}</strong>
                              <span className={`reminder-kind-badge ${reminder.kind}`}>
                                {reminder.kind === 'debt_repayment' ? 'Debt' : 'Payment'}
                              </span>
                            </div>
                            <p>{formatFrequencyLabel(reminder.frequency)}</p>
                          </div>
                          <span className="reminder-status success">Completed</span>
                        </div>

                        <div className="reminder-card-meta">
                          <span>Done: {formatDate(reminder.lastCompletedDate || reminder.nextDueDate)}</span>
                          <span>Amount: {formatCurrency(reminder.amount)}</span>
                        </div>

                        {reminder.notes ? <p className="reminder-card-notes">{reminder.notes}</p> : null}

                        <div className="reminder-card-actions">
                          <button type="button" className="reminders-icon-btn" onClick={() => handleEdit(reminder)}>
                            <Pencil size={16} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="reminders-icon-btn danger"
                            onClick={() => handleDelete(reminder.id)}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="reminders-empty">
              <h3>No reminders yet</h3>
              <p>Add your first payment or debt reminder to start tracking upcoming due dates.</p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
