import ChartDurationFilter from '../components/ChartDurationFilter';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { getTypeInfo, formatCurrency, formatCompactCurrency, calculateReturns } from '../utils/constants';
import InvestmentCard from '../components/InvestmentCard';
import GoalCard from '../components/GoalCard';
import MotivationBanner from '../components/MotivationBanner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Target, ChevronRight, Landmark, CreditCard, CalendarRange, BellRing, Repeat, AlertTriangle } from 'lucide-react';
import { buildNetWorthSeries, getCurrentMonthValue, getDaysUntil, getExpensePeriodKey } from '../utils/netWorthHistory';
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

function NetWorthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const portfolioValue = payload.find((item) => item.dataKey === 'portfolioValue')?.value || 0;
  const netWorth = payload.find((item) => item.dataKey === 'netWorth')?.value || 0;

  return (
    <div className="dash-networth-tooltip">
      <strong>{label}</strong>
      <span>Portfolio: {formatCurrency(portfolioValue)}</span>
      <span>Net worth: {formatCurrency(netWorth)}</span>
    </div>
  );
}

export default function Dashboard() {
  const {
    investments,
    recurringError,
    visibleInvestments,
    investmentVisibilityMember,
    goals,
    loans,
    cash,
    expenses,
    expenseBudgets,
    recurringEntries,
    reminders,
    cashHistory,
    netWorthSnapshots,
    appSettings,
    themePrimary,
  } = useApp();
  const navigate = useNavigate();
  const [netWorthRange, setNetWorthRange] = useState('month');
  const [netWorthPeriod, setNetWorthPeriod] = useState('6m');
  const dashboardSections = appSettings?.dashboardSections || {};
  const portfolioScopeLabel = investmentVisibilityMember ? investmentVisibilityMember.name : 'Whole family';

  const stats = useMemo(() => {
    const totalInvested = visibleInvestments.reduce((sum, i) => sum + (Number(i.investedAmount) || 0), 0);
    const totalCurrent = visibleInvestments.reduce((sum, i) => sum + (Number(i.currentValue) || 0), 0);
    const totalGain = totalCurrent - totalInvested;
    const overallReturn = calculateReturns(totalInvested, totalCurrent);

    const byType = {};
    visibleInvestments.forEach((inv) => {
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
    const totalLoanPrincipal = loans.reduce((sum, loan) => sum + (Number(loan.outstandingBalance ?? loan.loanAmount ?? loan.principalAmount ?? loan.principal) || 0), 0);
    const totalMonthlyEmi = loans.reduce((sum, loan) => sum + (Number(loan.monthlyEmi || loan.monthlyEMI) || 0), 0);
    const liquidAssets = totalCurrent + (Number(cash) || 0);
    const netWorth = liquidAssets - totalLoanPrincipal;
    const goalCoverage = totalGoalTarget > 0 ? (totalGoalCurrent / totalGoalTarget) * 100 : 0;

    return {
      totalInvested,
      totalCurrent,
      totalGain,
      overallReturn,
      pieData,
      totalGoalTarget,
      totalGoalCurrent,
      totalLoanPrincipal,
      totalMonthlyEmi,
      liquidAssets,
      netWorth,
      goalCoverage,
    };
  }, [cash, goals, loans, visibleInvestments]);

  const topInvestments = useMemo(() => {
    return [...visibleInvestments].sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0)).slice(0, 3);
  }, [visibleInvestments]);

  const topGoals = useMemo(() => {
    return [...goals].slice(0, 2);
  }, [goals]);
  const attentionItems = useMemo(() => {
    const items = [];
    const dueReminders = reminders.filter((reminder) => reminder.status !== 'completed' && getDaysUntil(reminder.nextDueDate) <= 7);
    const dueRecurring = recurringEntries.filter((entry) => getDaysUntil(entry.nextDueDate) <= 0);
    const staleInvestments = visibleInvestments.filter((investment) => getDaysUntil(investment.lastUpdated) < -30);
    const currentMonth = getCurrentMonthValue();
    const currentMonthExpenses = expenses.filter((expense) => getExpensePeriodKey(expense) === currentMonth);
    const overBudgetItems = expenseBudgets
      .filter((budget) => budget.periodKey === currentMonth)
      .map((budget) => {
        const actual = currentMonthExpenses.reduce((sum, expense) => {
          if (expense.category !== budget.categoryValue) return sum;
          if (!budget.subcategoryValue) return sum + (Number(expense.amount) || 0);
          return expense.subcategory === budget.subcategoryValue ? sum + (Number(expense.amount) || 0) : sum;
        }, 0);

        return { ...budget, actual, overBy: actual - budget.amount };
      })
      .filter((budget) => budget.overBy > 0);

    if (dueReminders.length) {
      items.push({
        key: 'reminders',
        icon: BellRing,
        tone: dueReminders.some((reminder) => getDaysUntil(reminder.nextDueDate) < 0) ? 'danger' : 'warning',
        title: `${dueReminders.length} reminder${dueReminders.length === 1 ? '' : 's'} due`,
        copy: dueReminders[0].title,
        action: 'Open',
        to: '/reminders',
      });
    }

    if (dueRecurring.length) {
      const dueImpact = dueRecurring.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
      items.push({
        key: 'recurring',
        icon: Repeat,
        tone: dueRecurring.some((entry) => getDaysUntil(entry.nextDueDate) < 0) ? 'danger' : 'warning',
        title: `${dueRecurring.length} recurring entr${dueRecurring.length === 1 ? 'y' : 'ies'} due`,
        copy: `${dueRecurring[0].title} · ${formatCurrency(dueImpact)} impact`,
        action: 'Review',
        to: '/recurring',
      });
    }

    if (overBudgetItems.length) {
      items.push({
        key: 'budgets',
        icon: AlertTriangle,
        tone: 'danger',
        title: `${overBudgetItems.length} budget overrun${overBudgetItems.length === 1 ? '' : 's'}`,
        copy: `Top over by ${formatCurrency(Math.max(...overBudgetItems.map((budget) => budget.overBy)))}`,
        action: 'Review',
        to: '/expenses',
      });
    }

    if (staleInvestments.length) {
      items.push({
        key: 'stale',
        icon: CalendarRange,
        tone: 'neutral',
        title: `${staleInvestments.length} stale investment${staleInvestments.length === 1 ? '' : 's'}`,
        copy: 'Update values for better trends',
        action: 'Update',
        to: '/investments',
      });
    }

    return items;
  }, [expenseBudgets, expenses, recurringEntries, reminders, visibleInvestments]);

  const netWorthSeries = useMemo(
    () => buildNetWorthSeries(
      visibleInvestments,
      netWorthRange,
      netWorthPeriod,
      cashHistory,
      loans,
      goals,
      // Saved snapshots are whole-family aggregates; only apply them in the family view. When a
      // member is selected, build purely from that member's scoped data so the line reflects the
      // selected scope instead of family totals.
      investmentVisibilityMember ? [] : netWorthSnapshots,
      {
        cashReserve: Number(cash) || 0,
        loanPrincipal: stats.totalLoanPrincipal,
        goalSaved: stats.totalGoalCurrent,
      },
    ),
    [cash, cashHistory, goals, investmentVisibilityMember, loans, netWorthPeriod, netWorthRange, netWorthSnapshots, stats.totalGoalCurrent, stats.totalLoanPrincipal, visibleInvestments],
  );
  const latestNetWorth = netWorthSeries[netWorthSeries.length - 1];
  const previousNetWorth = netWorthSeries[netWorthSeries.length - 2];
  const netWorthChange = latestNetWorth && previousNetWorth ? latestNetWorth.netWorth - previousNetWorth.netWorth : 0;
  const isPositive = stats.totalGain >= 0;
  const assetAllocationSection = dashboardSections.assetAllocation && stats.pieData.length > 0 ? (
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
              <span className="legend-value">{formatCompactCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  ) : null;

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div>
          <p className="dash-greeting">My Money</p>
          <h1 className="dash-title">Portfolio Overview</h1>
          <p className="dash-subtitle">Investment view: {portfolioScopeLabel}</p>
        </div>
      </header>

      {appSettings?.showMotivationBanner !== false ? (
        <MotivationBanner
          stats={stats}
          goals={goals}
          netWorthChange={netWorthChange}
          netWorthRange={netWorthRange}
        />
      ) : null}

      {recurringError && <p className="form-feedback" role="alert">{recurringError}</p>}
      {attentionItems.length ? (
        <section className="dash-attention">
          <div className="dash-attention-head">
            <p className="dash-attention-label">Needs attention</p>
            <button type="button" className="dash-attention-cta" onClick={() => navigate('/monthly-review')}>
              Monthly review <ChevronRight size={14} />
            </button>
          </div>
          <div className="dash-attention-grid">
            {attentionItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`dash-attention-card ${item.tone}`}
                  onClick={() => navigate(item.to)}
                >
                  <span className="dash-attention-icon"><Icon size={16} /></span>
                  <span className="dash-attention-copy">
                    <strong>{item.title}</strong>
                    <span>{item.copy}</span>
                  </span>
                  <span
                    className="dash-attention-action"
                    onClick={(event) => {
                      if (!item.onAction) return;
                      event.stopPropagation();
                      item.onAction();
                    }}
                  >
                    {item.action}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {dashboardSections.netWorth ? (
        <>
          <section className="dash-hero-widget">
            <div className="dash-hero-main">
              <h2 className="dash-hero-title">Net worth</h2>
              <strong className="dash-hero-value">{formatCompactCurrency(stats.netWorth)}</strong>
              <p className="dash-hero-copy">
                {stats.netWorth >= 0 ? 'Assets minus liabilities' : 'Liabilities currently exceed liquid assets'}
              </p>
            </div>

            <div className="dash-hero-side">
              <article className="dash-hero-chip">
                <span>{netWorthRange === 'month' ? 'Month-on-month' : 'Year-on-year'}</span>
                <strong className={netWorthChange >= 0 ? 'dash-positive' : 'dash-negative'}>
                  {netWorthChange >= 0 ? '+' : ''}{formatCompactCurrency(netWorthChange)}
                </strong>
              </article>
              <article className="dash-hero-chip">
                <span>Liquid assets</span>
                <strong>{formatCompactCurrency(stats.liquidAssets)}</strong>
              </article>
              <article className="dash-hero-chip">
                <span>Loan liability</span>
                <strong>{formatCompactCurrency(stats.totalLoanPrincipal)}</strong>
              </article>
            </div>
          </section>

          {assetAllocationSection}

          <section className="dash-networth-panel">
            <div className="dash-networth-header">
              <div>
                <p className="dash-networth-label">Balance Sheet</p>
                <h2 className="dash-networth-title">Net worth snapshot</h2>
              </div>
              <div className="dash-networth-toggle">
                <button
                  type="button"
                  className={netWorthRange === 'month' ? 'active' : ''}
                  onClick={() => setNetWorthRange('month')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={netWorthRange === 'year' ? 'active' : ''}
                  onClick={() => setNetWorthRange('year')}
                >
                  Yearly
                </button>
              </div>
            </div>

            <div className="dash-networth-summary">
              <article className="dash-networth-stat dash-networth-primary">
                <span className="dash-networth-stat-label">Net worth</span>
                <strong>{formatCompactCurrency(stats.netWorth)}</strong>
                <span>{stats.netWorth >= 0 ? 'Assets minus liabilities' : 'Liabilities exceed current assets'}</span>
              </article>
              <article className="dash-networth-stat">
                <span className="dash-networth-stat-label">Liquid assets</span>
                <strong>{formatCompactCurrency(stats.liquidAssets)}</strong>
                <span>Cash + portfolio value</span>
              </article>
              <article className="dash-networth-stat">
                <span className="dash-networth-stat-label">Loan liability</span>
                <strong>{formatCompactCurrency(stats.totalLoanPrincipal)}</strong>
                <span>{stats.totalMonthlyEmi ? `EMI outflow ${formatCompactCurrency(stats.totalMonthlyEmi)}/mo` : 'No EMI tracked'}</span>
              </article>
              <article className="dash-networth-stat">
                <span className="dash-networth-stat-label">Goal funding</span>
                <strong>{formatCompactCurrency(stats.totalGoalCurrent)}</strong>
                <span>{stats.totalGoalTarget ? `${Math.round(stats.goalCoverage)}% of ${formatCompactCurrency(stats.totalGoalTarget)}` : 'No goal target set yet'}</span>
              </article>
            </div>

            <div className="dash-networth-chart-card">
              <div className="dash-networth-chart-summary">
                <div>
                  <span className="dash-networth-chart-label">Current net worth</span>
                  <strong>{formatCompactCurrency(latestNetWorth?.netWorth ?? stats.netWorth)}</strong>
                </div>
                <div>
                  <span className="dash-networth-chart-label">{netWorthRange === 'month' ? 'Month-on-month' : 'Year-on-year'}</span>
                  <strong className={netWorthChange >= 0 ? 'dash-positive' : 'dash-negative'}>
                    {netWorthChange >= 0 ? '+' : ''}{formatCompactCurrency(netWorthChange)}
                  </strong>
                </div>
                <ChartDurationFilter value={netWorthPeriod} onChange={setNetWorthPeriod} label="Net worth chart duration" />
              </div>

              <div className="dash-networth-chart">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={netWorthSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => formatCompactCurrency(value)} width={52} />
                    <Tooltip content={<NetWorthTooltip />} />
                    <Line type="monotone" dataKey="portfolioValue" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 3 }} name="Portfolio" />
                    <Line type="monotone" dataKey="netWorth" stroke={themePrimary} strokeWidth={3} dot={{ r: 3 }} name="Net worth" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="dash-networth-footnote">
                <CalendarRange size={14} />
                <span>Trend is built from investment snapshots. Add more dated investment updates for a richer monthly and yearly balance-sheet view.</span>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {dashboardSections.portfolioStats ? (
      <div className="dash-stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-card-icon">
            <Wallet size={20} />
          </div>
          <span className="stat-label">Portfolio value</span>
          <span className="stat-value">{formatCompactCurrency(stats.totalCurrent)}</span>
          <span className="stat-sub">Invested: {formatCompactCurrency(stats.totalInvested)}</span>
        </div>
        <div className={`stat-card ${isPositive ? 'stat-card-success' : 'stat-card-danger'}`}>
          <div className="stat-card-icon">
            {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <span className="stat-label">Portfolio returns</span>
          <span className="stat-value">{isPositive ? '+' : ''}{formatCompactCurrency(stats.totalGain)}</span>
          <span className="stat-sub">{isPositive ? '+' : ''}{stats.overallReturn}% overall</span>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon dash-neutral-icon">
            <Landmark size={20} />
          </div>
          <span className="stat-label">Cash reserve</span>
          <span className="stat-value">{formatCompactCurrency(cash)}</span>
          <span className="stat-sub">Liquid cash available</span>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon dash-neutral-icon">
            <CreditCard size={20} />
          </div>
          <span className="stat-label">Loan exposure</span>
          <span className="stat-value">{formatCompactCurrency(stats.totalLoanPrincipal)}</span>
          <span className="stat-sub">{stats.totalMonthlyEmi ? `EMI ${formatCompactCurrency(stats.totalMonthlyEmi)}/mo` : 'No monthly EMI recorded'}</span>
        </div>
      </div>
      ) : null}

      {!dashboardSections.netWorth ? assetAllocationSection : null}

      {dashboardSections.goalProgress && goals.length > 0 && (
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
              <span>{formatCompactCurrency(stats.totalGoalCurrent)} saved</span>
              <span>of {formatCompactCurrency(stats.totalGoalTarget)}</span>
            </div>
          </div>
          <div className="dash-cards-list">
            {topGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onClick={() => navigate(`/goals/${goal.id}`)} />
            ))}
          </div>
        </section>
      )}

      {dashboardSections.topInvestments && visibleInvestments.length > 0 && (
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

      {visibleInvestments.length === 0 && (
        <div className="dash-empty">
          <Wallet size={48} strokeWidth={1} />
          <h3>{investments.length === 0 ? 'Start tracking your investments' : `No investments for ${portfolioScopeLabel}`}</h3>
          <p>{investments.length === 0 ? 'Add your first investment to see your portfolio here' : 'Change the portfolio visibility setting or add an investment for this member.'}</p>
          <button className="btn-primary" onClick={() => navigate(investments.length === 0 ? '/add' : '/settings')}>
            {investments.length === 0 ? 'Add Investment' : 'Open Settings'}
          </button>
        </div>
      )}

      {!dashboardSections.netWorth
        && !dashboardSections.portfolioStats
        && !dashboardSections.assetAllocation
        && !dashboardSections.goalProgress
        && !dashboardSections.topInvestments ? (
          <div className="dash-empty">
            <Target size={48} strokeWidth={1} />
            <h3>All dashboard sections are hidden</h3>
            <p>Open Settings to turn sections back on.</p>
            <button className="btn-primary" onClick={() => navigate('/settings')}>Open Settings</button>
          </div>
        ) : null}
    </div>
  );
}
