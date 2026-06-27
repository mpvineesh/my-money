import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { DEFAULT_FAMILY_MEMBER, INVESTMENT_TYPES, getTypeInfo, formatCurrency, formatCompactCurrency, calculateReturns, isValidDateValue } from '../utils/constants';
import InvestmentCard from '../components/InvestmentCard';
import { Briefcase, CalendarRange, CandlestickChart, ChevronRight, Landmark, Layers, ReceiptText, RefreshCw, Search, SlidersHorizontal, TrendingUp, Users } from 'lucide-react';
import { computePortfolioXirr, compute80C } from '../utils/finance';
import { Area, ComposedChart, LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './Investments.css';

function getPeriodKey(dateValue, range) {
  const value = String(dateValue || '');
  if (!isValidDateValue(value)) return '';
  return range === 'year' ? value.slice(0, 4) : value.slice(0, 7);
}

function formatPeriodLabel(periodKey, range) {
  if (!periodKey) return '';
  if (range === 'year') return periodKey;

  const [year, month] = periodKey.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function buildProgressSeries(investments, range) {
  const sortedInvestments = investments.map((investment) => {
    const periodSnapshots = new Map();

    (investment.history || []).forEach((entry) => {
      const periodKey = getPeriodKey(entry.date, range);
      if (!periodKey) return;
      periodSnapshots.set(periodKey, {
        investedAmount: Number(entry.investedAmount) || 0,
        currentValue: Number(entry.currentValue) || 0,
      });
    });

    return {
      id: investment.id,
      periodSnapshots,
    };
  });

  const allPeriodKeys = [...new Set(sortedInvestments.flatMap((investment) => [...investment.periodSnapshots.keys()]))].sort();
  const visiblePeriodKeys = allPeriodKeys.slice(range === 'year' ? -6 : -12);
  const latestByInvestment = new Map();

  return visiblePeriodKeys.map((periodKey) => {
    let investedAmount = 0;
    let currentValue = 0;

    sortedInvestments.forEach((investment) => {
      const nextSnapshot = investment.periodSnapshots.get(periodKey);
      if (nextSnapshot) latestByInvestment.set(investment.id, nextSnapshot);

      const activeSnapshot = latestByInvestment.get(investment.id);
      if (!activeSnapshot) return;

      investedAmount += activeSnapshot.investedAmount;
      currentValue += activeSnapshot.currentValue;
    });

    return {
      key: periodKey,
      label: formatPeriodLabel(periodKey, range),
      investedAmount,
      currentValue,
      gain: currentValue - investedAmount,
    };
  });
}

function buildMemberOptions(familyMembers, investments, ownerName = DEFAULT_FAMILY_MEMBER.name) {
  const options = new Map([[DEFAULT_FAMILY_MEMBER.id, { id: DEFAULT_FAMILY_MEMBER.id, name: ownerName }]]);

  familyMembers.forEach((member) => {
    options.set(member.id, member);
  });

  investments.forEach((investment) => {
    const memberId = investment.memberId || DEFAULT_FAMILY_MEMBER.id;
    const memberName = investment.memberName || DEFAULT_FAMILY_MEMBER.name;
    options.set(memberId, { id: memberId, name: memberName });
  });

  return [...options.values()].sort((left, right) => {
    if (left.id === DEFAULT_FAMILY_MEMBER.id) return -1;
    if (right.id === DEFAULT_FAMILY_MEMBER.id) return 1;
    return left.name.localeCompare(right.name);
  });
}

function buildMemberSummaries(investments, memberOptions) {
  const summaryMap = new Map(
    memberOptions.map((member) => [
      member.id,
      {
        ...member,
        investedAmount: 0,
        currentValue: 0,
        gain: 0,
        count: 0,
      },
    ]),
  );

  investments.forEach((investment) => {
    const memberId = investment.memberId || DEFAULT_FAMILY_MEMBER.id;
    const memberName = investment.memberName || DEFAULT_FAMILY_MEMBER.name;
    const currentSummary = summaryMap.get(memberId) || {
      id: memberId,
      name: memberName,
      investedAmount: 0,
      currentValue: 0,
      gain: 0,
      count: 0,
    };

    currentSummary.investedAmount += Number(investment.investedAmount) || 0;
    currentSummary.currentValue += Number(investment.currentValue) || 0;
    currentSummary.gain += (Number(investment.currentValue) || 0) - (Number(investment.investedAmount) || 0);
    currentSummary.count += 1;

    summaryMap.set(memberId, currentSummary);
  });

  return [...summaryMap.values()].sort((left, right) => {
    if (left.id === DEFAULT_FAMILY_MEMBER.id) return -1;
    if (right.id === DEFAULT_FAMILY_MEMBER.id) return 1;
    return right.currentValue - left.currentValue || left.name.localeCompare(right.name);
  });
}

function ProgressTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const invested = payload.find((item) => item.dataKey === 'investedAmount')?.value || 0;
  const current = payload.find((item) => item.dataKey === 'currentValue')?.value || 0;

  return (
    <div className="inv-progress-tooltip">
      <strong>{label}</strong>
      <span>Invested: {formatCurrency(invested)}</span>
      <span>Value: {formatCurrency(current)}</span>
      <span>Gain: {formatCurrency(current - invested)}</span>
    </div>
  );
}

// Project each holding's current value forward, compounding annually at its own interest rate.
// Holdings without a rate stay flat. The baseline (today's value held constant) is kept alongside
// so the chart can show projected growth above the current level.
const PROJECTION_YEARS = 10;

function buildProjectionSeries(investments, years = PROJECTION_YEARS) {
  const startYear = new Date().getFullYear();
  const baseline = investments.reduce((sum, investment) => sum + (Number(investment.currentValue) || 0), 0);

  return Array.from({ length: years + 1 }, (_, offset) => {
    const projected = investments.reduce((sum, investment) => {
      const rate = parseFloat(investment.interestRate) || 0;
      return sum + (Number(investment.currentValue) || 0) * Math.pow(1 + rate / 100, offset);
    }, 0);

    return {
      year: startYear + offset,
      label: offset === 0 ? 'Now' : String(startYear + offset),
      projected: Math.round(projected),
      baseline: Math.round(baseline),
    };
  });
}

function ProjectionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const growth = point.projected - point.baseline;

  return (
    <div className="inv-progress-tooltip">
      <strong>{point.label}</strong>
      <span>Projected: {formatCurrency(point.projected)}</span>
      <span>Growth vs now: {growth >= 0 ? '+' : ''}{formatCurrency(growth)}</span>
    </div>
  );
}

export default function Investments() {
  const { investments, visibleInvestments, familyMembers, investmentVisibilityMember, contributeToInvestment, themePrimary, ownerName, refreshNavPrices } = useApp();
  const [navBusy, setNavBusy] = useState(false);
  const [navMsg, setNavMsg] = useState('');
  const hasLinkedFunds = visibleInvestments.some((inv) => inv.schemeCode && Number(inv.units) > 0);

  async function handleRefreshNav() {
    setNavBusy(true);
    setNavMsg('');
    const res = await refreshNavPrices();
    setNavBusy(false);
    if (!res?.ok) setNavMsg(res?.error || 'Could not refresh NAVs.');
    else if (!res.updated) setNavMsg(res.message || 'No linked funds to update.');
    else setNavMsg(`Updated ${res.updated} of ${res.total} fund${res.total === 1 ? '' : 's'}.`);
    setTimeout(() => setNavMsg(''), 4000);
  }

  const portfolioXirr = useMemo(() => computePortfolioXirr(visibleInvestments), [visibleInvestments]);
  const tax80c = useMemo(() => compute80C(visibleInvestments), [visibleInvestments]);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMember, setFilterMember] = useState('all');
  const [sortBy, setSortBy] = useState('value');
  const [showFilters, setShowFilters] = useState(false);
  const [progressRange, setProgressRange] = useState('month');
  const [contributionTarget, setContributionTarget] = useState(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionDate, setContributionDate] = useState('');

  function openContribution(investment) {
    setContributionTarget(investment);
    setContributionAmount('');
    setContributionDate(new Date().toISOString().slice(0, 10));
  }

  function closeContribution() {
    setContributionTarget(null);
  }

  function submitContribution(event) {
    event.preventDefault();
    const amount = Number(contributionAmount) || 0;
    if (!contributionTarget || amount <= 0) return;
    contributeToInvestment(contributionTarget.id, { amount, date: contributionDate });
    closeContribution();
  }
  const portfolioScopeLabel = investmentVisibilityMember ? investmentVisibilityMember.name : 'Whole family';
  const scopedFamilyMembers = useMemo(
    () => (investmentVisibilityMember ? [investmentVisibilityMember] : familyMembers),
    [familyMembers, investmentVisibilityMember],
  );

  const memberOptions = useMemo(
    () => buildMemberOptions(scopedFamilyMembers, visibleInvestments, ownerName),
    [scopedFamilyMembers, visibleInvestments, ownerName],
  );
  const memberSummaries = useMemo(
    () => buildMemberSummaries(visibleInvestments, memberOptions),
    [memberOptions, visibleInvestments],
  );
  const activeFilterMember = memberOptions.some((member) => member.id === filterMember) ? filterMember : 'all';

  const memberScopedInvestments = useMemo(() => {
    if (activeFilterMember === 'all') return visibleInvestments;
    return visibleInvestments.filter((investment) => (investment.memberId || DEFAULT_FAMILY_MEMBER.id) === activeFilterMember);
  }, [activeFilterMember, visibleInvestments]);

  const activeTypes = useMemo(() => {
    const types = new Set(memberScopedInvestments.map((investment) => investment.type));
    return INVESTMENT_TYPES.filter((type) => types.has(type.value));
  }, [memberScopedInvestments]);

  const filtered = useMemo(() => {
    let result = [...memberScopedInvestments];

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (investment) =>
          investment.name.toLowerCase().includes(query) ||
          getTypeInfo(investment.type).label.toLowerCase().includes(query) ||
          (investment.memberName || DEFAULT_FAMILY_MEMBER.name).toLowerCase().includes(query),
      );
    }

    if (filterType !== 'all') {
      result = result.filter((investment) => investment.type === filterType);
    }

    switch (sortBy) {
      case 'value':
        result.sort((left, right) => (Number(right.currentValue) || 0) - (Number(left.currentValue) || 0));
        break;
      case 'invested':
        result.sort((left, right) => (Number(right.investedAmount) || 0) - (Number(left.investedAmount) || 0));
        break;
      case 'returns':
        result.sort((left, right) => {
          const leftReturns =
            ((Number(left.currentValue) - Number(left.investedAmount)) / Number(left.investedAmount)) || 0;
          const rightReturns =
            ((Number(right.currentValue) - Number(right.investedAmount)) / Number(right.investedAmount)) || 0;
          return rightReturns - leftReturns;
        });
        break;
      case 'name':
        result.sort((left, right) => left.name.localeCompare(right.name));
        break;
      default:
        break;
    }

    return result;
  }, [filterType, memberScopedInvestments, search, sortBy]);

  // Mutual funds and stocks are managed on their own screens; collapse each into one
  // summary card here so the main list stays readable.
  const otherInvestments = useMemo(
    () => filtered.filter((inv) => inv.type !== 'mutual_funds' && inv.type !== 'stocks'),
    [filtered],
  );
  const aggregateByType = useMemo(() => {
    const acc = {};
    filtered.forEach((inv) => {
      if (inv.type !== 'mutual_funds' && inv.type !== 'stocks') return;
      const a = acc[inv.type] || (acc[inv.type] = { count: 0, invested: 0, current: 0 });
      a.count += 1;
      a.invested += Number(inv.investedAmount) || 0;
      a.current += Number(inv.currentValue) || 0;
    });
    Object.values(acc).forEach((a) => { a.gain = a.current - a.invested; });
    return acc;
  }, [filtered]);
  const mfAggregate = aggregateByType.mutual_funds || null;
  const stocksAggregate = aggregateByType.stocks || null;
  const listCount = otherInvestments.length + (mfAggregate ? 1 : 0) + (stocksAggregate ? 1 : 0);

  const selectedMember = memberOptions.find((member) => member.id === activeFilterMember);
  const totalValue = useMemo(
    () => filtered.reduce((sum, investment) => sum + (Number(investment.currentValue) || 0), 0),
    [filtered],
  );

  const progressSeries = useMemo(() => buildProgressSeries(filtered, progressRange), [filtered, progressRange]);
  const latestProgress = progressSeries[progressSeries.length - 1];
  const previousProgress = progressSeries[progressSeries.length - 2];
  const periodGainChange = latestProgress && previousProgress ? latestProgress.gain - previousProgress.gain : 0;

  const projectionSeries = useMemo(() => buildProjectionSeries(filtered), [filtered]);
  const projectedFuture = projectionSeries[projectionSeries.length - 1];
  const projectedGrowth = projectedFuture ? projectedFuture.projected - projectedFuture.baseline : 0;
  const hasProjectionRates = filtered.some((investment) => (parseFloat(investment.interestRate) || 0) > 0);
  const totalLabel = search || filterType !== 'all' || activeFilterMember !== 'all' ? 'Showing' : 'Total';

  return (
    <div className="investments-page">
      <header className="inv-page-header">
        <div>
          <p className="inv-page-label">Portfolio</p>
          <h1 className="inv-page-title">My Investments</h1>
          <p className="inv-page-scope">Showing: {portfolioScopeLabel}</p>
          {navMsg ? <p className="inv-nav-msg">{navMsg}</p> : null}
        </div>
        <div className="inv-page-header-right">
          {hasLinkedFunds ? (
            <button type="button" className="inv-transactions-link" onClick={handleRefreshNav} disabled={navBusy}>
              <RefreshCw size={16} className={navBusy ? 'inv-nav-spin' : ''} />
              {navBusy ? 'Refreshing…' : 'Refresh NAV'}
            </button>
          ) : null}
          <button type="button" className="inv-transactions-link" onClick={() => navigate('/investments/transactions')}>
            <ReceiptText size={16} />
            Transactions
          </button>
          <div className="inv-page-total">
            <span className="inv-total-label">{totalLabel}</span>
            <span className="inv-total-value">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      </header>

      {(portfolioXirr != null || tax80c.eligibleCount > 0) ? (
        <section className="inv-returns-panel">
          {portfolioXirr != null ? (
            <div className="inv-returns-stat">
              <div className="inv-returns-icon"><TrendingUp size={18} /></div>
              <div>
                <span className="inv-returns-label">True return (XIRR)</span>
                <strong className={`inv-returns-value ${portfolioXirr >= 0 ? 'positive' : 'negative'}`}>
                  {portfolioXirr >= 0 ? '+' : ''}{(portfolioXirr * 100).toFixed(1)}%
                </strong>
                <span className="inv-returns-note">annualised across holdings</span>
              </div>
            </div>
          ) : null}
          {tax80c.eligibleCount > 0 ? (
            <div className="inv-returns-stat">
              <div className="inv-returns-icon"><Landmark size={18} /></div>
              <div className="inv-returns-grow">
                <span className="inv-returns-label">80C used · {tax80c.fyLabel}</span>
                <strong className="inv-returns-value">
                  {formatCurrency(tax80c.used)} <em>/ {formatCurrency(tax80c.limit)}</em>
                </strong>
                <div className="inv-80c-bar"><div style={{ width: `${tax80c.percent}%` }} /></div>
                <span className="inv-returns-note">{formatCurrency(tax80c.remaining)} of headroom left</span>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {visibleInvestments.length > 0 ? (
        <section className="inv-family-panel">
          <div className="inv-family-panel-head">
            <div>
              <p className="inv-progress-label">Family Split</p>
              <h2 className="inv-progress-title">Investments by member</h2>
            </div>
            <button type="button" className="inv-manage-link" onClick={() => navigate('/family-members')}>
              <Users size={16} />
              Manage members
            </button>
          </div>

          <div className="inv-member-summary-grid">
            {memberSummaries.map((member) => (
              <button
                key={member.id}
                type="button"
                className={`inv-member-summary-card ${activeFilterMember === member.id ? 'active' : ''}`}
                onClick={() => setFilterMember((current) => (current === member.id ? 'all' : member.id))}
              >
                <div className="inv-member-summary-top">
                  <span>{member.name}</span>
                  <strong>{formatCurrency(member.currentValue)}</strong>
                </div>
                <div className="inv-member-summary-meta">
                  <span>{member.count} holding{member.count === 1 ? '' : 's'}</span>
                  <span className={member.gain >= 0 ? 'positive' : 'negative'}>
                    {member.gain >= 0 ? '+' : ''}{formatCurrency(member.gain)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {filtered.length > 0 ? (
        <section className="inv-progress-panel">
          <div className="inv-progress-header">
            <div>
              <p className="inv-progress-label">Tracked Progress</p>
              <h2 className="inv-progress-title">
                Portfolio trend{selectedMember ? ` · ${selectedMember.name}` : ''}
              </h2>
            </div>
            <div className="inv-progress-actions">
              <div className="inv-progress-toggle">
                <button
                  type="button"
                  className={progressRange === 'month' ? 'active' : ''}
                  onClick={() => setProgressRange('month')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={progressRange === 'year' ? 'active' : ''}
                  onClick={() => setProgressRange('year')}
                >
                  Yearly
                </button>
              </div>
            </div>
          </div>

          <div className="inv-progress-summary">
            <div>
              <span className="inv-progress-summary-label">Current value</span>
              <strong>{formatCurrency(latestProgress?.currentValue || totalValue)}</strong>
            </div>
            <div>
              <span className="inv-progress-summary-label">Tracked gain</span>
              <strong>{formatCurrency(latestProgress?.gain || 0)}</strong>
            </div>
            <div>
              <span className="inv-progress-summary-label">
                {progressRange === 'month' ? 'Month-on-month' : 'Year-on-year'}
              </span>
              <strong className={periodGainChange >= 0 ? 'inv-progress-positive' : 'inv-progress-negative'}>
                {periodGainChange >= 0 ? '+' : ''}{formatCurrency(periodGainChange)}
              </strong>
            </div>
          </div>

          <div className="inv-progress-chart">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={progressSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => formatCompactCurrency(value)}
                  width={52}
                />
                <Tooltip content={<ProgressTooltip />} />
                <Line type="monotone" dataKey="investedAmount" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="currentValue" stroke={themePrimary} strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="inv-progress-footnote">
            <CalendarRange size={14} />
            <span>Each investment edit records a dated snapshot. Older investments start building trend history from the snapshots you save.</span>
          </div>
        </section>
      ) : null}

      {filtered.length > 0 ? (
        <section className="inv-progress-panel">
          <div className="inv-progress-header">
            <div>
              <p className="inv-progress-label">Projection</p>
              <h2 className="inv-progress-title">
                Projected value · next {PROJECTION_YEARS} years{selectedMember ? ` · ${selectedMember.name}` : ''}
              </h2>
            </div>
          </div>

          <div className="inv-progress-summary">
            <div>
              <span className="inv-progress-summary-label">Current value</span>
              <strong>{formatCurrency(projectionSeries[0]?.baseline || totalValue)}</strong>
            </div>
            <div>
              <span className="inv-progress-summary-label">In {PROJECTION_YEARS} years</span>
              <strong>{formatCurrency(projectedFuture?.projected || 0)}</strong>
            </div>
            <div>
              <span className="inv-progress-summary-label">Projected growth</span>
              <strong className={projectedGrowth >= 0 ? 'inv-progress-positive' : 'inv-progress-negative'}>
                {projectedGrowth >= 0 ? '+' : ''}{formatCurrency(projectedGrowth)}
              </strong>
            </div>
          </div>

          <div className="inv-progress-chart">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={projectionSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="invProjectionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => formatCompactCurrency(value)}
                  width={52}
                />
                <Tooltip content={<ProjectionTooltip />} />
                <Line type="monotone" dataKey="baseline" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Current value" />
                <Area type="monotone" dataKey="projected" stroke="#0f766e" strokeWidth={3} fill="url(#invProjectionFill)" dot={{ r: 3 }} name="Projected" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="inv-progress-footnote">
            <TrendingUp size={14} />
            <span>
              {hasProjectionRates
                ? "Compounds each holding's current value at its own interest rate. Holdings without a rate stay flat — this is an estimate, not a guarantee."
                : 'Set an interest rate on each holding to project its growth. Without a rate, the value is held flat.'}
            </span>
          </div>
        </section>
      ) : null}

      <div className="inv-search-bar">
        <Search size={18} className="inv-search-icon" />
        <input
          type="text"
          placeholder="Search investments or members..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="inv-search-input"
        />
        <button
          type="button"
          className={`inv-filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {showFilters ? (
        <div className="inv-filters">
          <div className="inv-filter-group">
            <label className="inv-filter-label">Family Member</label>
            <div className="inv-filter-chips">
              <button
                type="button"
                className={`filter-chip ${activeFilterMember === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMember('all')}
              >
                All members
              </button>
              {memberOptions.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={`filter-chip ${activeFilterMember === member.id ? 'active' : ''}`}
                  onClick={() => setFilterMember(member.id)}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>

          <div className="inv-filter-group">
            <label className="inv-filter-label">Type</label>
            <div className="inv-filter-chips">
              <button
                type="button"
                className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All
              </button>
              {activeTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  className={`filter-chip ${filterType === type.value ? 'active' : ''}`}
                  style={
                    filterType === type.value
                      ? { backgroundColor: `${type.color}18`, color: type.color, borderColor: `${type.color}40` }
                      : {}
                  }
                  onClick={() => setFilterType(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="inv-filter-group">
            <label className="inv-filter-label">Sort by</label>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="inv-sort-select">
              <option value="value">Current Value</option>
              <option value="invested">Invested Amount</option>
              <option value="returns">Returns %</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      ) : null}

      <div className="inv-count">
        {listCount} item{listCount !== 1 ? 's' : ''}
        {selectedMember ? ` for ${selectedMember.name}` : ''}
        {filterType !== 'all' ? ` in ${getTypeInfo(filterType).label}` : ''}
      </div>

      <div className="inv-cards-list">
        {mfAggregate ? (
          <button type="button" className="inv-mf-card" onClick={() => navigate('/mutual-funds')}>
            <div className="inv-mf-icon"><Layers size={22} /></div>
            <div className="inv-mf-main">
              <div className="inv-mf-titlerow">
                <strong>Mutual Funds</strong>
                <span className="inv-mf-count">{mfAggregate.count} fund{mfAggregate.count === 1 ? '' : 's'}</span>
              </div>
              <div className="inv-mf-metrics">
                <span>Current <strong>{formatCurrency(mfAggregate.current)}</strong></span>
                <span>Invested <strong>{formatCurrency(mfAggregate.invested)}</strong></span>
                <span className={mfAggregate.gain >= 0 ? 'pos' : 'neg'}>
                  {mfAggregate.gain >= 0 ? '+' : ''}{calculateReturns(mfAggregate.invested, mfAggregate.current)}%
                </span>
              </div>
            </div>
            <ChevronRight size={18} className="inv-mf-chevron" />
          </button>
        ) : null}
        {stocksAggregate ? (
          <button type="button" className="inv-mf-card" onClick={() => navigate('/stocks')}>
            <div className="inv-mf-icon"><CandlestickChart size={22} /></div>
            <div className="inv-mf-main">
              <div className="inv-mf-titlerow">
                <strong>Stocks</strong>
                <span className="inv-mf-count">{stocksAggregate.count} stock{stocksAggregate.count === 1 ? '' : 's'}</span>
              </div>
              <div className="inv-mf-metrics">
                <span>Current <strong>{formatCurrency(stocksAggregate.current)}</strong></span>
                <span>Invested <strong>{formatCurrency(stocksAggregate.invested)}</strong></span>
                <span className={stocksAggregate.gain >= 0 ? 'pos' : 'neg'}>
                  {stocksAggregate.gain >= 0 ? '+' : ''}{calculateReturns(stocksAggregate.invested, stocksAggregate.current)}%
                </span>
              </div>
            </div>
            <ChevronRight size={18} className="inv-mf-chevron" />
          </button>
        ) : null}
        {otherInvestments.map((investment) => (
          <InvestmentCard
            key={investment.id}
            investment={investment}
            onClick={() => navigate(`/investments/edit/${investment.id}`)}
            onViewTransactions={() => navigate(`/investments/transactions?investment=${investment.id}`)}
            onAddContribution={() => openContribution(investment)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="inv-empty">
          <Briefcase size={40} strokeWidth={1} />
          <p>
            {search || filterType !== 'all' || filterMember !== 'all'
              ? 'No investments match your current member and filter selection'
              : investments.length === 0
                ? 'No investments yet'
                : `No investments are visible for ${portfolioScopeLabel}`}
          </p>
          {!search && filterType === 'all' && activeFilterMember === 'all' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(investments.length === 0 ? '/add' : '/settings')}
            >
              {investments.length === 0 ? 'Add Investment' : 'Open Settings'}
            </button>
          ) : null}
        </div>
      ) : null}

      {contributionTarget ? (
        <div className="inv-contrib-backdrop" role="presentation" onClick={closeContribution}>
          <div
            className="inv-contrib-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="inv-contrib-head">
              <p className="inv-contrib-label">Invest more</p>
              <h2 className="inv-contrib-title">{contributionTarget.name}</h2>
              <p className="inv-contrib-sub">
                Adds to invested amount and current value, and records an addition transaction.
              </p>
            </div>
            <form onSubmit={submitContribution} className="inv-contrib-form">
              <label className="inv-contrib-field">
                <span>Amount</span>
                <div className="inv-contrib-input-prefix">
                  <span>₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    value={contributionAmount}
                    onChange={(event) => setContributionAmount(event.target.value)}
                    autoFocus
                  />
                </div>
              </label>
              <label className="inv-contrib-field">
                <span>Date</span>
                <input
                  type="date"
                  value={contributionDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setContributionDate(event.target.value)}
                />
              </label>
              <div className="inv-contrib-actions">
                <button type="button" className="inv-contrib-cancel" onClick={closeContribution}>
                  Cancel
                </button>
                <button type="submit" className="inv-contrib-save" disabled={!(Number(contributionAmount) > 0)}>
                  Add contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
