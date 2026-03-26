import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { loadInvestments, saveInvestments, loadGoals, saveGoals } from '../utils/storage';
import { getDemoInvestments, getDemoGoals } from '../utils/constants';
import { AppContext } from './AppContextDef';

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
  const [investments, setInvestments] = useState(getInitialInvestments);
  const [goals, setGoals] = useState(getInitialGoals);

  const addInvestment = useCallback((investment) => {
    setInvestments((prev) => {
      const updated = [...prev, { ...investment, id: uuidv4() }];
      saveInvestments(updated);
      return updated;
    });
  }, []);

  const updateInvestment = useCallback((id, investment) => {
    setInvestments((prev) => {
      const updated = prev.map((inv) => (inv.id === id ? { ...inv, ...investment } : inv));
      saveInvestments(updated);
      return updated;
    });
  }, []);

  const deleteInvestment = useCallback((id) => {
    setInvestments((prev) => {
      const updated = prev.filter((inv) => inv.id !== id);
      saveInvestments(updated);
      return updated;
    });
  }, []);

  const addGoal = useCallback((goal) => {
    setGoals((prev) => {
      const updated = [...prev, { ...goal, id: uuidv4() }];
      saveGoals(updated);
      return updated;
    });
  }, []);

  const updateGoal = useCallback((id, goal) => {
    setGoals((prev) => {
      const updated = prev.map((g) => (g.id === id ? { ...g, ...goal } : g));
      saveGoals(updated);
      return updated;
    });
  }, []);

  const deleteGoal = useCallback((id) => {
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
