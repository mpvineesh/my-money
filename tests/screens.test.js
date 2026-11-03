import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

test('updated expense and goal screens render with synthetic household data', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom', logLevel: 'silent' });
  try {
    const { AppContext } = await server.ssrLoadModule('/src/context/AppContextDef.js');
    const { AuthContext } = await server.ssrLoadModule('/src/context/AuthContextDef.js');
    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const ctx = {
      expenses: [{ id: 'expense1', name: 'Test grocery', amount: 500, dateTime: `${month}-01T09:00`, category: 'food', paidByName: 'Me', paymentMethod: 'upi' }],
      expenseCategories: [], expenseSubcategories: [], expenseTypes: [], expensePayers: [], expenseProjects: [], expenseBudgets: [],
      goals: [{ id: 'goal1', name: 'Emergency fund', targetAmount: 10000, currentAmount: 2500, priority: 'high', allocations: [], targetDate: '2030-12-01' }],
      isReadOnly: false,
    };
    for (const [module, path, route, expected] of [
      ['pages/ExpenseList', '/expenses/list?q=grocery', '/expenses/list', 'Test grocery'],
      ['pages/ExpenseForm', '/expenses/new', '/expenses/new', 'More details'],
      ['pages/Expenses', '/expenses', '/expenses', 'Recent expenses'],
      ['pages/GoalDetail', '/goals/goal1', '/goals/:id', 'per month'],
      ['pages/Goals', '/goals', '/goals', 'Emergency fund'],
      ['pages/AddPage', '/add', '/add', 'Recurring payment'],
      ['components/BottomNav', '/', '/', 'Main navigation'],
    ]) {
      const { default: Screen } = await server.ssrLoadModule(`/src/${module}.jsx`);
      const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
        createElement(AuthContext.Provider, { value: { user: { uid: 'synthetic' } } },
          createElement(AppContext.Provider, { value: ctx },
            createElement(Routes, null, createElement(Route, { path: route, element: createElement(Screen) }))))));
      assert.ok(html.includes(expected), `${module} should render its main workflow`);
    }
  } finally { await server.close(); }
});
