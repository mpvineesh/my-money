import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Pencil, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { useApp } from '../context/useApp';
import { DEFAULT_FAMILY_MEMBER, formatCurrency } from '../utils/constants';
import './FamilyMembers.css';

function buildMemberSummaries(familyMembers, investments) {
  const summaryMap = new Map();

  [DEFAULT_FAMILY_MEMBER, ...familyMembers].forEach((member) => {
    summaryMap.set(member.id, {
      ...member,
      investedAmount: 0,
      currentValue: 0,
      gain: 0,
      holdings: [],
    });
  });

  investments.forEach((investment) => {
    const fallbackId = investment.memberId || DEFAULT_FAMILY_MEMBER.id;
    const fallbackName = investment.memberName || DEFAULT_FAMILY_MEMBER.name;
    const existingSummary = summaryMap.get(fallbackId) || {
      id: fallbackId,
      name: fallbackName,
      investedAmount: 0,
      currentValue: 0,
      gain: 0,
      holdings: [],
    };

    existingSummary.investedAmount += Number(investment.investedAmount) || 0;
    existingSummary.currentValue += Number(investment.currentValue) || 0;
    existingSummary.gain += (Number(investment.currentValue) || 0) - (Number(investment.investedAmount) || 0);
    existingSummary.holdings.push(investment);
    summaryMap.set(existingSummary.id, existingSummary);
  });

  return [...summaryMap.values()].sort((left, right) => {
    if (left.id === DEFAULT_FAMILY_MEMBER.id) return -1;
    if (right.id === DEFAULT_FAMILY_MEMBER.id) return 1;
    return right.currentValue - left.currentValue || left.name.localeCompare(right.name);
  });
}

export default function FamilyMembers() {
  const navigate = useNavigate();
  const { familyMembers, investments, addFamilyMember, updateFamilyMember, deleteFamilyMember } = useApp();
  const [newMemberName, setNewMemberName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState('');

  const memberSummaries = useMemo(
    () => buildMemberSummaries(familyMembers, investments),
    [familyMembers, investments],
  );

  const totalFamilyValue = useMemo(
    () => memberSummaries.reduce((sum, member) => sum + member.currentValue, 0),
    [memberSummaries],
  );

  const handleAddMember = () => {
    const nextMember = addFamilyMember({ name: newMemberName });
    if (!nextMember) return;
    setNewMemberName('');
  };

  const startEditing = (member) => {
    setEditingId(member.id);
    setEditingName(member.name);
    setPendingDeleteId('');
  };

  const stopEditing = () => {
    setEditingId('');
    setEditingName('');
  };

  const handleSaveEdit = (memberId) => {
    const nextMember = updateFamilyMember(memberId, { name: editingName });
    if (!nextMember) return;
    stopEditing();
  };

  const handleDelete = (memberId) => {
    deleteFamilyMember(memberId);
    if (pendingDeleteId === memberId) setPendingDeleteId('');
    if (editingId === memberId) stopEditing();
  };

  return (
    <div className="family-page">
      <header className="family-header">
        <button type="button" className="family-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <div className="family-header-copy">
          <p className="family-label">Household</p>
          <h1 className="family-title">Family Members</h1>
          <p className="family-subtitle">Add members once, then assign investments to the right person across the app.</p>
        </div>
      </header>

      <section className="family-hero-card">
        <div className="family-hero-icon">
          <Users size={26} />
        </div>
        <div>
          <p className="family-hero-label">Tracked Value</p>
          <strong className="family-hero-value">{formatCurrency(totalFamilyValue)}</strong>
          <p className="family-hero-note">{memberSummaries.length} member{memberSummaries.length === 1 ? '' : 's'} with investment ownership tracking</p>
        </div>
      </section>

      <section className="family-panel">
        <div className="family-panel-head">
          <div>
            <p className="family-panel-label">Add Member</p>
            <h2>Who do you want to track?</h2>
          </div>
        </div>

        <div className="family-add-row">
          <input
            type="text"
            className="family-input"
            placeholder="e.g., Mom, Dad, Spouse"
            value={newMemberName}
            onChange={(event) => setNewMemberName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddMember();
              }
            }}
          />
          <button type="button" className="btn-primary family-add-btn" onClick={handleAddMember} disabled={!newMemberName.trim()}>
            <Plus size={16} />
            Add
          </button>
        </div>
      </section>

      <section className="family-panel">
        <div className="family-panel-head">
          <div>
            <p className="family-panel-label">Ownership</p>
            <h2>Member investment summary</h2>
          </div>
        </div>

        <div className="family-member-list">
          {memberSummaries.map((member) => {
            const isDefaultMember = member.id === DEFAULT_FAMILY_MEMBER.id;
            const isEditing = editingId === member.id;
            const isDeleteOpen = pendingDeleteId === member.id;

            return (
              <article key={member.id} className="family-member-card">
                <div className="family-member-top">
                  <div>
                    <span className="family-member-tag">{isDefaultMember ? 'Default owner' : 'Family member'}</span>
                    {isEditing ? (
                      <div className="family-edit-row">
                        <input
                          type="text"
                          className="family-input"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                        />
                        <button type="button" className="family-icon-btn save" onClick={() => handleSaveEdit(member.id)}>
                          <Save size={16} />
                        </button>
                        <button type="button" className="family-icon-btn" onClick={stopEditing}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <h3 className="family-member-name">{member.name}</h3>
                    )}
                  </div>

                  {!isDefaultMember && !isEditing ? (
                    <div className="family-card-actions">
                      <button type="button" className="family-icon-btn" onClick={() => startEditing(member)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="family-icon-btn danger"
                        onClick={() => setPendingDeleteId((current) => (current === member.id ? '' : member.id))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="family-metrics-grid">
                  <div>
                    <span>Current value</span>
                    <strong>{formatCurrency(member.currentValue)}</strong>
                  </div>
                  <div>
                    <span>Invested</span>
                    <strong>{formatCurrency(member.investedAmount)}</strong>
                  </div>
                  <div>
                    <span>Gain</span>
                    <strong className={member.gain >= 0 ? 'positive' : 'negative'}>
                      {member.gain >= 0 ? '+' : ''}{formatCurrency(member.gain)}
                    </strong>
                  </div>
                  <div>
                    <span>Holdings</span>
                    <strong>{member.holdings.length}</strong>
                  </div>
                </div>

                <div className="family-holdings-head">
                  <span>
                    <Briefcase size={14} />
                    Investments
                  </span>
                  <button
                    type="button"
                    className="family-link-btn"
                    onClick={() =>
                      navigate('/investments/new', {
                        state: {
                          returnTo: '/family-members',
                          prefill: {
                            memberId: member.id,
                            memberName: member.name,
                          },
                        },
                      })
                    }
                  >
                    Add investment
                  </button>
                </div>

                {member.holdings.length ? (
                  <div className="family-holdings-list">
                    {member.holdings
                      .sort((left, right) => (Number(right.currentValue) || 0) - (Number(left.currentValue) || 0))
                      .map((investment) => (
                        <button
                          key={investment.id}
                          type="button"
                          className="family-holding-item"
                          onClick={() => navigate(`/investments/edit/${investment.id}`, { state: { returnTo: '/family-members' } })}
                        >
                          <div>
                            <strong>{investment.name}</strong>
                            <span>{formatCurrency(investment.investedAmount)} invested</span>
                          </div>
                          <span>{formatCurrency(investment.currentValue)}</span>
                        </button>
                      ))}
                  </div>
                ) : (
                  <p className="family-empty-holdings">No investments assigned yet.</p>
                )}

                {isDeleteOpen ? (
                  <div className="family-delete-note">
                    <p>
                      Delete this member? {member.holdings.length} investment{member.holdings.length === 1 ? '' : 's'} will be reassigned to {DEFAULT_FAMILY_MEMBER.name}.
                    </p>
                    <div className="family-delete-actions">
                      <button type="button" className="btn-cancel" onClick={() => setPendingDeleteId('')}>
                        Cancel
                      </button>
                      <button type="button" className="btn-danger" onClick={() => handleDelete(member.id)}>
                        Delete member
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
