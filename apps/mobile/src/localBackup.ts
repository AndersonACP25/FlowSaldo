import { isCurrency, type Movement } from '@flowsaldo/domain';
import { normalizeLocalData, type LocalData } from './storage';
import { byDemoScope, replaceDemoData } from './dataScopes';

const format = 'flowsaldo-local-backup';
const version = 2;
// Android's default AsyncStorage backend must be able to read the restored record.
export const maxBackupBytes = 2_000_000;
export const backupSizeMessage = 'El respaldo supera el límite de 2 MB.';

function localSnapshot(data: LocalData): LocalData {
  return {
    movements: data.movements,
    accounts: data.accounts,
    categories: data.categories,
    budgets: byDemoScope(data.budgets, true),
    categoryBudgets: byDemoScope(data.categoryBudgets, true),
    reviews: data.reviews,
    recurring: data.recurring,
    bankIds: data.bankIds,
    receipts: data.receipts,
    cashProjections: byDemoScope(data.cashProjections, true),
    savingsGoals: { demo: data.savingsGoals.demo, api: [] },
    pendingItems: byDemoScope(data.pendingItems, true),
    debtPlans: byDemoScope(data.debtPlans, true),
    monthlyClosings: byDemoScope(data.monthlyClosings, true),
    commerceRules: byDemoScope(data.commerceRules, true),
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
  if (file.version !== 1 && file.version !== version)
    throw new Error('Esta versión de FlowSaldo no admite el formato del respaldo.');

  try {
    if (typeof file.createdAt !== 'string' || !Number.isFinite(Date.parse(file.createdAt)))
      throw new Error();
    const data = normalizeLocalData(file.data);
    const snapshot = localSnapshot(data);
    const keys = Object.keys(snapshot);
    // A current-format backup must include every section. Legacy defaults only apply to device storage.
    if (
      keys.some(
        (key) =>
          !(key === 'accounts' && file.version === 1) && !Object.hasOwn(file.data as object, key),
      ) ||
      (file.version === 1 && data.accounts.length > 0) ||
      !(file.data as LocalData).categories ||
      Object.entries(data.savingsGoals).some(
        ([scope, goals]) => scope !== 'demo' && (goals?.length ?? 0) > 0,
      )
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
  const next = replaceDemoData(current, backup);
  checkSize(
    JSON.stringify(next),
    'El respaldo supera el espacio disponible para los datos locales.',
  );
  return next;
}
