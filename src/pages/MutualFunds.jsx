import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw, Pencil, Trash2, Save, X, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../context/useApp';
import { formatCurrency, calculateReturns, DEFAULT_FAMILY_MEMBER } from '../utils/constants';
import { searchSchemes, fetchLatestNav } from '../utils/navService';
import './MutualFunds.css';

const EMPTY = { id: '', name: '', schemeCode: '', schemeName: '', units: '', investedAmount: '', sipAmount: '' };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MutualFunds() {
  const navigate = useNavigate();
  const { visibleInvestments, ownerName, addInvestment, updateInvestment, deleteInvestment, refreshNavPrices } = useApp();

  const funds = useMemo(
    () => visibleInvestments
      .filter((inv) => inv.type === 'mutual_funds')
      .sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0)),
    [visibleInvestments],
  );

  const totals = useMemo(() => {
    const invested = funds.reduce((s, f) => s + (Number(f.investedAmount) || 0), 0);
    const current = funds.reduce((s, f) => s + (Number(f.currentValue) || 0), 0);
    const sip = funds.reduce((s, f) => s + (Number(f.sipAmount) || 0), 0);
    return { invested, current, gain: current - invested, sip };
  }, [funds]);

  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState('');
  const [navBusy, setNavBusy] = useState(false);
  const [navMsg, setNavMsg] = useState('');
  const [schemeQuery, setSchemeQuery] = useState('');
  const [schemeResults, setSchemeResults] = useState([]);
  const [navInfo, setNavInfo] = useState(null);

  useEffect(() => {
    if (!editing?.schemeCode) return undefined;
    let active = true;
    fetchLatestNav(editing.schemeCode).then((info) => { if (active) setNavInfo(info); }).catch(() => {});
    return () => { active = false; };
  }, [editing?.schemeCode]);

  async function handleRefresh() {
    setNavBusy(true); setNavMsg('');
    const res = await refreshNavPrices();
    setNavBusy(false);
    if (!res?.ok) setNavMsg(res?.error || 'Could not refresh.');
    else if (!res.updated) setNavMsg(res.message || 'No funds linked to a scheme yet.');
    else setNavMsg(`Updated ${res.updated} of ${res.total} fund${res.total === 1 ? '' : 's'}.`);
    setTimeout(() => setNavMsg(''), 4000);
  }

  async function onSchemeSearch(value) {
    setSchemeQuery(value);
    if (value.trim().length < 3) { setSchemeResults([]); return; }
    try { setSchemeResults(await searchSchemes(value)); } catch { setSchemeResults([]); }
  }

  function pickScheme(scheme) {
    setEditing((prev) => ({
      ...prev,
      schemeCode: scheme.schemeCode,
      schemeName: scheme.schemeName,
      name: prev.name || scheme.schemeName,
    }));
    setSchemeQuery('');
    setSchemeResults([]);
  }

  function save(event) {
    event.preventDefault();
    const units = Number(editing.units) || 0;
    const invested = Number(editing.investedAmount) || 0;
    const name = editing.name.trim() || editing.schemeName.trim();
    if (!name) return;
    const current = navInfo && units ? Math.round(units * navInfo.nav) : (invested || 0);
    const payload = {
      ...editing,
      name,
      type: 'mutual_funds',
      units,
      investedAmount: invested,
      currentValue: current,
      sipAmount: Number(editing.sipAmount) || 0,
      navValue: navInfo?.nav,
      navDate: navInfo?.date,
      snapshotDate: todayIso(),
    };
    if (editing.id) {
      updateInvestment(editing.id, payload);
    } else {
      addInvestment({
        ...payload,
        memberId: DEFAULT_FAMILY_MEMBER.id,
        memberName: ownerName,
        startDate: todayIso(),
        risk: 'medium',
      });
    }
    setEditing(null);
  }

  function openEdit(fund) {
    setNavInfo(null);
    setEditing({
      id: fund.id,
      name: fund.name || '',
      schemeCode: fund.schemeCode || '',
      schemeName: fund.schemeName || '',
      units: fund.units || '',
      investedAmount: fund.investedAmount || '',
      sipAmount: fund.sipAmount || '',
    });
  }

  return (
    <div className="mf-page">
      <header className="mf-header">
        <button type="button" className="mf-back" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <div className="mf-header-copy">
          <p className="mf-label">Portfolio</p>
          <h1 className="mf-title">Mutual Funds</h1>
        </div>
        {funds.some((f) => f.schemeCode && Number(f.units) > 0) ? (
          <button type="button" className="mf-refresh" onClick={handleRefresh} disabled={navBusy}>
            <RefreshCw size={15} className={navBusy ? 'mf-spin' : ''} />
            {navBusy ? '…' : 'NAV'}
          </button>
        ) : null}
      </header>

      <section className="mf-summary">
        <div className="mf-summary-main">
          <span className="mf-summary-label">Current value</span>
          <strong className="mf-summary-value">{formatCurrency(totals.current)}</strong>
          <span className={`mf-summary-gain ${totals.gain >= 0 ? 'pos' : 'neg'}`}>
            {totals.gain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {totals.gain >= 0 ? '+' : ''}{formatCurrency(totals.gain)} ({calculateReturns(totals.invested, totals.current)}%)
          </span>
        </div>
        <div className="mf-summary-side">
          <div><span>Invested</span><strong>{formatCurrency(totals.invested)}</strong></div>
          {totals.sip > 0 ? <div><span>Monthly SIP</span><strong>{formatCurrency(totals.sip)}</strong></div> : null}
        </div>
      </section>
      {navMsg ? <p className="mf-navmsg">{navMsg}</p> : null}

      <div className="mf-toolbar">
        <span className="mf-count">{funds.length} fund{funds.length === 1 ? '' : 's'}</span>
        <button type="button" className="mf-add" onClick={() => { setNavInfo(null); setEditing({ ...EMPTY }); setSchemeQuery(''); setSchemeResults([]); }}>
          <Plus size={16} /> Add fund
        </button>
      </div>

      {funds.length === 0 ? (
        <div className="mf-empty"><p>No mutual funds yet. Add your first fund.</p></div>
      ) : (
        <div className="mf-list">
          {funds.map((fund) => {
            const gain = (Number(fund.currentValue) || 0) - (Number(fund.investedAmount) || 0);
            return (
              <article key={fund.id} className="mf-card">
                <div className="mf-card-top">
                  <div className="mf-card-name">
                    <strong>{fund.name}</strong>
                    <span>
                      {Number(fund.units) ? `${fund.units} units` : 'No units'}
                      {Number(fund.sipAmount) ? ` · SIP ${formatCurrency(fund.sipAmount)}` : ''}
                      {fund.navValue ? ` · NAV ₹${fund.navValue}` : ''}
                    </span>
                  </div>
                  <div className="mf-card-actions">
                    <button type="button" className="mf-icon" onClick={() => openEdit(fund)}><Pencil size={14} /></button>
                    <button type="button" className="mf-icon danger" onClick={() => setConfirmDeleteId((c) => (c === fund.id ? '' : fund.id))}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mf-card-metrics">
                  <div><span>Current</span><strong>{formatCurrency(fund.currentValue)}</strong></div>
                  <div><span>Invested</span><strong>{formatCurrency(fund.investedAmount)}</strong></div>
                  <div><span>Returns</span><strong className={gain >= 0 ? 'pos' : 'neg'}>{calculateReturns(fund.investedAmount, fund.currentValue)}%</strong></div>
                </div>
                {confirmDeleteId === fund.id ? (
                  <div className="mf-confirm">
                    <span>Delete this fund?</span>
                    <button type="button" className="mf-cancel" onClick={() => setConfirmDeleteId('')}>Cancel</button>
                    <button type="button" className="mf-danger" onClick={() => { deleteInvestment(fund.id); setConfirmDeleteId(''); }}>Delete</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <div className="mf-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="mf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mf-modal-head">
              <h3>{editing.id ? 'Edit fund' : 'Add fund'}</h3>
              <button type="button" className="mf-icon" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <form onSubmit={save} className="mf-form">
              {editing.schemeCode ? (
                <div className="mf-linked">
                  <div>
                    <strong>{editing.schemeName}</strong>
                    <span>Code {editing.schemeCode}{navInfo ? ` · NAV ₹${navInfo.nav} (${navInfo.date})` : ''}</span>
                  </div>
                  <button type="button" className="mf-icon" onClick={() => { setNavInfo(null); setEditing({ ...editing, schemeCode: '', schemeName: '' }); }}><X size={15} /></button>
                </div>
              ) : (
                <div className="mf-search">
                  <input className="mf-input" placeholder="Search fund for live NAV (min 3 chars)" value={schemeQuery} onChange={(e) => onSchemeSearch(e.target.value)} />
                  {schemeResults.length ? (
                    <div className="mf-results">
                      {schemeResults.map((s) => (
                        <button type="button" key={s.schemeCode} className="mf-result" onClick={() => pickScheme(s)}>{s.schemeName}</button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <input className="mf-input" placeholder="Fund name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <div className="mf-form-row">
                <input className="mf-input" type="number" step="any" min="0" placeholder="Units / quantity" value={editing.units} onChange={(e) => setEditing({ ...editing, units: e.target.value })} />
                <input className="mf-input" type="number" min="0" placeholder="SIP / month (₹)" value={editing.sipAmount} onChange={(e) => setEditing({ ...editing, sipAmount: e.target.value })} />
              </div>
              <input className="mf-input" type="number" min="0" placeholder="Invested amount (₹)" value={editing.investedAmount} onChange={(e) => setEditing({ ...editing, investedAmount: e.target.value })} />
              {navInfo && Number(editing.units) ? (
                <p className="mf-hint">Current value ≈ {formatCurrency(Math.round(Number(editing.units) * navInfo.nav))} (units × NAV)</p>
              ) : null}

              <div className="mf-modal-actions">
                <button type="button" className="mf-cancel" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="mf-save"><Save size={16} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
