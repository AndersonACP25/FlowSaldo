import { ledgerBalance } from './finance.ts';
import { isCurrency, type Currency } from './finance.ts';
import { validDate } from './dateTime.ts';
import type { Movement } from './movement.ts';
import { pendingRemaining, type PendingItem } from './pendingPayments.ts';

export type ClosingPending = Pick<PendingItem, 'id' | 'name' | 'kind' | 'dueAt'> & {
  remainingMinor: number;
};

export type ClosingCategory = {
  categoryId: string;
  name: string;
  limitMinor: number;
  spentMinor: number;
};

export type MonthlyClosing = {
  month: string;
  currency: Currency;
  capturedAt: string;
  incomeMinor: number;
  expenseMinor: number;
  uncategorizedCount: number;
  budgetMinor: number | null;
  categories: ClosingCategory[];
  pendingCount: number;
  toPayMinor: number;
  toCollectMinor: number;
};

export function pendingForClosing(
  items: readonly PendingItem[],
  movements: ReadonlyMap<string, Movement>,
  month: string,
  currency: Currency,
): ClosingPending[] {
  return items
    .filter((item) => item.currency === currency && item.dueAt.startsWith(month + '-'))
    .flatMap((item) => {
      const { id, name, kind, dueAt } = item;
      const remainingMinor = pendingRemaining(item, movements);
      return remainingMinor ? [{ id, name, kind, dueAt, remainingMinor }] : [];
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

const nonnegative = (value: number) => Number.isSafeInteger(value) && value >= 0;
const validLimit = (value: number) => nonnegative(value) && value > 0;

export function validMonthlyClosings(value: unknown): value is MonthlyClosing[] {
  if (!Array.isArray(value)) return false;
  const keys = new Set<string>();
  for (const item of value as MonthlyClosing[]) {
    if (
      !item ||
      typeof item.month !== 'string' ||
      !validDate(item.month + '-01') ||
      !isCurrency(item.currency) ||
      typeof item.capturedAt !== 'string' ||
      !Number.isFinite(Date.parse(item.capturedAt)) ||
      ![
        item.incomeMinor,
        item.uncategorizedCount,
        item.pendingCount,
        item.toPayMinor,
        item.toCollectMinor,
      ].every(nonnegative) ||
      !Number.isSafeInteger(item.expenseMinor) ||
      (item.budgetMinor !== null && !validLimit(item.budgetMinor)) ||
      !Array.isArray(item.categories) ||
      item.categories.some(
        (entry) =>
          !entry ||
          typeof entry.categoryId !== 'string' ||
          !entry.categoryId ||
          typeof entry.name !== 'string' ||
          !entry.name.trim() ||
          !validLimit(entry.limitMinor) ||
          !Number.isSafeInteger(entry.spentMinor),
      ) ||
      new Set(item.categories.map((entry) => entry.categoryId)).size !== item.categories.length
    )
      return false;
    const key = item.month + ':' + item.currency;
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}

export function makeMonthlyClosing(
  input: Omit<MonthlyClosing, 'pendingCount' | 'toPayMinor' | 'toCollectMinor'>,
  pending: readonly ClosingPending[],
): MonthlyClosing {
  let toPayMinor = 0;
  let toCollectMinor = 0;
  for (const item of pending) {
    if (item.kind === 'pay') toPayMinor = ledgerBalance(toPayMinor, item.remainingMinor, 0, 0);
    else toCollectMinor = ledgerBalance(toCollectMinor, item.remainingMinor, 0, 0);
  }
  const closing = { ...input, pendingCount: pending.length, toPayMinor, toCollectMinor };
  if (!validMonthlyClosings([closing])) throw new Error('Los datos del cierre no son válidos.');
  return closing;
}
