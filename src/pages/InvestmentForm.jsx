import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { DEFAULT_FAMILY_MEMBER, INVESTMENT_TYPES, RISK_LEVELS } from '../utils/constants';
import { searchSchemes, fetchLatestNav } from '../utils/navService';
import { ArrowLeft, Plus, Save, Trash2, Users, X } from 'lucide-react';
import './InvestmentForm.css';

const ADD_MEMBER_VALUE = '__add_member__';

function getInitialForm(investments, id, prefill = null, ownerName = DEFAULT_FAMILY_MEMBER.name) {
  const today = new Date().toISOString().slice(0, 10);
  if (id) {
    const inv = investments.find((i) => i.id === id);
    if (inv) {
      return {
        name: inv.name || '',
        memberId: inv.memberId || DEFAULT_FAMILY_MEMBER.id,
        memberName: inv.memberName || ownerName,
        type: inv.type || 'mutual_funds',
        investedAmount: inv.investedAmount || '',
        currentValue: inv.currentValue || '',
        risk: inv.risk || 'medium',
        startDate: inv.startDate || '',
        maturityDate: inv.maturityDate || '',
        interestRate: inv.interestRate || '',
        snapshotDate: inv.lastUpdated || today,
        notes: inv.notes || '',
        schemeCode: inv.schemeCode || '',
        schemeName: inv.schemeName || '',
        units: inv.units || '',
      };
    }
  }
  const baseForm = {
    name: '',
    memberId: DEFAULT_FAMILY_MEMBER.id,
    memberName: ownerName,
    type: 'mutual_funds',
    investedAmount: '',
    currentValue: '',
    risk: 'medium',
    startDate: '',
    maturityDate: '',
    interestRate: '',
    snapshotDate: today,
    notes: '',
    schemeCode: '',
    schemeName: '',
    units: '',
  };

  if (!prefill) return baseForm;

  return {
    ...baseForm,
    ...prefill,
    memberId: prefill.memberId || baseForm.memberId,
    memberName: prefill.memberName || baseForm.memberName,
    investedAmount: prefill.investedAmount || '',
    currentValue: prefill.currentValue || '',
    snapshotDate: prefill.snapshotDate || today,
    notes: prefill.notes || '',
  };
}

export default function InvestmentForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = location.state?.prefill || null;
  const sourceRecurringId = location.state?.sourceRecurringId || '';
  const returnTo = location.state?.returnTo || '/investments';
  const {
    investments,
    familyMembers,
    ownerName,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    addFamilyMember,
    markRecurringEntryRecorded,
  } = useApp();

  const [form, setForm] = useState(() => getInitialForm(investments, id, prefill, ownerName));
  const [showDelete, setShowDelete] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberModalName, setMemberModalName] = useState('');
  const [schemeQuery, setSchemeQuery] = useState('');
  const [schemeResults, setSchemeResults] = useState([]);
  const [schemeLoading, setSchemeLoading] = useState(false);
  const [navInfo, setNavInfo] = useState(null);

  // Load the latest NAV for an already-linked fund (and clear it when unlinked).
  useEffect(() => {
    let active = true;
    if (form.schemeCode) {
      fetchLatestNav(form.schemeCode).then((info) => { if (active) setNavInfo(info); }).catch(() => {});
    } else {
      setNavInfo(null);
    }
    return () => { active = false; };
  }, [form.schemeCode]);

  async function handleSchemeSearch(value) {
    setSchemeQuery(value);
    if (value.trim().length < 3) { setSchemeResults([]); return; }
    setSchemeLoading(true);
    try { setSchemeResults(await searchSchemes(value)); }
    catch { setSchemeResults([]); }
    finally { setSchemeLoading(false); }
  }

  function selectScheme(scheme) {
    setForm((prev) => {
      const next = { ...prev, schemeCode: scheme.schemeCode, schemeName: scheme.schemeName };
      return next;
    });
    setSchemeQuery('');
    setSchemeResults([]);
  }

  function clearScheme() {
    setForm((prev) => ({ ...prev, schemeCode: '', schemeName: '', units: '' }));
    setNavInfo(null);
  }

  function applyNavValue() {
    if (!navInfo || !form.units) return;
    handleChange('currentValue', String(Math.round(Number(form.units) * navInfo.nav)));
  }

  function suggestUnits() {
    if (!navInfo || !form.currentValue) return;
    handleChange('units', (Number(form.currentValue) / navInfo.nav).toFixed(3));
  }

  const memberOptions = useMemo(() => {
    const options = new Map([[DEFAULT_FAMILY_MEMBER.id, { id: DEFAULT_FAMILY_MEMBER.id, name: ownerName }]]);

    familyMembers.forEach((member) => {
      options.set(member.id, member);
    });

    investments.forEach((investment) => {
      const memberId = investment.memberId || DEFAULT_FAMILY_MEMBER.id;
      const memberName = investment.memberName || DEFAULT_FAMILY_MEMBER.name;
      options.set(memberId, { id: memberId, name: memberName });
    });

    if (form.memberName) {
      options.set(form.memberId || DEFAULT_FAMILY_MEMBER.id, {
        id: form.memberId || DEFAULT_FAMILY_MEMBER.id,
        name: form.memberName,
      });
    }

    return [...options.values()].sort((left, right) => {
      if (left.id === DEFAULT_FAMILY_MEMBER.id) return -1;
      if (right.id === DEFAULT_FAMILY_MEMBER.id) return 1;
      return left.name.localeCompare(right.name);
    });
  }, [familyMembers, form.memberId, form.memberName, investments, ownerName]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleMemberSelection = (value) => {
    if (value === ADD_MEMBER_VALUE) {
      setShowMemberModal(true);
      setMemberModalName('');
      return;
    }

    const selectedMember = memberOptions.find((member) => member.id === value) || DEFAULT_FAMILY_MEMBER;
    setForm((prev) => ({
      ...prev,
      memberId: selectedMember.id,
      memberName: selectedMember.name,
    }));
  };

  const handleMemberModalSave = () => {
    const nextMember = addFamilyMember({ name: memberModalName });
    if (!nextMember) return;

    setForm((prev) => ({
      ...prev,
      memberId: nextMember.id,
      memberName: nextMember.name,
    }));
    setShowMemberModal(false);
    setMemberModalName('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const selectedMember =
      memberOptions.find((member) => member.id === form.memberId) || {
        id: form.memberId || DEFAULT_FAMILY_MEMBER.id,
        name: form.memberName?.trim() || DEFAULT_FAMILY_MEMBER.name,
      };

    const data = {
      ...form,
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      investedAmount: Number(form.investedAmount) || 0,
      currentValue: Number(form.currentValue) || 0,
      interestRate: form.interestRate ? Number(form.interestRate) : '',
      snapshotDate: form.snapshotDate,
    };

    if (isEdit) {
      updateInvestment(id, data);
    } else {
      addInvestment(data);
      if (sourceRecurringId) markRecurringEntryRecorded(sourceRecurringId, data.snapshotDate);
    }
    navigate(returnTo);
  };

  const handleDelete = () => {
    deleteInvestment(id);
    navigate(returnTo);
  };

  const isValid = form.name.trim() && form.investedAmount && form.memberName.trim();

  return (
    <div className="form-page">
      <header className="form-header">
        <button type="button" className="form-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-title">{isEdit ? 'Edit Investment' : 'Add Investment'}</h1>
        <div style={{ width: 36 }} />
      </header>

      <form onSubmit={handleSubmit} className="form-body">
        <div className="form-group">
          <label className="form-label">Investment Name *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., HDFC Mid-Cap Fund"
            value={form.name}
            onChange={(event) => handleChange('name', event.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <div className="form-label-row">
            <label className="form-label">Family Member *</label>
            <button type="button" className="form-label-action" onClick={() => navigate('/family-members')}>
              <Users size={14} />
              Manage members
            </button>
          </div>

          <div className="form-inline-select">
            <select
              className="form-input"
              value={form.memberId}
              onChange={(event) => handleMemberSelection(event.target.value)}
            >
              {memberOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
              <option value={ADD_MEMBER_VALUE}>Add family member...</option>
            </select>
            <button type="button" className="form-inline-btn" onClick={() => setShowMemberModal(true)}>
              <Plus size={16} />
            </button>
          </div>

        </div>

        <div className="form-group">
          <label className="form-label">Type</label>
          <div className="form-type-grid">
            {INVESTMENT_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                className={`form-type-btn ${form.type === type.value ? 'active' : ''}`}
                style={
                  form.type === type.value
                    ? { backgroundColor: `${type.color}15`, color: type.color, borderColor: `${type.color}50` }
                    : {}
                }
                onClick={() => handleChange('type', type.value)}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Invested Amount *</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={form.investedAmount}
                onChange={(event) => handleChange('investedAmount', event.target.value)}
                required
                min="0"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Current Value</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={form.currentValue}
                onChange={(event) => handleChange('currentValue', event.target.value)}
                min="0"
              />
            </div>
          </div>
        </div>

        {form.type === 'mutual_funds' ? (
          <div className="form-group">
            <div className="form-label-row">
              <label className="form-label">Live NAV tracking</label>
              <span className="nav-badge">Auto-update from AMFI</span>
            </div>

            {form.schemeCode ? (
              <>
                <div className="nav-linked">
                  <div className="nav-linked-info">
                    <strong>{form.schemeName}</strong>
                    <span>Code {form.schemeCode}{navInfo ? ` · NAV ₹${navInfo.nav} on ${navInfo.date}` : ''}</span>
                  </div>
                  <button type="button" className="nav-unlink" onClick={clearScheme} title="Unlink">
                    <X size={16} />
                  </button>
                </div>

                <div className="nav-units-row">
                  <div className="form-input-prefix nav-units-input">
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Units held"
                      value={form.units}
                      onChange={(event) => handleChange('units', event.target.value)}
                      min="0"
                      step="any"
                    />
                  </div>
                  <button type="button" className="nav-mini-btn" onClick={suggestUnits} disabled={!navInfo || !form.currentValue}>
                    Units from value
                  </button>
                  <button type="button" className="nav-mini-btn primary" onClick={applyNavValue} disabled={!navInfo || !form.units}>
                    Value from NAV
                  </button>
                </div>
                <p className="nav-hint">Current value = units × NAV. Refresh all linked funds from the Investments page.</p>
              </>
            ) : (
              <div className="nav-search">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search fund by name (min 3 characters)"
                  value={schemeQuery}
                  onChange={(event) => handleSchemeSearch(event.target.value)}
                />
                {schemeLoading ? <p className="nav-hint">Searching…</p> : null}
                {schemeResults.length ? (
                  <div className="nav-results">
                    {schemeResults.map((scheme) => (
                      <button type="button" key={scheme.schemeCode} className="nav-result" onClick={() => selectScheme(scheme)}>
                        {scheme.schemeName}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="form-group">
          <label className="form-label">Risk Level</label>
          <div className="form-risk-row">
            {RISK_LEVELS.map((risk) => (
              <button
                key={risk.value}
                type="button"
                className={`form-risk-btn ${form.risk === risk.value ? 'active' : ''}`}
                style={
                  form.risk === risk.value
                    ? { backgroundColor: `${risk.color}15`, color: risk.color, borderColor: `${risk.color}50` }
                    : {}
                }
                onClick={() => handleChange('risk', risk.value)}
              >
                {risk.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={form.startDate}
              onChange={(event) => handleChange('startDate', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Maturity Date</label>
            <input
              type="date"
              className="form-input"
              value={form.maturityDate}
              onChange={(event) => handleChange('maturityDate', event.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Interest Rate (%)</label>
          <input
            type="number"
            step="0.01"
            className="form-input"
            placeholder="e.g., 7.5"
            value={form.interestRate}
            onChange={(event) => handleChange('interestRate', event.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Value As Of</label>
          <input
            type="date"
            className="form-input"
            value={form.snapshotDate}
            onChange={(event) => handleChange('snapshotDate', event.target.value)}
          />
          <p className="form-helper-text">
            Each save records a history snapshot for this date so monthly and yearly progress can be tracked.
            {isEdit ? ' Update the current value freely to track market changes — only changing the invested amount counts as new money invested.' : ''}
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input form-textarea"
            placeholder="Any additional details..."
            value={form.notes}
            onChange={(event) => handleChange('notes', event.target.value)}
            rows={3}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary form-submit-btn" disabled={!isValid}>
            <Save size={18} />
            {isEdit ? 'Update Investment' : 'Add Investment'}
          </button>

          {isEdit ? (
            <>
              {!showDelete ? (
                <button type="button" className="btn-danger-outline" onClick={() => setShowDelete(true)}>
                  <Trash2 size={16} />
                  Delete
                </button>
              ) : (
                <div className="delete-confirm">
                  <p>Are you sure? This cannot be undone.</p>
                  <div className="delete-confirm-actions">
                    <button type="button" className="btn-danger" onClick={handleDelete}>
                      Yes, Delete
                    </button>
                    <button type="button" className="btn-cancel" onClick={() => setShowDelete(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </form>

      {showMemberModal ? (
        <div className="form-modal-backdrop" role="presentation" onClick={() => setShowMemberModal(false)}>
          <div className="form-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="form-modal-header">
              <div>
                <div className="form-modal-label">Family Member</div>
                <h2 className="form-modal-title">Add family member</h2>
                <p className="form-modal-context">You can assign this person to investments right away.</p>
              </div>
              <button type="button" className="form-modal-close" onClick={() => setShowMemberModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Member name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Mom"
                value={memberModalName}
                onChange={(event) => setMemberModalName(event.target.value)}
                autoFocus
              />
            </div>

            <div className="form-modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setShowMemberModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary form-modal-submit"
                onClick={handleMemberModalSave}
                disabled={!memberModalName.trim()}
              >
                Save member
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
