import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Mail, Pencil, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { useApp } from '../context/useApp';
import { DEFAULT_FAMILY_MEMBER, FAMILY_RELATIONS, formatCurrency, getRelationLabel } from '../utils/constants';
import './FamilyMembers.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildMemberSummaries(familyMembers, investments, ownerName = DEFAULT_FAMILY_MEMBER.name) {
  const summaryMap = new Map();

  [{ ...DEFAULT_FAMILY_MEMBER, name: ownerName }, ...familyMembers].forEach((member) => {
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
  const { familyMembers, investments, ownerName, isReadOnly, addFamilyMember, updateFamilyMember, deleteFamilyMember } = useApp();
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingRelation, setEditingRelation] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [editError, setEditError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState('');

  const memberSummaries = useMemo(
    () => buildMemberSummaries(familyMembers, investments, ownerName),
    [familyMembers, investments, ownerName],
  );

  const totalFamilyValue = useMemo(
    () => memberSummaries.reduce((sum, member) => sum + member.currentValue, 0),
    [memberSummaries],
  );

  // Family management is owner-only. A signed-in family member is redirected home.
  if (isReadOnly) return <Navigate to="/" replace />;

  const handleAddMember = () => {
    const email = newMemberEmail.trim();
    if (email && !EMAIL_PATTERN.test(email)) {
      setAddError('Enter a valid email address.');
      return;
    }
    const nextMember = addFamilyMember({ name: newMemberName, relation: newMemberRelation, email });
    if (!nextMember) return;
    setNewMemberName('');
    setNewMemberRelation('');
    setNewMemberEmail('');
    setAddError('');
  };

  const startEditing = (member) => {
    setEditingId(member.id);
    setEditingName(member.name);
    setEditingRelation(member.relation || '');
    setEditingEmail(member.email || '');
    setEditError('');
    setPendingDeleteId('');
  };

  const stopEditing = () => {
    setEditingId('');
    setEditingName('');
    setEditingRelation('');
    setEditingEmail('');
    setEditError('');
  };

  const handleSaveEdit = (memberId) => {
    const email = editingEmail.trim();
    if (email && !EMAIL_PATTERN.test(email)) {
      setEditError('Enter a valid email address.');
      return;
    }
    const nextMember = updateFamilyMember(memberId, { name: editingName, relation: editingRelation, email });
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

        <div className="family-add-form">
          <div className="family-field-grid">
            <input
              type="text"
              className="family-input"
              placeholder="Name e.g., Priya"
              value={newMemberName}
              onChange={(event) => setNewMemberName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddMember();
                }
              }}
            />
            <select
              className="family-input family-select"
              value={newMemberRelation}
              onChange={(event) => setNewMemberRelation(event.target.value)}
            >
              <option value="">Relation</option>
              {FAMILY_RELATIONS.map((relation) => (
                <option key={relation.value} value={relation.value}>{relation.label}</option>
              ))}
            </select>
          </div>
          <input
            type="email"
            className="family-input"
            placeholder="Email for login access (optional)"
            value={newMemberEmail}
            onChange={(event) => setNewMemberEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddMember();
              }
            }}
          />
          {addError ? <p className="family-form-error">{addError}</p> : null}
          <button type="button" className="btn-primary family-add-btn" onClick={handleAddMember} disabled={!newMemberName.trim()}>
            <Plus size={16} />
            Add member
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
                      <div className="family-edit-form">
                        <input
                          type="text"
                          className="family-input"
                          placeholder="Name"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                        />
                        <div className="family-field-grid">
                          <select
                            className="family-input family-select"
                            value={editingRelation}
                            onChange={(event) => setEditingRelation(event.target.value)}
                          >
                            <option value="">Relation</option>
                            {FAMILY_RELATIONS.map((relation) => (
                              <option key={relation.value} value={relation.value}>{relation.label}</option>
                            ))}
                          </select>
                          <input
                            type="email"
                            className="family-input"
                            placeholder="Email (optional)"
                            value={editingEmail}
                            onChange={(event) => setEditingEmail(event.target.value)}
                          />
                        </div>
                        {editError ? <p className="family-form-error">{editError}</p> : null}
                        <div className="family-edit-actions">
                          <button type="button" className="family-icon-btn save" onClick={() => handleSaveEdit(member.id)}>
                            <Save size={16} />
                          </button>
                          <button type="button" className="family-icon-btn" onClick={stopEditing}>
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="family-member-name">{member.name}</h3>
                        {(member.relation || member.email) ? (
                          <div className="family-member-meta">
                            {member.relation ? (
                              <span className="family-relation-pill">{getRelationLabel(member.relation)}</span>
                            ) : null}
                            {member.email ? (
                              <span className="family-member-email">
                                <Mail size={13} />
                                {member.email}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </>
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
                      Delete this member? {member.holdings.length} investment{member.holdings.length === 1 ? '' : 's'} will be reassigned to {ownerName}.
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
