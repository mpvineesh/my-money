import { ChevronRight, SlidersHorizontal, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import './Settings.css';

const DASHBOARD_TOGGLES = [
  {
    key: 'netWorth',
    title: 'Net Worth Snapshot',
    description: 'Show or hide the balance-sheet cards and trend chart at the top of the dashboard.',
  },
  {
    key: 'portfolioStats',
    title: 'Portfolio Stats',
    description: 'Show or hide the summary cards for portfolio value, returns, cash reserve, and loan exposure.',
  },
  {
    key: 'assetAllocation',
    title: 'Asset Allocation',
    description: 'Show or hide the asset allocation pie chart.',
  },
  {
    key: 'goalProgress',
    title: 'Goal Progress',
    description: 'Show or hide the goals progress section.',
  },
  {
    key: 'topInvestments',
    title: 'Top Investments',
    description: 'Show or hide the top investments section.',
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { appSettings, updateAppSettings } = useApp();
  const dashboardSections = appSettings?.dashboardSections || {};

  function handleToggle(key) {
    updateAppSettings((current) => ({
      dashboardSections: {
        ...(current?.dashboardSections || {}),
        [key]: !current?.dashboardSections?.[key],
      },
    }));
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div className="settings-icon-circle">
          <SlidersHorizontal size={26} />
        </div>
        <div>
          <p className="settings-label">Preferences</p>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Choose which sections are visible on the dashboard home screen.</p>
        </div>
      </header>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <p className="settings-panel-label">Dashboard</p>
            <h2>Visible sections</h2>
          </div>
        </div>

        <div className="settings-toggle-list">
          {DASHBOARD_TOGGLES.map((item) => (
            <article key={item.key} className="settings-toggle-card">
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
              <button
                type="button"
                className={`settings-switch ${dashboardSections[item.key] ? 'active' : ''}`}
                onClick={() => handleToggle(item.key)}
                aria-pressed={dashboardSections[item.key] ? 'true' : 'false'}
              >
                <span />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-panel settings-panel-secondary">
        <div className="settings-panel-head">
          <div>
            <p className="settings-panel-label">Household</p>
            <h2>Family members</h2>
          </div>
        </div>

        <button type="button" className="settings-link-card" onClick={() => navigate('/family-members')}>
          <div className="settings-link-icon">
            <Users size={20} />
          </div>
          <div className="settings-link-copy">
            <strong>Manage members and holdings</strong>
            <p>Add family members once, then assign and review their investments from one place.</p>
          </div>
          <ChevronRight size={18} />
        </button>
      </section>
    </div>
  );
}
