import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Briefcase, Wallet, Target, Landmark, TrendingUp, CornerDownLeft } from 'lucide-react';
import { useApp } from '../context/useApp';
import { formatCurrency } from '../utils/constants';
import './GlobalSearch.css';

const TYPE_META = {
  Investment: { icon: Briefcase, to: (it) => `/investments/edit/${it.id}`, amount: (it) => it.currentValue },
  Expense: { icon: Wallet, to: (it) => `/expenses/edit/${it.id}`, amount: (it) => it.amount },
  Goal: { icon: Target, to: (it) => `/goals/edit/${it.id}`, amount: (it) => it.targetAmount },
  Loan: { icon: Landmark, to: (it) => `/loans/edit/${it.id}`, amount: (it) => it.outstandingBalance ?? it.principal },
  'Swing trade': { icon: TrendingUp, to: (it) => `/swing-trades/edit/${it.id}`, amount: (it) => it.currentValue ?? it.investedAmount },
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { investments, expenses, goals, loans, swingTrades } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (openRef.current) { setOpen(false); setQuery(''); setActive(0); } else setOpen(true);
      } else if (event.key === 'Escape') {
        setOpen(false); setQuery(''); setActive(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus the field when the panel opens (focus only — no state changes here).
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    const scan = (items, type) => (items || []).forEach((item) => {
      const name = String(item.name || item.title || '').trim();
      const haystack = `${name} ${item.notes || ''}`.toLowerCase();
      if (name && haystack.includes(q)) out.push({ key: `${type}:${item.id}`, type, name, item });
    });
    scan(investments, 'Investment');
    scan(expenses, 'Expense');
    scan(goals, 'Goal');
    scan(loans, 'Loan');
    scan(swingTrades, 'Swing trade');
    return out.slice(0, 40);
  }, [query, investments, expenses, goals, loans, swingTrades]);

  function closeSearch() {
    setOpen(false);
    setQuery('');
    setActive(0);
  }

  function go(result) {
    if (!result) return;
    closeSearch();
    navigate(TYPE_META[result.type].to(result.item));
  }

  function onInputKey(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); go(results[active]); }
  }

  return (
    <>
      <button type="button" className="gsearch-trigger" onClick={() => { setQuery(''); setActive(0); setOpen(true); }} title="Search (Ctrl/Cmd + K)" aria-label="Search">
        <Search size={18} />
      </button>

      {open ? (
        <div className="gsearch-backdrop" onClick={closeSearch}>
          <div className="gsearch-panel" onClick={(e) => e.stopPropagation()}>
            <div className="gsearch-input-row">
              <Search size={18} className="gsearch-input-icon" />
              <input
                ref={inputRef}
                className="gsearch-input"
                placeholder="Search investments, expenses, goals, loans…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onInputKey}
              />
              <button type="button" className="gsearch-close" onClick={closeSearch}><X size={18} /></button>
            </div>

            <div className="gsearch-results">
              {query.trim() && results.length === 0 ? (
                <p className="gsearch-empty">No matches for “{query.trim()}”.</p>
              ) : null}
              {!query.trim() ? (
                <p className="gsearch-empty">Type to search across your finances.</p>
              ) : null}
              {results.map((result, index) => {
                const meta = TYPE_META[result.type];
                const Icon = meta.icon;
                const amount = meta.amount(result.item);
                return (
                  <button
                    type="button"
                    key={result.key}
                    className={`gsearch-result ${index === active ? 'active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(result)}
                  >
                    <span className="gsearch-result-icon"><Icon size={16} /></span>
                    <span className="gsearch-result-main">
                      <strong>{result.name}</strong>
                      <span>{result.type}</span>
                    </span>
                    {Number.isFinite(Number(amount)) && Number(amount) ? (
                      <span className="gsearch-result-amount">{formatCurrency(Number(amount))}</span>
                    ) : null}
                    {index === active ? <CornerDownLeft size={14} className="gsearch-result-enter" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
