import { ledgerBalance } from './finance.ts';
import { isCurrency, type Currency } from './finance.ts';
import type { Movement } from './movement.ts';

export const localAccountKinds = ['BANK', 'CASH', 'CREDIT_CARD'] as const;

export interface LocalAccount {
  id: string;
  name: string;
  kind: (typeof localAccountKinds)[number];
  currency: Currency;
  openingMinor: number;
  archived: boolean;
}

export function localAccountName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 60)
    throw new Error('El nombre de la cuenta debe tener entre 1 y 60 caracteres.');
  return name;
}

export function validateLocalAccounts(accounts: LocalAccount[]) {
  if (!Array.isArray(accounts)) throw new Error('Cuentas locales inválidas.');
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const account of accounts) {
    if (
      !account ||
      typeof account.id !== 'string' ||
      !account.id ||
      ids.has(account.id) ||
      typeof account.name !== 'string' ||
      localAccountName(account.name) !== account.name ||
      !localAccountKinds.includes(account.kind) ||
      !isCurrency(account.currency) ||
      !Number.isSafeInteger(account.openingMinor) ||
      Math.abs(account.openingMinor) > 2147483647 ||
      (account.kind === 'CREDIT_CARD' && account.openingMinor > 0) ||
      typeof account.archived !== 'boolean'
    )
      throw new Error('Cuenta local inválida.');
    const key = `${account.currency}:${account.name.toLocaleLowerCase('es')}`;
    if (names.has(key)) throw new Error('Ya existe una cuenta con ese nombre y moneda.');
    ids.add(account.id);
    names.add(key);
  }
}

type AccountMovement = Pick<
  Movement,
  | 'accountId'
  | 'targetAccountId'
  | 'type'
  | 'currency'
  | 'amountMinor'
  | 'balanceAdjustment'
  | 'refundOfId'
>;

export function localMovementAccounts(
  accounts: ReadonlyMap<string, LocalAccount>,
  movement: AccountMovement,
) {
  const { accountId, targetAccountId, type, currency } = movement;
  const adjustment = movement.balanceAdjustment;
  if (adjustment !== undefined) {
    if (
      !adjustment ||
      type !== 'TRANSFER' ||
      accountId == null ||
      targetAccountId != null ||
      movement.refundOfId != null ||
      Math.abs(reconciliationDifference(adjustment)) !== movement.amountMinor ||
      movement.amountMinor <= 0
    )
      throw new Error('Ajuste de saldo inválido.');
  }
  if (accountId == null && targetAccountId == null) return {};
  if (
    !adjustment &&
    type === 'TRANSFER' &&
    (accountId == null || targetAccountId == null || accountId === targetAccountId)
  )
    throw new Error('Elige dos cuentas distintas para la transferencia.');
  if (type !== 'TRANSFER' && targetAccountId != null)
    throw new Error('Solo las transferencias tienen una cuenta de destino.');

  function findAccount(id: string | null | undefined) {
    if (id == null) return undefined;
    const account = accounts.get(id);
    if (!account) throw new Error('La cuenta del movimiento no existe.');
    if (account.currency !== currency)
      throw new Error('Las cuentas y el movimiento deben usar la misma moneda.');
    return account;
  }

  return { source: findAccount(accountId), target: findAccount(targetAccountId) };
}

export function localAccountBalances(
  accounts: LocalAccount[],
  movements: Movement[],
  cutoff?: number,
) {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const totals = new Map(
    accounts.map(({ id }) => [id, { income: 0, outgoing: 0, incomingTransfers: 0 }]),
  );
  for (const movement of movements) {
    if (cutoff !== undefined && Date.parse(movement.occurredAt) > cutoff) continue;
    const { source, target } = localMovementAccounts(byId, movement);
    if (!source) continue;
    const total = totals.get(source.id)!;
    const adjustment = movement.balanceAdjustment;
    if (
      movement.type === 'INCOME' ||
      (adjustment && adjustment.statementMinor > adjustment.expectedMinor)
    )
      total.income += movement.amountMinor;
    else total.outgoing += movement.amountMinor;
    if (target) totals.get(target.id)!.incomingTransfers += movement.amountMinor;
  }
  return new Map(
    accounts.map(({ id, openingMinor }) => {
      const { income, outgoing, incomingTransfers } = totals.get(id)!;
      return [id, ledgerBalance(openingMinor, income, outgoing, incomingTransfers)];
    }),
  );
}

function reconciliationDifference({
  expectedMinor,
  statementMinor,
}: NonNullable<Movement['balanceAdjustment']>) {
  if (!Number.isSafeInteger(expectedMinor) || !Number.isSafeInteger(statementMinor))
    throw new Error('Saldo de conciliación inválido.');
  const difference = statementMinor - expectedMinor;
  if (Math.abs(difference) > 2147483647)
    throw new Error('La diferencia supera el monto máximo de un ajuste.');
  return difference;
}

export interface LocalReconciliation {
  accountId: string;
  occurredAt: string;
  expectedMinor: number;
  statementMinor: number;
  differenceMinor: number;
}

export function previewLocalReconciliation(
  accounts: LocalAccount[],
  movements: Movement[],
  input: Pick<LocalReconciliation, 'accountId' | 'occurredAt' | 'statementMinor'>,
): LocalReconciliation {
  const cutoff = Date.parse(input.occurredAt);
  if (!Number.isFinite(cutoff)) throw new Error('Selecciona una fecha y hora válidas.');
  const account = accounts.find((item) => item.id === input.accountId);
  if (!account || account.archived) throw new Error('Selecciona una cuenta activa.');
  const expectedMinor = localAccountBalances(accounts, movements, cutoff).get(account.id)!;
  const differenceMinor = reconciliationDifference({
    expectedMinor,
    statementMinor: input.statementMinor,
  });
  return { ...input, expectedMinor, differenceMinor };
}
