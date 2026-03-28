import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Pencil, Trash2, X } from 'lucide-react';
import { useApp } from '../context/useApp';
import {
  formatCurrency,
  getExpenseCategoryInfo,
  getExpenseCategoryOptions,
  getExpenseChartColor,
  getExpenseSubcategoryInfo,
  getExpenseSubcategories,
  getExpenseTypeInfo,
} from '../utils/constants';
import './Expenses.css';

function getCurrentMonthValue() {
  const now = new Date();
  const timezoneAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return timezoneAdjusted.toISOString().slice(0, 7);
}

function getExpensePeriodKey(expense) {
  const value = String(expense?.dateTime || expense?.date || '').trim();
  return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : '';
}

function formatMonthLabel(periodKey) {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) return 'Selected month';
  const [year, month] = periodKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function ExpenseChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const { name, value } = payload[0];
  return (
    <div className="expense-chart-tooltip">
      <p>{name}</p>
      <strong>{formatCurrency(value)}</strong>
    </div>
  );
}

export default function Expenses() {
  const {
    expenses,
    expenseCategories,
    expenseSubcategories,
    expenseTypes,
    expenseBudgets,
    addExpenseBudget,
    updateExpenseBudget,
    deleteExpenseBudget,
  } = useApp();
  const [selectedCategoryValue, setSelectedCategoryValue] = useState('');
  const [selectedSubcategoryValue, setSelectedSubcategoryValue] = useState('');
  const [budgetMonth, setBudgetMonth] = useState(getCurrentMonthValue());
  const [budgetForm, setBudgetForm] = useState({
    id: '',
    categoryValue: '',
    subcategoryValue: '',
    amount: '',
  });

  const budgetCategoryOptions = useMemo(
    () => getExpenseCategoryOptions(expenseCategories),
    [expenseCategories],
  );

  const budgetSubcategoryOptions = useMemo(
    () => (budgetForm.categoryValue ? getExpenseSubcategories(budgetForm.categoryValue, expenseSubcategories) : []),
    [budgetForm.categoryValue, expenseSubcategories],
  );

  const totalSpent = useMemo(
    () => expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
    [expenses],
  );

  const projectBreakdown = useMemo(() => {
    const totals = new Map();

    expenses.forEach((expense) => {
      const project = String(expense.project || '').trim();
      if (!project) return;

      const current = totals.get(project);
      const expenseDate = String(expense.dateTime || expense.date || '');
      totals.set(project, {
        key: project,
        name: project,
        amount: (current?.amount || 0) + (Number(expense.amount) || 0),
        count: (current?.count || 0) + 1,
        lastActivity: current?.lastActivity && current.lastActivity > expenseDate ? current.lastActivity : expenseDate,
      });
    });

    return [...totals.values()].sort((left, right) => right.amount - left.amount);
  }, [expenses]);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map();

    expenses.forEach((expense) => {
      const category = getExpenseCategoryInfo(expense.category, expenseCategories, expense.categoryLabel);
      const currentTotal = totals.get(category.value)?.amount || 0;
      totals.set(category.value, {
        key: category.value,
        name: category.label,
        amount: currentTotal + (Number(expense.amount) || 0),
        color: category.color,
      });
    });

    return [...totals.values()].sort((left, right) => right.amount - left.amount);
  }, [expenseCategories, expenses]);

  const activeCategoryValue = categoryBreakdown.some((category) => category.key === selectedCategoryValue)
    ? selectedCategoryValue
    : categoryBreakdown[0]?.key || '';
  const activeCategory = categoryBreakdown.find((category) => category.key === activeCategoryValue) || categoryBreakdown[0];

  const subcategoryBreakdown = useMemo(() => {
    if (!activeCategoryValue) return [];

    const totals = new Map();

    expenses.forEach((expense) => {
      const category = getExpenseCategoryInfo(expense.category, expenseCategories, expense.categoryLabel);
      if (category.value !== activeCategoryValue) return;

      const subcategory = getExpenseSubcategoryInfo(
        category.value,
        expense.subcategory,
        expenseSubcategories,
        expense.subcategoryLabel,
      );
      const key = subcategory?.value || 'uncategorized';
      const current = totals.get(key);

      totals.set(key, {
        key,
        name: subcategory?.label || 'Uncategorized',
        amount: (current?.amount || 0) + (Number(expense.amount) || 0),
        color: current?.color || subcategory?.color || getExpenseChartColor(totals.size),
      });
    });

    return [...totals.values()].sort((left, right) => right.amount - left.amount);
  }, [activeCategoryValue, expenseCategories, expenseSubcategories, expenses]);

  const activeSubcategoryValue = subcategoryBreakdown.some((subcategory) => subcategory.key === selectedSubcategoryValue)
    ? selectedSubcategoryValue
    : subcategoryBreakdown[0]?.key || '';
  const activeSubcategory = subcategoryBreakdown.find((subcategory) => subcategory.key === activeSubcategoryValue) || subcategoryBreakdown[0];

  const expenseTypeBreakdown = useMemo(() => {
    if (!activeCategoryValue || !activeSubcategoryValue) return [];

    const totals = new Map();

    expenses.forEach((expense) => {
      const category = getExpenseCategoryInfo(expense.category, expenseCategories, expense.categoryLabel);
      if (category.value !== activeCategoryValue) return;

      const subcategory = getExpenseSubcategoryInfo(
        category.value,
        expense.subcategory,
        expenseSubcategories,
        expense.subcategoryLabel,
      );
      const subcategoryKey = subcategory?.value || 'uncategorized';
      if (subcategoryKey !== activeSubcategoryValue) return;

      const expenseType = getExpenseTypeInfo(
        category.value,
        subcategory?.value || '',
        expense.expenseType,
        expenseTypes,
        expense.expenseTypeLabel,
      );
      const key = expenseType?.value || 'uncategorized';
      const current = totals.get(key);

      totals.set(key, {
        key,
        name: expenseType?.label || 'Uncategorized',
        amount: (current?.amount || 0) + (Number(expense.amount) || 0),
        color: current?.color || expenseType?.color || getExpenseChartColor(totals.size),
      });
    });

    return [...totals.values()].sort((left, right) => right.amount - left.amount);
  }, [activeCategoryValue, activeSubcategoryValue, expenseCategories, expenseSubcategories, expenseTypes, expenses]);

  const monthlyExpenses = useMemo(
    () => expenses.filter((expense) => getExpensePeriodKey(expense) === budgetMonth),
    [budgetMonth, expenses],
  );

  const monthlySpent = useMemo(
    () => monthlyExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
    [monthlyExpenses],
  );

  const budgetItems = useMemo(() => {
    return expenseBudgets
      .filter((budget) => budget.periodKey === budgetMonth)
      .map((budget) => {
        const category = getExpenseCategoryInfo(budget.categoryValue, expenseCategories, budget.categoryLabel);
        const subcategory = budget.subcategoryValue
          ? getExpenseSubcategoryInfo(
              category.value,
              budget.subcategoryValue,
              expenseSubcategories,
              budget.subcategoryLabel,
            )
          : null;

        const actual = monthlyExpenses.reduce((sum, expense) => {
          const expenseCategory = getExpenseCategoryInfo(expense.category, expenseCategories, expense.categoryLabel);
          if (expenseCategory.value !== category.value) return sum;

          if (!budget.subcategoryValue) return sum + (Number(expense.amount) || 0);

          const expenseSubcategory = getExpenseSubcategoryInfo(
            expenseCategory.value,
            expense.subcategory,
            expenseSubcategories,
            expense.subcategoryLabel,
          );

          return expenseSubcategory?.value === budget.subcategoryValue
            ? sum + (Number(expense.amount) || 0)
            : sum;
        }, 0);

        const remaining = budget.amount - actual;
        const progress = budget.amount > 0 ? Math.round((actual / budget.amount) * 100) : 0;

        return {
          ...budget,
          actual,
          remaining,
          progress,
          overspent: remaining < 0,
          categoryLabel: category.label,
          subcategoryLabel: subcategory?.label || '',
          scopeLabel: subcategory ? `${category.label} / ${subcategory.label}` : category.label,
        };
      })
      .sort((left, right) => {
        if (left.overspent !== right.overspent) return Number(right.overspent) - Number(left.overspent);
        return right.actual - left.actual;
      });
  }, [budgetMonth, expenseBudgets, expenseCategories, expenseSubcategories, monthlyExpenses]);

  const totalBudget = useMemo(
    () => budgetItems.reduce((sum, budget) => sum + budget.amount, 0),
    [budgetItems],
  );

  const totalBudgetRemaining = totalBudget - monthlySpent;
  const overBudgetCount = budgetItems.filter((budget) => budget.overspent).length;
  const topBudgetIssue = budgetItems.find((budget) => budget.overspent) || null;
  const topCategory = categoryBreakdown[0];
  const topProject = projectBreakdown[0] || null;
  const activeCategoryTotal = activeCategory?.amount || 0;
  const activeSubcategoryTotal = activeSubcategory?.amount || 0;

  function resetBudgetForm() {
    setBudgetForm({
      id: '',
      categoryValue: '',
      subcategoryValue: '',
      amount: '',
    });
  }

  function handleBudgetFieldChange(field, value) {
    setBudgetForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'categoryValue' ? { subcategoryValue: '' } : {}),
    }));
  }

  function handleBudgetSubmit(event) {
    event.preventDefault();

    const amount = Number(budgetForm.amount);
    if (!budgetForm.categoryValue || amount <= 0) return;

    const payload = {
      periodKey: budgetMonth,
      categoryValue: budgetForm.categoryValue,
      subcategoryValue: budgetForm.subcategoryValue,
      amount,
    };

    if (budgetForm.id) updateExpenseBudget(budgetForm.id, payload);
    else addExpenseBudget(payload);

    resetBudgetForm();
  }

  function handleBudgetEdit(budget) {
    setBudgetForm({
      id: budget.id,
      categoryValue: budget.categoryValue,
      subcategoryValue: budget.subcategoryValue || '',
      amount: String(budget.amount),
    });
  }

  function handleBudgetDelete(id) {
    if (!window.confirm('Delete this budget?')) return;
    deleteExpenseBudget(id);
    if (budgetForm.id === id) resetBudgetForm();
  }

  return (
    <div className="expenses-page">
      <header className="expense-home-header">
        <div>
          <p className="expense-home-label">My Money</p>
          <h1 className="expense-home-title">Expenses</h1>
          <p className="expense-home-subtitle">Track where your money is going and set monthly budgets to control it.</p>
        </div>
        <div className="expense-home-actions">
          <Link to="/expenses/list" className="expense-home-link">
            View All Expenses
          </Link>
          <Link to="/expenses/new" className="btn-primary expense-home-cta">Add Expense</Link>
        </div>
      </header>

      <section className="expense-panel expense-budget-panel">
        <div className="expense-panel-header expense-budget-header">
          <div>
            <p className="expense-panel-label">Budgets</p>
            <h2 className="expense-panel-title">Monthly budget planner</h2>
            <p className="expense-budget-subtitle">Set category or subcategory caps and compare them against actual spend for {formatMonthLabel(budgetMonth)}.</p>
          </div>
          <label className="expense-budget-month">
            <span>Month</span>
            <input
              type="month"
              value={budgetMonth}
              onChange={(event) => setBudgetMonth(event.target.value)}
            />
          </label>
        </div>

        <div className="expense-budget-top">
          <div className="expense-budget-summary-grid">
            <article className="expense-budget-stat">
              <span className="expense-budget-stat-label">Budget set</span>
              <strong>{formatCurrency(totalBudget)}</strong>
              <span>{budgetItems.length ? `${budgetItems.length} budget item${budgetItems.length === 1 ? '' : 's'}` : 'No budgets yet'}</span>
            </article>
            <article className="expense-budget-stat">
              <span className="expense-budget-stat-label">Spent this month</span>
              <strong>{formatCurrency(monthlySpent)}</strong>
              <span>{monthlyExpenses.length ? `${monthlyExpenses.length} expense${monthlyExpenses.length === 1 ? '' : 's'} in ${formatMonthLabel(budgetMonth)}` : 'No expenses recorded for this month'}</span>
            </article>
            <article className={`expense-budget-stat ${totalBudgetRemaining < 0 ? 'danger' : ''}`}>
              <span className="expense-budget-stat-label">{totalBudgetRemaining < 0 ? 'Over budget' : 'Remaining'}</span>
              <strong>{formatCurrency(Math.abs(totalBudgetRemaining))}</strong>
              <span>{totalBudget ? `${Math.max(totalBudgetRemaining, 0) >= 0 ? 'Left from plan' : 'Above your plan'}` : 'Add a budget target to compare'}</span>
            </article>
            <article className={`expense-budget-stat ${overBudgetCount ? 'danger' : ''}`}>
              <span className="expense-budget-stat-label">Alerts</span>
              <strong>{overBudgetCount}</strong>
              <span>{topBudgetIssue ? `${topBudgetIssue.scopeLabel} is over by ${formatCurrency(Math.abs(topBudgetIssue.remaining))}` : 'No budget overruns right now'}</span>
            </article>
          </div>

          <form className="expense-budget-form" onSubmit={handleBudgetSubmit}>
            <div className="expense-budget-form-head">
              <div>
                <h3>{budgetForm.id ? 'Edit budget' : 'Add budget target'}</h3>
                <p>{budgetForm.id ? 'Update the current budget item.' : 'Budget an entire category or a specific subcategory.'}</p>
              </div>
              {budgetForm.id ? (
                <button type="button" className="expense-budget-clear" onClick={resetBudgetForm}>
                  <X size={16} />
                  <span>Cancel</span>
                </button>
              ) : null}
            </div>

            <div className="expense-budget-form-grid">
              <label className="expense-budget-field">
                <span>Category</span>
                <select
                  value={budgetForm.categoryValue}
                  onChange={(event) => handleBudgetFieldChange('categoryValue', event.target.value)}
                  required
                >
                  <option value="">Select category</option>
                  {budgetCategoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="expense-budget-field">
                <span>Subcategory</span>
                <select
                  value={budgetForm.subcategoryValue}
                  onChange={(event) => handleBudgetFieldChange('subcategoryValue', event.target.value)}
                  disabled={!budgetForm.categoryValue}
                >
                  <option value="">Entire category</option>
                  {budgetSubcategoryOptions.map((subcategory) => (
                    <option key={subcategory.value} value={subcategory.value}>
                      {subcategory.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="expense-budget-field">
                <span>Budget amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={budgetForm.amount}
                  onChange={(event) => handleBudgetFieldChange('amount', event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="expense-budget-form-actions">
              <button type="submit" className="btn-primary">
                {budgetForm.id ? 'Update Budget' : 'Save Budget'}
              </button>
            </div>
          </form>
        </div>

        <div className="expense-budget-list">
          {budgetItems.length ? (
            budgetItems.map((budget) => (
              <article key={budget.id} className="expense-budget-item">
                <div className="expense-budget-item-main">
                  <div>
                    <strong>{budget.scopeLabel}</strong>
                    <span>{budget.subcategoryValue ? 'Subcategory budget' : 'Category budget'}</span>
                  </div>
                  <div className="expense-budget-item-amounts">
                    <strong>{formatCurrency(budget.actual)}</strong>
                    <span>of {formatCurrency(budget.amount)}</span>
                  </div>
                </div>

                <div className="expense-budget-progress">
                  <span
                    className={budget.overspent ? 'danger' : ''}
                    style={{ width: `${Math.min(Math.max(budget.progress, 0), 100)}%` }}
                  />
                </div>

                <div className="expense-budget-item-footer">
                  <span className={`expense-budget-status ${budget.overspent ? 'danger' : ''}`}>
                    {budget.overspent
                      ? `Over by ${formatCurrency(Math.abs(budget.remaining))}`
                      : `${formatCurrency(budget.remaining)} left`}
                  </span>

                  <div className="expense-budget-item-actions">
                    <button type="button" className="expense-budget-action" onClick={() => handleBudgetEdit(budget)}>
                      <Pencil size={15} />
                      <span>Edit</span>
                    </button>
                    <button type="button" className="expense-budget-action danger" onClick={() => handleBudgetDelete(budget.id)}>
                      <Trash2 size={15} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="expense-budget-empty">
              <h3>No budgets for {formatMonthLabel(budgetMonth)}</h3>
              <p>Add a budget target above to compare planned spend versus actual expense totals.</p>
            </div>
          )}
        </div>
      </section>

      {expenses.length > 0 ? (
        <>
          <section className="expense-home-summary">
            <article className="expense-stat-card expense-stat-highlight">
              <span className="expense-stat-label">Total spent</span>
              <strong className="expense-stat-value">{formatCurrency(totalSpent)}</strong>
              <span className="expense-stat-note">Across {expenses.length} recorded expenses</span>
            </article>

            <article className="expense-stat-card">
              <span className="expense-stat-label">Top category</span>
              <strong className="expense-stat-value">{topCategory?.name || 'Other'}</strong>
              <span className="expense-stat-note">
                {topCategory ? formatCurrency(topCategory.amount) : 'No category data yet'}
              </span>
            </article>

            <article className="expense-stat-card">
              <span className="expense-stat-label">Tracked projects</span>
              <strong className="expense-stat-value">{projectBreakdown.length}</strong>
              <span className="expense-stat-note">
                {projectBreakdown.length ? 'Project-tagged expense groups' : 'Start adding project names to expenses'}
              </span>
            </article>

            <article className="expense-stat-card">
              <span className="expense-stat-label">Top project</span>
              <strong className="expense-stat-value">{topProject?.name || 'No project yet'}</strong>
              <span className="expense-stat-note">
                {topProject ? `${formatCurrency(topProject.amount)} across ${topProject.count} expense${topProject.count === 1 ? '' : 's'}` : 'No project-tagged expenses yet'}
              </span>
            </article>
          </section>

          {projectBreakdown.length ? (
            <section className="expense-panel expense-project-panel">
              <div className="expense-panel-header">
                <div>
                  <p className="expense-panel-label">Projects</p>
                  <h2 className="expense-panel-title">Project-based expense tracking</h2>
                </div>
              </div>

              <div className="expense-project-list">
                {projectBreakdown.map((project) => (
                  <article key={project.key} className="expense-project-item">
                    <div>
                      <strong>{project.name}</strong>
                      <span>{project.count} expense{project.count === 1 ? '' : 's'} linked</span>
                    </div>
                    <div className="expense-project-item-amounts">
                      <strong>{formatCurrency(project.amount)}</strong>
                      <span>{totalSpent ? `${Math.round((project.amount / totalSpent) * 100)}% of total spend` : '0% of total spend'}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="expense-home-grid">
            <article className="expense-panel expense-chart-panel">
              <div className="expense-panel-header">
                <div>
                  <p className="expense-panel-label">Allocation</p>
                  <h2 className="expense-panel-title">Expense split by category</h2>
                </div>
              </div>

              <div className="expense-chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={68}
                      outerRadius={98}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {categoryBreakdown.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ExpenseChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="expense-chart-center">
                  <span>Total</span>
                  <strong>{formatCurrency(totalSpent)}</strong>
                </div>
              </div>
            </article>

            <article className="expense-panel">
              <div className="expense-panel-header">
                <div>
                  <p className="expense-panel-label">Breakdown</p>
                  <h2 className="expense-panel-title">Where most of it goes</h2>
                </div>
              </div>

              <div className="expense-breakdown-list">
                {categoryBreakdown.map((item) => (
                  <div key={item.key} className="expense-breakdown-item">
                    <div className="expense-breakdown-main">
                      <span className="expense-breakdown-dot" style={{ backgroundColor: item.color }} />
                      <div>
                        <strong>{item.name}</strong>
                        <span>{totalSpent ? `${Math.round((item.amount / totalSpent) * 100)}% of total` : '0%'}</span>
                      </div>
                    </div>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="expense-panel expense-subcategory-panel">
            <div className="expense-panel-header">
              <div>
                <p className="expense-panel-label">Drill Down</p>
                <h2 className="expense-panel-title">Subcategory split by category</h2>
              </div>
            </div>

            <div className="expense-category-filters">
              {categoryBreakdown.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={`expense-category-filter ${activeCategory?.key === category.key ? 'active' : ''}`}
                  style={
                    activeCategory?.key === category.key
                      ? { backgroundColor: `${category.color}15`, color: category.color, borderColor: `${category.color}50` }
                      : {}
                  }
                  onClick={() => setSelectedCategoryValue(category.key)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {activeCategory ? (
              <div className="expense-subcategory-grid">
                <div className="expense-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={subcategoryBreakdown}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={98}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {subcategoryBreakdown.map((entry) => (
                          <Cell key={`${activeCategory.key}:${entry.key}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ExpenseChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="expense-chart-center">
                    <span>{activeCategory.name}</span>
                    <strong>{formatCurrency(activeCategoryTotal)}</strong>
                  </div>
                </div>

                <div className="expense-breakdown-list">
                  {subcategoryBreakdown.map((item) => (
                    <div key={`${activeCategory.key}:${item.key}`} className="expense-breakdown-item">
                      <div className="expense-breakdown-main">
                        <span className="expense-breakdown-dot" style={{ backgroundColor: item.color }} />
                        <div>
                          <strong>{item.name}</strong>
                          <span>{activeCategoryTotal ? `${Math.round((item.amount / activeCategoryTotal) * 100)}% of category` : '0%'}</span>
                        </div>
                      </div>
                      <strong>{formatCurrency(item.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="expense-panel expense-type-panel">
            <div className="expense-panel-header">
              <div>
                <p className="expense-panel-label">Expense Type</p>
                <h2 className="expense-panel-title">Expense type split by subcategory</h2>
              </div>
            </div>

            <div className="expense-category-filters">
              {subcategoryBreakdown.map((subcategory) => (
                <button
                  key={`${activeCategoryValue}:${subcategory.key}`}
                  type="button"
                  className={`expense-category-filter ${activeSubcategory?.key === subcategory.key ? 'active' : ''}`}
                  style={
                    activeSubcategory?.key === subcategory.key
                      ? { backgroundColor: `${subcategory.color}15`, color: subcategory.color, borderColor: `${subcategory.color}50` }
                      : {}
                  }
                  onClick={() => setSelectedSubcategoryValue(subcategory.key)}
                >
                  {subcategory.name}
                </button>
              ))}
            </div>

            {activeSubcategory ? (
              <div className="expense-type-grid">
                <div className="expense-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={expenseTypeBreakdown}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={98}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {expenseTypeBreakdown.map((entry) => (
                          <Cell key={`${activeCategoryValue}:${activeSubcategory.key}:${entry.key}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ExpenseChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="expense-chart-center">
                    <span>{activeSubcategory.name}</span>
                    <strong>{formatCurrency(activeSubcategoryTotal)}</strong>
                  </div>
                </div>

                <div className="expense-breakdown-list">
                  {expenseTypeBreakdown.map((item) => (
                    <div key={`${activeCategoryValue}:${activeSubcategory.key}:${item.key}`} className="expense-breakdown-item">
                      <div className="expense-breakdown-main">
                        <span className="expense-breakdown-dot" style={{ backgroundColor: item.color }} />
                        <div>
                          <strong>{item.name}</strong>
                          <span>{activeSubcategoryTotal ? `${Math.round((item.amount / activeSubcategoryTotal) * 100)}% of subcategory` : '0%'}</span>
                        </div>
                      </div>
                      <strong>{formatCurrency(item.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <div className="expense-empty-state">
          <h2>No expenses yet</h2>
          <p>Add your first expense to unlock category, subcategory, expense type, and budget tracking insights.</p>
          <Link to="/expenses/new" className="btn-primary">Add Expense</Link>
        </div>
      )}
    </div>
  );
}
