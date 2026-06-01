import { useEffect, useState, useCallback } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AuthContext } from './AuthContextDef';

async function resolveHousehold(user) {
  const email = (user?.email || '').toLowerCase();
  if (!email) return { mode: 'owner', ownerUid: user.uid };
  try {
    const snap = await getDoc(doc(db, 'memberAccess', email));
    if (snap.exists()) {
      const data = snap.data();
      if (data.ownerUid && data.ownerUid !== user.uid) {
        return {
          mode: 'member',
          ownerUid: data.ownerUid,
          ownerName: data.ownerName || '',
          memberId: data.memberId || '',
          memberName: data.memberName || '',
          role: data.role || 'reader',
        };
      }
    }
  } catch (err) {
    console.warn('Household resolution failed', err);
  }
  return { mode: 'owner', ownerUid: user.uid };
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
