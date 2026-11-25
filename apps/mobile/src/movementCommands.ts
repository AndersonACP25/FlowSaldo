import {
  localMovementAccounts,
  prepareRefund,
  refusesRefundSourceChange,
  selectedCategory,
  type LocalAccount,
  type Movement,
} from '@flowsaldo/domain';
import type { MovementRequest } from './history';
import type { Draft } from './MovementForm';
import type { LocalData } from './storage';

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
  getLocal,
  persist,
  refreshMovements,
}: {
  request: MovementRequest | null;
  getLocal: () => LocalData;
  persist: (next: LocalData) => Promise<void>;
  refreshMovements: () => Promise<void>;
}) {
  return {
    async save(draft: Draft, edit: Movement | null) {
      if (request) {
        const movement = await request<Movement>(edit ? `/movements/${edit.id}` : '/movements', {
          method: edit ? 'PATCH' : 'POST',
          body: JSON.stringify(draft),
        });
        await refreshMovements();
        return movement.id;
      }

      const current = getLocal();
      checkLocalMovementAccounts(current.accounts, draft, edit);
      const item: Movement = {
        ...draft,
        ...selectedCategory(
          current.categories,
          draft.categoryId ?? undefined,
          draft.category,
          edit ?? undefined,
        ),
        id: edit?.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      if (
        edit &&
        current.movements.some((row) => row.refundOfId === edit.id) &&
        refusesRefundSourceChange(edit, { ...item, accountId: edit.accountId })
      )
        throw new Error(
          'El gasto tiene devoluciones. Quita las devoluciones antes de cambiar sus datos financieros.',
        );
      const accountChanged = (edit?.accountId ?? null) !== (item.accountId ?? null);
      await persist({
        ...current,
        movements: edit
          ? current.movements.map((movement) => {
              if (movement.id === item.id) return item;
              if (accountChanged && movement.refundOfId === item.id)
                return { ...movement, accountId: item.accountId ?? null };
              return movement;
            })
          : [item, ...current.movements],
      });
      return item.id;
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

      const current = getLocal();
      const source = current.movements.find((item) => item.id === expense.id);
      if (!source) throw new Error('Gasto no encontrado.');
      const refund = {
        ...prepareRefund(source, current.movements, { amountMinor, occurredAt }),
        id: requestKey,
        accountId: source.accountId ?? null,
        description: ('Devolución: ' + source.description).slice(0, 100),
      };
      await persist({ ...current, movements: [refund, ...current.movements] });
    },

    async remove(id: string) {
      if (request) {
        await request(`/movements/${id}`, { method: 'DELETE' });
        await refreshMovements();
        return;
      }

      const current = getLocal();
      if (current.movements.some((item) => item.refundOfId === id))
        throw new Error('Elimina las devoluciones vinculadas antes de quitar el gasto.');
      await persist({
        ...current,
        movements: current.movements.filter((movement) => movement.id !== id),
        receipts: current.receipts.map((receipt) =>
          receipt.movementId === id ? { ...receipt, movementId: null } : receipt,
        ),
        reviews: current.reviews.map((review) =>
          review.movement?.id === id ? { ...review, movement: null } : review,
        ),
      });
    },
  };
}
