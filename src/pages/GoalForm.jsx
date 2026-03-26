import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import './InvestmentForm.css';

const PRIORITIES = [
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low', label: 'Low', color: '#22c55e' },
];

function getInitialGoalForm(goals, id) {
  if (id) {
    const goal = goals.find((g) => g.id === id);
    if (goal) {
      return {
        name: goal.name || '',
        targetAmount: goal.targetAmount || '',
        currentAmount: goal.currentAmount || '',
        targetDate: goal.targetDate || '',
        priority: goal.priority || 'medium',
        notes: goal.notes || '',
      };
    }
  }
  return {
    name: '',
    targetAmount: '',
    currentAmount: '',
    targetDate: '',
    priority: 'medium',
    notes: '',
  };
}

export default function GoalForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { goals, addGoal, updateGoal, deleteGoal } = useApp();

  const [form, setForm] = useState(() => getInitialGoalForm(goals, id));
  const [showDelete, setShowDelete] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      targetAmount: Number(form.targetAmount) || 0,
      currentAmount: Number(form.currentAmount) || 0,
    };

    if (isEdit) {
      updateGoal(id, data);
    } else {
      addGoal(data);
    }
    navigate('/goals');
  };

  const handleDelete = () => {
    deleteGoal(id);
    navigate('/goals');
  };

  const isValid = form.name.trim() && form.targetAmount;

  return (
    <div className="form-page">
      <header className="form-header">
        <button className="form-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-title">{isEdit ? 'Edit Goal' : 'New Goal'}</h1>
        <div style={{ width: 36 }} />
      </header>

      <form onSubmit={handleSubmit} className="form-body">
        <div className="form-group">
          <label className="form-label">Goal Name *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., House Down Payment"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Target Amount *</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={form.targetAmount}
                onChange={(e) => handleChange('targetAmount', e.target.value)}
                required
                min="0"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Saved So Far</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={form.currentAmount}
                onChange={(e) => handleChange('currentAmount', e.target.value)}
                min="0"
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Target Date</label>
          <input
            type="date"
            className="form-input"
            value={form.targetDate}
            onChange={(e) => handleChange('targetDate', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Priority</label>
          <div className="form-risk-row">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`form-risk-btn ${form.priority === p.value ? 'active' : ''}`}
                style={
                  form.priority === p.value
                    ? { backgroundColor: p.color + '15', color: p.color, borderColor: p.color + '50' }
                    : {}
                }
                onClick={() => handleChange('priority', p.value)}
              >
                {p.label}
              </button>
            ))}
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
            {isEdit ? 'Update Goal' : 'Add Goal'}
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
