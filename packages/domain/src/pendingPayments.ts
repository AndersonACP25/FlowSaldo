import { isCurrency, type Currency } from './finance.ts';
import { validDate } from './dateTime.ts';
import type { Movement } from './movement.ts';
import { parseDominicanDateTime } from './dateTime.ts';

type PendingOccurrence = { templateId: string; scheduledFor: string };
export type PendingSettlement =
  | { id: string; kind: 'manual'; amountMinor: number }
  | { id: string; kind: 'movement'; movementId: string };

export type PendingDraft = {
  name: string;
  kind: 'pay' | 'collect';
  currency: Currency;
  dueAt: string;
  amountMinor: number;
};

export type PendingItem = PendingDraft & {
  id: string;
  occurrence?: PendingOccurrence;
  settlements: PendingSettlement[];
};

const validAmount = (amount: number) =>
  Number.isInteger(amount) && amount > 0 && amount <= 2147483647;

export function checkPendingDraft(input: PendingDraft): PendingDraft {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 100) throw new Error('Escribe un nombre de hasta 100 caracteres.');
  if (input.kind !== 'pay' && input.kind !== 'collect') throw new Error('Tipo inválido.');
  if (!isCurrency(input.currency) || !validAmount(input.amountMinor))
    throw new Error('Monto o moneda inválidos.');
  if (!parseDominicanDateTime(input.dueAt))
    throw new Error('Elige la fecha y hora de vencimiento.');
  return { ...input, name };
}

export function pendingOccurrence<T extends Pick<PendingItem, 'occurrence'>>(
  items: readonly T[],
  templateId: string,
  scheduledFor: string,
) {
  return items.find(
    (item) =>
      item.occurrence?.templateId === templateId && item.occurrence.scheduledFor === scheduledFor,
  );
}

export function settlementAmount(
  item: PendingItem,
  settlement: PendingSettlement,
  movements: ReadonlyMap<string, Movement>,
) {
  if (settlement.kind === 'manual') return settlement.amountMinor;
  const movement = movements.get(settlement.movementId);
  const type = item.kind === 'pay' ? 'EXPENSE' : 'INCOME';
  return movement &&
    !movement.refundOfId &&
    movement.currency === item.currency &&
    movement.type === type &&
    validAmount(movement.amountMinor)
    ? movement.amountMinor
    : 0;
}

export function pendingRemaining(item: PendingItem, movements: ReadonlyMap<string, Movement>) {
  return item.settlements.reduce(
    (remaining, settlement) =>
      Math.max(0, remaining - settlementAmount(item, settlement, movements)),
    item.amountMinor,
  );
}

export function addPendingSettlement(
  items: PendingItem[],
  id: string,
  settlement: PendingSettlement,
  movements: ReadonlyMap<string, Movement>,
) {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error('El pendiente ya no está disponible.');
  if (
    settlement.kind === 'movement' &&
    items.some((entry) =>
      entry.settlements.some(
        (saved) => saved.kind === 'movement' && saved.movementId === settlement.movementId,
      ),
    )
  )
    throw new Error('Este movimiento ya está vinculado a un pendiente.');
  const amount = settlementAmount(item, settlement, movements);
  if (!validAmount(amount))
    throw new Error(
      'El movimiento debe coincidir con el tipo y la moneda del pendiente, o el abono debe ser mayor a cero.',
    );
  if (amount > pendingRemaining(item, movements))
    throw new Error('El abono excede el monto pendiente.');
  return items.map((entry) =>
    entry.id === id ? { ...entry, settlements: [...entry.settlements, settlement] } : entry,
  );
}

export function updatePendingManualSettlement(
  items: PendingItem[],
  id: string,
  settlementId: string,
  amountMinor: number,
  movements: ReadonlyMap<string, Movement>,
) {
  const item = items.find((entry) => entry.id === id);
  const settlement = item?.settlements.find((entry) => entry.id === settlementId);
  if (!item || settlement?.kind !== 'manual')
    throw new Error('Solo se pueden editar abonos manuales existentes.');
  const withoutSettlement = item.settlements.filter((entry) => entry.id !== settlementId);
  if (!validAmount(amountMinor)) throw new Error('El abono debe ser mayor a cero.');
  if (amountMinor > pendingRemaining({ ...item, settlements: withoutSettlement }, movements))
    throw new Error('El abono excede el monto pendiente.');
  return items.map((entry) =>
    entry.id === id
      ? {
          ...entry,
          settlements: entry.settlements.map((saved) =>
            saved.id === settlementId ? { ...settlement, amountMinor } : saved,
          ),
        }
      : entry,
  );
}

export function validPendingItems(value: unknown): value is PendingItem[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  const movements = new Set<string>();
  const occurrences = new Set<string>();
  try {
    for (const item of value as PendingItem[]) {
      checkPendingDraft(item);
      if (
        typeof item.id !== 'string' ||
        !item.id ||
        ids.has(item.id) ||
        !Array.isArray(item.settlements)
      )
        return false;
      ids.add(item.id);
      if (item.occurrence !== undefined) {
        const { templateId, scheduledFor } = item.occurrence;
        const key = JSON.stringify([templateId, scheduledFor]);
        if (
          typeof templateId !== 'string' ||
          !templateId ||
          !validDate(scheduledFor) ||
          occurrences.has(key)
        )
          return false;
        occurrences.add(key);
      }
      const settlementIds = new Set<string>();
      for (const settlement of item.settlements) {
        if (typeof settlement.id !== 'string' || !settlement.id || settlementIds.has(settlement.id))
          return false;
        settlementIds.add(settlement.id);
        if (settlement.kind === 'manual') {
          if (!validAmount(settlement.amountMinor)) return false;
        } else if (settlement.kind === 'movement') {
          if (
            typeof settlement.movementId !== 'string' ||
            !settlement.movementId ||
            movements.has(settlement.movementId)
          )
            return false;
          movements.add(settlement.movementId);
        } else return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
