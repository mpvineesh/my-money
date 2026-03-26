import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { getTypeInfo, formatCurrency, calculateReturns, INVESTMENT_TYPES } from '../utils/constants';
import InvestmentCard from '../components/InvestmentCard';
import GoalCard from '../components/GoalCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Target, ChevronRight } from 'lucide-react';
import './Dashboard.css';

function ChartTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <span className="chart-tooltip-name">{payload[0].name}</span>
        <span className="chart-tooltip-value">{formatCurrency(payload[0].value)}</span>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const { investments, goals } = useApp();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const totalInvested = investments.reduce((sum, i) => sum + (Number(i.investedAmount) || 0), 0);
    const totalCurrent = investments.reduce((sum, i) => sum + (Number(i.currentValue) || 0), 0);
    const totalGain = totalCurrent - totalInvested;
    const overallReturn = calculateReturns(totalInvested, totalCurrent);

    const byType = {};
    investments.forEach((inv) => {
      const type = inv.type || 'other';
      if (!byType[type]) byType[type] = { invested: 0, current: 0, count: 0 };
      byType[type].invested += Number(inv.investedAmount) || 0;
      byType[type].current += Number(inv.currentValue) || 0;
      byType[type].count += 1;
    });

    const pieData = Object.entries(byType)
      .map(([type, data]) => ({
        name: getTypeInfo(type).label,
        value: data.current,
        color: getTypeInfo(type).color,
      }))
      .sort((a, b) => b.value - a.value);

    const totalGoalTarget = goals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
    const totalGoalCurrent = goals.reduce((sum, g) => sum + (Number(g.currentAmount) || 0), 0);

    return { totalInvested, totalCurrent, totalGain, overallReturn, pieData, totalGoalTarget, totalGoalCurrent };
  }, [investments, goals]);

  const topInvestments = useMemo(() => {
    return [...investments].sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0)).slice(0, 3);
  }, [investments]);

  const topGoals = useMemo(() => {
    return [...goals].slice(0, 2);
  }, [goals]);

  const isPositive = stats.totalGain >= 0;

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div>
          <p className="dash-greeting">My Money</p>
          <h1 className="dash-title">Portfolio Overview</h1>
        </div>
      </header>

      <div className="dash-stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-card-icon">
            <Wallet size={20} />
          </div>
          <span className="stat-label">Total Value</span>
          <span className="stat-value">{formatCurrency(stats.totalCurrent)}</span>
          <span className="stat-sub">Invested: {formatCurrency(stats.totalInvested)}</span>
        </div>
        <div className={`stat-card ${isPositive ? 'stat-card-success' : 'stat-card-danger'}`}>
          <div className="stat-card-icon">
            {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <span className="stat-label">Total Returns</span>
          <span className="stat-value">{isPositive ? '+' : ''}{formatCurrency(stats.totalGain)}</span>
          <span className="stat-sub">{isPositive ? '+' : ''}{stats.overallReturn}% overall</span>
        </div>
      </div>

      {stats.pieData.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-section-title">Asset Allocation</h2>
          <div className="dash-chart-card">
            <div className="dash-pie-container">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="dash-legend">
              {stats.pieData.map((item, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: item.color }} />
                  <span className="legend-label">{item.name}</span>
                  <span className="legend-value">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {goals.length > 0 && (
        <section className="dash-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">
              <Target size={18} /> Goals Progress
            </h2>
            <button className="dash-see-all" onClick={() => navigate('/goals')}>
              See all <ChevronRight size={14} />
            </button>
          </div>
          <div className="dash-goals-summary">
            <div className="goal-summary-bar-bg">
              <div
                className="goal-summary-bar-fill"
                style={{
                  width: `${stats.totalGoalTarget > 0 ? Math.min(100, (stats.totalGoalCurrent / stats.totalGoalTarget) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="goal-summary-text">
              <span>{formatCurrency(stats.totalGoalCurrent)} saved</span>
              <span>of {formatCurrency(stats.totalGoalTarget)}</span>
            </div>
          </div>
          <div className="dash-cards-list">
            {topGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onClick={() => navigate(`/goals/edit/${goal.id}`)} />
            ))}
          </div>
        </section>
      )}

      {investments.length > 0 && (
        <section className="dash-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">Top Investments</h2>
            <button className="dash-see-all" onClick={() => navigate('/investments')}>
              See all <ChevronRight size={14} />
            </button>
          </div>
          <div className="dash-cards-list">
            {topInvestments.map((inv) => (
              <InvestmentCard key={inv.id} investment={inv} onClick={() => navigate(`/investments/edit/${inv.id}`)} />
            ))}
          </div>
        </section>
      )}

      {investments.length === 0 && (
        <div className="dash-empty">
          <Wallet size={48} strokeWidth={1} />
          <h3>Start tracking your investments</h3>
          <p>Add your first investment to see your portfolio here</p>
          <button className="btn-primary" onClick={() => navigate('/add')}>Add Investment</button>
        </div>
      )}
    </div>
  );
}
