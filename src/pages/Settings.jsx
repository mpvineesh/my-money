import { useEffect, useState } from 'react';
import { Check, ChevronRight, KeyRound, Palette, SlidersHorizontal, UserRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { THEMES, DEFAULT_THEME } from '../utils/themes';
import { FEATURES } from '../config';
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
  const {
    appSettings,
    investmentMemberOptions,
    investmentVisibilityMemberId,
    investmentVisibilityMember,
    ownerName,
    isReadOnly,
    updateAppSettings,
  } = useApp();
  const dashboardSections = appSettings?.dashboardSections || {};

  const [nameDraft, setNameDraft] = useState(ownerName);
  useEffect(() => { setNameDraft(ownerName); }, [ownerName]);
  const trimmedName = nameDraft.trim();
  const nameDirty = trimmedName && trimmedName !== ownerName;

  function handleSaveName() {
    if (!trimmedName || trimmedName === ownerName) return;
    updateAppSettings({ ownerName: trimmedName });
  }

  function handleToggle(key) {
    updateAppSettings((current) => ({
      dashboardSections: {
        ...(current?.dashboardSections || {}),
        [key]: !current?.dashboardSections?.[key],
      },
    }));
  }

  function handleInvestmentVisibilityChange(value) {
    updateAppSettings({
      investmentVisibilityMemberId: value,
    });
  }

  const showProjectedValue = appSettings?.showProjectedValue !== false;

  function handleProjectedValueToggle() {
    updateAppSettings((current) => ({
      showProjectedValue: current?.showProjectedValue === false,
    }));
  }

  const showMotivationBanner = appSettings?.showMotivationBanner !== false;

  function handleMotivationBannerToggle() {
    updateAppSettings((current) => ({
      showMotivationBanner: current?.showMotivationBanner === false,
    }));
  }

  const activeTheme = appSettings?.theme || DEFAULT_THEME;

  function handleThemeChange(themeId) {
    updateAppSettings({ theme: themeId });
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

      {!isReadOnly ? (
        <section className="settings-panel">
          <div className="settings-panel-head">
            <div>
              <p className="settings-panel-label">Profile</p>
              <h2>Your name</h2>
              <p className="settings-panel-copy">
                This is how you appear across the app (on your investments, goals, and the member filter) instead of &ldquo;Me&rdquo;.
              </p>
            </div>
            <div className="settings-icon-circle settings-icon-circle--sm">
              <UserRound size={18} />
            </div>
          </div>

          <div className="settings-name-row">
            <input
              type="text"
              className="settings-input"
              value={nameDraft}
              maxLength={40}
              placeholder="Me"
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleSaveName(); }}
            />
            <button
              type="button"
              className="settings-name-save"
              onClick={handleSaveName}
              disabled={!nameDirty}
            >
              Save
            </button>
          </div>
        </section>
      ) : null}

      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <p className="settings-panel-label">Appearance</p>
            <h2>App theme</h2>
            <p className="settings-panel-copy">
              Pick an accent palette. This re-colors buttons, highlights, charts, and other accents across the app.
            </p>
          </div>
          <div className="settings-icon-circle settings-icon-circle--sm">
            <Palette size={18} />
          </div>
        </div>

        <div className="settings-theme-grid">
          {THEMES.map((theme) => {
            const isActive = activeTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                className={`settings-theme-card ${isActive ? 'active' : ''}`}
                onClick={() => handleThemeChange(theme.id)}
                aria-pressed={isActive ? 'true' : 'false'}
              >
                <span
                  className="settings-theme-swatch"
                  style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}
                >
                  {isActive ? <Check size={16} strokeWidth={3} /> : null}
                </span>
                <span className="settings-theme-name">{theme.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <p className="settings-panel-label">Portfolio</p>
            <h2>Investment visibility</h2>
            <p className="settings-panel-copy">
              Choose whether the app shows the whole family portfolio or only one member&apos;s investments.
            </p>
          </div>
        </div>

        <label className="settings-field">
          <span>Show investments for</span>
          <select
            className="settings-select"
            value={investmentVisibilityMemberId}
            onChange={(event) => handleInvestmentVisibilityChange(event.target.value)}
          >
            <option value="all">Whole family</option>
            {investmentMemberOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>

        <p className="settings-helper-copy">
          Current view: <strong>{investmentVisibilityMember ? investmentVisibilityMember.name : 'Whole family'}</strong>. This affects the dashboard and investments pages.
        </p>

        <div className="settings-toggle-list">
          <article className="settings-toggle-card">
            <div>
              <strong>Projected Value</strong>
              <p>Show or hide the future-value projection chart and estimate on each investment card.</p>
            </div>
            <button
              type="button"
              className={`settings-switch ${showProjectedValue ? 'active' : ''}`}
              onClick={handleProjectedValueToggle}
              aria-pressed={showProjectedValue ? 'true' : 'false'}
            >
              <span />
            </button>
          </article>
        </div>
      </section>

      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <p className="settings-panel-label">Dashboard</p>
            <h2>Visible sections</h2>
          </div>
        </div>

        <div className="settings-toggle-list">
          <article className="settings-toggle-card">
            <div>
              <strong>Motivation Banner</strong>
              <p>Show a small banner on the home screen that highlights an encouraging fact from your data each day.</p>
            </div>
            <button
              type="button"
              className={`settings-switch ${showMotivationBanner ? 'active' : ''}`}
              onClick={handleMotivationBannerToggle}
              aria-pressed={showMotivationBanner ? 'true' : 'false'}
            >
              <span />
            </button>
          </article>
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

      {FEATURES.passwordVault && !isReadOnly ? (
        <section className="settings-panel">
          <div className="settings-panel-head">
            <div>
              <p className="settings-panel-label">Security</p>
              <h2>Password vault</h2>
            </div>
          </div>

          <button type="button" className="settings-link-card" onClick={() => navigate('/vault')}>
            <div className="settings-link-icon">
              <KeyRound size={20} />
            </div>
            <div className="settings-link-copy">
              <strong>Open password vault</strong>
              <p>Store passwords end-to-end encrypted with a master password. Only you can read them.</p>
            </div>
            <ChevronRight size={18} />
          </button>
        </section>
      ) : null}

      {!isReadOnly ? (
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
      ) : null}
    </div>
  );
}
