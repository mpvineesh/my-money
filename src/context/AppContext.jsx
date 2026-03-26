import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { loadInvestments, saveInvestments, loadGoals, saveGoals } from '../utils/storage';
import { getDemoInvestments, getDemoGoals } from '../utils/constants';
import { AppContext } from './AppContextDef';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

function getInitialInvestments() {
  const stored = loadInvestments();
  if (stored.length > 0) return stored;
  const demo = getDemoInvestments();
  saveInvestments(demo);
  return demo;
}

function getInitialGoals() {
  const stored = loadGoals();
  if (stored.length > 0) return stored;
  const demo = getDemoGoals();
  saveGoals(demo);
  return demo;
}

export function AppProvider({ children }) {
  const { user } = useAuth();

  const [investments, setInvestments] = useState(getInitialInvestments);
  const [goals, setGoals] = useState(getInitialGoals);

  useEffect(() => {
    // If user is signed in, listen to their Firestore collections and sync locally
    if (!user) return undefined;

    const invCol = collection(db, 'users', user.uid, 'investments');
    const goalsCol = collection(db, 'users', user.uid, 'goals');

    const unsubInv = onSnapshot(invCol, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInvestments(items);
      // also persist locally for offline fallback
      saveInvestments(items);
    });

    const unsubGoals = onSnapshot(goalsCol, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGoals(items);
      saveGoals(items);
    });

    return () => {
      unsubInv();
      unsubGoals();
    };
  }, [user]);

  const addInvestment = useCallback((investment) => {
    const newItem = { ...investment, id: uuidv4() };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'investments', newItem.id);
      setDoc(ref, newItem);
      return;
    }
    setInvestments((prev) => {
      const updated = [...prev, newItem];
      saveInvestments(updated);
      return updated;
    });
  }, []);

  const updateInvestment = useCallback((id, investment) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'investments', id);
      updateDoc(ref, { ...investment });
      return;
    }
    setInvestments((prev) => {
      const updated = prev.map((inv) => (inv.id === id ? { ...inv, ...investment } : inv));
      saveInvestments(updated);
      return updated;
    });
  }, []);

  const deleteInvestment = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'investments', id);
      deleteDoc(ref);
      return;
    }
    setInvestments((prev) => {
      const updated = prev.filter((inv) => inv.id !== id);
      saveInvestments(updated);
      return updated;
    });
  }, []);

  const addGoal = useCallback((goal) => {
    const newItem = { ...goal, id: uuidv4() };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'goals', newItem.id);
      setDoc(ref, newItem);
      return;
    }
    setGoals((prev) => {
      const updated = [...prev, newItem];
      saveGoals(updated);
      return updated;
    });
  }, []);

  const updateGoal = useCallback((id, goal) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'goals', id);
      updateDoc(ref, { ...goal });
      return;
    }
    setGoals((prev) => {
      const updated = prev.map((g) => (g.id === id ? { ...g, ...goal } : g));
      saveGoals(updated);
      return updated;
    });
  }, []);

  const deleteGoal = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'goals', id);
      deleteDoc(ref);
      return;
    }
    setGoals((prev) => {
      const updated = prev.filter((g) => g.id !== id);
      saveGoals(updated);
      return updated;
    });
  }, []);

  const resetToDemo = useCallback(() => {
    const demoInv = getDemoInvestments();
    const demoGoals = getDemoGoals();
    setInvestments(demoInv);
    setGoals(demoGoals);
    saveInvestments(demoInv);
    saveGoals(demoGoals);
  }, []);

  const value = {
    investments,
    goals,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    addGoal,
    updateGoal,
    deleteGoal,
    resetToDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
