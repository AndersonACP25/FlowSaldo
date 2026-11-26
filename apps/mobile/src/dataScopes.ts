import { isCurrency, type Currency } from '@flowsaldo/domain';
import type { LocalData } from './storage';

type ConnectedScope = `[${string}]`;
export type LocalScope = 'demo' | ConnectedScope;
export type CashProjectionKey = `${LocalScope | 'api'}:${Currency}`;

export function localDataScope(apiUrl: string, owner: number | 'development' | null): LocalScope {
  if (owner === null) return 'demo';
  // apiUrl is the canonical base URL returned by apiBase().
  return JSON.stringify([apiUrl, owner]) as ConnectedScope;
}

export function cashProjectionKey(scope: LocalScope, currency: Currency): CashProjectionKey {
  return `${scope}:${currency}`;
}

export function isConnectedScope(value: string): value is ConnectedScope {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length !== 2) return false;
    const [url, owner] = parsed;
    return (
      typeof url === 'string' &&
      /^https?:\/\//.test(url) &&
      (owner === 'development' ||
        (typeof owner === 'number' && Number.isSafeInteger(owner) && owner > 0)) &&
      localDataScope(url, owner) === value
    );
  } catch {
    return false;
  }
}

export function isCashProjectionKey(value: string): value is CashProjectionKey {
  const separator = value.lastIndexOf(':');
  const scope = value.slice(0, separator);
  return (
    separator >= 0 &&
    isCurrency(value.slice(separator + 1)) &&
    (scope === 'demo' || scope === 'api' || isConnectedScope(scope))
  );
}

export function byDemoScope<T>(entries: Record<string, T>, demo: boolean) {
  return Object.fromEntries(
    Object.entries(entries).filter(([key]) => (key === 'demo' || key.startsWith('demo:')) === demo),
  );
}

export function replaceDemoData(current: LocalData, demo: LocalData): LocalData {
  return {
    ...demo,
    budgets: { ...byDemoScope(current.budgets, false), ...byDemoScope(demo.budgets, true) },
    categoryBudgets: {
      ...byDemoScope(current.categoryBudgets, false),
      ...byDemoScope(demo.categoryBudgets, true),
    },
    cashProjections: {
      ...byDemoScope(current.cashProjections, false),
      ...byDemoScope(demo.cashProjections, true),
    },
    savingsGoals: { ...byDemoScope(current.savingsGoals, false), demo: demo.savingsGoals.demo },
    pendingItems: {
      ...byDemoScope(current.pendingItems, false),
      ...byDemoScope(demo.pendingItems, true),
    },
    debtPlans: { ...byDemoScope(current.debtPlans, false), ...byDemoScope(demo.debtPlans, true) },
    monthlyClosings: {
      ...byDemoScope(current.monthlyClosings, false),
      ...byDemoScope(demo.monthlyClosings, true),
    },
    commerceRules: {
      ...byDemoScope(current.commerceRules, false),
      ...byDemoScope(demo.commerceRules, true),
    },
  };
}

export function hasUnassignedConnectedData(data: LocalData): boolean {
  return (
    !!data.savingsGoals.api?.length ||
    Object.keys(data.cashProjections).some((key) => key.startsWith('api:')) ||
    Object.entries(data.pendingItems).some(
      ([key, items]) => (key === 'api' || key.startsWith('owner:')) && items.length > 0,
    )
  );
}
