import { useQuery } from '@tanstack/react-query';
import {
  addPendingSettlement,
  checkPendingDraft,
  dominicanDateTime,
  pendingOccurrence,
  pendingRemaining,
  recurringOccurrenceAt,
  updatePendingManualSettlement,
  type Movement,
  type PendingDraft,
  type PendingItem,
  type PendingSettlement,
  type RecurringTemplate,
  type Currency,
} from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import { localMovementIndex, newLocalId } from './localRecords';
import type { LocalData, LocalUpdate } from './storage';

type SettlementInput =
  | Omit<Extract<PendingSettlement, { kind: 'manual' }>, 'id'>
  | Omit<Extract<PendingSettlement, { kind: 'movement' }>, 'id'>;

function pendingMovementIds(item: PendingItem) {
  return item.settlements.flatMap((entry) => (entry.kind === 'movement' ? [entry.movementId] : []));
}

export function usePendingPayments({
  dataScope,
  connected,
  closing,
  active,
  local,
  localRef,
  recurring,
  month,
  currency,
  movementForLink,
  persist,
  saveForm,
  confirmRecurring,
}: {
  dataScope: LocalScope;
  connected: boolean;
  closing: boolean;
  active: boolean;
  local: LocalData;
  localRef: { current: LocalData };
  recurring: RecurringTemplate[];
  month: string;
  currency: Currency;
  movementForLink: (id: string) => Promise<Movement | null>;
  persist: (update: LocalUpdate) => Promise<void>;
  saveForm: (save: () => Promise<void>) => Promise<void>;
  confirmRecurring: (
    template: RecurringTemplate,
    recordMovement: boolean,
    pendingId: string,
  ) => Promise<void>;
}) {
  const pendingItems = local.pendingItems[dataScope] ?? [];
  async function pendingLinks(ids: string[]) {
    const results = await Promise.all(ids.map(movementForLink));
    return new Map(
      results.flatMap((movement) => (movement ? [[movement.id, movement] as const] : [])),
    );
  }
  const monthPending = closing
    ? pendingItems.filter(
        (item) => item.currency === currency && item.dueAt.startsWith(month + '-'),
      )
    : [];
  const movementIds = [...new Set(pendingItems.flatMap(pendingMovementIds))].sort();
  const relevantPendingIds = closing
    ? [...new Set(monthPending.flatMap(pendingMovementIds))].sort()
    : movementIds;
  const pendingLinksQuery = useQuery({
    queryKey: ['pending-links', dataScope, relevantPendingIds],
    enabled: connected && relevantPendingIds.length > 0 && (closing || active),
    retry: false,
    queryFn: () => pendingLinks(relevantPendingIds),
  });
  const pendingLinksReady = !connected || !relevantPendingIds.length || pendingLinksQuery.isSuccess;
  const linkedPendingMovements = connected
    ? (pendingLinksQuery.data ?? new Map<string, Movement>())
    : localMovementIndex(local);

  function updatePending(update: (items: PendingItem[], current: LocalData) => PendingItem[]) {
    return persist((current) => {
      const items = current.pendingItems[dataScope] ?? [];
      const next = update(items, current);
      if (next === items) return current;
      return { ...current, pendingItems: { ...current.pendingItems, [dataScope]: next } };
    });
  }

  function savePending(input: PendingDraft) {
    return saveForm(() =>
      updatePending((items) => [
        ...items,
        { ...checkPendingDraft(input), id: newLocalId(), settlements: [] },
      ]),
    );
  }

  async function ensureRecurringPending(template: RecurringTemplate) {
    let id = newLocalId();
    await updatePending((items, current) => {
      const existing = pendingOccurrence(items, template.id, template.nextDate);
      if (existing) {
        id = existing.id;
        return items;
      }
      const latest = connected
        ? template
        : current.recurring.find((item) => item.id === template.id);
      if (
        !latest ||
        latest.nextDate !== template.nextDate ||
        !latest.active ||
        latest.type === 'TRANSFER'
      )
        throw new Error('Esta plantilla no admite pagos ni cobros pendientes.');
      return [
        ...items,
        {
          ...checkPendingDraft({
            name: latest.description,
            kind: latest.type === 'EXPENSE' ? 'pay' : 'collect',
            currency: latest.currency,
            dueAt: dominicanDateTime(
              new Date(recurringOccurrenceAt(latest.nextDate, latest.timeOfDay)),
            ),
            amountMinor: latest.amountMinor,
          }),
          id,
          occurrence: { templateId: latest.id, scheduledFor: latest.nextDate },
          settlements: [],
        },
      ];
    });
    return id;
  }

  function currentPendingTemplate(item: PendingItem) {
    return recurring.find(
      (template) =>
        template.id === item.occurrence?.templateId &&
        template.nextDate === item.occurrence.scheduledFor &&
        template.active,
    );
  }

  function canEditPending(item: PendingItem, templates = recurring) {
    return (
      !item.occurrence ||
      templates.some(
        (template) =>
          template.id === item.occurrence?.templateId &&
          template.nextDate === item.occurrence.scheduledFor,
      )
    );
  }

  async function verifiedPendingMovements(item: PendingItem, extraId?: string) {
    const ids = pendingMovementIds(item);
    if (extraId) ids.push(extraId);
    return pendingLinks([...new Set(ids)]);
  }

  const screenProps = {
    items: pendingItems,
    movements: linkedPendingMovements,
    ready: pendingLinksReady,
    linksError: pendingLinksQuery.isError,
    canClose: (item: PendingItem) => !!currentPendingTemplate(item),
    canEdit: canEditPending,
    onSave: savePending,
    onSettle: (id: string, settlement: SettlementInput) =>
      saveForm(async () => {
        const item = (localRef.current.pendingItems[dataScope] ?? []).find(
          (entry) => entry.id === id,
        );
        if (!item) throw new Error('El pendiente ya no está disponible.');
        const remote = connected
          ? await verifiedPendingMovements(
              item,
              settlement.kind === 'movement' ? settlement.movementId : undefined,
            )
          : null;
        await updatePending((items, current) => {
          if (connected && items.find((entry) => entry.id === id) !== item)
            throw new Error('El pendiente cambió. Vuelve a verificar sus abonos.');
          return addPendingSettlement(
            items,
            id,
            { ...settlement, id: newLocalId() },
            remote ?? localMovementIndex(current),
          );
        });
      }),
    onEdit: (id: string, settlementId: string, amountMinor: number) =>
      saveForm(async () => {
        const item = (localRef.current.pendingItems[dataScope] ?? []).find(
          (entry) => entry.id === id,
        );
        if (!item) throw new Error('El pendiente ya no está disponible para edición.');
        const remote = connected ? await verifiedPendingMovements(item) : null;
        await updatePending((items, current) => {
          const latest = items.find((entry) => entry.id === id);
          if (connected && latest !== item)
            throw new Error('El pendiente cambió. Vuelve a verificar sus abonos.');
          if (!latest || !canEditPending(latest, connected ? recurring : current.recurring))
            throw new Error('El pendiente ya no está disponible para edición.');
          return updatePendingManualSettlement(
            items,
            id,
            settlementId,
            amountMinor,
            remote ?? localMovementIndex(current),
          );
        });
      }),
    onRemove: (id: string, settlementId: string) =>
      saveForm(() =>
        updatePending((items) =>
          items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  settlements: item.settlements.filter((entry) => entry.id !== settlementId),
                }
              : item,
          ),
        ),
      ),
    onDelete: (id: string) =>
      saveForm(() =>
        updatePending((items, current) => {
          const item = items.find((entry) => entry.id === id);
          if (item?.settlements.length)
            throw new Error('Quita los abonos antes de eliminar el pendiente.');
          if (item && !canEditPending(item, connected ? recurring : current.recurring))
            throw new Error('El vencimiento ya se cerró.');
          return items.filter((entry) => entry.id !== id);
        }),
      ),
    onClose: (item: PendingItem) =>
      saveForm(async () => {
        const template = currentPendingTemplate(item);
        const current = (localRef.current.pendingItems[dataScope] ?? []).find(
          (entry) => entry.id === item.id,
        );
        if (
          !template ||
          !current ||
          (connected && pendingRemaining(current, await verifiedPendingMovements(current)) !== 0)
        )
          throw new Error('El vencimiento debe estar saldado y la plantilla activa.');
        await confirmRecurring(template, false, current.id);
      }),
    onRetry: () => void pendingLinksQuery.refetch(),
  };
  return {
    screenProps,
    ensureRecurringPending,
    movementIds,
    monthPending,
    relevantPendingIds,
    pendingLinksQuery,
  };
}
