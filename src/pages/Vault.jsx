import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Lock, LockKeyhole, Plus, Eye, EyeOff, Copy, Check,
  Pencil, Trash2, Save, X, KeyRound, AlertTriangle,
} from 'lucide-react';
import { useVault } from '../context/useVault';
import './Vault.css';

const EMPTY_ITEM = { id: '', title: '', username: '', password: '', url: '', notes: '' };

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      setTimeout(() => { navigator.clipboard.writeText('').catch(() => {}); }, 20000);
    } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" className="vault-copy" onClick={onCopy} title={`Copy ${label}`}>
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

export default function Vault() {
  const navigate = useNavigate();
  const {
    enabled, status, items, error, busy,
    setup, unlock, recoverWithCode, resetVault, lock, saveItem, deleteItem, resetLockTimer,
  } = useVault();

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [localError, setLocalError] = useState('');
  const [newRecoveryCode, setNewRecoveryCode] = useState(''); // shown once after setup
  const [ackSaved, setAckSaved] = useState(false);
  const [lockedMode, setLockedMode] = useState('unlock'); // 'unlock' | 'recover'
  const [recCode, setRecCode] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [editing, setEditing] = useState(null);
  const [revealId, setRevealId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState('');

  if (!enabled) return <Navigate to="/" replace />;

  async function handleSetup(e) {
    e.preventDefault();
    setLocalError('');
    if (pw.length < 8) { setLocalError('Use at least 8 characters for your master password.'); return; }
    if (pw !== pw2) { setLocalError('The two master passwords do not match.'); return; }
    const code = await setup(pw);
    if (code) { setPw(''); setPw2(''); setNewRecoveryCode(code); setAckSaved(false); }
  }

  async function handleUnlock(e) {
    e.preventDefault();
    const ok = await unlock(pw);
    if (ok) setPw('');
  }

  async function handleRecover(e) {
    e.preventDefault();
    setLocalError('');
    if (pw.length < 8) { setLocalError('Use at least 8 characters for your new master password.'); return; }
    if (pw !== pw2) { setLocalError('The two new master passwords do not match.'); return; }
    const ok = await recoverWithCode(recCode, pw);
    if (ok) { setPw(''); setPw2(''); setRecCode(''); setLockedMode('unlock'); }
  }

  async function handleSaveItem(e) {
    e.preventDefault();
    if (!editing.title.trim()) return;
    await saveItem({ ...editing, title: editing.title.trim() });
    setEditing(null);
  }

  const header = (
    <header className="vault-header">
      <button type="button" className="vault-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={20} />
      </button>
      <div className="vault-header-copy">
        <p className="vault-label">Security</p>
        <h1 className="vault-title">Password Vault</h1>
      </div>
      {status === 'unlocked' && !newRecoveryCode ? (
        <button type="button" className="vault-lock-btn" onClick={lock} title="Lock vault">
          <Lock size={16} /> Lock
        </button>
      ) : null}
    </header>
  );

  // --- One-time recovery code screen (after creating a vault) ---
  if (newRecoveryCode) {
    return (
      <div className="vault-page">
        {header}
        <section className="vault-card vault-gate">
          <div className="vault-gate-icon"><KeyRound size={28} /></div>
          <h2>Save your recovery code</h2>
          <p className="vault-gate-copy">
            This is the <strong>only</strong> way back in if you forget your master password. Store it
            somewhere safe and offline. It will not be shown again.
          </p>
          <div className="vault-reccode">
            <code>{newRecoveryCode}</code>
            <CopyButton value={newRecoveryCode} label="recovery code" />
          </div>
          <label className="vault-ack">
            <input type="checkbox" checked={ackSaved} onChange={(e) => setAckSaved(e.target.checked)} />
            <span>I&apos;ve saved my recovery code somewhere safe.</span>
          </label>
          <button type="button" className="vault-primary" disabled={!ackSaved}
            onClick={() => { setNewRecoveryCode(''); setAckSaved(false); }}>
            Continue to vault
          </button>
        </section>
      </div>
    );
  }

  // --- Setup (no vault yet) ---
  if (status === 'absent') {
    return (
      <div className="vault-page">
        {header}
        <section className="vault-card vault-gate">
          <div className="vault-gate-icon"><ShieldCheck size={28} /></div>
          <h2>Create your vault</h2>
          <p className="vault-gate-copy">
            Choose a <strong>master password</strong>. It encrypts everything on this device and is
            never stored or sent anywhere. You&apos;ll get a recovery code on the next screen.
          </p>
          <form onSubmit={handleSetup} className="vault-form">
            <input type="password" className="vault-input" placeholder="Master password"
              value={pw} autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
            <input type="password" className="vault-input" placeholder="Confirm master password"
              value={pw2} autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} />
            {(localError || error) ? <p className="vault-error">{localError || error}</p> : null}
            <button type="submit" className="vault-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create vault'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  // --- Locked (unlock or recover) ---
  if (status === 'locked' || status === 'loading' || status === 'error') {
    return (
      <div className="vault-page">
        {header}
        {lockedMode === 'unlock' ? (
          <section className="vault-card vault-gate">
            <div className="vault-gate-icon"><LockKeyhole size={28} /></div>
            <h2>Vault locked</h2>
            <p className="vault-gate-copy">Enter your master password to unlock.</p>
            <form onSubmit={handleUnlock} className="vault-form">
              <input type="password" className="vault-input" placeholder="Master password"
                value={pw} autoComplete="current-password" autoFocus
                onChange={(e) => setPw(e.target.value)} disabled={status === 'loading'} />
              {error ? <p className="vault-error">{error}</p> : null}
              <button type="submit" className="vault-primary" disabled={busy || status === 'loading' || !pw}>
                {busy ? 'Unlocking…' : status === 'loading' ? 'Loading…' : 'Unlock'}
              </button>
            </form>
            <button type="button" className="vault-textlink"
              onClick={() => { setLockedMode('recover'); setPw(''); setLocalError(''); }}>
              Forgot master password?
            </button>
          </section>
        ) : (
          <section className="vault-card vault-gate">
            <div className="vault-gate-icon"><KeyRound size={28} /></div>
            <h2>Recover with code</h2>
            <p className="vault-gate-copy">
              Enter your recovery code and choose a new master password. Your entries are kept.
            </p>
            <form onSubmit={handleRecover} className="vault-form">
              <input type="text" className="vault-input" placeholder="Recovery code"
                value={recCode} autoFocus autoComplete="off" autoCapitalize="characters"
                onChange={(e) => setRecCode(e.target.value)} />
              <input type="password" className="vault-input" placeholder="New master password"
                value={pw} autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
              <input type="password" className="vault-input" placeholder="Confirm new master password"
                value={pw2} autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} />
              {(localError || error) ? <p className="vault-error">{localError || error}</p> : null}
              <button type="submit" className="vault-primary" disabled={busy || !recCode || !pw}>
                {busy ? 'Recovering…' : 'Recover vault'}
              </button>
            </form>
            <button type="button" className="vault-textlink"
              onClick={() => { setLockedMode('unlock'); setPw(''); setPw2(''); setRecCode(''); setLocalError(''); }}>
              Back to unlock
            </button>

            <div className="vault-reset">
              {confirmReset ? (
                <div className="vault-reset-confirm">
                  <p><AlertTriangle size={15} /> This permanently deletes the vault and <strong>all entries</strong>. This cannot be undone.</p>
                  <div className="vault-reset-actions">
                    <button type="button" className="vault-cancel" onClick={() => setConfirmReset(false)}>Cancel</button>
                    <button type="button" className="vault-danger" disabled={busy}
                      onClick={async () => { await resetVault(); setConfirmReset(false); setLockedMode('unlock'); }}>
                      Delete &amp; reset
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="vault-textlink danger" onClick={() => setConfirmReset(true)}>
                  Lost your recovery code too? Reset the vault
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    );
  }

  // --- Unlocked ---
  return (
    <div className="vault-page" onClick={resetLockTimer} onKeyDown={resetLockTimer}>
      {header}

      <div className="vault-toolbar">
        <span className="vault-count">{items.length} {items.length === 1 ? 'entry' : 'entries'}</span>
        <button type="button" className="vault-add" onClick={() => setEditing({ ...EMPTY_ITEM })}>
          <Plus size={16} /> Add entry
        </button>
      </div>

      {items.length === 0 ? (
        <div className="vault-empty">
          <KeyRound size={26} />
          <p>No entries yet. Add your first password.</p>
        </div>
      ) : (
        <div className="vault-list">
          {items.map((item) => {
            const revealed = revealId === item.id;
            return (
              <article key={item.id} className="vault-item">
                <div className="vault-item-head">
                  <div className="vault-item-title">
                    <strong>{item.title}</strong>
                    {item.username ? <span>{item.username}</span> : null}
                  </div>
                  <div className="vault-item-actions">
                    <button type="button" className="vault-icon" onClick={() => setEditing({ ...item })} title="Edit">
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="vault-icon danger"
                      onClick={() => setConfirmDeleteId((c) => (c === item.id ? '' : item.id))} title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="vault-field">
                  <span className="vault-field-label">Password</span>
                  <code className="vault-secret">{revealed ? (item.password || '—') : '••••••••••'}</code>
                  <button type="button" className="vault-copy" title={revealed ? 'Hide' : 'Reveal'}
                    onClick={() => setRevealId(revealed ? '' : item.id)}>
                    {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <CopyButton value={item.password} label="password" />
                </div>

                {item.url ? (
                  <div className="vault-field">
                    <span className="vault-field-label">URL</span>
                    <a className="vault-url" href={/^https?:\/\//.test(item.url) ? item.url : `https://${item.url}`}
                      target="_blank" rel="noopener noreferrer">{item.url}</a>
                    <CopyButton value={item.url} label="URL" />
                  </div>
                ) : null}

                {item.notes ? <p className="vault-notes">{item.notes}</p> : null}

                {confirmDeleteId === item.id ? (
                  <div className="vault-confirm">
                    <span>Delete this entry?</span>
                    <button type="button" className="vault-cancel" onClick={() => setConfirmDeleteId('')}>Cancel</button>
                    <button type="button" className="vault-danger"
                      onClick={() => { deleteItem(item.id); setConfirmDeleteId(''); }}>Delete</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <div className="vault-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="vault-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vault-modal-head">
              <h3>{editing.id ? 'Edit entry' : 'Add entry'}</h3>
              <button type="button" className="vault-icon" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveItem} className="vault-form">
              <input className="vault-input" placeholder="Title (e.g., Gmail)" value={editing.title}
                autoFocus onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <input className="vault-input" placeholder="Username / email" value={editing.username}
                autoComplete="off" onChange={(e) => setEditing({ ...editing, username: e.target.value })} />
              <input className="vault-input" placeholder="Password" value={editing.password}
                autoComplete="off" onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
              <input className="vault-input" placeholder="URL (optional)" value={editing.url}
                autoComplete="off" onChange={(e) => setEditing({ ...editing, url: e.target.value })} />
              <textarea className="vault-input vault-textarea" placeholder="Notes (optional)" rows={3}
                value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              <div className="vault-modal-actions">
                <button type="button" className="vault-cancel" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="vault-primary" disabled={!editing.title.trim()}>
                  <Save size={16} /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
