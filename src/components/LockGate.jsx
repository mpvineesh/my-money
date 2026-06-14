import { useCallback, useEffect, useState } from 'react';
import { Delete, LockKeyhole } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { isAppLockEnabled, verifyAppPin, disableAppLock } from '../utils/appLock';
import './LockGate.css';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

// Wraps the app. When app lock is enabled and the user is signed in, it requires the
// PIN on load and again whenever the app returns from the background.
export default function LockGate({ children }) {
  const { user, signOutUser } = useAuth();
  const [locked, setLocked] = useState(() => isAppLockEnabled());
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // Re-lock when the tab is hidden, so returning to the app requires the PIN again.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && isAppLockEnabled()) setLocked(true); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    let active = true;
    verifyAppPin(pin).then((ok) => {
      if (!active) return;
      if (ok) { setLocked(false); setPin(''); setError(''); }
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
