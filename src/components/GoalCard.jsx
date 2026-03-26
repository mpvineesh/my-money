import { formatCurrency } from '../utils/constants';
import './GoalCard.css';

export default function GoalCard({ goal, onClick }) {
  const progress = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 0;

  const remaining = goal.targetAmount - goal.currentAmount;
  const daysLeft = goal.targetDate
    ? Math.max(0, Math.ceil((new Date(goal.targetDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  const priorityColors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e',
  };

  const progressColor = progress >= 75 ? '#22c55e' : progress >= 40 ? '#f59e0b' : '#6366f1';

  return (
    <div className="goal-card" onClick={onClick}>
      <div className="goal-card-header">
        <h3 className="goal-card-name">{goal.name}</h3>
        {goal.priority && (
          <span
            className="goal-priority-badge"
            style={{
              backgroundColor: (priorityColors[goal.priority] || '#94a3b8') + '18',
              color: priorityColors[goal.priority] || '#94a3b8',
            }}
          >
            {goal.priority}
          </span>
        )}
      </div>

      <div className="goal-progress-section">
        <div className="goal-progress-bar-bg">
          <div
            className="goal-progress-bar-fill"
            style={{ width: `${progress}%`, backgroundColor: progressColor }}
          />
        </div>
        <div className="goal-progress-info">
          <span className="goal-progress-percent" style={{ color: progressColor }}>{progress}%</span>
          {daysLeft !== null && (
            <span className="goal-days-left">
              {daysLeft === 0 ? 'Due today' : `${daysLeft} days left`}
            </span>
          )}
        </div>
      </div>

      <div className="goal-card-amounts">
        <div className="goal-amount-group">
          <span className="goal-amount-label">Saved</span>
          <span className="goal-amount-value">{formatCurrency(goal.currentAmount)}</span>
        </div>
        <div className="goal-amount-group" style={{ textAlign: 'right' }}>
          <span className="goal-amount-label">Target</span>
          <span className="goal-amount-value">{formatCurrency(goal.targetAmount)}</span>
        </div>
      </div>

      {remaining > 0 && (
        <div className="goal-remaining">
          {formatCurrency(remaining)} more to go
        </div>
      )}
    </div>
  );
}
