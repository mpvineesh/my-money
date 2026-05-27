import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { getTypeInfo, formatCurrency, calculateReturns } from '../utils/constants';
import InvestmentCard from '../components/InvestmentCard';
import GoalCard from '../components/GoalCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Target, ChevronRight, Landmark, CreditCard, CalendarRange, BellRing, Repeat, AlertTriangle } from 'lucide-react';
import './Dashboard.css';

function getPeriodKey(dateValue, range) {
  const value = String(dateValue || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return range === 'year' ? value.slice(0, 4) : value.slice(0, 7);
}

function formatPeriodLabel(periodKey, range) {
  if (!periodKey) return '';
  if (range === 'year') return periodKey;

  const [year, month] = periodKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function getCurrentPeriodKey(range) {
  const now = new Date();
  return range === 'year'
    ? String(now.getFullYear())
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayDateValue() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 10);
}

function getCurrentMonthValue() {
  return getTodayDateValue().slice(0, 7);
}

function getDaysUntil(dateValue) {
  const today = new Date(`${getTodayDateValue()}T00:00:00`);
  const dueDate = new Date(`${dateValue}T00:00:00`);
  return Math.round((dueDate.getTime() - today.getTime()) / 86400000);
}

function getExpensePeriodKey(expense) {
  const value = String(expense?.dateTime || expense?.date || '').trim();
  return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : '';
}

function buildAmountSeries(history, range) {
  const periodSnapshots = new Map();
  (history || []).forEach((entry) => {
    const periodKey = getPeriodKey(entry.date, range);
    if (!periodKey) return;
    periodSnapshots.set(periodKey, Number(entry.amount ?? entry.value) || 0);
  });
  return periodSnapshots;
}

function buildNetWorthSeries(investments, range, cashHistory, loans, goals, netWorthSnapshots, currentTotals) {
  const investmentSnapshots = investments.map((investment) => {
    const periodSnapshots = new Map();

    (investment.history || []).forEach((entry) => {
      const periodKey = getPeriodKey(entry.date, range);
      if (!periodKey) return;
      periodSnapshots.set(periodKey, {
        investedAmount: Number(entry.investedAmount) || 0,
        currentValue: Number(entry.currentValue) || 0,
      });
    });

    return { id: investment.id, periodSnapshots };
  });
  const cashSnapshots = buildAmountSeries(cashHistory, range);
  const loanSnapshots = loans.map((loan) => ({
    id: loan.id,
    periodSnapshots: buildAmountSeries(loan.history, range),
    fallbackAmount: Number(loan.outstandingBalance ?? loan.principal) || 0,
  }));
  const goalSnapshots = goals.map((goal) => ({
    id: goal.id,
    periodSnapshots: buildAmountSeries(goal.history, range),
    fallbackAmount: Number(goal.currentAmount) || 0,
  }));
  const netWorthSnapshotMap = new Map(
    (netWorthSnapshots || [])
      .map((snapshot) => [range === 'year' ? String(snapshot.periodKey || '').slice(0, 4) : snapshot.periodKey, snapshot])
      .filter(([periodKey]) => periodKey),
  );

  const allPeriodKeys = [...new Set(
    [
      ...investmentSnapshots.flatMap((investment) => [...investment.periodSnapshots.keys()]),
      ...cashSnapshots.keys(),
      ...loanSnapshots.flatMap((loan) => [...loan.periodSnapshots.keys()]),
      ...goalSnapshots.flatMap((goal) => [...goal.periodSnapshots.keys()]),
      ...netWorthSnapshotMap.keys(),
    ],
  )].sort();
  const latestByInvestment = new Map();
  const latestByLoan = new Map();
  const latestByGoal = new Map();
  let latestCash = Number(currentTotals.cashReserve) || 0;
  let visiblePeriodKeys = allPeriodKeys.slice(range === 'year' ? -6 : -12);

  if (!visiblePeriodKeys.length) visiblePeriodKeys = [getCurrentPeriodKey(range)];

  const currentPeriodKey = getCurrentPeriodKey(range);
  if (!visiblePeriodKeys.includes(currentPeriodKey)) {
    visiblePeriodKeys = [...visiblePeriodKeys, currentPeriodKey].slice(range === 'year' ? -6 : -12);
  }

  return visiblePeriodKeys.map((periodKey) => {
    let investedAmount = 0;
    let portfolioValue = 0;

    investmentSnapshots.forEach((investment) => {
      const nextSnapshot = investment.periodSnapshots.get(periodKey);
      if (nextSnapshot) latestByInvestment.set(investment.id, nextSnapshot);

      const activeSnapshot = latestByInvestment.get(investment.id);
      if (!activeSnapshot) return;

      investedAmount += activeSnapshot.investedAmount;
      portfolioValue += activeSnapshot.currentValue;
    });
    const nextCash = cashSnapshots.get(periodKey);
    if (nextCash !== undefined) latestCash = nextCash;

    let loanPrincipal = 0;
    loanSnapshots.forEach((loan) => {
      const nextSnapshot = loan.periodSnapshots.get(periodKey);
      if (nextSnapshot !== undefined) latestByLoan.set(loan.id, nextSnapshot);
      loanPrincipal += latestByLoan.get(loan.id) ?? loan.fallbackAmount;
    });

    let goalSaved = 0;
    goalSnapshots.forEach((goal) => {
      const nextSnapshot = goal.periodSnapshots.get(periodKey);
      if (nextSnapshot !== undefined) latestByGoal.set(goal.id, nextSnapshot);
      goalSaved += latestByGoal.get(goal.id) ?? goal.fallbackAmount;
    });

    const savedSnapshot = netWorthSnapshotMap.get(periodKey);

    return {
      key: periodKey,
      label: formatPeriodLabel(periodKey, range),
      investedAmount: savedSnapshot?.investedAmount ?? investedAmount,
      portfolioValue: savedSnapshot?.portfolioValue ?? portfolioValue,
      cashReserve: savedSnapshot?.cashReserve ?? latestCash,
      loanPrincipal: savedSnapshot?.loanPrincipal ?? loanPrincipal,
      goalSaved: savedSnapshot?.goalSaved ?? goalSaved,
      netWorth: savedSnapshot?.netWorth ?? (portfolioValue + latestCash - loanPrincipal),
    };
  });
}

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
    recordRecurringEntryNow,
    appSettings,
  } = useApp();
  const navigate = useNavigate();
  const [netWorthRange, setNetWorthRange] = useState('month');
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
    const dueRecurring = recurringEntries.filter((entry) => getDaysUntil(entry.nextDueDate) <= 7);
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
        action: 'Record all',
        to: '/recurring',
        onAction: () => dueRecurring.forEach((entry) => recordRecurringEntryNow(entry.id, entry.nextDueDate)),
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
  }, [expenseBudgets, expenses, recordRecurringEntryNow, recurringEntries, reminders, visibleInvestments]);

  const netWorthSeries = useMemo(
    () => buildNetWorthSeries(visibleInvestments, netWorthRange, cashHistory, loans, goals, netWorthSnapshots, {
      cashReserve: Number(cash) || 0,
      loanPrincipal: stats.totalLoanPrincipal,
      goalSaved: stats.totalGoalCurrent,
    }),
    [cash, cashHistory, goals, loans, netWorthRange, netWorthSnapshots, stats.totalGoalCurrent, stats.totalLoanPrincipal, visibleInvestments],
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
              <span className="legend-value">{formatCurrency(item.value)}</span>
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
              <strong className="dash-hero-value">{formatCurrency(stats.netWorth)}</strong>
              <p className="dash-hero-copy">
                {stats.netWorth >= 0 ? 'Assets minus liabilities' : 'Liabilities currently exceed liquid assets'}
              </p>
            </div>

            <div className="dash-hero-side">
              <article className="dash-hero-chip">
                <span>{netWorthRange === 'month' ? 'Month-on-month' : 'Year-on-year'}</span>
                <strong className={netWorthChange >= 0 ? 'dash-positive' : 'dash-negative'}>
                  {netWorthChange >= 0 ? '+' : ''}{formatCurrency(netWorthChange)}
                </strong>
              </article>
              <article className="dash-hero-chip">
                <span>Liquid assets</span>
                <strong>{formatCurrency(stats.liquidAssets)}</strong>
              </article>
              <article className="dash-hero-chip">
                <span>Loan liability</span>
                <strong>{formatCurrency(stats.totalLoanPrincipal)}</strong>
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
                <strong>{formatCurrency(stats.netWorth)}</strong>
                <span>{stats.netWorth >= 0 ? 'Assets minus liabilities' : 'Liabilities exceed current assets'}</span>
              </article>
              <article className="dash-networth-stat">
                <span className="dash-networth-stat-label">Liquid assets</span>
                <strong>{formatCurrency(stats.liquidAssets)}</strong>
                <span>Cash + portfolio value</span>
              </article>
              <article className="dash-networth-stat">
                <span className="dash-networth-stat-label">Loan liability</span>
                <strong>{formatCurrency(stats.totalLoanPrincipal)}</strong>
                <span>{stats.totalMonthlyEmi ? `EMI outflow ${formatCurrency(stats.totalMonthlyEmi)}/mo` : 'No EMI tracked'}</span>
              </article>
              <article className="dash-networth-stat">
                <span className="dash-networth-stat-label">Goal funding</span>
                <strong>{formatCurrency(stats.totalGoalCurrent)}</strong>
                <span>{stats.totalGoalTarget ? `${Math.round(stats.goalCoverage)}% of ${formatCurrency(stats.totalGoalTarget)}` : 'No goal target set yet'}</span>
              </article>
            </div>

            <div className="dash-networth-chart-card">
              <div className="dash-networth-chart-summary">
                <div>
                  <span className="dash-networth-chart-label">Current net worth</span>
                  <strong>{formatCurrency(latestNetWorth?.netWorth ?? stats.netWorth)}</strong>
                </div>
                <div>
                  <span className="dash-networth-chart-label">{netWorthRange === 'month' ? 'Month-on-month' : 'Year-on-year'}</span>
                  <strong className={netWorthChange >= 0 ? 'dash-positive' : 'dash-negative'}>
                    {netWorthChange >= 0 ? '+' : ''}{formatCurrency(netWorthChange)}
                  </strong>
                </div>
              </div>

              <div className="dash-networth-chart">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={netWorthSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip content={<NetWorthTooltip />} />
                    <Line type="monotone" dataKey="portfolioValue" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 3 }} name="Portfolio" />
                    <Line type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} name="Net worth" />
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
          <span className="stat-value">{formatCurrency(stats.totalCurrent)}</span>
          <span className="stat-sub">Invested: {formatCurrency(stats.totalInvested)}</span>
        </div>
        <div className={`stat-card ${isPositive ? 'stat-card-success' : 'stat-card-danger'}`}>
          <div className="stat-card-icon">
            {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <span className="stat-label">Portfolio returns</span>
          <span className="stat-value">{isPositive ? '+' : ''}{formatCurrency(stats.totalGain)}</span>
          <span className="stat-sub">{isPositive ? '+' : ''}{stats.overallReturn}% overall</span>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon dash-neutral-icon">
            <Landmark size={20} />
          </div>
          <span className="stat-label">Cash reserve</span>
          <span className="stat-value">{formatCurrency(cash)}</span>
          <span className="stat-sub">Liquid cash available</span>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon dash-neutral-icon">
            <CreditCard size={20} />
          </div>
          <span className="stat-label">Loan exposure</span>
          <span className="stat-value">{formatCurrency(stats.totalLoanPrincipal)}</span>
          <span className="stat-sub">{stats.totalMonthlyEmi ? `EMI ${formatCurrency(stats.totalMonthlyEmi)}/mo` : 'No monthly EMI recorded'}</span>
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
