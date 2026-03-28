import { createElement, useEffect, useMemo, useState } from 'react';
import { Sparkles, RefreshCcw, CalendarRange, TrendingUp, AlertTriangle, CircleDollarSign, BriefcaseBusiness, PieChart } from 'lucide-react';
import { useApp } from '../context/useApp';
import { formatCurrency, formatDateTime } from '../utils/constants';
import './AiInsights.css';

const AI_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
];

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function ReportMetric({ icon, label, value, hint }) {
  return (
    <article className="ai-metric-card">
      <div className="ai-metric-icon">
        {createElement(icon, { size: 18 })}
      </div>
      <span className="ai-metric-label">{label}</span>
      <strong className="ai-metric-value">{value}</strong>
      {hint ? <span className="ai-metric-hint">{hint}</span> : null}
    </article>
  );
}

export default function AiInsights() {
  const { aiReports, generateMonthlyAiReport } = useApp();
  const [periodKey, setPeriodKey] = useState(getCurrentMonthValue);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [provider, setProvider] = useState(() => localStorage.getItem('myMoney_ai_provider') || 'openai');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.setItem('myMoney_ai_provider', provider);
  }, [provider]);

  useEffect(() => {
    if (!aiReports.length) {
      setSelectedReportId('');
      return;
    }

    if (!selectedReportId || !aiReports.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(aiReports[0].id);
    }
  }, [aiReports, selectedReportId]);

  const selectedReport = useMemo(
    () => aiReports.find((report) => report.id === selectedReportId) || aiReports[0] || null,
    [aiReports, selectedReportId],
  );

  async function handleGenerate(forceRefresh = false) {
    setLoading(true);
    setError('');
    setStatusMessage('');

    try {
      const result = await generateMonthlyAiReport(periodKey, { forceRefresh, provider });
      setSelectedReportId(result.report.id);
      setStatusMessage(result.cached ? 'Loaded the saved report for this month.' : 'Generated a fresh report.');
    } catch (err) {
      setError(err?.message || 'Could not generate the AI report.');
    } finally {
      setLoading(false);
    }
  }

  const totalSpent = Number(selectedReport?.metrics?.totalSpent) || 0;
  const previousSpent = Number(selectedReport?.metrics?.previousSpent) || 0;
  const changeAmount = totalSpent - previousSpent;
  const expenseCount = Number(selectedReport?.metrics?.expenseCount) || 0;
  const topCategory = selectedReport?.metrics?.topCategory?.label || 'N/A';
  const topType = selectedReport?.metrics?.topExpenseType?.label || 'N/A';
  const investmentValue = Number(selectedReport?.metrics?.investmentValue) || 0;
  const investedAmount = Number(selectedReport?.metrics?.investedAmount) || 0;
  const investmentGain = Number(selectedReport?.metrics?.investmentGain) || 0;
  const investmentReturnPercentage = Number(selectedReport?.metrics?.investmentReturnPercentage) || 0;
  const topInvestmentType = selectedReport?.metrics?.topInvestmentType?.label || 'N/A';
  const topHolding = selectedReport?.metrics?.topHolding?.label || 'N/A';

  return (
    <div className="ai-insights-page">
      <header className="ai-header">
        <div>
          <p className="ai-label">My Money</p>
          <h1 className="ai-title">AI Insights</h1>
          <p className="ai-subtitle">Generate monthly summaries, spending observations, and next-step recommendations.</p>
        </div>

        <div className="ai-controls">
          <label className="ai-period-picker">
            <CalendarRange size={18} />
            <input
              type="month"
              value={periodKey}
              max={getCurrentMonthValue()}
              onChange={(event) => setPeriodKey(event.target.value)}
            />
          </label>
          <div className="ai-provider-toggle" role="tablist" aria-label="AI provider">
            {AI_PROVIDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`ai-provider-btn ${provider === option.value ? 'active' : ''}`}
                onClick={() => setProvider(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" className="ai-primary-btn" onClick={() => handleGenerate(false)} disabled={loading}>
            <Sparkles size={18} />
            <span>{loading ? 'Generating...' : 'Generate Report'}</span>
          </button>
        </div>
      </header>

      {statusMessage ? <div className="ai-banner ai-banner-success">{statusMessage}</div> : null}
      {error ? <div className="ai-banner ai-banner-error">{error}</div> : null}

      <section className="ai-overview-grid">
        <ReportMetric
          icon={CircleDollarSign}
          label="Monthly spend"
          value={formatCurrency(totalSpent)}
          hint={expenseCount ? `${expenseCount} expense${expenseCount === 1 ? '' : 's'} recorded` : 'Generate a report to populate this'}
        />
        <ReportMetric
          icon={TrendingUp}
          label="vs previous month"
          value={`${changeAmount >= 0 ? '+' : ''}${formatCurrency(changeAmount)}`}
          hint={previousSpent ? `Previous: ${formatCurrency(previousSpent)}` : 'No previous month data'}
        />
        <ReportMetric
          icon={AlertTriangle}
          label="Top category"
          value={topCategory}
          hint={selectedReport?.metrics?.topCategory?.amount ? formatCurrency(selectedReport.metrics.topCategory.amount) : ''}
        />
        <ReportMetric
          icon={Sparkles}
          label="Top expense type"
          value={topType}
          hint={selectedReport?.metrics?.topExpenseType?.amount ? formatCurrency(selectedReport.metrics.topExpenseType.amount) : ''}
        />
        <ReportMetric
          icon={BriefcaseBusiness}
          label="Portfolio value"
          value={formatCurrency(investmentValue)}
          hint={investedAmount ? `Invested: ${formatCurrency(investedAmount)}` : 'No investment data'}
        />
        <ReportMetric
          icon={TrendingUp}
          label="Portfolio gain"
          value={`${investmentGain >= 0 ? '+' : ''}${formatCurrency(investmentGain)}`}
          hint={`${investmentGain >= 0 ? '+' : ''}${investmentReturnPercentage}% overall`}
        />
        <ReportMetric
          icon={PieChart}
          label="Top investment type"
          value={topInvestmentType}
          hint={selectedReport?.metrics?.topInvestmentType?.amount ? formatCurrency(selectedReport.metrics.topInvestmentType.amount) : topHolding}
        />
      </section>

      <div className="ai-layout">
        <aside className="ai-history-panel">
          <div className="ai-panel-head">
            <div>
              <p className="ai-panel-label">Saved Reports</p>
              <h2 className="ai-panel-title">Report History</h2>
            </div>
            {selectedReport ? (
              <button
                type="button"
                className="ai-ghost-btn"
                onClick={() => handleGenerate(true)}
                disabled={loading}
              >
                <RefreshCcw size={16} />
                <span>Refresh</span>
              </button>
            ) : null}
          </div>

          {aiReports.length ? (
            <div className="ai-report-list">
              {aiReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  className={`ai-report-card ${selectedReport?.id === report.id ? 'active' : ''}`}
                  onClick={() => setSelectedReportId(report.id)}
                >
                  <div>
                    <strong>{report.periodLabel}</strong>
                    <span>{formatDateTime(report.generatedAt)}</span>
                  </div>
                  <span className="ai-provider-chip">{(report.provider || 'openai').toUpperCase()}</span>
                  <p>{report.summary || 'No summary generated yet.'}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="ai-empty-card">
              <Sparkles size={28} />
              <h3>No AI reports yet</h3>
              <p>Pick a month and generate your first report. It will be saved here for quick review later.</p>
            </div>
          )}
        </aside>

        <section className="ai-detail-panel">
          {selectedReport ? (
            <>
              <div className="ai-panel-head">
                <div>
                  <p className="ai-panel-label">Current View</p>
                  <h2 className="ai-panel-title">{selectedReport.periodLabel}</h2>
                </div>
                <span className="ai-generated-at">
                  {(selectedReport.provider || 'openai').toUpperCase()} · Generated {formatDateTime(selectedReport.generatedAt)}
                </span>
              </div>

              <div className="ai-summary-card">
                <p className="ai-summary-label">Summary</p>
                <p className="ai-summary-text">{selectedReport.summary}</p>
              </div>

              <div className="ai-section-grid">
                <article className="ai-section-card">
                  <h3>What went well</h3>
                  {selectedReport.wins.length ? (
                    <ul className="ai-list">
                      {selectedReport.wins.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p className="ai-muted">No wins captured for this report.</p>
                  )}
                </article>

                <article className="ai-section-card">
                  <h3>Watchouts</h3>
                  {selectedReport.risks.length ? (
                    <ul className="ai-list">
                      {selectedReport.risks.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p className="ai-muted">No specific risks flagged.</p>
                  )}
                </article>
              </div>

              <div className="ai-section-grid">
                <article className="ai-section-card">
                  <h3>Recommendations</h3>
                  {selectedReport.recommendations.length ? (
                    <div className="ai-stacked-list">
                      {selectedReport.recommendations.map((item) => (
                        <div key={`${item.title}-${item.reason}`} className="ai-recommendation-item">
                          <div className={`ai-priority ai-priority-${item.priority}`}>{item.priority}</div>
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ai-muted">No recommendations available.</p>
                  )}
                </article>

                <article className="ai-section-card">
                  <h3>Anomalies</h3>
                  {selectedReport.anomalies.length ? (
                    <div className="ai-stacked-list">
                      {selectedReport.anomalies.map((item) => (
                        <div key={`${item.area}-${item.finding}`} className="ai-anomaly-item">
                          <strong>{item.area}</strong>
                          <p>{item.finding}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ai-muted">No anomalies found.</p>
                  )}
                </article>
              </div>

              <article className="ai-section-card">
                <h3>Investment insights</h3>
                {selectedReport.investmentInsights.length ? (
                  <ul className="ai-list">
                    {selectedReport.investmentInsights.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <p className="ai-muted">No investment-specific insights were generated for this report.</p>
                )}
              </article>

              <article className="ai-section-card">
                <h3>Top spending buckets</h3>
                <div className="ai-breakdown-columns">
                  <div>
                    <p className="ai-breakdown-label">Categories</p>
                    <div className="ai-breakdown-list">
                      {selectedReport.breakdown.categories.map((item) => (
                        <div key={item.label} className="ai-breakdown-item">
                          <span>{item.label}</span>
                          <strong>{formatCurrency(item.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="ai-breakdown-label">Subcategories</p>
                    <div className="ai-breakdown-list">
                      {selectedReport.breakdown.subcategories.map((item) => (
                        <div key={item.label} className="ai-breakdown-item">
                          <span>{item.label}</span>
                          <strong>{formatCurrency(item.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="ai-breakdown-label">Expense types</p>
                    <div className="ai-breakdown-list">
                      {selectedReport.breakdown.expenseTypes.map((item) => (
                        <div key={item.label} className="ai-breakdown-item">
                          <span>{item.label}</span>
                          <strong>{formatCurrency(item.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>

              <article className="ai-section-card">
                <h3>Portfolio breakdown</h3>
                <div className="ai-breakdown-columns">
                  <div>
                    <p className="ai-breakdown-label">Investment types</p>
                    <div className="ai-breakdown-list">
                      {selectedReport.breakdown.investmentTypes.map((item) => (
                        <div key={item.label} className="ai-breakdown-item">
                          <span>{item.label}</span>
                          <strong>{formatCurrency(item.amount)}</strong>
                        </div>
                      ))}
                      {!selectedReport.breakdown.investmentTypes.length ? <p className="ai-muted">No type split available.</p> : null}
                    </div>
                  </div>
                  <div>
                    <p className="ai-breakdown-label">Top holdings</p>
                    <div className="ai-breakdown-list">
                      {selectedReport.breakdown.holdings.map((item) => (
                        <div key={item.label} className="ai-breakdown-item">
                          <span>{item.label}</span>
                          <strong>{formatCurrency(item.amount)}</strong>
                        </div>
                      ))}
                      {!selectedReport.breakdown.holdings.length ? <p className="ai-muted">No holdings available.</p> : null}
                    </div>
                  </div>
                </div>
              </article>
            </>
          ) : (
            <div className="ai-empty-card ai-empty-card-large">
              <Sparkles size={32} />
              <h3>Generate a report to start</h3>
              <p>This screen will save monthly summaries so you can compare patterns and revisit recommendations later.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
