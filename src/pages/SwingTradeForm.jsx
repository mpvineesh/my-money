import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useApp } from '../context/useApp';
import { formatCurrency } from '../utils/constants';
import { computeTradeCharges, CHARGE_LABELS, TRADE_SEGMENTS } from '../utils/tradeCharges';
import './InvestmentForm.css';
import './SwingTradeForm.css';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getInitialForm(swingTrades, id) {
  const trade = id ? swingTrades.find((item) => item.id === id) : null;
  if (trade) {
    return {
      symbol: trade.symbol || '',
      segment: trade.segment || 'delivery',
      quantity: trade.quantity || '',
      buyPrice: trade.buyPrice || '',
      buyDate: trade.buyDate || getToday(),
      buyNotes: trade.buyNotes || '',
      sellPrice: trade.sellPrice ? trade.sellPrice : '',
      sellDate: trade.sellDate || '',
      sellNotes: trade.sellNotes || '',
      brokerageOverride: trade.brokerageOverride === '' || trade.brokerageOverride === undefined ? '' : String(trade.brokerageOverride),
    };
  }
  return {
    symbol: '',
    segment: 'delivery',
    quantity: '',
    buyPrice: '',
    buyDate: getToday(),
    buyNotes: '',
    sellPrice: '',
    sellDate: '',
    sellNotes: '',
    brokerageOverride: '',
  };
}

export default function SwingTradeForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { swingTrades, addSwingTrade, updateSwingTrade, deleteSwingTrade } = useApp();

  const [form, setForm] = useState(() => getInitialForm(swingTrades, id));
  const [showDelete, setShowDelete] = useState(false);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const charges = useMemo(
    () =>
      computeTradeCharges({
        segment: form.segment,
        quantity: form.quantity,
        buyPrice: form.buyPrice,
        sellPrice: form.sellPrice,
        brokerageOverride: form.brokerageOverride,
      }),
    [form.segment, form.quantity, form.buyPrice, form.sellPrice, form.brokerageOverride],
  );

  const isValid = form.symbol.trim() && Number(form.quantity) > 0 && Number(form.buyPrice) > 0;
  // A sell is recorded only when both price and date are present.
  const sellEntered = Number(form.sellPrice) > 0 && Boolean(form.sellDate);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid) return;
    const data = {
      symbol: form.symbol.trim().toUpperCase(),
      segment: form.segment,
      quantity: Number(form.quantity) || 0,
      buyPrice: Number(form.buyPrice) || 0,
      buyDate: form.buyDate,
      buyNotes: form.buyNotes.trim(),
      sellPrice: sellEntered ? Number(form.sellPrice) : 0,
      sellDate: sellEntered ? form.sellDate : '',
      sellNotes: form.sellNotes.trim(),
      brokerageOverride: form.brokerageOverride === '' ? '' : Number(form.brokerageOverride),
    };
    if (isEdit) updateSwingTrade(id, data);
    else addSwingTrade(data);
    navigate('/swing-trades');
  };

  const handleDelete = () => {
    deleteSwingTrade(id);
    navigate('/swing-trades');
  };

  const pnlPositive = charges.netPnl >= 0;

  return (
    <div className="form-page">
      <header className="form-header">
        <button type="button" className="form-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-title">{isEdit ? 'Edit Swing Trade' : 'Add Swing Trade'}</h1>
        <div style={{ width: 36 }} />
      </header>

      <form onSubmit={handleSubmit} className="form-body">
        <div className="form-group">
          <label className="form-label">Stock Symbol *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., RELIANCE"
            value={form.symbol}
            onChange={(event) => handleChange('symbol', event.target.value.toUpperCase())}
            required
            autoFocus={!isEdit}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Segment</label>
          <div className="form-risk-row">
            {TRADE_SEGMENTS.map((segment) => (
              <button
                key={segment.value}
                type="button"
                className={`form-risk-btn ${form.segment === segment.value ? 'active' : ''}`}
                onClick={() => handleChange('segment', segment.value)}
              >
                {segment.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Quantity *</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={form.quantity}
              onChange={(event) => handleChange('quantity', event.target.value)}
              required
              min="0"
              step="1"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Buy Price *</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={form.buyPrice}
                onChange={(event) => handleChange('buyPrice', event.target.value)}
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Buy Date *</label>
            <input
              type="date"
              className="form-input"
              value={form.buyDate}
              onChange={(event) => handleChange('buyDate', event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Brokerage override</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="Auto"
                value={form.brokerageOverride}
                onChange={(event) => handleChange('brokerageOverride', event.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Buy Notes</label>
          <textarea
            className="form-input form-textarea"
            placeholder="Entry reason, target, stop-loss..."
            value={form.buyNotes}
            onChange={(event) => handleChange('buyNotes', event.target.value)}
            rows={2}
          />
        </div>

        <div className="swing-form-divider">
          <span>Sell (when you exit)</span>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Sell Price</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={form.sellPrice}
                onChange={(event) => handleChange('sellPrice', event.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Sell Date</label>
            <input
              type="date"
              className="form-input"
              value={form.sellDate}
              onChange={(event) => handleChange('sellDate', event.target.value)}
            />
          </div>
        </div>

        {Number(form.sellPrice) > 0 && !form.sellDate ? (
          <p className="form-helper-text">Add a sell date to mark this trade as closed and record realized P&amp;L.</p>
        ) : null}

        <div className="form-group">
          <label className="form-label">Sell Notes</label>
          <textarea
            className="form-input form-textarea"
            placeholder="Exit reason, learnings..."
            value={form.sellNotes}
            onChange={(event) => handleChange('sellNotes', event.target.value)}
            rows={2}
          />
        </div>

        {Number(form.quantity) > 0 && Number(form.buyPrice) > 0 ? (
          <section className="swing-charges-panel">
            <h2>{sellEntered ? 'Trade summary' : 'Estimated charges'}</h2>

            <div className="swing-charges-row">
              <span>Buy value</span>
              <span>{formatCurrency(charges.buyTurnover)}</span>
            </div>
            {sellEntered ? (
              <div className="swing-charges-row">
                <span>Sell value</span>
                <span>{formatCurrency(charges.sellTurnover)}</span>
              </div>
            ) : null}

            <div className="swing-charges-breakdown">
              {CHARGE_LABELS.map((item) => (
                <div key={item.key} className="swing-charges-row sub">
                  <span>{item.label}</span>
                  <span>{formatCurrency(charges.components[item.key])}</span>
                </div>
              ))}
            </div>

            <div className="swing-charges-row total">
              <span>Total charges</span>
              <span>{formatCurrency(charges.total)}</span>
            </div>

            {sellEntered ? (
              <>
                <div className="swing-charges-row">
                  <span>Gross P&amp;L</span>
                  <span>{charges.grossPnl >= 0 ? '+' : ''}{formatCurrency(charges.grossPnl)}</span>
                </div>
                <div className={`swing-charges-row net ${pnlPositive ? 'positive' : 'negative'}`}>
                  <span>Net P&amp;L (after charges)</span>
                  <span>
                    {pnlPositive ? '+' : ''}{formatCurrency(charges.netPnl)} ({pnlPositive ? '+' : ''}{charges.netPnlPct}%)
                  </span>
                </div>
              </>
            ) : (
              <p className="swing-charges-note">
                Charges so far reflect the buy side only. Breakeven sell price will appear once you enter a sell price.
              </p>
            )}
          </section>
        ) : null}

        <div className="form-actions">
          <button type="submit" className="btn-primary form-submit-btn" disabled={!isValid}>
            <Save size={18} />
            {isEdit ? 'Update Trade' : 'Add Trade'}
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
    </div>
  );
}
