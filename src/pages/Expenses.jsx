import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useApp } from '../context/useApp';
import {
  formatCurrency,
  getExpenseCategoryInfo,
  getExpenseChartColor,
  getExpenseSubcategoryInfo,
  getExpenseTypeInfo,
} from '../utils/constants';
import './Expenses.css';

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
  const { expenses, expenseCategories, expenseSubcategories, expenseTypes } = useApp();
  const [selectedCategoryValue, setSelectedCategoryValue] = useState('');
  const [selectedSubcategoryValue, setSelectedSubcategoryValue] = useState('');

  const totalSpent = useMemo(
    () => expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
    [expenses],
  );

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

  const topCategory = categoryBreakdown[0];
  const activeCategoryTotal = activeCategory?.amount || 0;
  const activeSubcategoryTotal = activeSubcategory?.amount || 0;

  return (
    <div className="expenses-page">
      <header className="expense-home-header">
        <div>
          <p className="expense-home-label">My Money</p>
          <h1 className="expense-home-title">Expenses</h1>
          <p className="expense-home-subtitle">Track where your money is going at a glance.</p>
        </div>
        <div className="expense-home-actions">
          <Link to="/expenses/list" className="expense-home-link">
            View All Expenses
          </Link>
          <Link to="/expenses/new" className="btn-primary expense-home-cta">Add Expense</Link>
        </div>
      </header>

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
          </section>

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
          <p>Add your first expense to unlock category, subcategory, and expense type spending insights.</p>
          <Link to="/expenses/new" className="btn-primary">Add Expense</Link>
        </div>
      )}
    </div>
  );
}
