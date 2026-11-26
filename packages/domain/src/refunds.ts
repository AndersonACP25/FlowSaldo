import { movementCategories, type MovementSplit } from './movementSplits.ts';
import type { Movement } from './movement.ts';

type RefundSource = Pick<
  Movement,
  | 'id'
  | 'type'
  | 'amountMinor'
  | 'currency'
  | 'occurredAt'
  | 'categoryId'
  | 'category'
  | 'splits'
  | 'refundOfId'
>;

export function refundBalance(source: RefundSource, refunds: readonly Movement[]) {
  if (source.type !== 'EXPENSE' || source.refundOfId)
    throw new Error('Selecciona un gasto para registrar la devolución.');
  const parts = movementCategories(source).map((part) => ({
    category: part.category,
    categoryId: part.categoryId ?? null,
    amountMinor: part.amountMinor,
  }));
  let refundedMinor = 0;
  for (const refund of refunds) {
    if (refund.refundOfId !== source.id) continue;
    if (refund.type !== 'INCOME' || refund.currency !== source.currency)
      throw new Error('La devolución debe usar la moneda del gasto original.');
    refundedMinor += refund.amountMinor;
    for (const returned of movementCategories(refund)) {
      const part = parts.find((row) => row.categoryId === (returned.categoryId ?? null));
      if (!part || returned.amountMinor > part.amountMinor)
        throw new Error('La devolución excede el importe de su categoría original.');
      part.amountMinor -= returned.amountMinor;
    }
  }
  if (refundedMinor > source.amountMinor)
    throw new Error('Las devoluciones superan el importe original.');
  return { refundedMinor, remainingMinor: source.amountMinor - refundedMinor, parts };
}

export function prepareRefund(
  source: RefundSource,
  refunds: readonly Movement[],
  input: { amountMinor: number; occurredAt: string },
) {
  const balance = refundBalance(source, refunds);
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1)
    throw new Error('Indica un importe positivo.');
  if (input.amountMinor > balance.remainingMinor)
    throw new Error('La devolución supera el importe pendiente de devolver.');
  if (
    !Number.isFinite(Date.parse(input.occurredAt)) ||
    input.occurredAt.slice(0, 10) < source.occurredAt.slice(0, 10)
  )
    throw new Error('La fecha de devolución debe ser igual o posterior a la del gasto.');

  const total = BigInt(balance.remainingMinor);
  const items = balance.parts
    .map((part) => {
      const scaled = BigInt(part.amountMinor) * BigInt(input.amountMinor);
      return { ...part, amountMinor: Number(scaled / total), remainder: Number(scaled % total) };
    })
    .sort(
      (a, b) => b.remainder - a.remainder || (a.categoryId ?? '').localeCompare(b.categoryId ?? ''),
    );
  let cents = input.amountMinor - items.reduce((sum, item) => sum + item.amountMinor, 0);
  for (const item of items) {
    if (cents > 0) {
      item.amountMinor++;
      cents--;
    }
  }
  const allocated = items.filter((part) => part.amountMinor > 0);
  const first = allocated[0];
  const splits: MovementSplit[] =
    allocated.length > 1
      ? allocated.map(({ category, categoryId, amountMinor }) => ({
          category,
          categoryId: categoryId!,
          amountMinor,
        }))
      : [];
  return {
    ...input,
    refundOfId: source.id,
    type: 'INCOME' as const,
    currency: source.currency,
    category: first.category,
    categoryId: first.categoryId,
    splits,
  };
}

export function refusesRefundSourceChange(source: Movement, draft: Omit<Movement, 'id'>) {
  const original = movementCategories(source);
  const proposed = movementCategories(draft);
  return (
    source.amountMinor !== draft.amountMinor ||
    source.currency !== draft.currency ||
    source.type !== draft.type ||
    source.occurredAt !== draft.occurredAt ||
    (source.accountId ?? null) !== (draft.accountId ?? null) ||
    original.length !== proposed.length ||
    original.some(
      (part) =>
        !proposed.some(
          (row) => row.categoryId === part.categoryId && row.amountMinor === part.amountMinor,
        ),
    )
  );
}
