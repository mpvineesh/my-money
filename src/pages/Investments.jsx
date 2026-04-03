import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { DEFAULT_FAMILY_MEMBER, INVESTMENT_TYPES, getTypeInfo, formatCurrency } from '../utils/constants';
import InvestmentCard from '../components/InvestmentCard';
import { Briefcase, CalendarRange, Search, SlidersHorizontal, Users } from 'lucide-react';
import { LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './Investments.css';

function getPeriodKey(dateValue, range) {
  const value = String(dateValue || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
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

function buildMemberOptions(familyMembers, investments) {
  const options = new Map([[DEFAULT_FAMILY_MEMBER.id, DEFAULT_FAMILY_MEMBER]]);

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

export default function Investments() {
  const { investments, familyMembers } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMember, setFilterMember] = useState('all');
  const [sortBy, setSortBy] = useState('value');
  const [showFilters, setShowFilters] = useState(false);
  const [progressRange, setProgressRange] = useState('month');

  const memberOptions = useMemo(() => buildMemberOptions(familyMembers, investments), [familyMembers, investments]);
  const memberSummaries = useMemo(() => buildMemberSummaries(investments, memberOptions), [investments, memberOptions]);

  const memberScopedInvestments = useMemo(() => {
    if (filterMember === 'all') return investments;
    return investments.filter((investment) => (investment.memberId || DEFAULT_FAMILY_MEMBER.id) === filterMember);
  }, [filterMember, investments]);

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

  const selectedMember = memberOptions.find((member) => member.id === filterMember);
  const totalValue = useMemo(
    () => filtered.reduce((sum, investment) => sum + (Number(investment.currentValue) || 0), 0),
    [filtered],
  );

  const progressSeries = useMemo(() => buildProgressSeries(filtered, progressRange), [filtered, progressRange]);
  const latestProgress = progressSeries[progressSeries.length - 1];
  const previousProgress = progressSeries[progressSeries.length - 2];
  const periodGainChange = latestProgress && previousProgress ? latestProgress.gain - previousProgress.gain : 0;
  const totalLabel = search || filterType !== 'all' || filterMember !== 'all' ? 'Showing' : 'Total';

  return (
    <div className="investments-page">
      <header className="inv-page-header">
        <div>
          <p className="inv-page-label">Portfolio</p>
          <h1 className="inv-page-title">My Investments</h1>
        </div>
        <div className="inv-page-total">
          <span className="inv-total-label">{totalLabel}</span>
          <span className="inv-total-value">{formatCurrency(totalValue)}</span>
        </div>
      </header>

      {investments.length > 0 ? (
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
                className={`inv-member-summary-card ${filterMember === member.id ? 'active' : ''}`}
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
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip content={<ProgressTooltip />} />
                <Line type="monotone" dataKey="investedAmount" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="currentValue" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="inv-progress-footnote">
            <CalendarRange size={14} />
            <span>Each investment edit records a dated snapshot. Older investments start building trend history from the snapshots you save.</span>
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
                className={`filter-chip ${filterMember === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMember('all')}
              >
                All members
              </button>
              {memberOptions.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={`filter-chip ${filterMember === member.id ? 'active' : ''}`}
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
        {filtered.length} investment{filtered.length !== 1 ? 's' : ''}
        {selectedMember ? ` for ${selectedMember.name}` : ''}
        {filterType !== 'all' ? ` in ${getTypeInfo(filterType).label}` : ''}
      </div>

      <div className="inv-cards-list">
        {filtered.map((investment) => (
          <InvestmentCard
            key={investment.id}
            investment={investment}
            onClick={() => navigate(`/investments/edit/${investment.id}`)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="inv-empty">
          <Briefcase size={40} strokeWidth={1} />
          <p>
            {search || filterType !== 'all' || filterMember !== 'all'
              ? 'No investments match your current member and filter selection'
              : 'No investments yet'}
          </p>
          {!search && filterType === 'all' && filterMember === 'all' ? (
            <button type="button" className="btn-primary" onClick={() => navigate('/add')}>
              Add Investment
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
