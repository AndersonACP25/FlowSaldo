import {
  localMovementAccounts,
  prepareRefund,
  refusesRefundSourceChange,
  selectedCategory,
  type LocalAccount,
  type Movement,
} from '@flowsaldo/domain';
import { readMovement } from './apiContracts.ts';
import type { ApiRequest } from './apiClient';
import type { Draft } from './MovementForm';
import type { LocalUpdate } from './storage';

export interface RefundDraft {
  expense: Movement;
  requestKey: string;
}

export function checkLocalMovementAccounts(
  accounts: LocalAccount[],
  draft: Draft,
  previous?: Movement | null,
) {
  const { source, target } = localMovementAccounts(
    new Map(accounts.map((item) => [item.id, item])),
    draft,
  );
  if (
    (source?.archived && source.id !== previous?.accountId) ||
    (target?.archived && target.id !== previous?.targetAccountId)
  )
    throw new Error('Reactiva la cuenta antes de vincular un movimiento.');
}

export function movementCommands({
  request,
  persist,
  refreshMovements,
}: {
  request: ApiRequest | null;
  persist: (change: LocalUpdate) => Promise<void>;
  refreshMovements: () => Promise<void>;
}) {
  return {
    async save(draft: Draft, edit: Movement | null) {
      if (request) {
        const movement = readMovement(
          await request(edit ? `/movements/${encodeURIComponent(edit.id)}` : '/movements', {
            method: edit ? 'PATCH' : 'POST',
            body: JSON.stringify(draft),
          }),
        );
        await refreshMovements();
        return movement.id;
      }

      const id = edit?.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await persist((current) => {
        const previous = edit && current.movements.find((movement) => movement.id === edit.id);
        if (edit && !previous) throw new Error('El movimiento ya no está disponible.');
        checkLocalMovementAccounts(current.accounts, draft, previous);
        const item: Movement = {
          ...draft,
          ...selectedCategory(
            current.categories,
            draft.categoryId ?? undefined,
            draft.category,
            previous ?? undefined,
          ),
          id,
        };
        if (
          previous &&
          current.movements.some((row) => row.refundOfId === previous.id) &&
          refusesRefundSourceChange(previous, { ...item, accountId: previous.accountId })
        )
          throw new Error(
            'El gasto tiene devoluciones. Quita las devoluciones antes de cambiar sus datos financieros.',
          );
        const accountChanged = (previous?.accountId ?? null) !== (item.accountId ?? null);
        return {
          ...current,
          movements: previous
            ? current.movements.map((movement) => {
                if (movement.id === item.id) return item;
                if (accountChanged && movement.refundOfId === item.id)
                  return { ...movement, accountId: item.accountId ?? null };
                return movement;
              })
            : [item, ...current.movements],
        };
      });
      return id;
    },

    async refund({ expense, requestKey }: RefundDraft, amountMinor: number, occurredAt: string) {
      if (request) {
        await request(`/movements/${encodeURIComponent(expense.id)}/refunds`, {
          method: 'POST',
          body: JSON.stringify({ amountMinor, occurredAt, requestKey }),
        });
        await refreshMovements();
        return;
      }

      await persist((current) => {
        const saved = current.movements.find((item) => item.id === requestKey);
        if (saved) {
          if (
            saved.refundOfId === expense.id &&
            saved.amountMinor === amountMinor &&
            saved.occurredAt === occurredAt
          )
            return current;
          throw new Error('Este identificador de devolución ya se utilizó.');
        }
        const source = current.movements.find((item) => item.id === expense.id);
        if (!source) throw new Error('Gasto no encontrado.');
        const refund = {
          ...prepareRefund(source, current.movements, { amountMinor, occurredAt }),
          id: requestKey,
          accountId: source.accountId ?? null,
          description: ('Devolución: ' + source.description).slice(0, 100),
        };
        return { ...current, movements: [refund, ...current.movements] };
      });
    },

    async remove(id: string) {
      if (request) {
        await request(`/movements/${id}`, { method: 'DELETE' });
        await refreshMovements();
        return;
      }

      await persist((current) => {
        if (current.movements.some((item) => item.refundOfId === id))
          throw new Error('Elimina las devoluciones vinculadas antes de quitar el gasto.');
        return {
          ...current,
          movements: current.movements.filter((movement) => movement.id !== id),
          receipts: current.receipts.map((receipt) =>
            receipt.movementId === id ? { ...receipt, movementId: null } : receipt,
          ),
          reviews: current.reviews.map((review) =>
            review.movement?.id === id ? { ...review, movement: null } : review,
          ),
        };
      });
    },
  };
}
