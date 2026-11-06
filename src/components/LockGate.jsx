import { useCallback, useEffect, useState } from 'react';
import { Delete, LockKeyhole } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { isAppLockEnabled, verifyAppPin, disableAppLock, recordAppHidden, clearAppHidden, isWithinLockGrace } from '../utils/appLock';
import './LockGate.css';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

// Wraps the app. When app lock is enabled and the user is signed in, it requires the
// PIN on load and again when the app returns after more than the grace period in the
// background. A quick switch away (a notification, another app) does not re-lock.
export default function LockGate({ children }) {
  const { user, signOutUser } = useAuth();
  const [locked, setLocked] = useState(() => isAppLockEnabled() && !isWithinLockGrace());
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Stamp the time we went to the background (only while unlocked, so a locked app
    // can never be unlocked by reopening it quickly). pagehide covers iOS PWA closes.
    const onHidden = () => {
      if (!isAppLockEnabled()) return;
      setLocked((current) => {
        if (!current) recordAppHidden();
        return current;
      });
    };
    const onVisible = () => {
      if (!isAppLockEnabled()) return;
      if (!isWithinLockGrace()) setLocked(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHidden();
      else onVisible();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHidden);
    };
  }, []);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    let active = true;
    verifyAppPin(pin).then((ok) => {
      if (!active) return;
      if (ok) { setLocked(false); setPin(''); setError(''); clearAppHidden(); }
      else { setError('Incorrect PIN'); setPin(''); }
    });
    return () => { active = false; };
  }, [pin]);

  const press = useCallback((key) => {
    setError('');
    if (key === 'del') { setPin((p) => p.slice(0, -1)); return; }
    if (key === '') return;
    setPin((p) => (p.length < PIN_LENGTH ? p + key : p));
  }, []);

  const forgot = useCallback(() => {
    // No PIN recovery (it's a local hash). Escape hatch: clear the lock and sign out.
    disableAppLock();
    clearAppHidden();
    setLocked(false);
    signOutUser();
  }, [signOutUser]);

  if (!user || !locked || !isAppLockEnabled()) return children;

  return (
    <div className="lockgate">
      <div className="lockgate-card">
        <div className="lockgate-icon"><LockKeyhole size={26} /></div>
        <h1 className="lockgate-title">Enter PIN</h1>
        <p className="lockgate-sub">My Money is locked</p>

        <div className="lockgate-dots">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span key={i} className={`lockgate-dot ${i < pin.length ? 'filled' : ''}`} />
          ))}
        </div>
        {error ? <p className="lockgate-error">{error}</p> : null}

        <div className="lockgate-pad">
          {KEYS.map((key, i) => (
            <button
              key={i}
              type="button"
              className={`lockgate-key ${key === '' ? 'empty' : ''}`}
              onClick={() => press(key)}
              disabled={key === ''}
            >
              {key === 'del' ? <Delete size={22} /> : key}
            </button>
          ))}
        </div>

        <button type="button" className="lockgate-forgot" onClick={forgot}>
          Forgot PIN? Sign out
        </button>
      </div>
    </div>
  );
}
