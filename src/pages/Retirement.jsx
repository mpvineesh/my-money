import { useMemo, useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/useApp';
import { formatCurrency, formatCompactCurrency } from '../utils/constants';
import { loadRetirementPlan, saveRetirementPlan } from '../utils/storage';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PiggyBank, Target, TrendingUp, Wallet, Flag, CalendarClock, RotateCcw } from 'lucide-react';
import './Retirement.css';

const DEFAULT_PLAN = {
  currentAge: 30,
  retirementAge: 60,
  lifeExpectancy: 85,
  monthlyExpenses: 50000,
  currentSavings: '',
  monthlySip: '',
  preReturn: 12,
  postReturn: 7,
  inflation: 6,
};

// Future value of a series of month-start contributions (annuity due) over `months`,
// expressed as a multiplier of the monthly amount.
function sipFactor(monthlyRate, months) {
  if (months <= 0) return 0;
  if (monthlyRate < 1e-9) return months;
  return ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
}

const num = (value) => (value === '' || value === null || value === undefined ? NaN : Number(value));

export default function Retirement() {
  const { investments, cash, recurringEntries } = useApp();

  // Smart prefills from the user's real data — used only when a field is left blank.
  const portfolioValue = useMemo(
    () => investments.reduce((sum, inv) => sum + (Number(inv.currentValue) || 0), 0) + (Number(cash) || 0),
    [investments, cash],
  );
  const currentSipMonthly = useMemo(
    () =>
      recurringEntries
        .filter((entry) => entry.kind === 'investment')
        .reduce((sum, entry) => {
          const amount = Number(entry.amount) || 0;
          if (entry.frequency === 'yearly') return sum + amount / 12;
          if (entry.frequency === 'quarterly') return sum + amount / 3;
          return sum + amount;
        }, 0),
    [recurringEntries],
  );

  const [plan, setPlan] = useState(() => ({ ...DEFAULT_PLAN, ...(loadRetirementPlan() || {}) }));

  useEffect(() => {
    saveRetirementPlan(plan);
  }, [plan]);

  const setField = useCallback((field, value) => {
    setPlan((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetPlan = useCallback(() => setPlan({ ...DEFAULT_PLAN }), []);

  // Effective values: fall back to the prefilled estimates when a field is blank.
  const currentSavings = Number.isFinite(num(plan.currentSavings)) ? num(plan.currentSavings) : Math.round(portfolioValue);
  const monthlySip = Number.isFinite(num(plan.monthlySip)) ? num(plan.monthlySip) : Math.round(currentSipMonthly);

  const result = useMemo(() => {
    const currentAge = num(plan.currentAge);
    const retirementAge = num(plan.retirementAge);
    const lifeExpectancy = num(plan.lifeExpectancy);
    const monthlyExpenses = num(plan.monthlyExpenses) || 0;
    const inflRate = (num(plan.inflation) || 0) / 100;
    const preRate = (num(plan.preReturn) || 0) / 100;
    const postRate = (num(plan.postReturn) || 0) / 100;

    const yearsToRetire = retirementAge - currentAge;
    const yearsInRetirement = lifeExpectancy - retirementAge;
    const valid = yearsToRetire > 0 && yearsInRetirement > 0;

    if (!valid) {
      return { valid: false, yearsToRetire, yearsInRetirement };
    }

    const monthlyExpenseAtRetirement = monthlyExpenses * Math.pow(1 + inflRate, yearsToRetire);
    const annualExpenseAtRetirement = monthlyExpenseAtRetirement * 12;

    // Corpus = present value (at retirement) of an inflation-rising annual withdrawal,
    // discounted at the post-retirement return. Annuity-due: first withdrawal on day one.
    const realRate = (1 + postRate) / (1 + inflRate) - 1;
    const pvFactor = Math.abs(realRate) < 1e-9
      ? yearsInRetirement
      : (1 - Math.pow(1 + realRate, -yearsInRetirement)) / realRate;
    const requiredCorpus = annualExpenseAtRetirement * pvFactor * (1 + realRate);

    const monthlyPre = preRate / 12;
    const months = yearsToRetire * 12;
    const factor = sipFactor(monthlyPre, months);
    const fvSavings = currentSavings * Math.pow(1 + preRate, yearsToRetire);
    const fvSip = monthlySip * factor;
    const projectedCorpus = fvSavings + fvSip;

    const gap = requiredCorpus - projectedCorpus;
    const remaining = Math.max(0, requiredCorpus - fvSavings);
    const requiredMonthlySip = factor > 0 ? remaining / factor : 0;
    const additionalSip = Math.max(0, requiredMonthlySip - monthlySip);
    const readiness = requiredCorpus > 0 ? Math.max(0, Math.min(100, (projectedCorpus / requiredCorpus) * 100)) : 0;

    const series = Array.from({ length: yearsToRetire + 1 }, (_, i) => {
      const m = i * 12;
      const projected = currentSavings * Math.pow(1 + preRate, i) + monthlySip * sipFactor(monthlyPre, m);
      return {
        age: currentAge + i,
        projected: Math.round(projected),
        required: Math.round(requiredCorpus),
      };
    });

    return {
      valid: true,
      yearsToRetire,
      yearsInRetirement,
      monthlyExpenseAtRetirement,
      requiredCorpus,
      projectedCorpus,
      gap,
      requiredMonthlySip,
      additionalSip,
      readiness,
      retirementAge,
      lifeExpectancy,
      series,
    };
  }, [plan, currentSavings, monthlySip]);

  const onTrack = result.valid && result.gap <= 0;

  const fields = [
    { key: 'currentAge', label: 'Current age', suffix: 'yrs', step: 1 },
    { key: 'retirementAge', label: 'Retirement age', suffix: 'yrs', step: 1 },
    { key: 'lifeExpectancy', label: 'Life expectancy', suffix: 'yrs', step: 1 },
    { key: 'monthlyExpenses', label: 'Monthly expenses (today)', prefix: '₹', step: 1000 },
    {
      key: 'currentSavings',
      label: 'Current savings / corpus',
      prefix: '₹',
      step: 10000,
      placeholder: Math.round(portfolioValue),
      hint: 'From your portfolio + cash',
    },
    {
      key: 'monthlySip',
      label: 'Current monthly investment',
      prefix: '₹',
      step: 1000,
      placeholder: Math.round(currentSipMonthly),
      hint: 'From your recurring SIPs',
    },
    { key: 'preReturn', label: 'Return before retirement', suffix: '%', step: 0.5 },
    { key: 'postReturn', label: 'Return after retirement', suffix: '%', step: 0.5 },
    { key: 'inflation', label: 'Inflation', suffix: '%', step: 0.5 },
  ];

  return (
    <div className="ret-page">
      <header className="ret-header">
        <div>
          <p className="ret-label">Planner</p>
          <h1 className="ret-title">Retirement Planner</h1>
          <p className="ret-subtitle">See the corpus you'll need — and the monthly SIP to get there.</p>
        </div>
        <button type="button" className="ret-reset" onClick={resetPlan}>
          <RotateCcw size={15} /> Reset
        </button>
      </header>

      <div className="ret-layout">
        <section className="ret-card ret-inputs">
          <h2 className="ret-card-title">Your details</h2>
          <div className="ret-fields">
            {fields.map((field) => (
              <label key={field.key} className="ret-field">
                <span className="ret-field-label">{field.label}</span>
                <div className="ret-input-wrap">
                  {field.prefix ? <span className="ret-affix">{field.prefix}</span> : null}
                  <input
                    type="number"
                    inputMode="decimal"
                    step={field.step}
                    min="0"
                    value={plan[field.key]}
                    placeholder={field.placeholder != null ? String(field.placeholder) : '0'}
                    onChange={(event) => setField(field.key, event.target.value)}
                  />
                  {field.suffix ? <span className="ret-affix ret-affix-suffix">{field.suffix}</span> : null}
                </div>
                {field.hint ? <span className="ret-field-hint">{field.hint}</span> : null}
              </label>
            ))}
          </div>
        </section>

        <section className="ret-results">
          {!result.valid ? (
            <div className="ret-card ret-invalid">
              <CalendarClock size={32} strokeWidth={1.4} />
              <p>Set a retirement age above your current age, and a life expectancy beyond retirement, to see your plan.</p>
            </div>
          ) : (
            <>
              <div className={`ret-card ret-readiness ${onTrack ? 'on-track' : 'behind'}`}>
                <div className="ret-readiness-ring" style={{ '--pct': `${result.readiness}%` }}>
                  <div className="ret-readiness-inner">
                    <strong>{Math.round(result.readiness)}%</strong>
                    <span>funded</span>
                  </div>
                </div>
                <div className="ret-readiness-text">
                  <span className={`ret-status-pill ${onTrack ? 'on-track' : 'behind'}`}>
                    {onTrack ? 'On track' : 'Needs attention'}
                  </span>
                  <p className="ret-readiness-headline">
                    {onTrack
                      ? `You're projected to retire at ${result.retirementAge} with a surplus of ${formatCompactCurrency(Math.abs(result.gap))}.`
                      : `You're projected to fall short by ${formatCompactCurrency(Math.abs(result.gap))} at age ${result.retirementAge}.`}
                  </p>
                  <p className="ret-readiness-sub">
                    Retiring in {result.yearsToRetire} years · funding {result.yearsInRetirement} years of retirement.
                  </p>
                </div>
              </div>

              <div className="ret-stat-grid">
                <div className="ret-stat">
                  <div className="ret-stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}><Target size={18} /></div>
                  <span className="ret-stat-label">Required corpus</span>
                  <strong className="ret-stat-value">{formatCurrency(Math.round(result.requiredCorpus))}</strong>
                  <span className="ret-stat-note">≈ {formatCompactCurrency(result.requiredCorpus)} by age {result.retirementAge}</span>
                </div>

                <div className="ret-stat">
                  <div className="ret-stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}><PiggyBank size={18} /></div>
                  <span className="ret-stat-label">Monthly SIP needed</span>
                  <strong className="ret-stat-value">{formatCurrency(Math.round(result.requiredMonthlySip))}</strong>
                  <span className="ret-stat-note">
                    {result.additionalSip > 0
                      ? `+${formatCompactCurrency(result.additionalSip)} more than now`
                      : 'Your current SIP already covers this'}
                  </span>
                </div>

                <div className="ret-stat">
                  <div className="ret-stat-icon" style={{ background: '#ecfeff', color: '#0891b2' }}><TrendingUp size={18} /></div>
                  <span className="ret-stat-label">Projected corpus</span>
                  <strong className="ret-stat-value">{formatCurrency(Math.round(result.projectedCorpus))}</strong>
                  <span className="ret-stat-note">From current savings + SIP</span>
                </div>

                <div className="ret-stat">
                  <div className="ret-stat-icon" style={{ background: onTrack ? '#f0fdf4' : '#fef2f2', color: onTrack ? '#16a34a' : '#dc2626' }}>
                    <Flag size={18} />
                  </div>
                  <span className="ret-stat-label">{onTrack ? 'Surplus' : 'Shortfall'}</span>
                  <strong className={`ret-stat-value ${onTrack ? 'positive' : 'negative'}`}>
                    {onTrack ? '+' : '−'}{formatCurrency(Math.abs(Math.round(result.gap)))}
                  </strong>
                  <span className="ret-stat-note">First-year expenses {formatCompactCurrency(result.monthlyExpenseAtRetirement)}/mo</span>
                </div>
              </div>

              <div className="ret-card ret-chart-card">
                <div className="ret-chart-head">
                  <h2 className="ret-card-title">Corpus growth to retirement</h2>
                  <span className="ret-chart-legend">
                    <i className="dot projected" /> Projected
                    <i className="dot required" /> Target
                  </span>
                </div>
                <div className="ret-chart">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={result.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="retFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16a34a" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        tickFormatter={(value) => formatCompactCurrency(value)}
                        width={52}
                      />
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        labelFormatter={(label) => `Age ${label}`}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                      />
                      <ReferenceLine y={Math.round(result.requiredCorpus)} stroke="#6366f1" strokeDasharray="5 5" />
                      <Area type="monotone" dataKey="projected" stroke="#16a34a" strokeWidth={3} fill="url(#retFill)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="ret-foot">
                  Estimates compound your savings and SIP at the pre-retirement return, then size the corpus to cover
                  inflation-rising expenses through retirement. Assumptions, not guarantees.
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
