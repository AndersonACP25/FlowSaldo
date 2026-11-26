import { isCurrency, type Movement } from '@flowsaldo/domain';
import type { FinancialAccount } from './FinancePanel';
import type { Page } from './history';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): boolean {
  return isNonnegativeInteger(value) && value > 0;
}

function isMovement(value: unknown): value is Movement {
  if (!isRecord(value)) return false;
  const {
    id,
    amountMinor,
    currency,
    type,
    description,
    occurredAt,
    category,
    splits,
    balanceAdjustment,
  } = value;
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    isPositiveInteger(amountMinor) &&
    isCurrency(currency) &&
    (type === 'INCOME' || type === 'EXPENSE' || type === 'TRANSFER') &&
    typeof description === 'string' &&
    typeof occurredAt === 'string' &&
    Number.isFinite(Date.parse(occurredAt)) &&
    typeof category === 'string' &&
    ['categoryId', 'accountId', 'targetAccountId', 'requestKey', 'refundOfId'].every(
      (key) => value[key] == null || typeof value[key] === 'string',
    ) &&
    (splits === undefined ||
      (Array.isArray(splits) &&
        splits.every(
          (split: unknown) =>
            isRecord(split) &&
            typeof split.categoryId === 'string' &&
            typeof split.category === 'string' &&
            isPositiveInteger(split.amountMinor),
        ))) &&
    (balanceAdjustment === undefined ||
      (isRecord(balanceAdjustment) &&
        Number.isSafeInteger(balanceAdjustment.expectedMinor) &&
        Number.isSafeInteger(balanceAdjustment.statementMinor)))
  );
}

export function readMovement(value: unknown): Movement {
  if (!isMovement(value)) throw new Error('La API devolvió un movimiento inválido.');
  return value;
}

export function readMovementPage(value: unknown): Page<Movement> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(isMovement) ||
    !isNonnegativeInteger(value.total) ||
    value.items.length > value.total ||
    (value.nextCursor !== null && (typeof value.nextCursor !== 'string' || !value.nextCursor))
  )
    throw new Error('La API devolvió un historial de movimientos inválido.');
  return { items: value.items, total: value.total, nextCursor: value.nextCursor };
}

export function readRefundInfo(value: unknown, expenseId: string) {
  if (
    !isRecord(value) ||
    !isMovement(value.source) ||
    value.source.id !== expenseId ||
    value.source.type !== 'EXPENSE' ||
    !isNonnegativeInteger(value.refundedMinor) ||
    !isNonnegativeInteger(value.remainingMinor) ||
    value.source.amountMinor - value.refundedMinor !== value.remainingMinor
  )
    throw new Error('La API devolvió un saldo de devolución inválido.');
  return {
    source: value.source,
    refundedMinor: value.refundedMinor,
    remainingMinor: value.remainingMinor,
  };
}

function isAccount(value: unknown): value is FinancialAccount {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    (value.kind === 'BANK' ||
      value.kind === 'CASH' ||
      value.kind === 'CREDIT_CARD' ||
      value.kind === 'LOAN') &&
    isCurrency(value.currency) &&
    Number.isSafeInteger(value.openingMinor) &&
    Number.isSafeInteger(value.balanceMinor) &&
    isNonnegativeInteger(value.debtMinor) &&
    (value.creditLimitMinor === null || isNonnegativeInteger(value.creditLimitMinor)) &&
    (value.availableCreditMinor === null || Number.isSafeInteger(value.availableCreditMinor)) &&
    typeof value.archived === 'boolean' &&
    isNonnegativeInteger(value.revision) &&
    (value.reconciledThrough === null || typeof value.reconciledThrough === 'string')
  );
}

export function readFinancialAccounts(value: unknown): FinancialAccount[] {
  if (!Array.isArray(value) || !value.every(isAccount))
    throw new Error('La API devolvió una lista de cuentas inválida.');
  return value;
}
