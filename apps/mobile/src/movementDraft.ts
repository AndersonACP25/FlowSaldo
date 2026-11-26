import {
  checkMovementSplits,
  parseAmount,
  parseDominicanDateTime,
  selectedCategory,
  validDate,
  type Category,
  type Currency,
  type Movement,
  type MovementType,
} from '@flowsaldo/domain';
import type { SplitDraft } from './MovementSplitsEditor';
export type Draft = Omit<Movement, 'id'>;

export function buildMovementDraft({
  amount,
  description,
  date,
  time,
  type,
  unit,
  accountLink,
  categories,
  categoryId,
  parts,
  allowSplits,
  previous,
  requestKey,
}: {
  amount: string;
  description: string;
  date: string;
  time?: string;
  type: MovementType;
  unit: Currency;
  accountLink?: { accountId: string; targetAccountId: string };
  categories: Category[];
  categoryId: string;
  parts?: SplitDraft[];
  allowSplits: boolean;
  previous?: Movement;
  requestKey?: string;
}): Draft {
  const { accountId, targetAccountId } = accountLink ?? {};
  const isTransfer = type === 'TRANSFER';
  const amountMinor = parseAmount(amount);
  if (!description.trim()) throw new Error('Escribe una descripción.');
  const selectedTime = time === undefined ? null : parseDominicanDateTime(time);
  if (time !== undefined ? !selectedTime : !validDate(date))
    throw new Error(
      time !== undefined
        ? 'Selecciona una fecha y hora válidas.'
        : 'Escribe una fecha válida: AAAA-MM-DD.',
    );
  if (accountLink && isTransfer && accountId && (!targetAccountId || targetAccountId === accountId))
    throw new Error('Selecciona otra cuenta de destino.');
  if (parts?.some((part) => !part.categoryId))
    throw new Error('Elige una categoría para cada parte.');
  const splits = parts
    ? parts.map((part) => ({
        ...selectedCategory(
          categories,
          part.categoryId,
          'Sin categorizar',
          previous?.splits?.find((item) => item.categoryId === part.categoryId),
        ),
        amountMinor: parseAmount(part.amount),
      }))
    : [];
  checkMovementSplits(type, amountMinor, splits);
  const category = selectedCategory(
    categories,
    parts ? (previous?.categoryId ?? categories.find((c) => c.system)?.id) : categoryId,
    'Sin categorizar',
    previous,
  );
  return {
    description: description.trim(),
    amountMinor,
    occurredAt: selectedTime?.toISOString() ?? date + 'T12:00:00.000Z',
    ...category,
    ...(allowSplits ? { splits } : {}),
    type,
    currency: unit,
    ...(accountLink
      ? {
          accountId: accountId || null,
          targetAccountId: isTransfer ? targetAccountId || null : null,
        }
      : {}),
    ...(requestKey === undefined ? {} : { requestKey }),
  };
}
