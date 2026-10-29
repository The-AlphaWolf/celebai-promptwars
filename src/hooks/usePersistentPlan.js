import { useEffect, useState } from 'react';
import { normalizePlan } from '../domain/planSchema.js';

const STORAGE_KEY = 'celebai_plan_v2';

/** Restores a saved plan; anything corrupt or tampered with is discarded. */
export function loadSavedPlan() {
  try {
    return normalizePlan(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return null;
  }
}

/** Plan state that survives reloads (stored only in this browser). */
export function usePersistentPlan(createDefault) {
  const [plan, setPlan] = useState(() => loadSavedPlan() ?? createDefault());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    } catch {
      // Storage full or disabled (private mode): the app keeps working in memory.
    }
  }, [plan]);

  return [plan, setPlan];
}
