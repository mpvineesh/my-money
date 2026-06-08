import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CandlestickChart, Plus, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../context/useApp';
import { formatCurrency, formatDate } from '../utils/constants';
import { computeTradeCharges, TRADE_SEGMENTS } from '../utils/tradeCharges';
import './SwingTrades.css';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

function segmentLabel(segment) {
  return TRADE_SEGMENTS.find((item) => item.value === segment)?.label || 'Delivery (CNC)';
}

export default function SwingTrades() {
  const { swingTrades } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const rows = useMemo(
    () =>
      swingTrades.map((trade) => {
        const charges = computeTradeCharges(trade);
        return { ...trade, charges };
      }),
    [swingTrades],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((trade) => (filter === 'all' ? true : trade.status === filter))
      .filter((trade) => (query ? trade.symbol.toLowerCase().includes(query) : true))
      .sort((left, right) => (right.buyDate || '').localeCompare(left.buyDate || ''));
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    const open = rows.filter((trade) => trade.status === 'open');
    const closed = rows.filter((trade) => trade.status === 'closed');
    const realized = closed.reduce((sum, trade) => sum + trade.charges.netPnl, 0);
    const totalCharges = rows.reduce((sum, trade) => sum + trade.charges.total, 0);
    return {
      openCount: open.length,
      closedCount: closed.length,
      realized,
      totalCharges,
    };
  }, [rows]);

  return (
    <div className="swing-page">
      <header className="swing-header">
        <div>
          <p className="swing-label">Portfolio</p>
          <h1 className="swing-title">Swing Trades</h1>
          <p className="swing-subtitle">Track every buy and sell, with charges calculated automatically.</p>
        </div>
        <button type="button" className="swing-new-btn" onClick={() => navigate('/swing-trades/new')}>
          <Plus size={18} />
          New trade
        </button>
      </header>

      <section className="swing-stats">
        <article className="swing-stat">
          <span>Open</span>
          <strong>{stats.openCount}</strong>
          <p>active trade{stats.openCount === 1 ? '' : 's'}</p>
        </article>
        <article className="swing-stat">
          <span>Closed</span>
          <strong>{stats.closedCount}</strong>
          <p>completed</p>
        </article>
        <article className={`swing-stat ${stats.realized >= 0 ? 'positive' : 'negative'}`}>
          <span>Realized P&amp;L</span>
          <strong>{stats.realized >= 0 ? '+' : ''}{formatCurrency(stats.realized)}</strong>
          <p>net of charges</p>
        </article>
        <article className="swing-stat">
          <span>Total charges</span>
          <strong>{formatCurrency(stats.totalCharges)}</strong>
          <p>all trades</p>
        </article>
      </section>

      <div className="swing-search">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search symbol..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="swing-filters">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`swing-filter ${filter === item.value ? 'active' : ''}`}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length ? (
        <div className="swing-list">
          {filtered.map((trade) => {
            const positive = trade.charges.netPnl >= 0;
            return (
              <button
                key={trade.id}
                type="button"
                className="swing-card"
                onClick={() => navigate(`/swing-trades/edit/${trade.id}`)}
              >
                <div className="swing-card-top">
                  <div className="swing-card-symbol">
                    <h3>{trade.symbol || '—'}</h3>
                    <span className="swing-card-segment">{segmentLabel(trade.segment)}</span>
                  </div>
                  <span className={`swing-badge ${trade.status}`}>{trade.status === 'open' ? 'Open' : 'Closed'}</span>
                </div>

                <div className="swing-card-grid">
                  <div>
                    <span className="swing-k">Qty × Buy</span>
                    <span className="swing-v">{trade.quantity} × {formatCurrency(trade.buyPrice)}</span>
                  </div>
                  <div>
                    <span className="swing-k">Buy date</span>
                    <span className="swing-v">{formatDate(trade.buyDate)}</span>
                  </div>
                  {trade.status === 'closed' ? (
                    <>
                      <div>
                        <span className="swing-k">Sell</span>
                        <span className="swing-v">{formatCurrency(trade.sellPrice)}</span>
                      </div>
                      <div>
                        <span className="swing-k">Sell date</span>
                        <span className="swing-v">{formatDate(trade.sellDate)}</span>
                      </div>
                    </>
                  ) : (
                    <div>
                      <span className="swing-k">Invested</span>
                      <span className="swing-v">{formatCurrency(trade.charges.buyTurnover)}</span>
                    </div>
                  )}
                </div>

                <div className="swing-card-foot">
                  <span className="swing-charges">Charges {formatCurrency(trade.charges.total)}</span>
                  {trade.status === 'closed' ? (
                    <span className={`swing-pnl ${positive ? 'positive' : 'negative'}`}>
                      {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {positive ? '+' : ''}{formatCurrency(trade.charges.netPnl)}
                      <em>({positive ? '+' : ''}{trade.charges.netPnlPct}%)</em>
                    </span>
                  ) : (
                    <span className="swing-open-hint">Tap to record sell</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="swing-empty">
          <CandlestickChart size={40} strokeWidth={1.4} />
          <p>{swingTrades.length ? 'No trades match this filter.' : 'No swing trades yet.'}</p>
          <button type="button" className="swing-new-btn" onClick={() => navigate('/swing-trades/new')}>
            <Plus size={18} />
            Add your first trade
          </button>
        </div>
      )}
    </div>
  );
}
