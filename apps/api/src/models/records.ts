import { db } from '@flowsaldo/database';
import type { Prisma } from '@prisma/client';
import { checkMovementSplits, type Currency, type SplitAmount } from '@flowsaldo/domain';
import { assignCategory, CategoryError } from './categories';
import { lockFinance, checkAccountMovement, touchAccounts, checkAccountDelete } from './finance';

interface MovementInput {
  accountId?: string | null;
  targetAccountId?: string | null;
  amountMinor: number;
  currency: Currency;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  description: string;
  categoryId?: string | null;
  category: string;
  occurredAt: string;
}

type EditableMovement = MovementInput & { splits?: SplitAmount[] };

function validateSplits(data: MovementInput, parts: SplitAmount[]) {
  try {
    checkMovementSplits(data.type, data.amountMinor, parts);
  } catch (error) {
    throw new CategoryError((error as Error).message);
  }
}

async function assignSplits(
  tx: Prisma.TransactionClient,
  parts: SplitAmount[],
  previous: { categoryId: string; category: string }[] = [],
) {
  return Promise.all(
    parts.map(async (part) => {
      const category = await assignCategory(
        tx,
        { ...part, category: 'Sin categorizar' },
        previous.find((item) => item.categoryId === part.categoryId),
      );
      return { ...category, amountMinor: part.amountMinor };
    }),
  );
}

export async function createMovement({
  splits = [],
  ...data
}: EditableMovement & { requestKey?: string }) {
  validateSplits(data, splits);
  return db.$transaction(async (tx) => {
    await lockFinance(tx);
    if (data.requestKey) {
      const receipt = await tx.movementRequest.findUnique({
        where: { key: data.requestKey },
        include: { movement: { include: { splits: true } } },
      });
      if (receipt && !receipt.movement)
        throw new CategoryError('Este envío ya se registró y su movimiento fue eliminado.', 409);
      const previous = receipt?.movement;
      if (previous) {
        const same =
          previous.amountMinor === data.amountMinor &&
          previous.type === data.type &&
          previous.currency === data.currency &&
          previous.description === data.description &&
          previous.occurredAt.toISOString() === data.occurredAt &&
          (previous.accountId ?? null) === (data.accountId ?? null) &&
          (previous.targetAccountId ?? null) === (data.targetAccountId ?? null) &&
          (data.categoryId
            ? previous.categoryId === data.categoryId
            : previous.category === data.category) &&
          previous.splits.length === splits.length &&
          splits.every((part) =>
            previous.splits.some(
              (saved) =>
                saved.categoryId === part.categoryId && saved.amountMinor === part.amountMinor,
            ),
          );
        if (!same) throw new CategoryError('La clave de envío ya fue usada con otros datos.', 409);
        return previous;
      }
    }
    if (data.type === 'TRANSFER' && data.accountId && !data.requestKey)
      throw new CategoryError('Una transferencia entre cuentas requiere clave de envío.', 400);
    await checkAccountMovement(tx, data);
    const movement = await tx.movement.create({
      data: {
        ...data,
        ...(await assignCategory(tx, data)),
        splits: { create: await assignSplits(tx, splits) },
      },
      include: { splits: true },
    });
    if (data.requestKey)
      await tx.movementRequest.create({ data: { key: data.requestKey, movementId: movement.id } });
    await touchAccounts(tx, data);
    return movement;
  });
}

export async function updateMovement(id: string, { splits, ...data }: EditableMovement) {
  return db.$transaction(async (tx) => {
    await lockFinance(tx);
    const existing = await tx.movement.findUnique({
      where: { id },
      include: { splits: true },
    });
    if (!existing) return null;
    const linked = {
      ...data,
      accountId: data.accountId === undefined ? existing.accountId : data.accountId,
      targetAccountId:
        data.targetAccountId === undefined ? existing.targetAccountId : data.targetAccountId,
    };
    await checkAccountMovement(tx, linked, existing);
    validateSplits(data, splits ?? existing.splits);
    const replacement = splits ? await assignSplits(tx, splits, existing.splits) : undefined;
    if (replacement) await tx.movementSplit.deleteMany({ where: { movementId: id } });
    const movement = await tx.movement.update({
      where: { id: existing.id },
      data: {
        ...linked,
        ...(await assignCategory(tx, data, existing)),
        ...(replacement ? { splits: { create: replacement } } : {}),
      },
      include: { splits: true },
    });
    await touchAccounts(tx, linked, existing);
    return movement;
  });
}

export async function deleteMovement(id: string) {
  return db.$transaction(async (tx) => {
    await lockFinance(tx);
    const existing = await tx.movement.findUnique({ where: { id: id } });
    if (!existing) return false;
    await checkAccountDelete(tx, existing);
    await tx.movement.delete({ where: { id: existing.id } });
    await touchAccounts(tx, existing);
    return true;
  });
}

export async function resolveImport(id: string, data: MovementInput) {
  return db.$transaction(async (tx) => {
    await lockFinance(tx);
    const rows = await tx.$queryRaw<
      Array<{ id: string; status: string }>
    >`SELECT id,status FROM "MailImport" WHERE id=${id} FOR UPDATE`;
    if (!rows[0]) return { status: 404 };
    if (rows[0].status !== 'REVIEW') return { status: 409 };
    await checkAccountMovement(tx, data);
    const movement = await tx.movement.create({
      data: { ...data, ...(await assignCategory(tx, data)), importId: id },
    });
    await touchAccounts(tx, data);
    await tx.mailImport.update({
      where: { id },
      data: { status: 'PARSED', body: '', reason: 'Confirmado manualmente' },
    });
    return { status: 201, movement };
  });
}
