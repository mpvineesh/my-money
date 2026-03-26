import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import './InvestmentForm.css';

function getInitialForm(loans, id) {
  if (id) {
    const l = loans.find((x) => x.id === id);
    if (l) {
      return {
        name: l.name || '',
        principal: l.principal || '',
        annualRate: l.annualRate || '',
        termMonths: l.termMonths || '',
        startDate: l.startDate || '',
        monthlyEMI: l.monthlyEMI || '',
        notes: l.notes || '',
      };
    }
  }
  return {
    name: '',
    principal: '',
    annualRate: '',
    termMonths: '',
    startDate: '',
    monthlyEMI: '',
    notes: '',
  };
}

function calculateEMI(P, annualRate, n) {
  const r = (Number(annualRate) / 100) / 12;
  if (!r || r <= 0) return Math.round(P / n);
  const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi);
}

export default function LoanForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { loans, addLoan, updateLoan, deleteLoan } = useApp();

  const [form, setForm] = useState(() => getInitialForm(loans, id));
  const [showDelete, setShowDelete] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      principal: Number(form.principal) || 0,
      annualRate: Number(form.annualRate) || 0,
      termMonths: Number(form.termMonths) || 0,
      monthlyEMI: form.monthlyEMI ? Number(form.monthlyEMI) : null,
    };

    if (!data.monthlyEMI && data.principal && data.termMonths) {
      data.monthlyEMI = calculateEMI(data.principal, data.annualRate, data.termMonths);
    }

    if (isEdit) {
      updateLoan(id, data);
    } else {
      addLoan(data);
    }
    navigate('/loans');
  };

  const handleDelete = () => {
    deleteLoan(id);
    navigate('/loans');
  };

  const isValid = form.name.trim() && form.principal && form.termMonths;

  return (
    <div className="form-page">
      <header className="form-header">
        <button className="form-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-title">{isEdit ? 'Edit Loan' : 'Add Loan'}</h1>
        <div style={{ width: 36 }} />
      </header>

      <form onSubmit={handleSubmit} className="form-body">
        <div className="form-group">
          <label className="form-label">Loan Name *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., Home Loan - SBI"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Principal (₹) *</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={form.principal}
              onChange={(e) => handleChange('principal', e.target.value)}
              required
              min="0"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Annual Rate (%)</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              placeholder="e.g., 8.5"
              value={form.annualRate}
              onChange={(e) => handleChange('annualRate', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Term (months) *</label>
            <input
              type="number"
              className="form-input"
              placeholder="60"
              value={form.termMonths}
              onChange={(e) => handleChange('termMonths', e.target.value)}
              required
              min="1"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={form.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Monthly EMI (auto-calculated if empty)</label>
          <div className="form-input-prefix">
            <span className="form-prefix">₹</span>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={form.monthlyEMI}
              onChange={(e) => handleChange('monthlyEMI', e.target.value)}
              min="0"
            />
          </div>
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
            {isEdit ? 'Update Loan' : 'Add Loan'}
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
