import { useQuery } from '@tanstack/react-query';
import {
  addSavingsContribution,
  checkSavingsGoal,
  type Movement,
  type SavingsContribution,
  type SavingsGoal,
} from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import { newLocalId } from './localRecords';
import type { LocalData, LocalUpdate } from './storage';

export function useSavingsGoals({
  active,
  connected,
  dataScope,
  local,
  isLocalCardPayment,
  movementForLink,
  persist,
  saveForm,
}: {
  active: boolean;
  connected: boolean;
  dataScope: LocalScope;
  local: LocalData;
  isLocalCardPayment: (movement: Movement) => boolean;
  movementForLink: (id: string) => Promise<Movement | null>;
  persist: (update: LocalUpdate) => Promise<void>;
  saveForm: (save: () => Promise<void>) => Promise<void>;
}) {
  const savingsGoals = local.savingsGoals[dataScope] ?? [];
  const savingsTransferIds = [
    ...new Set(
      savingsGoals.flatMap((goal) =>
        goal.contributions.flatMap((item) => (item.kind === 'transfer' ? [item.movementId] : [])),
      ),
    ),
  ].sort();
  const savingsTransfersQuery = useQuery({
    queryKey: ['savings-transfers', dataScope, savingsTransferIds],
    enabled: connected && active && savingsTransferIds.length > 0,
    retry: false,
    queryFn: async () => {
      const results = await Promise.all(savingsTransferIds.map(movementForLink));
      return results.filter((movement): movement is Movement => movement !== null);
    },
  });

  function updateSavingsGoals(update: (goals: SavingsGoal[], current: LocalData) => SavingsGoal[]) {
    return persist((current) => ({
      ...current,
      savingsGoals: {
        ...current.savingsGoals,
        [dataScope]: update(current.savingsGoals[dataScope] ?? [], current),
      },
    }));
  }

  function saveSavingsGoal(
    input: Pick<SavingsGoal, 'name' | 'currency' | 'targetMinor'>,
    id?: string,
  ) {
    return saveForm(() =>
      updateSavingsGoals((goals) => {
        const goal = checkSavingsGoal(input);
        if (!id) return [...goals, { ...goal, id: newLocalId(), contributions: [] }];
        if (!goals.some((item) => item.id === id))
          throw new Error('La meta ya no está disponible.');
        return goals.map((item) =>
          item.id === id ? { ...item, name: goal.name, targetMinor: goal.targetMinor } : item,
        );
      }),
    );
  }

  function addSavings(goalId: string, item: SavingsContribution) {
    return saveForm(async () => {
      const remote =
        connected && item.kind === 'transfer' ? await movementForLink(item.movementId) : null;
      await updateSavingsGoals((goals, current) => {
        const transfer =
          !connected && item.kind === 'transfer'
            ? current.movements.find((movement) => movement.id === item.movementId)
            : remote;
        if (transfer?.balanceAdjustment)
          throw new Error('Los ajustes de conciliación no se vinculan a metas de ahorro.');
        if (
          !connected &&
          transfer?.type === 'TRANSFER' &&
          current.accounts.some(
            (account) => account.id === transfer.targetAccountId && account.kind === 'CREDIT_CARD',
          )
        )
          throw new Error('Los pagos de tarjeta no se vinculan a metas de ahorro.');
        const transfers = new Map(transfer ? [[transfer.id, transfer]] : []);
        return addSavingsContribution(goals, goalId, item, transfers);
      });
    });
  }

  function removeSavings(goalId: string, contributionId: string) {
    return saveForm(() =>
      updateSavingsGoals((goals) =>
        goals.map((goal) =>
          goal.id === goalId
            ? {
                ...goal,
                contributions: goal.contributions.filter((item) => item.id !== contributionId),
              }
            : goal,
        ),
      ),
    );
  }

  const movements = connected
    ? (savingsTransfersQuery.data ?? [])
    : active
      ? local.movements.filter(
          (movement) => !movement.balanceAdjustment && !isLocalCardPayment(movement),
        )
      : [];
  return {
    transferIds: savingsTransferIds,
    screenProps: {
      goals: savingsGoals,
      transfers: new Map(movements.map((movement) => [movement.id, movement])),
      linksPending:
        connected &&
        savingsTransferIds.length > 0 &&
        !savingsTransfersQuery.isError &&
        (!savingsTransfersQuery.isSuccess || savingsTransfersQuery.isFetching),
      linksError: connected && savingsTransferIds.length > 0 && savingsTransfersQuery.isError,
      onRetry: () => void savingsTransfersQuery.refetch(),
      onSaveGoal: saveSavingsGoal,
      onAddManual: (goalId: string, amountMinor: number) =>
        addSavings(goalId, { id: newLocalId(), kind: 'manual', amountMinor }),
      onLink: (goalId: string, movementId: string) =>
        addSavings(goalId, { id: newLocalId(), kind: 'transfer', movementId }),
      onRemove: removeSavings,
    },
  };
}
