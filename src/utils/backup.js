// Backup / restore + CSV export helpers.
//
// A backup is built entirely from data already loaded in memory (the AppContext
// value), so exporting costs zero Firestore reads. Restore writes the records back
// by id (merge), only for the allow-listed collections below.

export const BACKUP_VERSION = 1;

// Collection keys as exposed on the AppContext value === Firestore subcollection names.
export const BACKUP_COLLECTIONS = [
  'investments',
  'swingTrades',
  'goals',
  'loans',
  'familyMembers',
  'expenses',
  'expensePayers',
  'expenseProjects',
  'expenseCategories',
  'expenseSubcategories',
  'expenseTypes',
  'expenseBudgets',
  'recurringEntries',
  'reminders',
  'cashHistory',
  'netWorthSnapshots',
  'aiReports',
  'calendarEvents',
];

export function buildBackup(data) {
  const collections = {};
  BACKUP_COLLECTIONS.forEach((key) => {
    collections[key] = Array.isArray(data?.[key]) ? data[key] : [];
  });
  return {
    app: 'my-money',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: data?.appSettings || {},
    collections,
  };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(obj, filename) {
  triggerDownload(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
}

function csvEscape(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns: [{ label, value }] where value is a field name or (row) => cellValue.
export function toCsv(rows, columns) {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const lines = (rows || []).map((row) =>
    columns.map((c) => csvEscape(typeof c.value === 'function' ? c.value(row) : row?.[c.value])).join(','));
  return [header, ...lines].join('\n');
}

export function downloadCsv(csv, filename) {
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}
