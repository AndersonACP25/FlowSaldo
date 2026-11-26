import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  dominicanDateTime,
  pendingOccurrence,
  pendingRemaining,
  prepareOccurrence,
  selectedCategory,
  type Currency,
  type Movement,
  type RecurringTemplate,
} from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import type { MovementRequest } from './history';
import { localMovementIndex } from './localRecords';
import type { Draft } from './MovementForm';
import type { LocalData, LocalUpdate } from './storage';
import { notifyTransaction } from './transactionNotifications';

export function useRecurringTemplates({
  dataScope,
  connected,
  notify,
  local,
  localRef,
  request,
  persist,
  refreshMovements,
  setCurrency,
}: {
  dataScope: LocalScope;
  connected: boolean;
  notify: boolean;
  local: LocalData;
  localRef: { current: LocalData };
  request: MovementRequest;
  persist: (update: LocalUpdate) => Promise<void>;
  refreshMovements: () => Promise<void>;
  setCurrency: (currency: Currency) => void;
}) {
  const confirming = useRef(new Set<string>());
  const recurringQuery = useQuery({
    queryKey: ['recurring', dataScope],
    enabled: connected,
    retry: false,
    queryFn: async (): Promise<RecurringTemplate[]> => request('/recurring'),
  });
  const recurring = connected ? (recurringQuery.data ?? []) : local.recurring;
  async function saveRecurring(draft: Draft, id?: string) {
    const data = {
      description: draft.description,
      amountMinor: draft.amountMinor,
      currency: draft.currency,
      type: draft.type,
      categoryId: draft.categoryId,
      category: draft.category,
    };
    const [startDate, timeOfDay] = dominicanDateTime(new Date(draft.occurredAt)).split('T');
    if (connected) {
      await request(id ? `/recurring/${id}` : '/recurring', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...data,
          ...(id ? {} : { startDate, timeOfDay }),
        }),
      });
      await recurringQuery.refetch();
    } else {
      await persist((current) => {
        const existing = current.recurring.find((t) => t.id === id);
        const category = selectedCategory(
          current.categories,
          draft.categoryId ?? undefined,
          draft.category,
          existing,
        );
        const item: RecurringTemplate = {
          ...data,
          ...category,
          version: existing ? existing.version + 1 : 0,
          id: id ?? `recurring-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          startDate: existing?.startDate ?? startDate,
          timeOfDay: existing ? existing.timeOfDay : timeOfDay,
          nextDate: existing?.nextDate ?? startDate,
          anchorDay: existing?.anchorDay ?? Number(startDate.slice(8)),
          active: existing?.active ?? true,
        };
        return {
          ...current,
          recurring: id
            ? current.recurring.map((t) => (t.id === id ? item : t))
            : [...current.recurring, item],
        };
      });
    }
    setCurrency(draft.currency);
  }
  async function toggleRecurring(id: string, active: boolean) {
    if (connected) {
      await request(`/recurring/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) });
      await recurringQuery.refetch();
    } else
      await persist((current) => ({
        ...current,
        recurring: current.recurring.map((t) =>
          t.id === id ? { ...t, active, version: t.version + 1 } : t,
        ),
      }));
  }
  async function confirmRecurring(
    template: RecurringTemplate,
    recordMovement = true,
    pendingId?: string,
  ) {
    if (
      connected &&
      recordMovement &&
      pendingOccurrence(
        localRef.current.pendingItems[dataScope] ?? [],
        template.id,
        template.nextDate,
      )
    )
      throw new Error('Este vencimiento se gestiona en Pagos y cobros pendientes.');
    const key = JSON.stringify([template.id, template.nextDate]);
    if (confirming.current.has(key)) throw new Error('Este vencimiento ya se está procesando.');
    confirming.current.add(key);
    try {
      if (connected) {
        const result: { movement: Movement | null } = await request(
          `/recurring/${template.id}/${recordMovement ? 'confirm' : 'close'}`,
          {
            method: 'POST',
            body: JSON.stringify({
              scheduledFor: template.nextDate,
              expectedVersion: template.version,
            }),
          },
        );
        await Promise.all([recurringQuery.refetch(), refreshMovements()]);
        if (notify && result.movement)
          void notifyTransaction(result.movement.id, 'Movimiento recurrente confirmado');
      } else {
        await persist((current) => {
          const linked = pendingOccurrence(
            current.pendingItems[dataScope] ?? [],
            template.id,
            template.nextDate,
          );
          if (recordMovement && linked)
            throw new Error('Este vencimiento se gestiona en Pagos y cobros pendientes.');
          if (
            !recordMovement &&
            (!linked ||
              linked.id !== pendingId ||
              pendingRemaining(linked, localMovementIndex(current)) !== 0)
          )
            throw new Error('El vencimiento debe estar saldado y la plantilla activa.');
          const existing = current.recurring.find((t) => t.id === template.id);
          if (!existing) throw new Error('Plantilla no encontrada.');
          if (existing.version !== template.version)
            throw new Error('La plantilla cambió. Revisa sus datos antes de confirmar.');
          const occurrence = prepareOccurrence(
            existing,
            template.nextDate,
            new Date().toISOString(),
            current.receipts,
            recordMovement,
          );
          const movement: Movement | null = recordMovement
            ? {
                ...occurrence.movement,
                ...selectedCategory(current.categories, existing.categoryId, existing.category),
                id: `occurrence-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              }
            : null;
          return {
            ...current,
            movements: movement ? [movement, ...current.movements] : current.movements,
            recurring: current.recurring.map((t) =>
              t.id === existing.id
                ? { ...t, nextDate: occurrence.nextDate, version: t.version + 1 }
                : t,
            ),
            receipts: [
              ...current.receipts,
              {
                templateId: existing.id,
                scheduledFor: template.nextDate,
                movementId: movement?.id ?? null,
              },
            ],
          };
        });
      }
    } finally {
      confirming.current.delete(key);
    }
  }

  return { recurringQuery, recurring, saveRecurring, toggleRecurring, confirmRecurring };
}
