import React from 'react';
import { checkDebtPlan, type Currency, type DebtPlan } from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import { DebtPlansScreen } from './DebtPlansScreen';
import { newLocalId } from './localRecords';
import type { LocalUpdate } from './storage';

export function DebtPlansFeature({
  dataScope,
  plans,
  defaultCurrency,
  saving,
  money,
  persist,
  saveForm,
}: {
  dataScope: LocalScope;
  plans: DebtPlan[];
  defaultCurrency: Currency;
  saving: boolean;
  money: (amountMinor: number, currency: Currency) => string;
  persist: (update: LocalUpdate) => Promise<void>;
  saveForm: (save: () => Promise<void>) => Promise<void>;
}) {
  function updateDebtPlans(update: (plans: DebtPlan[]) => DebtPlan[]) {
    return saveForm(() => {
      return persist((current) => ({
        ...current,
        debtPlans: {
          ...current.debtPlans,
          [dataScope]: update(current.debtPlans[dataScope] ?? []),
        },
      }));
    });
  }

  return (
    <DebtPlansScreen
      plans={plans}
      defaultCurrency={defaultCurrency}
      saving={saving}
      money={money}
      onSave={async (input, id) => {
        const plan = { ...checkDebtPlan(input), id: id ?? newLocalId() };
        await updateDebtPlans((items) => {
          if (!id) return [...items, plan];
          if (!items.some((item) => item.id === id))
            throw new Error('El plan de pago ya no está disponible.');
          return items.map((item) => (item.id === id ? plan : item));
        });
        return plan.id;
      }}
      onRemove={(id) => updateDebtPlans((items) => items.filter((item) => item.id !== id))}
    />
  );
}
