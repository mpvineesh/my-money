import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { INVESTMENT_TYPES, RISK_LEVELS } from '../utils/constants';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import './InvestmentForm.css';

function getInitialForm(investments, id) {
  const today = new Date().toISOString().slice(0, 10);
  if (id) {
    const inv = investments.find((i) => i.id === id);
    if (inv) {
      return {
        name: inv.name || '',
        type: inv.type || 'mutual_funds',
        investedAmount: inv.investedAmount || '',
        currentValue: inv.currentValue || '',
        risk: inv.risk || 'medium',
        startDate: inv.startDate || '',
        maturityDate: inv.maturityDate || '',
        interestRate: inv.interestRate || '',
        snapshotDate: inv.lastUpdated || today,
        notes: inv.notes || '',
      };
    }
  }
  return {
    name: '',
    type: 'mutual_funds',
    investedAmount: '',
    currentValue: '',
    risk: 'medium',
    startDate: '',
    maturityDate: '',
    interestRate: '',
    snapshotDate: today,
    notes: '',
  };
}

export default function InvestmentForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { investments, addInvestment, updateInvestment, deleteInvestment } = useApp();

  const [form, setForm] = useState(() => getInitialForm(investments, id));

  const [showDelete, setShowDelete] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      investedAmount: Number(form.investedAmount) || 0,
      currentValue: Number(form.currentValue) || 0,
      interestRate: form.interestRate ? Number(form.interestRate) : '',
      snapshotDate: form.snapshotDate,
    };

    if (isEdit) {
      updateInvestment(id, data);
    } else {
      addInvestment(data);
    }
    navigate('/investments');
  };

  const handleDelete = () => {
    deleteInvestment(id);
    navigate('/investments');
  };

  const isValid = form.name.trim() && form.investedAmount;

  return (
    <div className="form-page">
      <header className="form-header">
        <button className="form-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-title">{isEdit ? 'Edit Investment' : 'Add Investment'}</h1>
        <div style={{ width: 36 }} />
      </header>

      <form onSubmit={handleSubmit} className="form-body">
        <div className="form-group">
          <label className="form-label">Investment Name *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., HDFC Mid-Cap Fund"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Type</label>
          <div className="form-type-grid">
            {INVESTMENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`form-type-btn ${form.type === t.value ? 'active' : ''}`}
                style={
                  form.type === t.value
                    ? { backgroundColor: t.color + '15', color: t.color, borderColor: t.color + '50' }
                    : {}
                }
                onClick={() => handleChange('type', t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Invested Amount *</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={form.investedAmount}
                onChange={(e) => handleChange('investedAmount', e.target.value)}
                required
                min="0"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Current Value</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={form.currentValue}
                onChange={(e) => handleChange('currentValue', e.target.value)}
                min="0"
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Risk Level</label>
          <div className="form-risk-row">
            {RISK_LEVELS.map((r) => (
              <button
                key={r.value}
                type="button"
                className={`form-risk-btn ${form.risk === r.value ? 'active' : ''}`}
                style={
                  form.risk === r.value
                    ? { backgroundColor: r.color + '15', color: r.color, borderColor: r.color + '50' }
                    : {}
                }
                onClick={() => handleChange('risk', r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={form.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Maturity Date</label>
            <input
              type="date"
              className="form-input"
              value={form.maturityDate}
              onChange={(e) => handleChange('maturityDate', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Interest Rate (%)</label>
          <input
            type="number"
            step="0.01"
            className="form-input"
            placeholder="e.g., 7.5"
            value={form.interestRate}
            onChange={(e) => handleChange('interestRate', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Value As Of</label>
          <input
            type="date"
            className="form-input"
            value={form.snapshotDate}
            onChange={(e) => handleChange('snapshotDate', e.target.value)}
          />
          <p className="form-helper-text">
            Each save records a history snapshot for this date so monthly and yearly progress can be tracked.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input form-textarea"
            placeholder="Any additional details..."
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary form-submit-btn" disabled={!isValid}>
            <Save size={18} />
            {isEdit ? 'Update Investment' : 'Add Investment'}
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
