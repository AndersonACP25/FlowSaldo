import { createLocalStore } from './localStore';
import { demoReviews, type ReviewItem } from './reviews';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isCurrency,
  localAccountBalances,
  validateLocalAccounts,
  type LocalAccount,
  validSavingsGoals,
  refundBalance,
  validPendingItems,
  validDebtPlans,
  validMonthlyClosings,
  validCommerceRules,
  type CommerceRule,
  type MonthlyClosing,
  type DebtPlan,
  type PendingItem,
  type SavingsGoal,
  parseDominicanDateTime,
  type CashProjectionPlan,
  type Currency,
  upgradeCategories,
  validClockTime,
  validDate,
  type RecurringReceipt,
  type RecurringTemplate,
  type Category,
  type Movement,
} from '@flowsaldo/domain';
type CashProjectionKey = `demo:${Currency}` | `api:${Currency}`;

export interface LocalData {
  movements: Movement[];
  accounts: LocalAccount[];
  budgets: Record<string, number>;
  reviews: ReviewItem[];
  categories: Category[];
  categoryBudgets: Record<string, number>;
  recurring: RecurringTemplate[];
  bankIds: string[];
  receipts: RecurringReceipt[];
  cashProjections: Partial<Record<CashProjectionKey, CashProjectionPlan>>;
  savingsGoals: Record<'demo' | 'api', SavingsGoal[]>;
  pendingItems: Record<string, PendingItem[]>;
  debtPlans: Record<string, DebtPlan[]>;
  monthlyClosings: Record<string, MonthlyClosing[]>;
  commerceRules: Record<string, CommerceRule[]>;
}
const key = 'flowsaldo.demo.v2';
async function readLocal(): Promise<LocalData | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  return normalizeLocalData(JSON.parse(raw));
}

export function normalizeLocalData(input: unknown): LocalData {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Datos locales inválidos');
  const value = { ...input } as LocalData;
  if (
    !Array.isArray(value.movements) ||
    !value.budgets ||
    typeof value.budgets !== 'object' ||
    Array.isArray(value.budgets)
  )
    throw new Error('Datos locales inválidos');
  for (const m of value.movements)
    if (
      !m ||
      typeof m.id !== 'string' ||
      !m.id ||
      typeof m.description !== 'string' ||
      typeof m.category !== 'string' ||
      typeof m.occurredAt !== 'string' ||
      !validDate(m.occurredAt.slice(0, 10)) ||
      !Number.isFinite(Date.parse(m.occurredAt)) ||
      !Number.isInteger(m.amountMinor) ||
      m.amountMinor <= 0 ||
      m.amountMinor > 2147483647 ||
      !isCurrency(m.currency) ||
      (m.refundOfId != null && (typeof m.refundOfId !== 'string' || !m.refundOfId)) ||
      !['INCOME', 'EXPENSE', 'TRANSFER'].includes(m.type)
    )
      throw new Error('Movimiento local inválido');
  if (new Set(value.movements.map((movement) => movement.id)).size !== value.movements.length)
    throw new Error('Identificadores de movimientos duplicados');
  for (const amount of Object.values(value.budgets))
    if (!Number.isInteger(amount) || amount < 0 || amount > 2147483647)
      throw new Error('Presupuesto local inválido');
  if (value.reviews === undefined) value.reviews = demoReviews();
  if (
    !Array.isArray(value.reviews) ||
    value.reviews.some(
      (item) =>
        !item ||
        typeof item.id !== 'string' ||
        typeof item.externalId !== 'string' ||
        !['REVIEW', 'PARSED', 'DISMISSED', 'PENDING', 'PROCESSING', 'FAILED'].includes(item.status),
    )
  )
    throw new Error('Revisiones locales inválidas');
  if (value.accounts === undefined) value.accounts = [];
  validateLocalAccounts(value.accounts);
  localAccountBalances(value.accounts, value.movements);
  const upgraded = upgradeCategories(value.movements, value.categories);
  value.categories = upgraded.categories;
  value.movements = upgraded.movements;
  const refundGroups = new Map<string, Movement[]>();
  for (const movement of value.movements) {
    if (!movement.refundOfId) continue;
    const refunds = refundGroups.get(movement.refundOfId);
    if (refunds) refunds.push(movement);
    else refundGroups.set(movement.refundOfId, [movement]);
  }
  for (const [sourceId, refunds] of refundGroups) {
    const source = value.movements.find((movement) => movement.id === sourceId);
    if (
      !source ||
      refunds.some(
        (refund) =>
          refund.occurredAt.slice(0, 10) < source.occurredAt.slice(0, 10) ||
          (refund.accountId ?? null) !== (source.accountId ?? null),
      )
    )
      throw new Error('Devolución local inválida.');
    refundBalance(source, refunds);
  }
  if (value.categoryBudgets === undefined) value.categoryBudgets = {};
  if (
    !value.categoryBudgets ||
    typeof value.categoryBudgets !== 'object' ||
    Array.isArray(value.categoryBudgets) ||
    Object.values(value.categoryBudgets).some(
      (n) => !Number.isInteger(n) || n <= 0 || n > 2147483647,
    )
  )
    throw new Error('Presupuestos por categoría inválidos');
  if (value.recurring === undefined) value.recurring = [];
  if (value.receipts === undefined) value.receipts = [];
  if (
    !Array.isArray(value.recurring) ||
    value.recurring.some(
      (t) =>
        !t ||
        typeof t.id !== 'string' ||
        !t.id ||
        !Number.isInteger(t.version) ||
        t.version < 0 ||
        typeof t.description !== 'string' ||
        typeof t.category !== 'string' ||
        !t.description.trim() ||
        !Number.isInteger(t.amountMinor) ||
        t.amountMinor <= 0 ||
        t.amountMinor > 2147483647 ||
        !isCurrency(t.currency) ||
        !['INCOME', 'EXPENSE', 'TRANSFER'].includes(t.type) ||
        !validDate(t.startDate) ||
        (t.timeOfDay != null && !validClockTime(t.timeOfDay)) ||
        !validDate(t.nextDate) ||
        t.nextDate < t.startDate ||
        !Number.isInteger(t.anchorDay) ||
        t.anchorDay < 1 ||
        t.anchorDay > 31 ||
        typeof t.active !== 'boolean' ||
        !value.categories.some((c) => c.id === t.categoryId),
    ) ||
    new Set(value.recurring.map((t) => t.id)).size !== value.recurring.length
  )
    throw new Error('Plantillas locales inválidas');
  if (
    !Array.isArray(value.receipts) ||
    value.receipts.some(
      (r) =>
        !r ||
        !value.recurring.some((t) => t.id === r.templateId) ||
        !validDate(r.scheduledFor) ||
        (r.movementId !== null && typeof r.movementId !== 'string'),
    ) ||
    new Set(value.receipts.map((r) => JSON.stringify([r.templateId, r.scheduledFor]))).size !==
      value.receipts.length
  )
    throw new Error('Confirmaciones locales inválidas');
  if (value.bankIds === undefined) value.bankIds = [];
  if (
    !Array.isArray(value.bankIds) ||
    value.bankIds.some((id) => typeof id !== 'string' || !id) ||
    new Set(value.bankIds).size !== value.bankIds.length
  )
    throw new Error('Bancos locales inválidos');
  if (value.cashProjections === undefined) value.cashProjections = {};
  if (
    !value.cashProjections ||
    typeof value.cashProjections !== 'object' ||
    Array.isArray(value.cashProjections) ||
    Object.entries(value.cashProjections).some(
      ([key, plan]) =>
        !/^(demo|api):(DOP|USD|EUR)$/.test(key) ||
        !plan ||
        !Number.isSafeInteger(plan.balanceMinor) ||
        Math.abs(plan.balanceMinor) > 2147483647 ||
        typeof plan.nextIncomeAt !== 'string' ||
        !parseDominicanDateTime(plan.nextIncomeAt),
    )
  )
    throw new Error('Proyección local inválida.');
  if (value.pendingItems === undefined) value.pendingItems = {};
  if (
    !value.pendingItems ||
    typeof value.pendingItems !== 'object' ||
    Array.isArray(value.pendingItems) ||
    !Object.values(value.pendingItems).every(validPendingItems)
  )
    throw new Error('Pagos y cobros locales inválidos.');
  if (value.debtPlans === undefined) value.debtPlans = {};
  if (
    !value.debtPlans ||
    typeof value.debtPlans !== 'object' ||
    Array.isArray(value.debtPlans) ||
    !Object.values(value.debtPlans).every(validDebtPlans)
  )
    throw new Error('Planes de pago locales inválidos.');
  if (value.monthlyClosings === undefined) value.monthlyClosings = {};
  if (
    !value.monthlyClosings ||
    typeof value.monthlyClosings !== 'object' ||
    Array.isArray(value.monthlyClosings) ||
    !Object.values(value.monthlyClosings).every(validMonthlyClosings)
  )
    throw new Error('Cierres mensuales locales inválidos.');
  if (value.commerceRules === undefined) value.commerceRules = {};
  if (
    !value.commerceRules ||
    typeof value.commerceRules !== 'object' ||
    Array.isArray(value.commerceRules) ||
    !Object.values(value.commerceRules).every(validCommerceRules)
  )
    throw new Error('Reglas de comercio locales inválidas.');
  if (value.savingsGoals === undefined) value.savingsGoals = { demo: [], api: [] };
  if (
    !value.savingsGoals ||
    !validSavingsGoals(value.savingsGoals.demo) ||
    !validSavingsGoals(value.savingsGoals.api)
  )
    throw new Error('Metas locales inválidas.');
  value.reviews = value.reviews.map((r) =>
    r.status === 'PARSED' && !r.movement
      ? {
          ...r,
          movement: value.movements.some((m) => m.id === `reviewed-${r.id}`)
            ? { id: `reviewed-${r.id}` }
            : null,
        }
      : r,
  );
  return value;
}
export type LocalUpdate = (current: LocalData) => LocalData;

const localStore = createLocalStore(readLocal, (data) =>
  AsyncStorage.setItem(key, JSON.stringify(data)),
);

export const loadLocal = localStore.load;
export const updateLocal = localStore.update;
