import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, X } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  DEFAULT_EXPENSE_PAYER,
  EXPENSE_PAYMENT_METHODS,
  getExpenseCategoryInfo,
  getExpenseCategoryOptions,
  getExpenseSubcategories,
  getExpenseSubcategoryInfo,
  getPaymentMethodInfo,
} from '../utils/constants';
import './InvestmentForm.css';

const ADD_OTHER_PAYER_VALUE = '__add_other_payer__';
const ADD_PROJECT_VALUE = '__add_project__';
const ADD_SUBCATEGORY_VALUE = '__add_subcategory__';

const MODAL_COPY = {
  payer: {
    label: 'Paid By',
    title: 'Add other payer',
    fieldLabel: 'Name *',
    placeholder: 'e.g., Akhil',
    submitLabel: 'Save payer',
  },
  project: {
    label: 'Project',
    title: 'Add project',
    fieldLabel: 'Project name *',
    placeholder: 'e.g., House Construction',
    submitLabel: 'Save project',
  },
  category: {
    label: 'Category',
    title: 'Add category',
    fieldLabel: 'Category name *',
    placeholder: 'e.g., Maintenance',
    submitLabel: 'Save category',
  },
  subcategory: {
    label: 'Subcategory',
    title: 'Add subcategory',
    fieldLabel: 'Subcategory name *',
    placeholder: 'e.g., Painting',
    submitLabel: 'Save subcategory',
  },
};

function getCurrentDateTimeValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toDateTimeInputValue(value) {
  if (!value) return getCurrentDateTimeValue();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  return String(value).slice(0, 16);
}

function getInitialForm(expenses, id, expenseCategories = [], expenseSubcategories = [], prefill = null) {
  if (id) {
    const expense = expenses.find((item) => item.id === id);
    if (expense) {
      const category = getExpenseCategoryInfo(expense.category, expenseCategories, expense.categoryLabel);
      const subcategory = getExpenseSubcategoryInfo(
        category.value,
        expense.subcategory || expense.subCategory,
        expenseSubcategories,
        expense.subcategoryLabel || expense.subCategoryLabel,
      );
      const paymentMethod = getPaymentMethodInfo(expense.paymentMethod);

      return {
        name: expense.name || '',
        amount: expense.amount || '',
        project: expense.project || '',
        dateTime: toDateTimeInputValue(expense.dateTime || expense.date),
        category: category.value,
        categoryLabel: category.label,
        subcategory: subcategory?.value || '',
        subcategoryLabel: subcategory?.label || '',
        paidById: expense.paidById || DEFAULT_EXPENSE_PAYER.id,
        paidByName: expense.paidByName || DEFAULT_EXPENSE_PAYER.name,
        paymentMethod: paymentMethod.value,
        paymentMethodOther:
          paymentMethod.value === 'other'
            ? expense.paymentMethodOther || expense.paymentMethodLabel || expense.paymentMethod || ''
            : '',
        notes: expense.notes || '',
      };
    }
  }

  const defaultCategory = getExpenseCategoryInfo('other', expenseCategories);
  const baseForm = {
    name: '',
    amount: '',
    project: '',
    dateTime: getCurrentDateTimeValue(),
    category: defaultCategory.value,
    categoryLabel: defaultCategory.label,
    subcategory: '',
    subcategoryLabel: '',
    paidById: DEFAULT_EXPENSE_PAYER.id,
    paidByName: DEFAULT_EXPENSE_PAYER.name,
    paymentMethod: 'upi',
    paymentMethodOther: '',
    notes: '',
  };

  if (!prefill) return baseForm;

  const category = getExpenseCategoryInfo(prefill.category, expenseCategories, prefill.categoryLabel);
  const subcategory = getExpenseSubcategoryInfo(
    category.value,
    prefill.subcategory,
    expenseSubcategories,
    prefill.subcategoryLabel,
  );
  const paymentMethod = getPaymentMethodInfo(prefill.paymentMethod || baseForm.paymentMethod);

  return {
    ...baseForm,
    ...prefill,
    amount: prefill.amount || '',
    project: prefill.project || '',
    dateTime: toDateTimeInputValue(prefill.dateTime || prefill.date),
    category: category.value,
    categoryLabel: category.label,
    subcategory: subcategory?.value || '',
    subcategoryLabel: subcategory?.label || '',
    paidById: prefill.paidById || baseForm.paidById,
    paidByName: prefill.paidByName || baseForm.paidByName,
    paymentMethod: paymentMethod.value,
    paymentMethodOther:
      paymentMethod.value === 'other'
        ? prefill.paymentMethodOther || prefill.paymentMethodLabel || ''
        : '',
    notes: prefill.notes || '',
  };
}

export default function ExpenseForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill || null;
  const sourceRecurringId = location.state?.sourceRecurringId || '';
  const {
    expenses,
    expensePayers,
    expenseProjects,
    expenseCategories,
    expenseSubcategories,
    addExpense,
    updateExpense,
    deleteExpense,
    addExpensePayer,
    addExpenseProject,
    addExpenseCategory,
    addExpenseSubcategory,
    markRecurringEntryRecorded,
  } = useApp();

  const [form, setForm] = useState(() =>
    getInitialForm(expenses, id, expenseCategories, expenseSubcategories, prefill),
  );
  const [showDelete, setShowDelete] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalName, setModalName] = useState('');
  const returnTo = location.state?.returnTo || '/expenses';

  const payerOptions = useMemo(() => {
    const options = new Map([[DEFAULT_EXPENSE_PAYER.id, DEFAULT_EXPENSE_PAYER]]);

    expensePayers.forEach((payer) => {
      options.set(payer.id, payer);
    });

    expenses.forEach((expense) => {
      if (expense.paidByName) {
        options.set(expense.paidById || `payer:${expense.paidByName.toLowerCase().replace(/\s+/g, '-')}`, {
          id: expense.paidById || `payer:${expense.paidByName.toLowerCase().replace(/\s+/g, '-')}`,
          name: expense.paidByName,
        });
      }
    });

    if (form.paidByName) {
      options.set(form.paidById || `payer:${form.paidByName.toLowerCase().replace(/\s+/g, '-')}`, {
        id: form.paidById || `payer:${form.paidByName.toLowerCase().replace(/\s+/g, '-')}`,
        name: form.paidByName,
      });
    }

    return [...options.values()].sort((left, right) => {
      if (left.id === DEFAULT_EXPENSE_PAYER.id) return -1;
      if (right.id === DEFAULT_EXPENSE_PAYER.id) return 1;
      return left.name.localeCompare(right.name);
    });
  }, [expensePayers, expenses, form.paidById, form.paidByName]);

  const categoryOptions = useMemo(() => {
    const options = new Map(getExpenseCategoryOptions(expenseCategories).map((category) => [category.value, category]));

    if (form.category && !options.has(form.category)) {
      const currentCategory = getExpenseCategoryInfo(form.category, expenseCategories, form.categoryLabel);
      options.set(currentCategory.value, currentCategory);
    }

    return [...options.values()];
  }, [expenseCategories, form.category, form.categoryLabel]);

  const projectOptions = useMemo(() => {
    const options = new Map(
      expenseProjects.map((project) => [project.toLowerCase(), project]),
    );

    expenses.forEach((expense) => {
      const project = String(expense.project || '').trim();
      if (project) options.set(project.toLowerCase(), project);
    });

    if (form.project) options.set(form.project.toLowerCase(), form.project);

    return [...options.values()].sort((left, right) => left.localeCompare(right));
  }, [expenseProjects, expenses, form.project]);

  const selectedCategory = useMemo(
    () => getExpenseCategoryInfo(form.category, expenseCategories, form.categoryLabel),
    [expenseCategories, form.category, form.categoryLabel],
  );

  const subcategoryOptions = useMemo(() => {
    const options = new Map(
      getExpenseSubcategories(selectedCategory.value, expenseSubcategories).map((subcategory) => [subcategory.value, subcategory]),
    );

    if (form.subcategory && !options.has(form.subcategory)) {
      const currentSubcategory = getExpenseSubcategoryInfo(
        selectedCategory.value,
        form.subcategory,
        expenseSubcategories,
        form.subcategoryLabel,
      );
      if (currentSubcategory) options.set(currentSubcategory.value, currentSubcategory);
    }

    return [...options.values()];
  }, [expenseSubcategories, form.subcategory, form.subcategoryLabel, selectedCategory.value]);

  const modalMeta = modalType ? MODAL_COPY[modalType] : null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const closeModal = () => {
    setModalType(null);
    setModalName('');
  };

  const openModal = (type) => {
    setModalType(type);
    setModalName('');
  };

  const handleCategorySelection = (value) => {
    const category = categoryOptions.find((item) => item.value === value) || getExpenseCategoryInfo(value, expenseCategories);

    setForm((prev) => ({
      ...prev,
      category: category.value,
      categoryLabel: category.label,
      subcategory: '',
      subcategoryLabel: '',
    }));
  };

  const handleSubcategorySelection = (value) => {
    if (value === ADD_SUBCATEGORY_VALUE) {
      openModal('subcategory');
      return;
    }

    const subcategory = subcategoryOptions.find((item) => item.value === value);
    setForm((prev) => ({
      ...prev,
      subcategory: subcategory?.value || '',
      subcategoryLabel: subcategory?.label || '',
    }));
  };

  const handlePayerSelection = (value) => {
    if (value === ADD_OTHER_PAYER_VALUE) {
      openModal('payer');
      return;
    }

    const selectedPayer = payerOptions.find((payer) => payer.id === value) || DEFAULT_EXPENSE_PAYER;
    setForm((prev) => ({
      ...prev,
      paidById: selectedPayer.id,
      paidByName: selectedPayer.name,
    }));
  };

  const handleProjectSelection = (value) => {
    if (value === ADD_PROJECT_VALUE) {
      openModal('project');
      return;
    }

    setForm((prev) => ({
      ...prev,
      project: value,
    }));
  };

  const handleModalSave = () => {
    const trimmedName = modalName.trim();
    if (!trimmedName || !modalType) return;

    if (modalType === 'payer') {
      const existingPayer = payerOptions.find((payer) => payer.name.toLowerCase() === trimmedName.toLowerCase());
      const nextPayer = existingPayer || addExpensePayer({ name: trimmedName });
      if (!nextPayer) return;

      setForm((prev) => ({
        ...prev,
        paidById: nextPayer.id,
        paidByName: nextPayer.name,
      }));
      closeModal();
      return;
    }

    if (modalType === 'project') {
      const nextProject = addExpenseProject(trimmedName);
      if (!nextProject) return;

      setForm((prev) => ({
        ...prev,
        project: nextProject,
      }));
      closeModal();
      return;
    }

    if (modalType === 'category') {
      const nextCategory = addExpenseCategory({ label: trimmedName });
      if (!nextCategory) return;

      setForm((prev) => ({
        ...prev,
        category: nextCategory.value,
        categoryLabel: nextCategory.label,
        subcategory: '',
        subcategoryLabel: '',
      }));
      closeModal();
      return;
    }

    if (modalType === 'subcategory') {
      if (!selectedCategory.value) return;

      const nextSubcategory = addExpenseSubcategory({
        label: trimmedName,
        categoryValue: selectedCategory.value,
      });
      if (!nextSubcategory) return;

      setForm((prev) => ({
        ...prev,
        subcategory: nextSubcategory.value,
        subcategoryLabel: nextSubcategory.label,
      }));
      closeModal();
      return;
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const category = getExpenseCategoryInfo(form.category, expenseCategories, form.categoryLabel);
    const subcategory = getExpenseSubcategoryInfo(
      category.value,
      form.subcategory,
      expenseSubcategories,
      form.subcategoryLabel,
    );

    const payload = {
      ...form,
      name: form.name.trim(),
      amount: Number(form.amount) || 0,
      project: form.project.trim(),
      dateTime: form.dateTime,
      date: form.dateTime.slice(0, 10),
      category: category.value,
      categoryLabel: category.label,
      subcategory: subcategory?.value || '',
      subcategoryLabel: subcategory?.label || '',
      paymentMethodOther: form.paymentMethod === 'other' ? form.paymentMethodOther.trim() : '',
      notes: form.notes.trim(),
    };

    if (isEdit) {
      updateExpense(id, payload);
    } else {
      addExpense(payload);
      if (sourceRecurringId) markRecurringEntryRecorded(sourceRecurringId, payload.date);
    }

    navigate(returnTo);
  };

  const handleDelete = () => {
    deleteExpense(id);
    navigate(returnTo);
  };

  const isValid =
    form.name.trim() &&
    form.amount &&
    form.category &&
    form.dateTime &&
    form.paidByName.trim() &&
    (form.paymentMethod !== 'other' || form.paymentMethodOther.trim());

  return (
    <div className="form-page">
      <header className="form-header">
        <button type="button" className="form-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-title">{isEdit ? 'Edit Expense' : 'Add Expense'}</h1>
        <div style={{ width: 36 }} />
      </header>

      <form onSubmit={handleSubmit} className="form-body">
        <div className="form-group">
          <label className="form-label">Expense Name *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., Grocery shopping"
            value={form.name}
            onChange={(event) => handleChange('name', event.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={form.amount}
              onChange={(event) => handleChange('amount', event.target.value)}
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date & Time *</label>
            <input
              type="datetime-local"
              className="form-input"
              value={form.dateTime}
              onChange={(event) => handleChange('dateTime', event.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Project</label>
          <div className="form-inline-select">
            <select
              className="form-input"
              value={form.project}
              onChange={(event) => handleProjectSelection(event.target.value)}
            >
              <option value="">No project</option>
              {projectOptions.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
              <option value={ADD_PROJECT_VALUE}>Add new project...</option>
            </select>
            <button type="button" className="form-inline-btn" onClick={() => openModal('project')}>
              <Plus size={16} />
            </button>
          </div>
          <datalist id="expense-project-options">
            {projectOptions.map((project) => (
              <option key={project} value={project} />
            ))}
          </datalist>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Paid By *</label>
            <div className="form-inline-select">
              <select
                className="form-input"
                value={form.paidById}
                onChange={(event) => handlePayerSelection(event.target.value)}
              >
                {payerOptions.map((payer) => (
                  <option key={payer.id} value={payer.id}>
                    {payer.name}
                  </option>
                ))}
                <option value={ADD_OTHER_PAYER_VALUE}>Add other payer...</option>
              </select>
              <button type="button" className="form-inline-btn" onClick={() => openModal('payer')}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method *</label>
            <select
              className="form-input"
              value={form.paymentMethod}
              onChange={(event) => handleChange('paymentMethod', event.target.value)}
            >
              {EXPENSE_PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.paymentMethod === 'other' ? (
          <div className="form-group">
            <label className="form-label">Payment Method Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., Wallet, cheque"
              value={form.paymentMethodOther}
              onChange={(event) => handleChange('paymentMethodOther', event.target.value)}
              required
            />
          </div>
        ) : null}

        <div className="form-group">
          <div className="form-label-row">
            <label className="form-label">Category *</label>
            <button type="button" className="form-label-action" onClick={() => openModal('category')}>
              <Plus size={14} />
              Add category
            </button>
          </div>
          <div className="form-type-grid">
            {categoryOptions.map((category) => (
              <button
                key={category.value}
                type="button"
                className={`form-type-btn ${form.category === category.value ? 'active' : ''}`}
                style={
                  form.category === category.value
                    ? { backgroundColor: `${category.color}15`, color: category.color, borderColor: `${category.color}50` }
                    : {}
                }
                onClick={() => handleCategorySelection(category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <div className="form-label-row">
            <label className="form-label">Subcategory</label>
            <button
              type="button"
              className="form-label-action"
              onClick={() => openModal('subcategory')}
              disabled={!selectedCategory.value}
            >
              <Plus size={14} />
              Add subcategory
            </button>
          </div>
          <div className="form-inline-select">
            <select
              className="form-input"
              value={form.subcategory}
              onChange={(event) => handleSubcategorySelection(event.target.value)}
              disabled={!selectedCategory.value}
            >
              <option value="">Select subcategory (optional)</option>
              {subcategoryOptions.map((subcategory) => (
                <option key={`${subcategory.categoryValue}:${subcategory.value}`} value={subcategory.value}>
                  {subcategory.label}
                </option>
              ))}
              {selectedCategory.value ? <option value={ADD_SUBCATEGORY_VALUE}>Add new subcategory...</option> : null}
            </select>
            <button
              type="button"
              className="form-inline-btn"
              onClick={() => openModal('subcategory')}
              disabled={!selectedCategory.value}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input form-textarea"
            placeholder="Any notes..."
            value={form.notes}
            onChange={(event) => handleChange('notes', event.target.value)}
            rows={3}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary form-submit-btn" disabled={!isValid}>
            <Save size={18} />
            {isEdit ? 'Update Expense' : 'Add Expense'}
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

      {modalMeta ? (
        <div className="form-modal-backdrop" onClick={closeModal}>
          <div className="form-modal" onClick={(event) => event.stopPropagation()}>
            <div className="form-modal-header">
              <div>
                <p className="form-modal-label">{modalMeta.label}</p>
                <h2 className="form-modal-title">{modalMeta.title}</h2>
                {modalType === 'subcategory' ? (
                  <p className="form-modal-context">Under {selectedCategory.label}</p>
                ) : null}
              </div>
              <button type="button" className="form-modal-close" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">{modalMeta.fieldLabel}</label>
              <input
                type="text"
                className="form-input"
                placeholder={modalMeta.placeholder}
                value={modalName}
                onChange={(event) => setModalName(event.target.value)}
                autoFocus
              />
            </div>

            <div className="form-modal-actions">
              <button type="button" className="btn-cancel" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" className="btn-primary form-modal-submit" onClick={handleModalSave}>
                {modalMeta.submitLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
