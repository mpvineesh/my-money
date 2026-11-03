export function filterExpenses(expenses, filters) {
  const query = (filters.q || '').trim().toLowerCase();
  return expenses.filter((expense) => {
    const date = String(expense.dateTime || expense.date || '').slice(0, 10);
    const amount = Number(expense.amount) || 0;
    return (!query || [expense.name, expense.notes, expense.project, expense.categoryLabel, expense.paidByName].some((value) => String(value || '').toLowerCase().includes(query)))
      && (!filters.project || expense.project === filters.project)
      && (!filters.category || expense.category === filters.category)
      && (!filters.payer || (expense.paidByName || 'Me') === filters.payer)
      && (!filters.payment || expense.paymentMethod === filters.payment)
      && (!filters.from || date >= filters.from)
      && (!filters.to || date <= filters.to)
      && (!filters.min || amount >= Number(filters.min))
      && (!filters.max || amount <= Number(filters.max));
  });
}
