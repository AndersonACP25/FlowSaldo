import type { Category, Currency, Movement } from '@flowsaldo/domain';
import type { createApiClient } from './apiClient';
import type { LocalScope } from './dataScopes';
import type { Draft } from './MovementForm';
import { movementCommands } from './movementCommands';
import type { LocalData, LocalUpdate } from './storage';
import { notifyTransaction } from './transactionNotifications';
import type { useMovementFlow } from './useMovementFlow';
import { useMovementHistory } from './useMovementHistory';
import { useRecurringTemplates } from './useRecurringTemplates';
import type { WorkspaceScreen } from './useWorkspaceNavigation';

export function useWorkspaceMovements({
  movementFlow,
  api,
  connected,
  dataScope,
  notify,
  local,
  localRef,
  persist,
  categoryCatalog,
  screen,
  closing,
  openScreen,
  month,
  currency,
  setPeriodDate,
  setCurrency,
  setNotice,
  clearFeedback,
}: {
  movementFlow: ReturnType<typeof useMovementFlow>;
  api: ReturnType<typeof createApiClient>;
  connected: boolean;
  dataScope: LocalScope;
  notify: boolean;
  local: LocalData;
  localRef: { current: LocalData };
  persist: (change: LocalUpdate) => Promise<void>;
  categoryCatalog: Category[];
  screen: WorkspaceScreen;
  closing: boolean;
  openScreen: (screen: WorkspaceScreen) => void;
  month: string;
  currency: Currency;
  setPeriodDate: (value: string) => void;
  setCurrency: (value: Currency) => void;
  setNotice: (notice: string) => void;
  clearFeedback: () => void;
}) {
  const { editor, refundDraft, setDeleteId, resetFilters, closeDraft, filters } = movementFlow;
  const { search, type, categoryFilter, accountFilter } = filters;
  const request = api.json;
  const localCardIds = new Set(
    local.accounts.filter((account) => account.kind === 'CREDIT_CARD').map((account) => account.id),
  );
  const uncategorizedId = categoryCatalog.find((category) => category.system)?.id;
  const history = useMovementHistory({
    connection: connected ? { scope: dataScope, request, requestText: api.text } : null,
    rows: local.movements,
    month,
    currency,
    filters: { type, search, categoryId: categoryFilter, accountId: accountFilter },
    closing: { active: closing, categoryId: uncategorizedId },
    refundSource: screen === 'Registrar devolución' ? (refundDraft?.expense ?? null) : null,
  });
  const templates = useRecurringTemplates({
    dataScope,
    connected,
    notify,
    local,
    localRef,
    request,
    persist,
    refreshMovements: history.refreshMovements,
    setCurrency,
  });
  const commands = movementCommands({
    request: connected ? request : null,
    persist,
    refreshMovements: history.refreshMovements,
  });
  function isLocalCardPayment(movement: Movement) {
    return (
      !connected && movement.type === 'TRANSFER' && localCardIds.has(movement.targetAccountId ?? '')
    );
  }
  async function saveMovement(draft: Draft) {
    const edit = editor?.kind === 'edit' ? editor.movement : null;
    const movementId = await commands.save(draft, edit);
    if (notify && !edit && draft.type !== 'EXPENSE') {
      void notifyTransaction(
        movementId,
        draft.type === 'INCOME' ? 'Ingreso registrado' : 'Transferencia o pago registrado',
      );
    }
    resetFilters();
    setPeriodDate(draft.occurredAt.slice(0, 10));
    setCurrency(draft.currency);
    closeDraft();
    openScreen('Movimientos');
    setNotice('Movimiento guardado.');
  }
  async function recordRefund(amountMinor: number, occurredAt: string) {
    if (!refundDraft) return;
    await commands.refund(refundDraft, amountMinor, occurredAt);
    closeDraft();
    setPeriodDate(occurredAt.slice(0, 10));
    resetFilters();
    openScreen('Movimientos');
    setNotice('Devolución registrada.');
  }
  async function remove(id: string) {
    await commands.remove(id);
    setDeleteId(null);
    setNotice('Movimiento eliminado.');
  }
  function editMovement(movement: Movement) {
    movementFlow.startEdit(movement);
    clearFeedback();
    openScreen('Editar movimiento');
  }
  function duplicateMovement(movement: Movement) {
    movementFlow.startDuplicate(movement);
    setNotice('Borrador duplicado. Revisa los datos y guarda para crear el movimiento.');
  }
  function openRefund(movement: Movement) {
    movementFlow.startRefund(movement);
    clearFeedback();
    openScreen('Registrar devolución');
  }

  function openUncategorized() {
    if (!uncategorizedId) return;
    closeDraft();
    resetFilters(uncategorizedId);
    openScreen('Movimientos');
  }

  function newMovement() {
    movementFlow.startNew();
    openScreen('Movimientos');
    clearFeedback();
  }

  function newTemplate() {
    closeDraft();
    setDeleteId(null);
    clearFeedback();
    openScreen('Nueva plantilla mensual');
  }

  async function saveNewTemplate(draft: Draft) {
    await templates.saveRecurring(draft);
    openScreen('Movimientos');
    setNotice('Plantilla mensual guardada.');
  }

  return {
    flow: movementFlow,
    history,
    templates,
    uncategorizedId,
    isLocalCardPayment,
    saveMovement,
    recordRefund,
    remove,
    editMovement,
    duplicateMovement,
    openRefund,
    openUncategorized,
    newMovement,
    newTemplate,
    saveNewTemplate,
  };
}
