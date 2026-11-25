import { isCurrency, type Movement } from '@flowsaldo/domain';
import { normalizeLocalData, type LocalData } from './storage';

const format = 'flowsaldo-local-backup';
const version = 1;
// Android's default AsyncStorage backend must be able to read the restored record.
export const maxBackupBytes = 2_000_000;
export const backupSizeMessage = 'El respaldo supera el límite de 2 MB.';

function byScope<T>(entries: Record<string, T>, local: boolean): Record<string, T> {
  return Object.fromEntries(
    Object.entries(entries).filter(
      ([key]) => (key === 'demo' || key.startsWith('demo:')) === local,
    ),
  );
}

function localSnapshot(data: LocalData): LocalData {
  return {
    movements: data.movements,
    categories: data.categories,
    budgets: byScope(data.budgets, true),
    categoryBudgets: byScope(data.categoryBudgets, true),
    reviews: data.reviews,
    recurring: data.recurring,
    bankIds: data.bankIds,
    receipts: data.receipts,
    cashProjections: byScope(data.cashProjections, true),
    savingsGoals: { demo: data.savingsGoals.demo, api: [] },
    pendingItems: byScope(data.pendingItems, true),
    debtPlans: byScope(data.debtPlans, true),
    monthlyClosings: byScope(data.monthlyClosings, true),
    commerceRules: byScope(data.commerceRules, true),
  };
}

function checkSize(text: string, message = backupSizeMessage) {
  const bytes = encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, '_').length;
  if (bytes > maxBackupBytes) throw new Error(message);
}

export function createLocalBackup(data: LocalData) {
  const createdAt = new Date().toISOString();
  const text = JSON.stringify({ format, version, createdAt, data: localSnapshot(data) });
  checkSize(text);
  return { text, name: `FlowSaldo-Respaldo-${createdAt.slice(0, 10)}.json` };
}

function optionalText(value: unknown) {
  return value == null || typeof value === 'string';
}

function validReviewSuggestion(movement: Movement | undefined) {
  return (
    movement == null ||
    (typeof movement.description === 'string' &&
      typeof movement.category === 'string' &&
      typeof movement.occurredAt === 'string' &&
      Number.isFinite(Date.parse(movement.occurredAt)) &&
      Number.isInteger(movement.amountMinor) &&
      movement.amountMinor > 0 &&
      movement.amountMinor <= 2147483647 &&
      isCurrency(movement.currency) &&
      ['INCOME', 'EXPENSE', 'TRANSFER'].includes(movement.type) &&
      movement.splits === undefined)
  );
}

export function readLocalBackup(text: string) {
  let file: { format?: unknown; version?: unknown; createdAt?: unknown; data?: unknown } | null;
  try {
    file = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('El archivo no es un respaldo válido de FlowSaldo.');
  }
  if (file?.format !== format) throw new Error('El archivo no es un respaldo válido de FlowSaldo.');
  if (file.version !== version)
    throw new Error('Esta versión de FlowSaldo no admite el formato del respaldo.');

  try {
    if (typeof file.createdAt !== 'string' || !Number.isFinite(Date.parse(file.createdAt)))
      throw new Error();
    const data = normalizeLocalData(file.data);
    const snapshot = localSnapshot(data);
    const keys = Object.keys(snapshot);
    // A current-format backup must include every section. Legacy defaults only apply to device storage.
    if (
      keys.some((key) => !Object.hasOwn(file.data as object, key)) ||
      !(file.data as LocalData).categories ||
      data.savingsGoals.api.length > 0
    )
      throw new Error();
    const movementIds = new Set(data.movements.map((movement) => movement.id));
    if (
      data.movements.some(
        (movement) =>
          !optionalText(movement.accountId) ||
          !optionalText(movement.targetAccountId) ||
          !optionalText(movement.requestKey),
      ) ||
      new Set(data.reviews.map((review) => review.id)).size !== data.reviews.length ||
      data.reviews.some(
        (review) =>
          !optionalText(review.reason) ||
          !optionalText(review.createdAt) ||
          !optionalText(review.nextAttemptAt) ||
          !optionalText(review.lastErrorCode) ||
          !optionalText(review.body) ||
          ![review.attempts, review.manualRetries].every(
            (value) => value == null || (Number.isSafeInteger(value) && value >= 0),
          ) ||
          (review.movement != null && !movementIds.has(review.movement.id)) ||
          !validReviewSuggestion(review.suggestion),
      ) ||
      data.receipts.some((receipt) => receipt.movementId && !movementIds.has(receipt.movementId))
    )
      throw new Error();
    return { createdAt: file.createdAt, data: snapshot };
  } catch {
    throw new Error('El respaldo contiene datos incompletos o inválidos.');
  }
}

export function restoreLocalBackup(current: LocalData, backup: LocalData) {
  const next: LocalData = {
    ...backup,
    budgets: { ...byScope(current.budgets, false), ...backup.budgets },
    categoryBudgets: { ...byScope(current.categoryBudgets, false), ...backup.categoryBudgets },
    cashProjections: { ...byScope(current.cashProjections, false), ...backup.cashProjections },
    savingsGoals: { demo: backup.savingsGoals.demo, api: current.savingsGoals.api },
    pendingItems: { ...byScope(current.pendingItems, false), ...backup.pendingItems },
    debtPlans: { ...byScope(current.debtPlans, false), ...backup.debtPlans },
    monthlyClosings: { ...byScope(current.monthlyClosings, false), ...backup.monthlyClosings },
    commerceRules: { ...byScope(current.commerceRules, false), ...backup.commerceRules },
  };
  checkSize(
    JSON.stringify(next),
    'El respaldo supera el espacio disponible para los datos locales.',
  );
  return next;
}
