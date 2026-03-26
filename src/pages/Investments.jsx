import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { INVESTMENT_TYPES, getTypeInfo, formatCurrency } from '../utils/constants';
import InvestmentCard from '../components/InvestmentCard';
import { Search, SlidersHorizontal, Briefcase } from 'lucide-react';
import './Investments.css';

export default function Investments() {
  const { investments } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('value');
  const [showFilters, setShowFilters] = useState(false);

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
