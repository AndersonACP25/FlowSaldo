import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { movementCategories, type Category, type Currency, type Movement } from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import type { ServerBudget } from './FinancePanel';
import type { MonthlySummary } from './history';
import type { ApiRequest } from './apiClient';
import type { LocalData, LocalUpdate } from './storage';

export function useBudgets({
  dataScope,
  connected,
  month,
  currency,
  local,
  categoryCatalog,
  period,
  remoteCategoryTotals,
  persist,
  request,
}: {
  dataScope: LocalScope;
  connected: boolean;
  month: string;
  currency: Currency;
  local: LocalData;
  categoryCatalog: Category[];
  period: Movement[];
  remoteCategoryTotals?: MonthlySummary['categoryTotals'];
  persist: (update: LocalUpdate) => Promise<void>;
  request: ApiRequest;
}) {
  const [budgetInput, setBudgetInput] = useState('');
  const serverBudget = useQuery({
    queryKey: ['budgets', dataScope, month, currency],
    enabled: connected,
    retry: false,
    queryFn: async (): Promise<ServerBudget> =>
      request(`/budgets?month=${month}&currency=${currency}`),
  });
  const budgetKey = `${connected ? 'api' : 'demo'}:${month}:${currency}`;
  const budget = connected ? (serverBudget.data?.limitMinor ?? 0) : (local.budgets[budgetKey] ?? 0);
  const categoryBudgets = connected
    ? Object.fromEntries(
        (serverBudget.data?.categoryLimits ?? []).map((c) => [c.categoryId, c.limitMinor]),
      )
    : Object.fromEntries(
        categoryCatalog
          .filter((c) => local.categoryBudgets[`${budgetKey}:${c.id}`])
          .map((c) => [c.id, local.categoryBudgets[`${budgetKey}:${c.id}`]]),
      );
  const categoryTotals = connected
    ? (remoteCategoryTotals ?? [])
    : categoryCatalog.map((c) => ({
        categoryId: c.id,
        amountMinor: period
          .filter((m) => m.type === 'EXPENSE' || !!m.refundOfId)
          .flatMap((m) =>
            movementCategories(m).map((part) =>
              m.refundOfId ? { ...part, amountMinor: -part.amountMinor } : part,
            ),
          )
          .filter((part) => part.categoryId === c.id)
          .reduce((n, part) => n + part.amountMinor, 0),
      }));
  async function saveServerBudget(
    limitMinor: number | null,
    categoryLimits: Array<{ categoryId: string; limitMinor: number }>,
  ) {
    if (!serverBudget.isSuccess || serverBudget.isFetching)
      throw new Error('Actualiza el presupuesto del servidor antes de guardar.');
    try {
      await request('/budgets', {
        method: 'POST',
        body: JSON.stringify({
          month,
          currency,
          expectedVersion: serverBudget.data.version,
          limitMinor,
          categoryLimits,
        }),
      });
    } catch (error) {
      await serverBudget.refetch();
      throw error;
    }
    await serverBudget.refetch();
  }
  async function saveGeneralBudget(value: number | null) {
    if (connected) {
      await saveServerBudget(value, serverBudget.data?.categoryLimits ?? []);
      return;
    }
    await persist((current) => {
      const budgets = { ...current.budgets };
      if (value === null) delete budgets[budgetKey];
      else budgets[budgetKey] = value;
      return { ...current, budgets };
    });
  }
  async function saveCategoryBudget(id: string, value: number | null) {
    if (connected) {
      if (value !== null && categoryCatalog.find((c) => c.id === id)?.archived)
        throw new Error('Selecciona una categoría activa.');
      const limits = (serverBudget.data?.categoryLimits ?? []).filter((c) => c.categoryId !== id);
      if (value !== null) limits.push({ categoryId: id, limitMinor: value });
      await saveServerBudget(serverBudget.data?.limitMinor ?? null, limits);
      return;
    }
    await persist((current) => {
      if (value !== null && !current.categories.some((c) => c.id === id && !c.archived))
        throw new Error('Selecciona una categoría activa.');
      const budgets = { ...current.categoryBudgets };
      const key = `${budgetKey}:${id}`;
      if (value === null) delete budgets[key];
      else budgets[key] = value;
      return { ...current, categoryBudgets: budgets };
    });
  }

  const canCopyLocalBudgets =
    connected &&
    serverBudget.data?.version === 0 &&
    (!!local.budgets[budgetKey] ||
      categoryCatalog.some((category) => !!local.categoryBudgets[`${budgetKey}:${category.id}`]));

  function copyLocalBudgets() {
    return saveServerBudget(
      local.budgets[budgetKey] ?? null,
      categoryCatalog
        .filter(
          (category) => !category.archived && local.categoryBudgets[`${budgetKey}:${category.id}`],
        )
        .map((category) => ({
          categoryId: category.id,
          limitMinor: local.categoryBudgets[`${budgetKey}:${category.id}`],
        })),
    );
  }

  return {
    serverBudget,
    budget,
    budgetKey,
    budgetInput,
    setBudgetInput,
    categoryBudgets,
    categoryTotals,
    saveGeneralBudget,
    saveCategoryBudget,
    canCopyLocalBudgets,
    copyLocalBudgets,
  };
}
