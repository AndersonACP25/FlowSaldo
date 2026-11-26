import { useEffect, useRef, useState } from 'react';
import { demoMovements, upgradeCategories } from '@flowsaldo/domain';
import { replaceDemoData } from './dataScopes';
import { localToday } from './PeriodPicker';
import { demoReviews } from './reviews';
import { loadLocal, updateLocal, type LocalData, type LocalUpdate } from './storage';

const currentMonth = () => localToday().slice(0, 7);
function initialData(): LocalData {
  return {
    ...upgradeCategories(
      demoMovements.map((m) => ({ ...m, occurredAt: currentMonth() + m.occurredAt.slice(7) })),
    ),
    accounts: [],
    recurring: [],
    bankIds: [],
    receipts: [],
    categoryBudgets: {},
    cashProjections: {},
    savingsGoals: { demo: [], api: [] },
    pendingItems: {},
    debtPlans: {},
    monthlyClosings: {},
    commerceRules: {},
    budgets: {},
    reviews: demoReviews(),
  };
}

export function useLocalWorkspace() {
  const [local, setLocal] = useState<LocalData>(initialData);
  const localRef = useRef(local);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    void loadLocal()
      .then((data) => {
        if (active) {
          if (data) {
            localRef.current = data;
            setLocal(data);
          }
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            'No se pudieron leer los datos locales. No se sobrescribieron. Puedes reintentar recargando o restablecer la demo.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function persist(change: LocalUpdate, recoverUnreadable = false) {
    const next = await updateLocal(localRef.current, change, recoverUnreadable);
    localRef.current = next;
    setLocal(next);
  }

  async function resetDemo() {
    await persist((current) => replaceDemoData(current, initialData()), !!loadError);
    setLoadError('');
    setReady(true);
  }

  return { local, localRef, ready, loadError, persist, resetDemo };
}
