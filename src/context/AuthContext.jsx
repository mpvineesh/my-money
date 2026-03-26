import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

const AuthContext = createContext({});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = {
    user,
    initializing,
    signInWithGoogle,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
