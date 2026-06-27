import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../context/useApp';
import { formatCurrency, calculateReturns, DEFAULT_FAMILY_MEMBER } from '../utils/constants';
import './MutualFunds.css';

const EMPTY = { id: '', name: '', quantity: '', investedAmount: '', currentValue: '' };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Stocks() {
  const navigate = useNavigate();
  const { visibleInvestments, ownerName, addInvestment, updateInvestment, deleteInvestment } = useApp();

  const stocks = useMemo(
    () => visibleInvestments
      .filter((inv) => inv.type === 'stocks')
      .sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0)),
    [visibleInvestments],
  );

  const totals = useMemo(() => {
    const invested = stocks.reduce((s, f) => s + (Number(f.investedAmount) || 0), 0);
    const current = stocks.reduce((s, f) => s + (Number(f.currentValue) || 0), 0);
    return { invested, current, gain: current - invested };
  }, [stocks]);

  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState('');

  function save(event) {
    event.preventDefault();
    const name = editing.name.trim();
    if (!name) return;
    const quantity = Number(editing.quantity) || 0;
    const invested = Number(editing.investedAmount) || 0;
    const current = Number(editing.currentValue) || 0;
    const payload = {
      ...editing, name, type: 'stocks', quantity,
      investedAmount: invested, currentValue: current, snapshotDate: todayIso(),
    };
    if (editing.id) {
      updateInvestment(editing.id, payload);
    } else {
      addInvestment({ ...payload, memberId: DEFAULT_FAMILY_MEMBER.id, memberName: ownerName, startDate: todayIso(), risk: 'high' });
    }
    setEditing(null);
  }

  function openEdit(stock) {
    setEditing({
      id: stock.id,
      name: stock.name || '',
      quantity: stock.quantity ?? stock.units ?? '',
      investedAmount: stock.investedAmount ?? '',
      currentValue: stock.currentValue ?? '',
    });
  }

  const impliedPrice = editing && Number(editing.quantity) && Number(editing.currentValue)
    ? Number(editing.currentValue) / Number(editing.quantity)
    : null;

  return (
    <div className="mf-page">
      <header className="mf-header">
        <button type="button" className="mf-back" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <div className="mf-header-copy">
          <p className="mf-label">Portfolio</p>
          <h1 className="mf-title">Stocks</h1>
        </div>
      </header>

      <section className="mf-summary">
        <div className="mf-summary-main">
          <span className="mf-summary-label">Current value</span>
          <strong className="mf-summary-value">{formatCurrency(totals.current)}</strong>
          <span className={`mf-summary-gain ${totals.gain >= 0 ? 'pos' : 'neg'}`}>
            {totals.gain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {totals.gain >= 0 ? '+' : ''}{formatCurrency(totals.gain)} ({calculateReturns(totals.invested, totals.current)}%)
          </span>
        </div>
        <div className="mf-summary-side">
          <div><span>Invested</span><strong>{formatCurrency(totals.invested)}</strong></div>
        </div>
      </section>

      <div className="mf-toolbar">
        <span className="mf-count">{stocks.length} stock{stocks.length === 1 ? '' : 's'}</span>
        <button type="button" className="mf-add" onClick={() => setEditing({ ...EMPTY })}>
          <Plus size={16} /> Add stock
        </button>
      </div>

      {stocks.length === 0 ? (
        <div className="mf-empty"><p>No stocks yet. Add your first holding.</p></div>
      ) : (
        <div className="mf-list">
          {stocks.map((stock) => {
            const gain = (Number(stock.currentValue) || 0) - (Number(stock.investedAmount) || 0);
            return (
              <article key={stock.id} className="mf-card">
                <div className="mf-card-top">
                  <div className="mf-card-name">
                    <strong>{stock.name}</strong>
                    <span>{Number(stock.quantity) ? `${stock.quantity} shares` : 'Holding'}</span>
                  </div>
                  <div className="mf-card-actions">
                    <button type="button" className="mf-icon" onClick={() => openEdit(stock)}><Pencil size={14} /></button>
                    <button type="button" className="mf-icon danger" onClick={() => setConfirmDeleteId((c) => (c === stock.id ? '' : stock.id))}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mf-card-metrics">
                  <div><span>Current</span><strong>{formatCurrency(stock.currentValue)}</strong></div>
                  <div><span>Invested</span><strong>{formatCurrency(stock.investedAmount)}</strong></div>
                  <div><span>Returns</span><strong className={gain >= 0 ? 'pos' : 'neg'}>{calculateReturns(stock.investedAmount, stock.currentValue)}%</strong></div>
                </div>
                {confirmDeleteId === stock.id ? (
                  <div className="mf-confirm">
                    <span>Delete this stock?</span>
                    <button type="button" className="mf-cancel" onClick={() => setConfirmDeleteId('')}>Cancel</button>
                    <button type="button" className="mf-danger" onClick={() => { deleteInvestment(stock.id); setConfirmDeleteId(''); }}>Delete</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <div className="mf-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="mf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mf-modal-head">
              <h3>{editing.id ? 'Edit stock' : 'Add stock'}</h3>
              <button type="button" className="mf-icon" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <form onSubmit={save} className="mf-form">
              <input className="mf-input" placeholder="Stock name (e.g., Reliance Industries)" value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <div className="mf-form-row">
                <input className="mf-input" type="number" step="any" min="0" placeholder="Quantity (shares)" value={editing.quantity}
                  onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} />
                <input className="mf-input" type="number" min="0" placeholder="Invested amount (₹)" value={editing.investedAmount}
                  onChange={(e) => setEditing({ ...editing, investedAmount: e.target.value })} />
              </div>
              <input className="mf-input" type="number" min="0" placeholder="Current value (₹)" value={editing.currentValue}
                onChange={(e) => setEditing({ ...editing, currentValue: e.target.value })} />
              {impliedPrice ? <p className="mf-hint">≈ {formatCurrency(impliedPrice)} per share</p> : null}
              <div className="mf-modal-actions">
                <button type="button" className="mf-cancel" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="mf-save"><Save size={16} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
