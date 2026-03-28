import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { INVESTMENT_TYPES, getTypeInfo, formatCurrency } from '../utils/constants';
import InvestmentCard from '../components/InvestmentCard';
import { Search, SlidersHorizontal, Briefcase, CalendarRange } from 'lucide-react';
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

  const allPeriodKeys = [...new Set(
    sortedInvestments.flatMap((investment) => [...investment.periodSnapshots.keys()]),
  )].sort();
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
  const { investments } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('value');
  const [showFilters, setShowFilters] = useState(false);
  const [progressRange, setProgressRange] = useState('month');

  const activeTypes = useMemo(() => {
    const types = new Set(investments.map((i) => i.type));
    return INVESTMENT_TYPES.filter((t) => types.has(t.value));
  }, [investments]);

  const filtered = useMemo(() => {
    let result = [...investments];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          getTypeInfo(i.type).label.toLowerCase().includes(q)
      );
    }

    if (filterType !== 'all') {
      result = result.filter((i) => i.type === filterType);
    }

    switch (sortBy) {
      case 'value':
        result.sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0));
        break;
      case 'invested':
        result.sort((a, b) => (Number(b.investedAmount) || 0) - (Number(a.investedAmount) || 0));
        break;
      case 'returns':
        result.sort((a, b) => {
          const ra = ((Number(a.currentValue) - Number(a.investedAmount)) / Number(a.investedAmount)) || 0;
          const rb = ((Number(b.currentValue) - Number(b.investedAmount)) / Number(b.investedAmount)) || 0;
          return rb - ra;
        });
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return result;
  }, [investments, search, filterType, sortBy]);

  const totalValue = useMemo(
    () => investments.reduce((sum, i) => sum + (Number(i.currentValue) || 0), 0),
    [investments]
  );

  const progressSeries = useMemo(() => buildProgressSeries(investments, progressRange), [investments, progressRange]);
  const latestProgress = progressSeries[progressSeries.length - 1];
  const previousProgress = progressSeries[progressSeries.length - 2];
  const periodGainChange = latestProgress && previousProgress ? latestProgress.gain - previousProgress.gain : 0;

  return (
    <div className="investments-page">
      <header className="inv-page-header">
        <div>
          <p className="inv-page-label">Portfolio</p>
          <h1 className="inv-page-title">My Investments</h1>
        </div>
        <div className="inv-page-total">
          <span className="inv-total-label">Total</span>
          <span className="inv-total-value">{formatCurrency(totalValue)}</span>
        </div>
      </header>

      {investments.length > 0 && (
        <section className="inv-progress-panel">
          <div className="inv-progress-header">
            <div>
              <p className="inv-progress-label">Tracked Progress</p>
              <h2 className="inv-progress-title">Portfolio trend</h2>
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
      )}

      <div className="inv-search-bar">
        <Search size={18} className="inv-search-icon" />
        <input
          type="text"
          placeholder="Search investments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="inv-search-input"
        />
        <button
          className={`inv-filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {showFilters && (
        <div className="inv-filters">
          <div className="inv-filter-group">
            <label className="inv-filter-label">Type</label>
            <div className="inv-filter-chips">
              <button
                className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All
              </button>
              {activeTypes.map((t) => (
                <button
                  key={t.value}
                  className={`filter-chip ${filterType === t.value ? 'active' : ''}`}
                  style={filterType === t.value ? { backgroundColor: t.color + '18', color: t.color, borderColor: t.color + '40' } : {}}
                  onClick={() => setFilterType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="inv-filter-group">
            <label className="inv-filter-label">Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="inv-sort-select">
              <option value="value">Current Value</option>
              <option value="invested">Invested Amount</option>
              <option value="returns">Returns %</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      )}

      <div className="inv-count">
        {filtered.length} investment{filtered.length !== 1 ? 's' : ''}
        {filterType !== 'all' && ` in ${getTypeInfo(filterType).label}`}
      </div>

      <div className="inv-cards-list">
        {filtered.map((inv) => (
          <InvestmentCard
            key={inv.id}
            investment={inv}
            onClick={() => navigate(`/investments/edit/${inv.id}`)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="inv-empty">
          <Briefcase size={40} strokeWidth={1} />
          <p>{search || filterType !== 'all' ? 'No investments match your filters' : 'No investments yet'}</p>
          {!search && filterType === 'all' && (
            <button className="btn-primary" onClick={() => navigate('/add')}>
              Add Investment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
