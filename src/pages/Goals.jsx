import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { formatCurrency } from '../utils/constants';
import GoalCard from '../components/GoalCard';
import { Target, Plus } from 'lucide-react';
import './Goals.css';

export default function Goals() {
  const { goals } = useApp();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('priority');

  const sorted = useMemo(() => {
    const result = [...goals];
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    switch (sortBy) {
      case 'priority':
        result.sort((a, b) => (priorityOrder[a.priority] || 9) - (priorityOrder[b.priority] || 9));
        break;
      case 'progress':
        result.sort((a, b) => {
          const pa = a.targetAmount ? a.currentAmount / a.targetAmount : 0;
          const pb = b.targetAmount ? b.currentAmount / b.targetAmount : 0;
          return pb - pa;
        });
        break;
      case 'target':
        result.sort((a, b) => (Number(b.targetAmount) || 0) - (Number(a.targetAmount) || 0));
        break;
      case 'deadline':
        result.sort((a, b) => new Date(a.targetDate || '2100-01-01') - new Date(b.targetDate || '2100-01-01'));
        break;
      default:
        break;
    }
    return result;
  }, [goals, sortBy]);

  const totalTarget = goals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
  const totalSaved = goals.reduce((sum, g) => sum + (Number(g.currentAmount) || 0), 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="goals-page">
      <header className="goals-header">
        <div>
          <p className="goals-label">Financial Goals</p>
          <h1 className="goals-title">My Goals</h1>
        </div>
        <button className="goals-add-btn" onClick={() => navigate('/goals/add')}>
          <Plus size={18} />
          <span>New Goal</span>
        </button>
      </header>

      {goals.length > 0 && (
        <div className="goals-overview">
          <div className="goals-overview-progress">
            <div className="goals-overview-circle">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#goalGrad)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${overallProgress * 2.64} ${264 - overallProgress * 2.64}`}
                  transform="rotate(-90 50 50)"
                />
                <defs>
                  <linearGradient id="goalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="goals-circle-text">
                <span className="goals-circle-percent">{overallProgress}%</span>
                <span className="goals-circle-label">achieved</span>
              </div>
            </div>
          </div>
          <div className="goals-overview-info">
            <div className="goals-info-row">
              <span className="goals-info-label">Total Target</span>
              <span className="goals-info-value">{formatCurrency(totalTarget)}</span>
            </div>
            <div className="goals-info-row">
              <span className="goals-info-label">Total Saved</span>
              <span className="goals-info-value goals-info-highlight">{formatCurrency(totalSaved)}</span>
            </div>
            <div className="goals-info-row">
              <span className="goals-info-label">Remaining</span>
              <span className="goals-info-value">{formatCurrency(totalTarget - totalSaved)}</span>
            </div>
          </div>
        </div>
      )}

      {goals.length > 1 && (
        <div className="goals-sort">
          <label className="goals-sort-label">Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="goals-sort-select">
            <option value="priority">Priority</option>
            <option value="progress">Progress</option>
            <option value="target">Target Amount</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>
      )}

      <div className="goals-list">
        {sorted.map((goal) => (
          <GoalCard key={goal.id} goal={goal} onClick={() => navigate(`/goals/edit/${goal.id}`)} />
        ))}
      </div>

      {goals.length === 0 && (
        <div className="goals-empty">
          <Target size={48} strokeWidth={1} />
          <h3>Set your financial goals</h3>
          <p>Track your progress towards house, retirement, travel & more</p>
          <button className="btn-primary" onClick={() => navigate('/goals/add')}>
            Add Your First Goal
          </button>
        </div>
      )}
    </div>
  );
}
