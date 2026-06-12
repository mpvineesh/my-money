import { useEffect, useState, useCallback } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AuthContext } from './AuthContextDef';

const HH_CACHE_PREFIX = 'household:';

function readCachedMembership(email, uid) {
  try {
    const cached = localStorage.getItem(HH_CACHE_PREFIX + email);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed?.mode === 'member' && parsed.ownerUid && parsed.ownerUid !== uid) return parsed;
  } catch {
    // ignore malformed cache
  }
  return null;
}

async function resolveHousehold(user) {
  const email = (user?.email || '').toLowerCase();
  if (!email) return { mode: 'owner', ownerUid: user.uid };
  try {
    const snap = await getDoc(doc(db, 'memberAccess', email));
    if (snap.exists()) {
      const data = snap.data();
      if (data.ownerUid && data.ownerUid !== user.uid) {
        const resolved = {
          mode: 'member',
          ownerUid: data.ownerUid,
          ownerName: data.ownerName || '',
          memberId: data.memberId || '',
          memberName: data.memberName || '',
          role: data.role || 'reader',
        };
        // Cache so a later transient read failure can't drop a known member to an empty owner view.
        try { localStorage.setItem(HH_CACHE_PREFIX + email, JSON.stringify(resolved)); } catch { /* ignore */ }
        return resolved;
      }
    }
    // Lookup succeeded and they are not a member -> genuine owner. Clear any stale cache.
    try { localStorage.removeItem(HH_CACHE_PREFIX + email); } catch { /* ignore */ }
    return { mode: 'owner', ownerUid: user.uid };
  } catch (err) {
    // Transient failure (e.g. Firestore quota exhausted, offline). Fall back to a
    // previously-cached membership instead of silently showing an empty owner view.
    console.warn('Household resolution failed; falling back to cached membership if available', err);
    const cached = readCachedMembership(email, user.uid);
    if (cached) return cached;
    return { mode: 'owner', ownerUid: user.uid };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [household, setHousehold] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setHousehold(null);
        setInitializing(false);
        return;
      }
      const resolved = await resolveHousehold(u);
      setHousehold(resolved);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google sign-in error', err);
      setError(err?.message || 'Sign-in failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = {
    user,
    household,
    initializing,
    loading,
    error,
    signInWithGoogle,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
