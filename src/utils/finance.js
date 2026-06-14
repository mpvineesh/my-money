// Returns & tax helpers: XIRR (true annualised return) and an India 80C tracker.
import { isValidDateValue } from './constants';

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function clampRate(rate) {
  return Number.isFinite(rate) && rate > -0.9999 && rate < 100 ? rate : null;
}

// XIRR via Newton's method with a bisection fallback. flows: [{ amount, date }],
// amount negative = money invested, positive = money received/current value.
export function xirr(flows) {
  const cleaned = (flows || [])
    .filter((f) => f && f.amount && isValidDateValue(f.date))
    .map((f) => ({ amount: Number(f.amount), t: new Date(`${f.date}T00:00:00`).getTime() }));
  if (cleaned.length < 2) return null;
  if (!cleaned.some((f) => f.amount > 0) || !cleaned.some((f) => f.amount < 0)) return null;

  const t0 = Math.min(...cleaned.map((f) => f.t));
  const npv = (rate) => cleaned.reduce((sum, f) => sum + f.amount / Math.pow(1 + rate, (f.t - t0) / MS_PER_YEAR), 0);

  let rate = 0.1;
  for (let i = 0; i < 60; i += 1) {
    const base = npv(rate);
    const deriv = (npv(rate + 1e-6) - base) / 1e-6;
    if (!Number.isFinite(deriv) || deriv === 0) break;
    const next = rate - base / deriv;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-7) return clampRate(next);
    rate = next;
  }

  let lo = -0.9999;
  let hi = 10;
  let flo = npv(lo);
  if (!Number.isFinite(flo)) return null;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid);
    if (!Number.isFinite(fmid)) return null;
    if (Math.abs(fmid) < 1e-6) return clampRate(mid);
    if ((flo < 0) === (fmid < 0)) { lo = mid; flo = fmid; } else { hi = mid; }
  }
  return clampRate((lo + hi) / 2);
}

// Portfolio XIRR: each holding modelled as money invested at its start date and its
// current value received today. Holdings without a valid start date are skipped.
export function computePortfolioXirr(investments) {
  const today = todayIso();
  const flows = [];
  (investments || []).forEach((inv) => {
    const invested = Number(inv?.investedAmount) || 0;
    const current = Number(inv?.currentValue) || 0;
    if (!invested || !isValidDateValue(inv?.startDate)) return;
    flows.push({ amount: -invested, date: inv.startDate });
    flows.push({ amount: current, date: today });
  });
  return xirr(flows);
}

// Indian financial year (Apr 1 – Mar 31) containing today.
function currentFinancialYear() {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
    label: `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`,
  };
}

const SECTION_80C_TYPES = new Set(['ppf', 'elss', 'epf', 'nps', 'insurance', 'ssy']);
const SECTION_80C_LIMIT = 150000;

// 80C utilisation for the current financial year, summed from contributions (increases
// in invested amount) dated within the FY across eligible instruments.
export function compute80C(investments) {
  const { start, end, label } = currentFinancialYear();
  let used = 0;
  let eligibleCount = 0;

  (investments || []).forEach((inv) => {
    if (!SECTION_80C_TYPES.has(inv?.type)) return;
    eligibleCount += 1;

    const history = Array.isArray(inv.history) ? [...inv.history].sort((a, b) => a.date.localeCompare(b.date)) : [];
    let prev = 0;
    let contributed = 0;
    history.forEach((entry) => {
      const amount = Number(entry?.investedAmount) || 0;
      const inc = amount - prev;
      if (inc > 0 && entry.date >= start && entry.date <= end) contributed += inc;
      prev = amount;
    });
    if (!history.length && inv.startDate >= start && inv.startDate <= end) {
      contributed = Number(inv.investedAmount) || 0;
    }
    used += contributed;
  });

  used = Math.round(used);
  return {
    used,
    limit: SECTION_80C_LIMIT,
    remaining: Math.max(0, SECTION_80C_LIMIT - used),
    percent: Math.min(100, Math.round((used / SECTION_80C_LIMIT) * 100)),
    eligibleCount,
    fyLabel: label,
  };
}
