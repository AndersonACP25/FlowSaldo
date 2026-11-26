import type { Movement, MovementType, SplitAmount } from './movement.ts';

export type { MovementSplit, SplitAmount } from './movement.ts';
export const maxMovementSplits = 12;

export function checkMovementSplits(
  type: MovementType,
  amountMinor: number,
  splits: readonly SplitAmount[],
) {
  if (splits.length === 0) return;
  if (type !== 'EXPENSE') throw new Error('Solo puedes dividir gastos.');
  if (splits.length < 2 || splits.length > maxMovementSplits)
    throw new Error('Elige entre 2 y 12 categorías para dividir el gasto.');
  const categories = new Set<string>();
  let total = 0;
  for (const split of splits) {
    if (!split.categoryId || categories.has(split.categoryId))
      throw new Error('Elige una categoría distinta para cada parte.');
    if (
      !Number.isInteger(split.amountMinor) ||
      split.amountMinor <= 0 ||
      split.amountMinor > 2147483647
    )
      throw new Error('El importe de cada parte debe ser positivo.');
    categories.add(split.categoryId);
    total += split.amountMinor;
  }
  if (total !== amountMinor) throw new Error('Las partes deben sumar el importe total del gasto.');
}

export function movementCategories(
  movement: Pick<Movement, 'splits' | 'categoryId' | 'category' | 'amountMinor'>,
): Pick<Movement, 'categoryId' | 'category' | 'amountMinor'>[] {
  return movement.splits?.length ? movement.splits : [movement];
}
