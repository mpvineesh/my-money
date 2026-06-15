import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Database, Download, KeyRound, Lock, Palette, SlidersHorizontal, Upload, UserRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { THEMES, DEFAULT_THEME } from '../utils/themes';
import { buildBackup, downloadJson, toCsv, downloadCsv } from '../utils/backup';
import { isAppLockEnabled, setAppPin, disableAppLock } from '../utils/appLock';
import { FEATURES } from '../config';
import './Settings.css';

const INVESTMENT_COLUMNS = [
  { label: 'Name', value: 'name' },
  { label: 'Type', value: 'type' },
  { label: 'Owner', value: 'memberName' },
  { label: 'Invested', value: 'investedAmount' },
  { label: 'Current', value: 'currentValue' },
  { label: 'Risk', value: 'risk' },
  { label: 'Start date', value: 'startDate' },
  { label: 'Maturity', value: 'maturityDate' },
  { label: 'Interest %', value: 'interestRate' },
  { label: 'Notes', value: 'notes' },
];

const EXPENSE_COLUMNS = [
  { label: 'Name', value: 'name' },
  { label: 'Amount', value: 'amount' },
  { label: 'Date', value: (row) => row.date || String(row.dateTime || '').slice(0, 10) },
  { label: 'Category', value: 'category' },
  { label: 'Subcategory', value: 'subcategoryLabel' },
  { label: 'Paid by', value: 'paidByName' },
  { label: 'Method', value: 'paymentMethod' },
  { label: 'Notes', value: 'notes' },
];

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
  const ctx = useApp();
  const {
    appSettings,
    investmentMemberOptions,
    investmentVisibilityMemberId,
    investmentVisibilityMember,
    ownerName,
    isReadOnly,
    updateAppSettings,
    restoreBackup,
  } = ctx;
  const dashboardSections = appSettings?.dashboardSections || {};

  const today = new Date().toISOString().slice(0, 10);
  const fileInputRef = useRef(null);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);

  function handleExportJson() {
    downloadJson(buildBackup(ctx), `my-money-backup-${today}.json`);
  }
  function handleExportInvestmentsCsv() {
    downloadCsv(toCsv(ctx.investments, INVESTMENT_COLUMNS), `investments-${today}.csv`);
  }
  function handleExportExpensesCsv() {
    downloadCsv(toCsv(ctx.expenses, EXPENSE_COLUMNS), `expenses-${today}.csv`);
  }
  const [lockEnabled, setLockEnabled] = useState(isAppLockEnabled());
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [showPinForm, setShowPinForm] = useState(false);
  const [lockMsg, setLockMsg] = useState('');

  async function handleEnableLock() {
    setLockMsg('');
    if (!/^\d{4}$/.test(pinDraft)) { setLockMsg('PIN must be exactly 4 digits.'); return; }
    if (pinDraft !== pinConfirm) { setLockMsg('The two PINs do not match.'); return; }
    await setAppPin(pinDraft);
    setLockEnabled(true);
    setShowPinForm(false);
    setPinDraft('');
    setPinConfirm('');
    setLockMsg('App lock is on. It will ask for your PIN next time the app opens.');
  }

  function handleDisableLock() {
    disableAppLock();
    setLockEnabled(false);
    setShowPinForm(false);
    setPinDraft('');
    setPinConfirm('');
    setLockMsg('App lock turned off.');
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setRestoreBusy(true);
    setRestoreMsg('');
    try {
      const data = JSON.parse(await file.text());
      const res = await restoreBackup(data);
      setRestoreMsg(res.ok ? `Restored ${res.count} record${res.count === 1 ? '' : 's'}.` : (res.error || 'Restore failed.'));
    } catch {
      setRestoreMsg('Could not read that file. Make sure it is a My Money backup (.json).');
    } finally {
      setRestoreBusy(false);
    }
  }

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

  const activeMode = appSettings?.mode || 'light';
  const MODES = [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'System' }];

  function handleModeChange(mode) {
    updateAppSettings({ mode });
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

        <div className="settings-mode-toggle">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`settings-mode-btn ${activeMode === m.id ? 'active' : ''}`}
              onClick={() => handleModeChange(m.id)}
              aria-pressed={activeMode === m.id ? 'true' : 'false'}
            >
              {m.label}
            </button>
          ))}
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

      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <p className="settings-panel-label">Security</p>
            <h2>App lock</h2>
            <p className="settings-panel-copy">
              Require a 4-digit PIN to open the app on this device. The PIN is stored only on this device.
            </p>
          </div>
          <div className="settings-icon-circle settings-icon-circle--sm">
            <Lock size={18} />
          </div>
        </div>

        {lockEnabled && !showPinForm ? (
          <div className="settings-data-actions">
            <button type="button" className="settings-data-btn" onClick={() => { setShowPinForm(true); setLockMsg(''); }}>
              Change PIN
            </button>
            <button type="button" className="settings-data-btn" onClick={handleDisableLock}>
              Turn off app lock
            </button>
          </div>
        ) : (
          <div className="settings-name-row settings-pin-row">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              className="settings-input"
              placeholder="4-digit PIN"
              value={pinDraft}
              onChange={(event) => setPinDraft(event.target.value.replace(/\D/g, ''))}
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              className="settings-input"
              placeholder="Confirm PIN"
              value={pinConfirm}
              onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, ''))}
            />
            <button type="button" className="settings-name-save" onClick={handleEnableLock} disabled={!pinDraft || !pinConfirm}>
              {lockEnabled ? 'Update' : 'Enable'}
            </button>
          </div>
        )}
        {lockMsg ? <p className="settings-helper-copy">{lockMsg}</p> : null}
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
        <section className="settings-panel">
          <div className="settings-panel-head">
            <div>
              <p className="settings-panel-label">Data</p>
              <h2>Backup &amp; export</h2>
              <p className="settings-panel-copy">
                Download a full backup or export to CSV. Restore merges records from a backup file by id.
              </p>
            </div>
            <div className="settings-icon-circle settings-icon-circle--sm">
              <Database size={18} />
            </div>
          </div>

          <div className="settings-data-actions">
            <button type="button" className="settings-data-btn" onClick={handleExportJson}>
              <Download size={16} /> Backup (JSON)
            </button>
            <button type="button" className="settings-data-btn" onClick={handleExportInvestmentsCsv}>
              <Download size={16} /> Investments (CSV)
            </button>
            <button type="button" className="settings-data-btn" onClick={handleExportExpensesCsv}>
              <Download size={16} /> Expenses (CSV)
            </button>
            <button type="button" className="settings-data-btn" onClick={() => fileInputRef.current?.click()} disabled={restoreBusy}>
              <Upload size={16} /> {restoreBusy ? 'Restoring…' : 'Restore from backup'}
            </button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
          </div>
          {restoreMsg ? <p className="settings-helper-copy">{restoreMsg}</p> : null}
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
