import React from 'react';
import {
  makeMonthlyClosing,
  movementCategories,
  pendingForClosing,
  previousMonth,
  type Category,
  type Currency,
  type MonthlyClosing,
  type Movement,
  type PendingItem,
} from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import { MonthlyClosingScreen } from './MonthlyClosingScreen';
import type { LocalUpdate } from './storage';

interface QueryReadState {
  isError: boolean;
  isSuccess: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

export function MonthlyClosingFeature({
  dataScope,
  month,
  currency,
  connected,
  summary,
  period,
  uncategorizedId,
  closingUncategorized,
  budget,
  summarySources,
  pending,
  monthlyClosings,
  saving,
  money,
  persist,
  saveForm,
  onMovements,
  onPending,
}: {
  dataScope: LocalScope;
  month: string;
  currency: Currency;
  connected: boolean;
  summary: { incomeMinor: number; expenseMinor: number };
  period: Movement[];
  uncategorizedId?: string;
  closingUncategorized: QueryReadState & { data?: number };
  budget: {
    limitMinor: number | null;
    catalog: Category[];
    limits: Record<string, number>;
    totals: { categoryId: string | null; amountMinor: number }[];
  };
  summarySources: QueryReadState[];
  pending: {
    items: PendingItem[];
    movements: ReadonlyMap<string, Movement>;
    links: QueryReadState;
    ready: boolean;
    hasLinks: boolean;
  };
  monthlyClosings: MonthlyClosing[];
  saving: boolean;
  money: (minor: number, currency: Currency) => string;
  persist: (update: LocalUpdate) => Promise<void>;
  saveForm: (save: () => Promise<void>) => Promise<void>;
  onMovements: () => void;
  onPending: (id: string) => void;
}) {
  const closingPending = pendingForClosing(pending.items, pending.movements, month, currency);
  const sources = [...summarySources, closingUncategorized];
  const closingReadError =
    connected &&
    (sources.some((source) => source.isError) || (pending.hasLinks && pending.links.isError));
  const closingReady =
    !connected ||
    (sources.every((source) => source.isSuccess && !source.isFetching) &&
      pending.ready &&
      !pending.links.isFetching);
  let currentClosing: MonthlyClosing | undefined;
  let closingCalculationError = false;
  if (closingReady) {
    try {
      currentClosing = makeMonthlyClosing(
        {
          month,
          currency,
          capturedAt: new Date().toISOString(),
          incomeMinor: summary.incomeMinor,
          expenseMinor: summary.expenseMinor,
          uncategorizedCount: connected
            ? (closingUncategorized.data ?? 0)
            : period.filter((item) =>
                movementCategories(item).some((part) => part.categoryId === uncategorizedId),
              ).length,
          budgetMinor: budget.limitMinor,
          categories: budget.catalog.flatMap((category) => {
            const limitMinor = budget.limits[category.id];
            if (!limitMinor) return [];
            const spentMinor =
              budget.totals.find((item) => item.categoryId === category.id)?.amountMinor ?? 0;
            return [{ categoryId: category.id, name: category.name, limitMinor, spentMinor }];
          }),
        },
        closingPending,
      );
    } catch {
      closingCalculationError = true;
    }
  }

  function retry() {
    for (const source of summarySources) void source.refetch();
    if (uncategorizedId) void closingUncategorized.refetch();
    if (pending.hasLinks) void pending.links.refetch();
  }

  function save(snapshot: MonthlyClosing) {
    return saveForm(() =>
      persist((current) => {
        const previous = current.monthlyClosings[dataScope] ?? [];
        return {
          ...current,
          monthlyClosings: {
            ...current.monthlyClosings,
            [dataScope]: [
              ...previous.filter((item) => item.month !== month || item.currency !== currency),
              snapshot,
            ],
          },
        };
      }),
    );
  }

  const priorMonth = previousMonth(month);
  return (
    <MonthlyClosingScreen
      current={currentClosing}
      saved={monthlyClosings.find((item) => item.month === month && item.currency === currency)}
      previous={monthlyClosings.find(
        (item) => item.month === priorMonth && item.currency === currency,
      )}
      pending={closingPending}
      loadingError={closingReadError || closingCalculationError}
      saving={saving}
      money={money}
      onRetry={closingReadError ? retry : undefined}
      onMovements={onMovements}
      onPending={onPending}
      onSave={save}
    />
  );
}
