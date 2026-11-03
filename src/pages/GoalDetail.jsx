import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { formatCurrency, formatDate } from '../utils/constants';
import GoalCard from '../components/GoalCard';
import './Goals.css';

export default function GoalDetail() {
  const { id } = useParams();
  const { goals, isReadOnly } = useApp();
  const goal = goals.find((item) => item.id === id);
  if (!goal) return <div className="goals-page"><h1>Goal unavailable</h1><p>It may still be loading or may have been removed.</p><Link to="/goals">Back to goals</Link></div>;
  const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount));
  const days = goal.targetDate ? Math.round((new Date(`${goal.targetDate}T00:00:00`) - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000) : null;
  const months = days > 0 ? Math.max(1, Math.ceil(days / 30.4375)) : 0;
  return (
    <div className="goals-page">
      <header className="goals-header"><Link to="/goals">Back to goals</Link>{!isReadOnly && <Link className="btn-primary" to={`/goals/edit/${id}`}>Edit goal</Link>}</header>
      <h1 className="goals-title">{goal.name}</h1>
      <GoalCard goal={goal} />
      <section className="form-details" style={{ marginTop: 20 }}>
        <h2>Next step</h2>
        {remaining === 0 ? <p>Your target is fully funded.</p> : months ? <p>Set aside <strong>{formatCurrency(remaining / months)} per month</strong> to close the gap by {formatDate(goal.targetDate)}. This estimate assumes no investment growth.</p> : <p>{days !== null ? 'The target date has arrived. Review your timeline or add funds to close the gap.' : 'Set a target date to estimate the monthly amount needed.'}</p>}
      </section>
      <section className="form-details">
        <h2>Allocated assets</h2>
        {goal.allocations?.length ? goal.allocations.map((allocation) => <p key={allocation.assetId}>{allocation.assetName || 'Asset'}: <strong>{formatCurrency(allocation.amount)}</strong></p>) : <p>No assets explicitly allocated. Edit this goal to earmark assets for it.</p>}
      </section>
      {goal.history?.length > 0 && <section className="form-details"><h2>Progress history</h2><p>Recorded balances, including valuation changes.</p>{[...goal.history].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => <p key={entry.date}>{formatDate(entry.date)} · {formatCurrency(entry.amount ?? entry.value)}</p>)}</section>}
    </div>
  );
}
