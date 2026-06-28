import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../context/useApp';
import {
  CALENDAR_CATEGORIES,
  getCalendarCategoryInfo,
  guessCalendarCategory,
  formatCurrency,
  formatCompactCurrency,
  isValidDateValue,
} from '../utils/constants';
import {
  Banknote, Coins, Landmark, Repeat, ShieldCheck, CreditCard, FileText, Wallet, CircleDollarSign,
  ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2, ArrowDownRight, ArrowUpRight,
} from 'lucide-react';
import './Calendar.css';

const CATEGORY_ICONS = {
  salary: Banknote,
  dividend: Coins,
  fd_maturity: Landmark,
  sip: Repeat,
  emi: Wallet,
  insurance: ShieldCheck,
  credit_card: CreditCard,
  tax: FileText,
  other: CircleDollarSign,
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_CATEGORY_VALUES = CALENDAR_CATEGORIES.map((category) => category.value);

const pad = (value) => String(value).padStart(2, '0');
const ymd = (year, monthIndex, day) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

function parseYMD(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function addMonthsStr(value, months) {
  const parsed = parseYMD(value);
  if (!parsed) return '';
  const date = new Date(parsed.year, parsed.month - 1 + months, parsed.day);
  return ymd(date.getFullYear(), date.getMonth(), date.getDate());
}

// Does a recurring source (anchored on `anchor`, repeating at `recurrence`) land on `dateStr`?
function occursOn(anchor, recurrence, dateStr, end) {
  const a = parseYMD(anchor);
  const t = parseYMD(dateStr);
  if (!a || !t) return false;
  if (dateStr < anchor) return false;
  if (end && dateStr > end) return false;

  const clampedDay = Math.min(a.day, daysInMonth(t.year, t.month - 1));

  switch (recurrence) {
    case 'once':
      return dateStr === anchor;
    case 'monthly':
      return t.day === clampedDay;
    case 'quarterly': {
      const diff = (t.year - a.year) * 12 + (t.month - a.month);
      return diff >= 0 && diff % 3 === 0 && t.day === clampedDay;
    }
    case 'yearly':
      return t.month === a.month && t.day === clampedDay;
    default:
      return false;
  }
}

function loanEmiAmount(loan) {
  if (loan.monthlyEMI) return Number(loan.monthlyEMI);
  const principal = Number(loan.principal) || 0;
  const rate = (Number(loan.annualRate) || 0) / 12 / 100;
  const months = Number(loan.termMonths) || 0;
  if (!principal || !months) return 0;
  if (rate < 1e-9) return principal / months;
  return (principal * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
}

function todayStr() {
  const now = new Date();
  return ymd(now.getFullYear(), now.getMonth(), now.getDate());
}

const EMPTY_FORM = { id: '', title: '', category: 'salary', amount: '', date: '', recurrence: 'monthly', notes: '' };

export default function Calendar() {
  const {
    investments, loans, recurringEntries, reminders, calendarEvents,
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, isReadOnly,
  } = useApp();

  const today = todayStr();
  const [view, setView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeCats, setActiveCats] = useState(() => new Set(ALL_CATEGORY_VALUES));
  const [form, setForm] = useState(null); // null = closed

  // One flat list of "sources" — each is a one-time or recurring money event. User events
  // are editable; everything else is auto-derived from the rest of the app (read-only).
  const sources = useMemo(() => {
    const list = [];

    calendarEvents.forEach((event) => {
      list.push({
        key: event.id, refId: event.id, title: event.title, category: event.category,
        amount: event.amount, anchor: event.date, recurrence: event.recurrence,
        notes: event.notes, editable: true, origin: 'You',
      });
    });

    recurringEntries.forEach((entry) => {
      const isInvestment = entry.kind === 'investment';
      list.push({
        key: `rec-${entry.id}`, title: entry.title,
        category: isInvestment ? 'sip' : guessCalendarCategory(entry.categoryLabel || entry.title, 'other'),
        amount: entry.amount, anchor: entry.nextDueDate, recurrence: entry.frequency,
        editable: false, origin: 'Recurring',
      });
    });

    reminders.filter((reminder) => reminder.status !== 'completed').forEach((reminder) => {
      list.push({
        key: `rem-${reminder.id}`, title: reminder.title,
        category: reminder.kind === 'debt_repayment' ? 'emi' : guessCalendarCategory(reminder.title, 'other'),
        amount: reminder.amount, anchor: reminder.nextDueDate, recurrence: reminder.frequency,
        editable: false, origin: 'Reminder',
      });
    });

    loans.forEach((loan) => {
      const amount = loanEmiAmount(loan);
      const anchor = loan.startDate || loan.balanceDate;
      if (amount > 0 && isValidDateValue(anchor)) {
        list.push({
          key: `loan-${loan.id}`, title: `${loan.name || 'Loan'} EMI`, category: 'emi',
          amount: Math.round(amount), anchor, recurrence: 'monthly',
          end: loan.termMonths ? addMonthsStr(anchor, Number(loan.termMonths) - 1) : '',
          editable: false, origin: 'Loan',
        });
      }
    });

    investments.forEach((inv) => {
      if (isValidDateValue(inv.maturityDate)) {
        list.push({
          key: `fd-${inv.id}`, title: `${inv.name || 'Deposit'} matures`, category: 'fd_maturity',
          amount: Math.round(Number(inv.currentValue) || Number(inv.investedAmount) || 0),
          anchor: inv.maturityDate, recurrence: 'once', editable: false, origin: 'Maturity',
        });
      }
    });

    return list;
  }, [calendarEvents, recurringEntries, reminders, loans, investments]);

  const eventsOnDate = useCallback((dateStr) => {
    return sources
      .filter((source) => activeCats.has(source.category) && occursOn(source.anchor, source.recurrence, dateStr, source.end))
      .map((source) => {
        const info = getCalendarCategoryInfo(source.category);
        return { ...source, direction: info.direction, color: info.color, categoryLabel: info.label };
      })
      .sort((left, right) => {
        if (left.direction !== right.direction) return left.direction === 'in' ? -1 : 1;
        return right.amount - left.amount;
      });
  }, [sources, activeCats]);

  const month = useMemo(() => {
    const { year, month: monthIndex } = view;
    const dim = daysInMonth(year, monthIndex);
    const lead = new Date(year, monthIndex, 1).getDay();
    const cells = Array.from({ length: lead }, () => null);
    let inflow = 0;
    let outflow = 0;

    for (let day = 1; day <= dim; day += 1) {
      const dateStr = ymd(year, monthIndex, day);
      const events = eventsOnDate(dateStr);
      events.forEach((event) => {
        if (event.direction === 'in') inflow += event.amount;
        else outflow += event.amount;
      });
      cells.push({ day, dateStr, events });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    return { cells, inflow, outflow };
  }, [view, eventsOnDate]);

  const upcoming = useMemo(() => {
    const out = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 60 && out.length < 12; i += 1) {
      const date = new Date(base);
      date.setDate(base.getDate() + i);
      const dateStr = ymd(date.getFullYear(), date.getMonth(), date.getDate());
      eventsOnDate(dateStr).forEach((event) => out.push({ ...event, dateStr }));
    }
    return out.slice(0, 12);
  }, [eventsOnDate]);

  const selectedEvents = useMemo(() => eventsOnDate(selectedDate), [eventsOnDate, selectedDate]);

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const net = month.inflow - month.outflow;

  function shiftMonth(delta) {
    setView((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  function goToday() {
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(today);
  }

  function toggleCat(value) {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const allActive = activeCats.size === ALL_CATEGORY_VALUES.length;

  function openAdd(dateStr) {
    setForm({ ...EMPTY_FORM, date: dateStr || selectedDate || today, recurrence: 'monthly' });
  }

  function openEdit(event) {
    setForm({
      id: event.refId, title: event.title, category: event.category,
      amount: String(event.amount), date: event.anchor, recurrence: event.recurrence, notes: event.notes || '',
    });
  }

  function submitForm(e) {
    e.preventDefault();
    const payload = {
      title: form.title.trim(),
      category: form.category,
      amount: Number(form.amount) || 0,
      date: form.date,
      recurrence: form.recurrence,
      notes: form.notes.trim(),
    };
    if (!payload.title || payload.amount <= 0) return;
    if (form.id) updateCalendarEvent(form.id, payload);
    else addCalendarEvent(payload);
    setForm(null);
  }

  const fmtDay = (dateStr) => {
    const parsed = parseYMD(dateStr);
    if (!parsed) return '';
    return new Date(parsed.year, parsed.month - 1, parsed.day)
      .toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="cal-page">
      <header className="cal-header">
        <div>
          <p className="cal-label">Money Calendar</p>
          <h1 className="cal-title">Calendar</h1>
          <p className="cal-subtitle">SIPs, EMIs, insurance, taxes, salary, dividends & maturities — all on one timeline.</p>
        </div>
        {!isReadOnly ? (
          <button type="button" className="cal-add-btn" onClick={() => openAdd(selectedDate)}>
            <Plus size={16} /> Add event
          </button>
        ) : null}
      </header>

      <div className="cal-summary">
        <div className="cal-stat in">
          <span className="cal-stat-label"><ArrowDownRight size={14} /> Inflow</span>
          <strong>{formatCurrency(month.inflow)}</strong>
        </div>
        <div className="cal-stat out">
          <span className="cal-stat-label"><ArrowUpRight size={14} /> Outflow</span>
          <strong>{formatCurrency(month.outflow)}</strong>
        </div>
        <div className={`cal-stat ${net >= 0 ? 'in' : 'out'}`}>
          <span className="cal-stat-label">Net this month</span>
          <strong>{net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}</strong>
        </div>
      </div>

      <div className="cal-chips">
        <button type="button" className={`cal-chip ${allActive ? 'active' : ''}`} onClick={() => setActiveCats(new Set(ALL_CATEGORY_VALUES))}>
          All
        </button>
        {CALENDAR_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.value];
          const active = activeCats.has(category.value);
          return (
            <button
              key={category.value}
              type="button"
              className={`cal-chip ${active ? 'active' : ''}`}
              onClick={() => toggleCat(category.value)}
              style={active ? { borderColor: category.color, color: category.color, background: `${category.color}14` } : {}}
            >
              <Icon size={13} /> {category.label}
            </button>
          );
        })}
      </div>

      <div className="cal-layout">
        <section className="cal-grid-card">
          <div className="cal-nav">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <div className="cal-nav-center">
              <strong>{monthLabel}</strong>
              <button type="button" className="cal-today-btn" onClick={goToday}>Today</button>
            </div>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
          </div>

          <div className="cal-weekdays">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className="cal-grid">
            {month.cells.map((cell, index) => {
              if (!cell) return <div key={`empty-${index}`} className="cal-cell empty" />;
              const isToday = cell.dateStr === today;
              const isSelected = cell.dateStr === selectedDate;
              const shown = cell.events.slice(0, 2);
              const extra = cell.events.length - shown.length;
              return (
                <button
                  type="button"
                  key={cell.dateStr}
                  className={`cal-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${cell.events.length ? 'has-events' : ''}`}
                  onClick={() => setSelectedDate(cell.dateStr)}
                >
                  <span className="cal-cell-day">{cell.day}</span>
                  <span className="cal-cell-events">
                    {shown.map((event, i) => (
                      <span key={i} className="cal-pill" style={{ background: `${event.color}1a`, color: event.color }}>
                        <i style={{ background: event.color }} />
                        {formatCompactCurrency(event.amount)}
                      </span>
                    ))}
                    {extra > 0 ? <span className="cal-more">+{extra}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="cal-side">
          <div className="cal-day-panel">
            <div className="cal-day-head">
              <h2>{fmtDay(selectedDate)}</h2>
              {!isReadOnly ? (
                <button type="button" className="cal-day-add" onClick={() => openAdd(selectedDate)}><Plus size={14} /> Add</button>
              ) : null}
            </div>
            {selectedEvents.length === 0 ? (
              <p className="cal-empty">No events on this day.</p>
            ) : (
              <ul className="cal-event-list">
                {selectedEvents.map((event, index) => {
                  const Icon = CATEGORY_ICONS[event.category];
                  return (
                    <li key={`${event.key}-${index}`} className="cal-event">
                      <span className="cal-event-icon" style={{ background: `${event.color}1a`, color: event.color }}>
                        <Icon size={16} />
                      </span>
                      <div className="cal-event-main">
                        <span className="cal-event-title">{event.title}</span>
                        <span className="cal-event-meta">{event.categoryLabel} · {event.origin}</span>
                      </div>
                      <div className="cal-event-right">
                        <span className={`cal-event-amount ${event.direction === 'in' ? 'in' : 'out'}`}>
                          {event.direction === 'in' ? '+' : '−'}{formatCurrency(event.amount)}
                        </span>
                        {event.editable && !isReadOnly ? (
                          <span className="cal-event-actions">
                            <button type="button" onClick={() => openEdit(event)} aria-label="Edit"><Pencil size={13} /></button>
                            <button type="button" onClick={() => deleteCalendarEvent(event.refId)} aria-label="Delete"><Trash2 size={13} /></button>
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="cal-upcoming">
            <h2 className="cal-upcoming-title">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="cal-empty">Nothing scheduled in the next 60 days.</p>
            ) : (
              <ul className="cal-upcoming-list">
                {upcoming.map((event, index) => {
                  const Icon = CATEGORY_ICONS[event.category];
                  return (
                    <li key={`${event.key}-${index}`} className="cal-upcoming-item" onClick={() => { setSelectedDate(event.dateStr); }}>
                      <span className="cal-up-date">
                        <strong>{parseYMD(event.dateStr).day}</strong>
                        <em>{new Date(event.dateStr).toLocaleDateString('en-IN', { month: 'short' })}</em>
                      </span>
                      <span className="cal-event-icon sm" style={{ background: `${event.color}1a`, color: event.color }}>
                        <Icon size={14} />
                      </span>
                      <span className="cal-up-title">{event.title}</span>
                      <span className={`cal-event-amount ${event.direction === 'in' ? 'in' : 'out'}`}>
                        {event.direction === 'in' ? '+' : '−'}{formatCompactCurrency(event.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {form ? (
        <div className="cal-modal-backdrop" role="presentation" onClick={() => setForm(null)}>
          <div className="cal-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <h2>{form.id ? 'Edit event' : 'Add event'}</h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <form onSubmit={submitForm} className="cal-form">
              <label className="cal-field">
                <span>Title</span>
                <input type="text" value={form.title} placeholder="e.g. Salary credit" autoFocus
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </label>
              <div className="cal-field-row">
                <label className="cal-field">
                  <span>Category</span>
                  <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                    {CALENDAR_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                  </select>
                </label>
                <label className="cal-field">
                  <span>Amount</span>
                  <div className="cal-amount-input">
                    <span>₹</span>
                    <input type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} placeholder="0"
                      onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
                  </div>
                </label>
              </div>
              <div className="cal-field-row">
                <label className="cal-field">
                  <span>Date</span>
                  <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
                </label>
                <label className="cal-field">
                  <span>Repeats</span>
                  <select value={form.recurrence} onChange={(e) => setForm((p) => ({ ...p, recurrence: e.target.value }))}>
                    <option value="once">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
              </div>
              <label className="cal-field">
                <span>Notes (optional)</span>
                <input type="text" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </label>
              <div className="cal-modal-actions">
                {form.id ? (
                  <button type="button" className="cal-delete" onClick={() => { deleteCalendarEvent(form.id); setForm(null); }}>
                    <Trash2 size={14} /> Delete
                  </button>
                ) : <span />}
                <div className="cal-modal-actions-right">
                  <button type="button" className="cal-cancel" onClick={() => setForm(null)}>Cancel</button>
                  <button type="submit" className="cal-save" disabled={!form.title.trim() || !(Number(form.amount) > 0)}>
                    {form.id ? 'Save' : 'Add event'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
