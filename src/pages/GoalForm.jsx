import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { DEFAULT_FAMILY_MEMBER, FAMILY_GOAL_SCOPE, formatCurrency } from '../utils/constants';
import { ArrowLeft, Plus, Save, Trash2, Users, X } from 'lucide-react';
import './InvestmentForm.css';

const ADD_MEMBER_VALUE = '__add_member__';

const PRIORITIES = [
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low', label: 'Low', color: '#22c55e' },
];

function getInitialGoalForm(goals, id) {
  if (id) {
    const goal = goals.find((g) => g.id === id);
    if (goal) {
      return {
        name: goal.name || '',
        memberId: goal.memberId || FAMILY_GOAL_SCOPE.id,
        memberName: goal.memberName || FAMILY_GOAL_SCOPE.name,
        targetAmount: goal.targetAmount || '',
        currentAmount: goal.currentAmount || '',
        allocations: Array.isArray(goal.allocations) ? goal.allocations : [],
        targetDate: goal.targetDate || '',
        priority: goal.priority || 'medium',
        notes: goal.notes || '',
      };
    }
  }
  return {
    name: '',
    memberId: FAMILY_GOAL_SCOPE.id,
    memberName: FAMILY_GOAL_SCOPE.name,
    targetAmount: '',
    currentAmount: '',
    allocations: [],
    targetDate: '',
    priority: 'medium',
    notes: '',
  };
}

export default function GoalForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { goals, investments, investmentMemberOptions, cash, addGoal, updateGoal, deleteGoal, addFamilyMember } = useApp();

  const [form, setForm] = useState(() => getInitialGoalForm(goals, id));
  const [showDelete, setShowDelete] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberModalName, setMemberModalName] = useState('');

  const memberOptions = useMemo(() => {
    const options = new Map([[FAMILY_GOAL_SCOPE.id, FAMILY_GOAL_SCOPE]]);

    investmentMemberOptions.forEach((member) => {
      options.set(member.id, member);
    });

    if (form.memberName) {
      options.set(form.memberId || FAMILY_GOAL_SCOPE.id, {
        id: form.memberId || FAMILY_GOAL_SCOPE.id,
        name: form.memberName,
      });
    }

    return [...options.values()].sort((left, right) => {
      if (left.id === FAMILY_GOAL_SCOPE.id) return -1;
      if (right.id === FAMILY_GOAL_SCOPE.id) return 1;
      if (left.id === DEFAULT_FAMILY_MEMBER.id) return -1;
      if (right.id === DEFAULT_FAMILY_MEMBER.id) return 1;
      return left.name.localeCompare(right.name);
    });
  }, [form.memberId, form.memberName, investmentMemberOptions]);

  const scopedCurrentAmount = useMemo(() => {
    const scopedInvestments = form.memberId === FAMILY_GOAL_SCOPE.id
      ? investments
      : investments.filter((investment) => (investment.memberId || DEFAULT_FAMILY_MEMBER.id) === form.memberId);

    const investmentValue = scopedInvestments.reduce((sum, investment) => sum + (Number(investment.currentValue) || 0), 0);
    return form.memberId === FAMILY_GOAL_SCOPE.id ? investmentValue + (Number(cash) || 0) : investmentValue;
  }, [cash, form.memberId, investments]);
  const availableAllocationAssets = useMemo(() => {
    const scopedInvestments = form.memberId === FAMILY_GOAL_SCOPE.id
      ? investments
      : investments.filter((investment) => (investment.memberId || DEFAULT_FAMILY_MEMBER.id) === form.memberId);
    const assets = scopedInvestments.map((investment) => ({
      id: investment.id,
      name: investment.name,
      type: 'investment',
      value: Number(investment.currentValue) || 0,
    }));

    if (form.memberId === FAMILY_GOAL_SCOPE.id && Number(cash) > 0) {
      assets.unshift({
        id: 'cash',
        name: 'Cash reserve',
        type: 'cash',
        value: Number(cash) || 0,
      });
    }

    return assets;
  }, [cash, form.memberId, investments]);
  const allocatedAmount = useMemo(
    () => (form.allocations || []).reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0),
    [form.allocations],
  );
  const progressAmount = form.allocations?.length ? allocatedAmount : scopedCurrentAmount;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddAllocation = () => {
    const firstAsset = availableAllocationAssets.find(
      (asset) => !(form.allocations || []).some((allocation) => allocation.assetId === asset.id),
    );
    if (!firstAsset) return;

    setForm((prev) => ({
      ...prev,
      allocations: [
        ...(prev.allocations || []),
        {
          assetId: firstAsset.id,
          assetName: firstAsset.name,
          assetType: firstAsset.type,
          amount: firstAsset.value,
        },
      ],
    }));
  };

  const handleAllocationAssetChange = (index, assetId) => {
    const selectedAsset = availableAllocationAssets.find((asset) => asset.id === assetId);
    if (!selectedAsset) return;

    setForm((prev) => ({
      ...prev,
      allocations: (prev.allocations || []).map((allocation, allocationIndex) =>
        allocationIndex === index
          ? {
              ...allocation,
              assetId: selectedAsset.id,
              assetName: selectedAsset.name,
              assetType: selectedAsset.type,
              amount: allocation.amount || selectedAsset.value,
            }
          : allocation,
      ),
    }));
  };

  const handleAllocationAmountChange = (index, amount) => {
    setForm((prev) => ({
      ...prev,
      allocations: (prev.allocations || []).map((allocation, allocationIndex) =>
        allocationIndex === index ? { ...allocation, amount } : allocation,
      ),
    }));
  };

  const handleRemoveAllocation = (index) => {
    setForm((prev) => ({
      ...prev,
      allocations: (prev.allocations || []).filter((_, allocationIndex) => allocationIndex !== index),
    }));
  };

  const handleMemberSelection = (value) => {
    if (value === ADD_MEMBER_VALUE) {
      setShowMemberModal(true);
      setMemberModalName('');
      return;
    }

    const selectedMember = memberOptions.find((member) => member.id === value) || FAMILY_GOAL_SCOPE;
    setForm((prev) => ({
      ...prev,
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      allocations: [],
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedMember =
      memberOptions.find((member) => member.id === form.memberId) || {
        id: form.memberId || FAMILY_GOAL_SCOPE.id,
        name: form.memberName?.trim() || FAMILY_GOAL_SCOPE.name,
      };
    const data = {
      ...form,
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      targetAmount: Number(form.targetAmount) || 0,
      currentAmount: progressAmount,
      allocations: (form.allocations || [])
        .map((allocation) => {
          const asset = availableAllocationAssets.find((item) => item.id === allocation.assetId);
          return {
            assetId: allocation.assetId,
            assetName: asset?.name || allocation.assetName,
            assetType: asset?.type || allocation.assetType,
            amount: Number(allocation.amount) || 0,
          };
        })
        .filter((allocation) => allocation.assetId && allocation.amount > 0),
    };

    if (isEdit) {
      updateGoal(id, data);
    } else {
      addGoal(data);
    }
    navigate('/goals');
  };

  const handleDelete = () => {
    deleteGoal(id);
    navigate('/goals');
  };

  const isValid = form.name.trim() && form.targetAmount && form.memberName.trim();

  return (
    <div className="form-page">
      <header className="form-header">
        <button className="form-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-title">{isEdit ? 'Edit Goal' : 'New Goal'}</h1>
        <div style={{ width: 36 }} />
      </header>

      <form onSubmit={handleSubmit} className="form-body">
        <div className="form-group">
          <label className="form-label">Goal Name *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., House Down Payment"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <div className="form-label-row">
            <label className="form-label">Applies To *</label>
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

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Target Amount *</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={form.targetAmount}
                onChange={(e) => handleChange('targetAmount', e.target.value)}
                required
                min="0"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Current Assets</label>
            <div className="form-input-prefix">
              <span className="form-prefix">₹</span>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={progressAmount}
                readOnly
                min="0"
              />
            </div>
            <p className="form-helper-text">
              {form.allocations?.length
                ? `Allocated to this goal: ${formatCurrency(allocatedAmount)}`
                : `Auto-updated from scoped assets: ${formatCurrency(scopedCurrentAmount)}`}
            </p>
          </div>
        </div>

        <div className="form-group">
          <div className="form-label-row">
            <label className="form-label">Goal Asset Allocation</label>
            <button
              type="button"
              className="form-label-action"
              onClick={handleAddAllocation}
              disabled={!availableAllocationAssets.length}
            >
              <Plus size={14} />
              Add asset
            </button>
          </div>

          {(form.allocations || []).length ? (
            <div className="goal-allocation-list">
              {form.allocations.map((allocation, index) => {
                const asset = availableAllocationAssets.find((item) => item.id === allocation.assetId);
                return (
                  <div key={`${allocation.assetId}:${index}`} className="goal-allocation-row">
                    <select
                      className="form-input"
                      value={allocation.assetId}
                      onChange={(event) => handleAllocationAssetChange(index, event.target.value)}
                    >
                      {availableAllocationAssets.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({formatCurrency(item.value)})
                        </option>
                      ))}
                    </select>
                    <div className="form-input-prefix">
                      <span className="form-prefix">₹</span>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        max={asset?.value || undefined}
                        value={allocation.amount}
                        onChange={(event) => handleAllocationAmountChange(index, event.target.value)}
                      />
                    </div>
                    <button type="button" className="form-inline-btn danger" onClick={() => handleRemoveAllocation(index)}>
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="form-helper-text">
              No assets allocated yet. Without allocations, progress uses all scoped assets for this person or family.
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Target Date</label>
          <input
            type="date"
            className="form-input"
            value={form.targetDate}
            onChange={(e) => handleChange('targetDate', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Priority</label>
          <div className="form-risk-row">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`form-risk-btn ${form.priority === p.value ? 'active' : ''}`}
                style={
                  form.priority === p.value
                    ? { backgroundColor: p.color + '15', color: p.color, borderColor: p.color + '50' }
                    : {}
                }
                onClick={() => handleChange('priority', p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input form-textarea"
            placeholder="Any additional details..."
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary form-submit-btn" disabled={!isValid}>
            <Save size={18} />
            {isEdit ? 'Update Goal' : 'Add Goal'}
          </button>

          {isEdit && (
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
          )}
        </div>
      </form>

      {showMemberModal ? (
        <div className="form-modal-backdrop" role="presentation" onClick={() => setShowMemberModal(false)}>
          <div className="form-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="form-modal-header">
              <div>
                <div className="form-modal-label">Family Member</div>
                <h2 className="form-modal-title">Add family member</h2>
                <p className="form-modal-context">You can assign this person to goals right away.</p>
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
