import React, { type ComponentProps } from 'react';
import { Text, View } from 'react-native';
import {
  pendingOccurrence,
  type Category,
  type CommerceRule,
  type Currency,
  type PendingItem,
  type RecurringTemplate,
} from '@flowsaldo/domain';
import { MovementEditor, RefundEditor } from './MovementEditors';
import { MovementForm } from './MovementForm';
import { MovementsFeature } from './MovementsFeature';
import { RecurringPanel } from './RecurringPanel';
import { useTheme } from './theme';
import { Button } from './ui';
import type { useWorkspaceMovements } from './useWorkspaceMovements';
import type { useWorkspaceNavigation, WorkspaceScreen } from './useWorkspaceNavigation';

export function MovementRoutes({
  screen,
  model,
  connected,
  busy,
  month,
  currency,
  accounts,
  accountsQuery,
  movementAccounts,
  catalogReady,
  categoryCatalog,
  commerceRules,
  money,
  links,
  goBack,
  action,
  saveForm,
}: {
  screen: WorkspaceScreen;
  model: ReturnType<typeof useWorkspaceMovements>;
  connected: boolean;
  busy: boolean;
  month: string;
  currency: Currency;
  accounts: ComponentProps<typeof MovementsFeature>['accounts'];
  accountsQuery: ComponentProps<typeof MovementEditor>['accountsQuery'];
  movementAccounts: ComponentProps<typeof MovementEditor>['movementAccounts'];
  catalogReady: boolean;
  categoryCatalog: Category[];
  commerceRules: CommerceRule[];
  money: (minor: number, currency: Currency) => string;
  links: {
    pendingItems: PendingItem[];
    pendingMovementIds: string[];
    savingsTransferIds: string[];
    ensureRecurringPending: (template: RecurringTemplate) => Promise<string>;
    openPending: ReturnType<typeof useWorkspaceNavigation>['openPending'];
    openSavingsTransfer: ReturnType<typeof useWorkspaceNavigation>['openSavingsTransfer'];
  };
  goBack: () => void;
  action: (work: () => Promise<void>) => Promise<void>;
  saveForm: (work: () => Promise<void>) => Promise<void>;
}) {
  const { styles: s } = useTheme();
  const { editor, refundDraft, deleteId, setDeleteId, closeDraft, filters } = model.flow;
  const { query, refundQuery, refundInfo, visible, recent, refreshMovements, exportAll } =
    model.history;
  const { recurringQuery, recurring, saveRecurring, toggleRecurring, confirmRecurring } =
    model.templates;
  const {
    isLocalCardPayment,
    saveMovement,
    recordRefund,
    remove,
    editMovement,
    duplicateMovement,
    openRefund,
  } = model;
  const {
    pendingItems,
    pendingMovementIds,
    savingsTransferIds,
    ensureRecurringPending,
    openPending,
    openSavingsTransfer,
  } = links;
  return (
    <>
      {editor && (screen === 'Movimientos' || screen === 'Editar movimiento') && (
        <MovementEditor
          editor={editor}
          fullScreen={screen === 'Editar movimiento'}
          connected={connected}
          accountsQuery={accountsQuery}
          movementAccounts={movementAccounts}
          catalogReady={catalogReady}
          categoryCatalog={categoryCatalog}
          commerceRules={commerceRules}
          recent={recent}
          currency={currency}
          month={month}
          onSave={(draft) => saveForm(() => saveMovement(draft))}
          onCancel={screen === 'Editar movimiento' ? goBack : closeDraft}
        />
      )}
      {screen === 'Registrar devolución' && refundDraft && (
        <RefundEditor
          requestKey={refundDraft.requestKey}
          connected={connected}
          refundQuery={refundQuery}
          refundInfo={refundInfo}
          busy={busy}
          money={money}
          onSave={(amount, occurredAt) => saveForm(() => recordRefund(amount, occurredAt))}
        />
      )}
      {screen === 'Nueva plantilla mensual' && catalogReady && (
        <MovementForm
          title={null}
          categories={categoryCatalog}
          currency={currency}
          month={month}
          recurringDateTime
          saveLabel="Guardar plantilla mensual"
          onSave={(draft) => saveForm(() => model.saveNewTemplate(draft))}
          onCancel={goBack}
        />
      )}
      {screen === 'Movimientos' && (
        <MovementsFeature
          connected={connected}
          busy={busy}
          currency={currency}
          accounts={accounts}
          categoryCatalog={categoryCatalog}
          filters={filters}
          visible={visible}
          query={query}
          refreshMovements={refreshMovements}
          onExport={() => void action(exportAll)}
          isLocalCardPayment={isLocalCardPayment}
          money={money}
          pendingMovementIds={pendingMovementIds}
          savingsTransferIds={savingsTransferIds}
          deleteId={deleteId}
          onSelectDelete={setDeleteId}
          onRemove={(id) => void action(() => remove(id))}
          onEdit={editMovement}
          onDuplicate={duplicateMovement}
          onRefund={openRefund}
          onPending={(movement) => openPending({ movement, focusId: null, origin: 'Movimientos' })}
          onSavings={openSavingsTransfer}
        >
          {catalogReady && (!connected || recurringQuery.isSuccess) && (
            <RecurringPanel
              key={currency}
              items={recurring.filter((t) => t.currency === currency)}
              categories={categoryCatalog}
              currency={currency}
              month={month}
              onSave={(draft, id) => saveForm(() => saveRecurring(draft, id))}
              onCreate={model.newTemplate}
              onToggle={(id, active) => saveForm(() => toggleRecurring(id, active))}
              onConfirm={(template) => saveForm(() => confirmRecurring(template))}
              hasPending={(template) =>
                !!pendingOccurrence(pendingItems, template.id, template.nextDate)
              }
              onPending={(template) =>
                saveForm(async () =>
                  openPending({
                    movement: null,
                    focusId: await ensureRecurringPending(template),
                    origin: 'Movimientos',
                  }),
                )
              }
              money={money}
            />
          )}
          {connected && recurringQuery.error && (
            <View style={s.card}>
              <Text style={s.error}>No se pudieron cargar las plantillas.</Text>
              <Button label="Reintentar plantillas" onPress={() => void recurringQuery.refetch()} />
            </View>
          )}
        </MovementsFeature>
      )}
    </>
  );
}
