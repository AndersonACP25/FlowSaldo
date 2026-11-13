import type { Prisma } from '@prisma/client';
import { ledgerBalance } from '@flowsaldo/domain';
import { CategoryError } from './categories';
type Tx = Prisma.TransactionClient;
// All account-affecting writes and reconciliation share one installation-level lock.
export async function lockFinance(tx: Tx) {
  await tx.$queryRaw`SELECT id FROM "FinanceLock" WHERE id=1 FOR UPDATE`;
}
interface Linked {
  accountId?: string | null;
  targetAccountId?: string | null;
  currency: string;
  type: string;
  occurredAt: string | Date;
}
export async function checkAccountMovement(tx: Tx, data: Linked, existing?: Linked) {
  const ids = [
    ...new Set(
      [data.accountId, data.targetAccountId, existing?.accountId, existing?.targetAccountId].filter(
        (v): v is string => !!v,
      ),
    ),
  ];
  if (!ids.length) return;
  if (
    (data.accountId || data.targetAccountId) &&
    (!data.accountId ||
      (data.type === 'TRANSFER'
        ? !data.targetAccountId || data.targetAccountId === data.accountId
        : !!data.targetAccountId))
  )
    throw new CategoryError(
      'Selecciona una cuenta y, en transferencias, otra cuenta de destino distinta.',
      400,
    );
  const accounts = await tx.financialAccount.findMany({ where: { id: { in: ids } } });
  if (accounts.length !== ids.length) throw new CategoryError('Cuenta no encontrada.', 404);
  for (const account of accounts) {
    const next = [data.accountId, data.targetAccountId].includes(account.id);
    const previous =
      existing && [existing.accountId, existing.targetAccountId].includes(account.id);
    if (next && account.currency !== data.currency)
      throw new CategoryError('Las cuentas y el movimiento deben usar la misma moneda.', 400);
    if (next && account.archived)
      throw new CategoryError('Reactiva la cuenta antes de modificar sus movimientos.', 409);
    const cutoff = account.reconciledThrough;
    const day = (value: string | Date) => new Date(value).toISOString().slice(0, 10);
    if (
      cutoff &&
      ((next && day(data.occurredAt) <= cutoff) ||
        (previous && day(existing!.occurredAt) <= cutoff))
    )
      throw new CategoryError('El período está conciliado. No se puede cambiar su historial.', 409);
  }
}
export async function touchAccounts(tx: Tx, ...items: Linked[]) {
  const ids = [
    ...new Set(
      items.flatMap((i) => [i.accountId, i.targetAccountId]).filter((v): v is string => !!v),
    ),
  ];
  if (ids.length)
    await tx.financialAccount.updateMany({
      where: { id: { in: ids } },
      data: { revision: { increment: 1 } },
    });
}
export async function checkAccountDelete(tx: Tx, item: Linked) {
  const accounts = await tx.financialAccount.findMany({
    where: { id: { in: [item.accountId, item.targetAccountId].filter((v): v is string => !!v) } },
  });
  if (
    accounts.some(
      (a) =>
        a.reconciledThrough &&
        new Date(item.occurredAt).toISOString().slice(0, 10) <= a.reconciledThrough!,
    )
  )
    throw new CategoryError(
      'El período está conciliado. No se puede eliminar este movimiento.',
      409,
    );
}
export async function balance(
  tx: Tx,
  account: { id: string; openingMinor: number },
  asOf?: string,
) {
  const occurredAt = asOf
    ? { lt: new Date(Date.parse(asOf + 'T00:00:00.000Z') + 86400000) }
    : undefined;
  const [out, incoming] = await Promise.all([
    tx.movement.groupBy({
      by: ['type'],
      where: { accountId: account.id, occurredAt },
      _sum: { amountMinor: true },
    }),
    tx.movement.aggregate({
      where: { targetAccountId: account.id, type: 'TRANSFER', occurredAt },
      _sum: { amountMinor: true },
    }),
  ]);
  return ledgerBalance(
    account.openingMinor,
    Number(out.find((r) => r.type === 'INCOME')?._sum.amountMinor ?? 0),
    out.filter((r) => r.type !== 'INCOME').reduce((n, r) => n + Number(r._sum.amountMinor ?? 0), 0),
    Number(incoming._sum.amountMinor ?? 0),
  );
}
