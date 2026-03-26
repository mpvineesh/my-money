import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { loadInvestments, saveInvestments, loadGoals, saveGoals, loadLoans, saveLoans, loadCash, saveCash, loadExpenses, saveExpenses } from '../utils/storage';
import { getDemoInvestments, getDemoGoals, getDemoLoans, getDemoCash, getDemoExpenses } from '../utils/constants';
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
  const [loans, setLoans] = useState(() => {
    const stored = loadLoans();
    if (stored.length > 0) return stored;
    const demo = getDemoLoans();
    saveLoans(demo);
    return demo;
  });
  const [cash, setCashState] = useState(() => {
    const stored = loadCash();
    if (stored) return stored;
    const demo = getDemoCash();
    saveCash(demo);
    return demo;
  });
  const [expenses, setExpenses] = useState(() => {
    const stored = loadExpenses();
    if (stored.length > 0) return stored;
    const demo = getDemoExpenses();
    saveExpenses(demo);
    return demo;
  });

  useEffect(() => {
    // If user is signed in, listen to their Firestore collections and sync locally
    if (!user) return undefined;

    const invCol = collection(db, 'users', user.uid, 'investments');
    const goalsCol = collection(db, 'users', user.uid, 'goals');
    const loansCol = collection(db, 'users', user.uid, 'loans');

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

    const unsubLoans = onSnapshot(loansCol, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLoans(items);
      saveLoans(items);
    });

    const expensesCol = collection(db, 'users', user.uid, 'expenses');
    const unsubExpenses = onSnapshot(expensesCol, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setExpenses(items);
      saveExpenses(items);
    });

    return () => {
      unsubInv();
      unsubGoals();
      unsubLoans();
      unsubExpenses();
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
  }, [user]);

  const addLoan = useCallback((loan) => {
    const newItem = { ...loan, id: uuidv4() };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'loans', newItem.id);
      setDoc(ref, newItem);
      return;
    }
    setLoans((prev) => {
      const updated = [...prev, newItem];
      saveLoans(updated);
      return updated;
    });
  }, [user]);

  const updateLoan = useCallback((id, loan) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'loans', id);
      updateDoc(ref, { ...loan });
      return;
    }
    setLoans((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, ...loan } : l));
      saveLoans(updated);
      return updated;
    });
  }, [user]);

  const deleteLoan = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'loans', id);
      deleteDoc(ref);
      return;
    }
    setLoans((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      saveLoans(updated);
      return updated;
    });
  }, [user]);

  const addExpense = useCallback((expense) => {
    const newItem = { ...expense, id: uuidv4() };
    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenses', newItem.id);
      setDoc(ref, newItem);
      return;
    }
    setExpenses((prev) => {
      const updated = [...prev, newItem];
      saveExpenses(updated);
      return updated;
    });
  }, [user]);

  const updateExpense = useCallback((id, expense) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenses', id);
      updateDoc(ref, { ...expense });
      return;
    }
    setExpenses((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, ...expense } : e));
      saveExpenses(updated);
      return updated;
    });
  }, [user]);

  const deleteExpense = useCallback((id) => {
    if (user) {
      const ref = doc(db, 'users', user.uid, 'expenses', id);
      deleteDoc(ref);
      return;
    }
    setExpenses((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      saveExpenses(updated);
      return updated;
    });
  }, [user]);

  const setCash = useCallback((amount) => {
    const value = Number(amount) || 0;
    setCashState(value);
    saveCash(value);
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
  }, [user]);

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
  }, [user]);

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
  }, [user]);

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
  }, [user]);

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
  }, [user]);

  const resetToDemo = useCallback(() => {
    const demoInv = getDemoInvestments();
    const demoGoals = getDemoGoals();
    const demoLoans = getDemoLoans();
    const demoCash = getDemoCash();
    const demoExpenses = getDemoExpenses();
    setInvestments(demoInv);
    setGoals(demoGoals);
    setLoans(demoLoans);
    setCashState(demoCash);
    setExpenses(demoExpenses);
    saveInvestments(demoInv);
    saveGoals(demoGoals);
    saveLoans(demoLoans);
    saveCash(demoCash);
    saveExpenses(demoExpenses);
  }, []);

  const value = {
    investments,
    goals,
    loans,
    cash,
    expenses,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    addGoal,
    updateGoal,
    deleteGoal,
    addLoan,
    updateLoan,
    deleteLoan,
    setCash,
    addExpense,
    updateExpense,
    deleteExpense,
    resetToDemo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
