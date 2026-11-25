import { ledgerBalance } from './finance.ts';
import { isCurrency, type Currency, type Movement } from './index.ts';

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

type AccountMovement = Pick<Movement, 'accountId' | 'targetAccountId' | 'type' | 'currency'>;

export function localMovementAccount(
  accounts: ReadonlyMap<string, LocalAccount>,
  movement: AccountMovement,
) {
  if (
    movement.targetAccountId != null ||
    (movement.type === 'TRANSFER' && movement.accountId != null)
  )
    throw new Error('Las transferencias locales todavía se registran sin cuenta.');
  if (movement.accountId == null) return undefined;
  const account = accounts.get(movement.accountId);
  if (!account) throw new Error('La cuenta del movimiento no existe.');
  if (account.currency !== movement.currency)
    throw new Error('La cuenta y el movimiento deben usar la misma moneda.');
  return account;
}

export function localAccountBalances(accounts: LocalAccount[], movements: Movement[]) {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const totals = new Map(accounts.map(({ id }) => [id, { income: 0, expenses: 0 }]));
  for (const movement of movements) {
    const account = localMovementAccount(byId, movement);
    if (!account) continue;
    const total = totals.get(account.id)!;
    if (movement.type === 'INCOME') total.income += movement.amountMinor;
    else total.expenses += movement.amountMinor;
  }
  return new Map(
    accounts.map(({ id, openingMinor }) => {
      const { income, expenses } = totals.get(id)!;
      return [id, ledgerBalance(openingMinor, income, expenses, 0)];
    }),
  );
}
