import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Repeat, Sparkles, Zap, ArrowRight } from 'lucide-react';
import { useApp } from '../context/useApp';
import { formatCurrency, formatDate } from '../utils/constants';
import { detectSubscriptions, monthlyComparison, largeTransactions } from '../utils/insights';
import './Insights.css';

function monthLabel(periodKey) {
  if (!periodKey) return '';
  const [year, month] = periodKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default function Insights() {
  const navigate = useNavigate();
  const { expenses, recurringEntries, expenseCategories } = useApp();

  const trend = useMemo(() => monthlyComparison(expenses, expenseCategories), [expenses, expenseCategories]);
  const subscriptions = useMemo(() => detectSubscriptions(expenses, recurringEntries), [expenses, recurringEntries]);
  const largeTxns = useMemo(() => largeTransactions(expenses), [expenses]);

  const subsMonthly = subscriptions.reduce((sum, s) => sum + s.typicalAmount, 0);
  const hasData = (expenses || []).length > 0;

  return (
    <div className="insights-page">
      <header className="insights-header">
        <button type="button" className="insights-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="insights-label">Spending</p>
          <h1 className="insights-title">Insights</h1>
        </div>
      </header>

      {!hasData ? (
        <div className="insights-empty">
          <Sparkles size={26} />
          <p>Add some expenses and insights will appear here automatically.</p>
        </div>
      ) : null}

      {trend.current ? (
        <section className="insights-card">
          <div className="insights-card-head">
            <span className="insights-card-icon"><TrendingUp size={18} /></span>
            <h2>This month vs last</h2>
          </div>
          <div className="insights-trend">
            <div>
              <span className="insights-trend-label">{monthLabel(trend.current)}</span>
              <strong className="insights-trend-value">{formatCurrency(trend.currentTotal)}</strong>
            </div>
            {trend.deltaPct !== null ? (
              <div className={`insights-delta ${trend.deltaPct > 0 ? 'up' : 'down'}`}>
                {trend.deltaPct > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {Math.abs(trend.deltaPct)}% vs {monthLabel(trend.previous)}
              </div>
            ) : null}
          </div>
          {trend.topMovers.length ? (
            <div className="insights-movers">
              <p className="insights-sub">Biggest increases</p>
              {trend.topMovers.map((mover) => (
                <div key={mover.category} className="insights-mover">
                  <span>{mover.label}</span>
                  <span className="insights-mover-amt">
                    {formatCurrency(mover.current)} <em>+{formatCurrency(mover.delta)}</em>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {subscriptions.length ? (
        <section className="insights-card">
          <div className="insights-card-head">
            <span className="insights-card-icon"><Repeat size={18} /></span>
            <h2>Possible subscriptions</h2>
          </div>
          <p className="insights-sub">
            Recurring charges we noticed that aren&apos;t tracked yet — about <strong>{formatCurrency(subsMonthly)}/mo</strong>.
          </p>
          <div className="insights-list">
            {subscriptions.map((sub) => (
              <div key={sub.name} className="insights-row">
                <div className="insights-row-main">
                  <strong>{sub.name}</strong>
                  <span>{sub.months} months · last {sub.lastDate ? formatDate(sub.lastDate) : '—'}</span>
                </div>
                <span className="insights-row-amt">{formatCurrency(sub.typicalAmount)}</span>
              </div>
            ))}
          </div>
          <button type="button" className="insights-cta" onClick={() => navigate('/recurring/new')}>
            Track as recurring <ArrowRight size={15} />
          </button>
        </section>
      ) : null}

      {largeTxns.length ? (
        <section className="insights-card">
          <div className="insights-card-head">
            <span className="insights-card-icon"><Zap size={18} /></span>
            <h2>Large transactions this month</h2>
          </div>
          <div className="insights-list">
            {largeTxns.map((txn, index) => (
              <div key={`${txn.name}-${index}`} className="insights-row">
                <div className="insights-row-main">
                  <strong>{txn.name}</strong>
                  <span>{txn.date ? formatDate(txn.date) : ''}{txn.multiple ? ` · ${txn.multiple}× typical` : ''}</span>
                </div>
                <span className="insights-row-amt">{formatCurrency(txn.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasData && trend.current && !subscriptions.length && !largeTxns.length && !trend.topMovers.length ? (
        <div className="insights-empty">
          <Sparkles size={26} />
          <p>Nothing unusual right now — your spending looks steady.</p>
        </div>
      ) : null}
    </div>
  );
}
