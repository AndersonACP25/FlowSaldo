import { ApiError, createApiClient } from './apiClient';
import { readFinancialAccounts, readMovement } from './apiContracts';
import { MonthlyOverview } from './MonthlyOverview';
import { useMonthlyOverview } from './useMonthlyOverview';
import { SettingsFeature } from './SettingsFeature';
import { ConnectionsFeature } from './ConnectionsFeature';
import { MovementEditor, RefundEditor } from './MovementEditors';
import { LoanSimulatorScreen } from './LoanSimulatorScreen';
import { MonthlyClosingFeature } from './MonthlyClosingFeature';
import { DebtPlansFeature } from './DebtPlansFeature';
import { PendingPaymentsScreen } from './PendingPaymentsScreen';
import { SavingsGoalsScreen } from './SavingsGoalsScreen';
import { CashProjectionFeature } from './CashProjectionFeature';
import { localDataScope } from './dataScopes';
import { useDueNotifications } from './DueNotificationSettings';
import { notifyTransaction } from './transactionNotifications';
import { RatesScreen } from './RatesScreen';
import { localToday, PeriodPicker } from './PeriodPicker';
import { FilterRow } from './ScreenChrome';
import { testAccount } from './testAccount';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatMinorAmount,
  pendingOccurrence,
  currencies,
  type Movement,
  type Currency,
} from '@flowsaldo/domain';
import { useTheme } from './theme';
import { Button, Choice } from './ui';
import { RecurringPanel } from './RecurringPanel';
import { BudgetFeature } from './BudgetFeature';
import { useBankDirectory } from './useBankDirectory';
import { useCategoryCatalog } from './useCategoryCatalog';
import { useBudgets } from './useBudgets';
import { useRecurringTemplates } from './useRecurringTemplates';
import { MovementsFeature } from './MovementsFeature';
import { MovementForm, type Draft } from './MovementForm';
import { ImportReviewFeature } from './ImportReviewFeature';
import { useImportReviews } from './useImportReviews';
import type { AuthRoute } from './AuthScreen';
import { apiBase, type Owner, type PersonalSession } from './access';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type Preferences,
} from './preferences';
import { useLocalWorkspace } from './useLocalWorkspace';
import { usePendingPayments } from './usePendingPayments';
import { useSavingsGoals } from './useSavingsGoals';
import { useMovementFlow } from './useMovementFlow';
import { useMovementHistory } from './useMovementHistory';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';
import { WorkspaceShell } from './WorkspaceShell';
import { movementCommands } from './movementCommands';
const formatMoney = (minor: number, currency: Currency) =>
  `${currency} ${formatMinorAmount(minor)}`;
export function Workspace({
  onAuth,
  personal,
  onLogout,
  onExpired,
  onProfileChanged,
  accessNotice,
}: {
  onAuth: (route: AuthRoute) => void;
  personal?: PersonalSession;
  onLogout: () => Promise<void>;
  onExpired: () => Promise<void>;
  onProfileChanged: (owner: Owner) => void;
  accessNotice?: string;
}) {
  const { styles: s, palette } = useTheme();
  const client = useQueryClient();
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  useEffect(() => {
    void loadPreferences()
      .then((value) => {
        setPreferences(value);
        setCurrency(value.currency);
      })
      .catch(() => setError('No se pudieron cargar las preferencias locales.'));
  }, []);
  const money = (minor: number, unit: Currency) =>
    preferences.hideAmounts ? `${unit} ••••` : formatMoney(minor, unit);
  const { local, localRef, ready, loadError, persist, resetDemo } = useLocalWorkspace();
  const dueNotificationSettings = useDueNotifications(ready ? local : null);
  const [currency, setCurrency] = useState<Currency>('DOP');
  const [periodDate, setPeriodDate] = useState(localToday);
  const month = periodDate.slice(0, 7);
  const movementFlow = useMovementFlow(month);
  const { editor, refundDraft, deleteId, setDeleteId, resetFilters, closeDraft, filters } =
    movementFlow;
  const { search, type, categoryFilter, accountFilter, setAccountFilter, setCategoryFilter } =
    filters;
  const [token, setToken] = useState('');
  const [developmentSession, setSession] = useState('');
  const session = personal?.token ?? developmentSession;
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [operations, setOperations] = useState(0);
  const busy = operations > 0;
  const {
    screen,
    openScreen,
    activeTab,
    secondary,
    closing,
    showMonth,
    overviewScreen,
    settingsRoute,
    transferForSavings,
    pendingEntry,
    projectionCurrency,
    setProjectionCurrency,
    goBack,
    navigate,
    openSettings,
    openPending,
    clearPendingLink,
    openSavingsTransfer,
    openBankSettings,
  } = useWorkspaceNavigation({
    busy,
    currency,
    closeDraft,
    clearDeletion: () => setDeleteId(null),
    clearFeedback,
  });
  const [resetConfirm, setResetConfirm] = useState(false);
  let url = '';
  try {
    url = apiBase();
  } catch {
    /* Auth screen explains invalid API configuration. Demo stays available. */
  }
  const connected = !!session;
  const dataScope = localDataScope(url, connected ? (personal?.owner.id ?? 'development') : null);
  const commerceRules = local.commerceRules[dataScope] ?? [];
  const api = createApiClient({
    baseUrl: url,
    token: session,
    onUnauthorized: personal ? onExpired : undefined,
  });
  const request = api.json;
  async function movementForLink(id: string): Promise<Movement | null> {
    if (!connected)
      return localRef.current.movements.find((movement) => movement.id === id) ?? null;
    try {
      return readMovement(await request(`/movements/${encodeURIComponent(id)}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }
  const { bankDirectory, banks, changeBank } = useBankDirectory({
    dataScope,
    connected,
    enabled: !!personal && (screen === 'Mis bancos' || screen === 'Conexiones'),
    bankIds: local.bankIds,
    request,
    persist,
  });
  const accountsQuery = useQuery({
    queryKey: ['accounts', dataScope],
    enabled:
      connected &&
      (screen === 'Cuentas y conciliación' ||
        !!editor ||
        screen === 'Por revisar' ||
        screen === 'Movimientos'),
    retry: false,
    queryFn: async ({ signal }) => readFinancialAccounts(await request('/accounts', { signal })),
  });
  const { catalog, categoryCatalog, catalogReady, saveCategory, archiveCategory, deleteCategory } =
    useCategoryCatalog({
      dataScope,
      connected,
      localCategories: local.categories,
      request,
      persist,
    });
  const localCardIds = new Set(
    local.accounts.filter((account) => account.kind === 'CREDIT_CARD').map((account) => account.id),
  );
  const savings = useSavingsGoals({
    dataScope,
    active: screen === 'Metas de ahorro',
    connected,
    local,
    isLocalCardPayment,
    movementForLink,
    persist,
    saveForm,
  });
  const accounts = connected ? (accountsQuery.data ?? []) : local.accounts;
  const movementAccounts = connected
    ? accountsQuery.data
    : local.accounts.length
      ? local.accounts
      : undefined;
  const uncategorizedId = categoryCatalog.find((category) => category.system)?.id;
  const {
    query,
    closingUncategorized,
    refundQuery,
    refundInfo,
    visible,
    recent,
    refreshMovements,
    exportAll,
  } = useMovementHistory({
    connection: connected ? { scope: dataScope, request, requestText: api.text } : null,
    rows: local.movements,
    month,
    currency,
    filters: { type, search, categoryId: categoryFilter, accountId: accountFilter },
    closing: { active: closing, categoryId: uncategorizedId },
    refundSource: screen === 'Registrar devolución' ? (refundDraft?.expense ?? null) : null,
  });
  const { recurringQuery, recurring, saveRecurring, toggleRecurring, confirmRecurring } =
    useRecurringTemplates({
      dataScope,
      connected,
      notify: !!personal,
      local,
      localRef,
      request,
      persist,
      refreshMovements,
      setCurrency,
    });
  const {
    screenProps: pendingScreenProps,
    ensureRecurringPending,
    movementIds: pendingMovementIds,
    monthPending,
    relevantPendingIds,
    pendingLinksQuery,
  } = usePendingPayments({
    dataScope,
    connected,
    closing,
    active:
      screen === 'Pagos y cobros pendientes' || screen === 'Disponible hasta el próximo cobro',
    local,
    localRef,
    recurring,
    month,
    currency,
    movementForLink,
    persist,
    saveForm,
    confirmRecurring,
  });
  const {
    items: pendingItems,
    ready: pendingLinksReady,
    movements: linkedPendingMovements,
  } = pendingScreenProps;
  const commands = movementCommands({
    request: connected ? request : null,
    persist,
    refreshMovements,
  });
  const importReviews = useImportReviews({
    connected,
    dataScope,
    notify: !!personal,
    connectionsOpen: screen === 'Conexiones',
    reviewsOpen: screen === 'Por revisar',
    local,
    localRef,
    request,
    persist,
    refreshMovements,
    setNotice,
  });
  const { pending, queue, sampleId, setSampleId, sampleBody, setSampleBody } = importReviews;
  const overview = useMonthlyOverview({
    dataScope,
    connected,
    request,
    rows: local.movements,
    month,
    currency,
    periodDate,
  });
  const { totals, period, summary } = overview;
  const budgetModel = useBudgets({
    dataScope,
    connected,
    month,
    currency,
    local,
    categoryCatalog,
    period,
    remoteCategoryTotals: totals.data?.categoryTotals,
    persist,
    request,
  });
  const { serverBudget, budget, categoryBudgets, categoryTotals } = budgetModel;
  async function action(work: () => Promise<void>) {
    setError('');
    setNotice('');
    try {
      await saveForm(work);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    }
  }
  function isLocalCardPayment(movement: Movement) {
    return (
      !connected && movement.type === 'TRANSFER' && localCardIds.has(movement.targetAccountId ?? '')
    );
  }
  async function saveMovement(draft: Draft) {
    const edit = editor?.kind === 'edit' ? editor.movement : null;
    const movementId = await commands.save(draft, edit);
    if (personal && !edit && draft.type !== 'EXPENSE') {
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
  async function reset() {
    await resetDemo();
    setResetConfirm(false);
    setAccountFilter('');
    setNotice('Demo restablecida.');
  }
  function connectDevelopment() {
    client.clear();
    setCategoryFilter('');
    closeDraft();
    setSession(token);
    setToken('');
    openScreen('Inicio');
  }

  function disconnect() {
    setAccountFilter('');
    setSession('');
    setToken('');
    client.clear();
    closeDraft();
    setCategoryFilter('');
    setDeleteId(null);
    setNotice('Sesión cerrada. Volviste a la demo local.');
  }
  async function saveForm(save: () => Promise<void>) {
    setOperations((count) => count + 1);
    try {
      await save();
    } finally {
      setOperations((count) => count - 1);
    }
  }

  function clearMovementFilters() {
    resetFilters();
    clearFeedback();
  }

  function clearFeedback() {
    setNotice('');
    setError('');
  }

  async function applyPreferences(value: Preferences) {
    await savePreferences(value);
    setPreferences(value);
    setCurrency(value.currency);
    setAccountFilter('');
  }

  function editMovement(movement: Movement) {
    movementFlow.startEdit(movement);
    setNotice('');
    setError('');
    openScreen('Editar movimiento');
  }
  function duplicateMovement(movement: Movement) {
    movementFlow.startDuplicate(movement);
    setNotice('Borrador duplicado. Revisa los datos y guarda para crear el movimiento.');
  }
  function openRefund(movement: Movement) {
    movementFlow.startRefund(movement);
    setNotice('');
    setError('');
    openScreen('Registrar devolución');
  }
  const addMovement = (
    <Button
      label="+ Nuevo movimiento"
      text="+ Añadir"
      disabled={!ready || busy || !!editor || !catalogReady}
      onPress={() => {
        movementFlow.startNew();
        openScreen('Movimientos');
        setError('');
        setNotice('');
      }}
    />
  );
  return (
    <WorkspaceShell
      screen={screen}
      name={personal?.owner.name ?? testAccount.name}
      busy={busy}
      ready={ready}
      activeTab={activeTab}
      secondary={secondary}
      inSettings={!!settingsRoute}
      pending={pending}
      addMovement={addMovement}
      navigate={navigate}
      openSettings={openSettings}
      goBack={goBack}
      onLogout={onLogout}
    >
      {!!accessNotice && <Text style={s.muted}>{accessNotice}</Text>}
      {screen === 'Conexiones' && (
        <View style={s.banner}>
          <Text style={s.text}>{connected ? 'Modo conectado' : 'Modo de prueba'}</Text>
        </View>
      )}
      {!ready && !loadError && <ActivityIndicator color={palette.primary} />}
      {!!loadError && (
        <View style={s.card}>
          <Text style={s.error}>{loadError}</Text>
          <Button
            label={
              resetConfirm ? 'Confirmar borrado local y restablecer' : 'Restablecer datos locales'
            }
            onPress={() => (resetConfirm ? void action(reset) : setResetConfirm(true))}
          />
        </View>
      )}
      {ready && (
        <>
          {!!notice && (
            <Text accessibilityLiveRegion="polite" style={s.success}>
              {notice}
            </Text>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          {connected && catalog.error && (
            <View style={s.card}>
              <Text style={s.error}>No se pudieron cargar las categorías.</Text>
              <Button label="Reintentar categorías" onPress={() => void catalog.refetch()} />
            </View>
          )}
          {screen === 'Disponible hasta el próximo cobro' && (
            <CashProjectionFeature
              dataScope={dataScope}
              currency={projectionCurrency}
              onCurrency={setProjectionCurrency}
              connected={connected}
              recurringQuery={recurringQuery}
              templates={recurring}
              pending={pendingItems}
              movements={linkedPendingMovements}
              pendingLinksQuery={pendingLinksQuery}
              pendingLinksReady={pendingLinksReady}
              projections={local.cashProjections}
              saving={busy}
              money={money}
              persist={persist}
              saveForm={saveForm}
            />
          )}
          {screen === 'Pagos y cobros pendientes' && (
            <PendingPaymentsScreen
              {...pendingScreenProps}
              defaultCurrency={currency}
              link={pendingEntry.movement}
              focusId={pendingEntry.focusId}
              saving={busy}
              money={money}
              onClearLink={clearPendingLink}
            />
          )}
          {screen === 'Simulador de préstamos' && (
            <LoanSimulatorScreen defaultCurrency={currency} money={money} />
          )}
          {screen === 'Plan de pago de tarjetas y préstamos' && (
            <DebtPlansFeature
              key={dataScope}
              dataScope={dataScope}
              plans={local.debtPlans[dataScope] ?? []}
              defaultCurrency={currency}
              saving={busy}
              money={money}
              persist={persist}
              saveForm={saveForm}
            />
          )}
          {screen === 'Metas de ahorro' && (
            <SavingsGoalsScreen
              {...savings.screenProps}
              defaultCurrency={currency}
              linkedTransfer={transferForSavings}
              saving={busy}
              money={money}
            />
          )}
          {showMonth && (
            <>
              <PeriodPicker date={periodDate} onChange={setPeriodDate} />
              <FilterRow label="Filtrar por moneda">
                {currencies.map((c) => (
                  <Choice
                    key={c}
                    label={c}
                    selected={currency === c}
                    onPress={() => {
                      setCurrency(c);
                      setAccountFilter('');
                    }}
                  />
                ))}
              </FilterRow>
            </>
          )}
          {closing && (
            <MonthlyClosingFeature
              key={dataScope + month + currency}
              dataScope={dataScope}
              month={month}
              currency={currency}
              connected={connected}
              summary={summary}
              period={period}
              uncategorizedId={uncategorizedId}
              closingUncategorized={closingUncategorized}
              budget={{
                limitMinor: budget || null,
                catalog: categoryCatalog,
                limits: categoryBudgets,
                totals: categoryTotals,
              }}
              summarySources={[totals, serverBudget, catalog]}
              pending={{
                items: monthPending,
                movements: linkedPendingMovements,
                links: pendingLinksQuery,
                ready: pendingLinksReady,
                hasLinks: relevantPendingIds.length > 0,
              }}
              monthlyClosings={local.monthlyClosings[dataScope] ?? []}
              saving={busy}
              money={money}
              persist={persist}
              saveForm={saveForm}
              onMovements={() => {
                if (!uncategorizedId) return;
                closeDraft();
                resetFilters(uncategorizedId);
                openScreen('Movimientos');
              }}
              onPending={(id) =>
                openPending({ movement: null, focusId: id, origin: 'Cierre mensual' })
              }
            />
          )}
          {connected && query.isFetching && <ActivityIndicator color={palette.primary} />}
          {connected && query.error && (
            <View style={s.card}>
              <Text accessibilityRole="alert" style={s.error}>
                {query.error.message}
              </Text>
              <Button label="Reintentar" onPress={() => void refreshMovements()} />
            </View>
          )}
          {overviewScreen && (
            <MonthlyOverview
              screen={overviewScreen}
              overview={overview}
              connected={connected}
              month={month}
              currency={currency}
              pending={pending}
              onReviews={() => openScreen('Por revisar')}
              budgetModel={budgetModel}
              rows={local.movements}
              periodDate={periodDate}
              money={money}
              hideAmounts={preferences.hideAmounts}
              busy={busy}
              action={action}
            />
          )}
          {screen === 'Tasas' && <RatesScreen />}
          {screen === 'Presupuestos' && (!connected || totals.isSuccess) && (
            <BudgetFeature
              model={budgetModel}
              connected={connected}
              busy={busy}
              month={month}
              currency={currency}
              categoryCatalog={categoryCatalog}
              catalogReady={catalogReady}
              expenseMinor={summary.expenseMinor}
              money={money}
              action={action}
              setNotice={setNotice}
            />
          )}
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
              onSave={(draft) =>
                saveForm(async () => {
                  await saveRecurring(draft);
                  openScreen('Movimientos');
                  setNotice('Plantilla mensual guardada.');
                })
              }
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
              savingsTransferIds={savings.transferIds}
              deleteId={deleteId}
              onSelectDelete={setDeleteId}
              onRemove={(id) => void action(() => remove(id))}
              onEdit={editMovement}
              onDuplicate={duplicateMovement}
              onRefund={openRefund}
              onPending={(movement) =>
                openPending({ movement, focusId: null, origin: 'Movimientos' })
              }
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
                  onCreate={() => {
                    closeDraft();
                    setDeleteId(null);
                    setNotice('');
                    setError('');
                    openScreen('Nueva plantilla mensual');
                  }}
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
                  <Button
                    label="Reintentar plantillas"
                    onPress={() => void recurringQuery.refetch()}
                  />
                </View>
              )}
            </MovementsFeature>
          )}

          {settingsRoute && (
            <SettingsFeature
              screen={settingsRoute}
              onOpen={openScreen}
              personal={personal}
              onAuth={onAuth}
              onLogout={onLogout}
              onExpired={onExpired}
              onProfileChanged={onProfileChanged}
              connected={connected}
              busy={busy}
              local={local}
              dataScope={dataScope}
              persist={persist}
              saveForm={saveForm}
              onLocalRestored={clearMovementFilters}
              currency={currency}
              money={money}
              bankDirectory={bankDirectory}
              banks={banks}
              onBankChange={(id, registered) =>
                void action(async () => {
                  await changeBank(id, registered);
                  setNotice(registered ? 'Banco agregado.' : 'Banco quitado.');
                })
              }
              accountsQuery={accountsQuery}
              request={request}
              dueNotificationSettings={dueNotificationSettings}
              onRetentionApplied={importReviews.refreshImports}
              preferences={preferences}
              onSavePreferences={applyPreferences}
              commerceRules={commerceRules}
              categoryCatalog={categoryCatalog}
              catalogReady={catalogReady}
              saveCategory={saveCategory}
              archiveCategory={archiveCategory}
              deleteCategory={async (id) => {
                await deleteCategory(id);
                setCategoryFilter((current) => (current === id ? '' : current));
              }}
            />
          )}
          {screen === 'Por revisar' && (
            <ImportReviewFeature
              model={importReviews}
              connected={connected}
              accountsQuery={accountsQuery}
              movementAccounts={movementAccounts}
              categoryCatalog={categoryCatalog}
              month={month}
              currency={currency}
              money={money}
            />
          )}
          {screen === 'Conexiones' && (
            <ConnectionsFeature
              connected={connected}
              personal={!!personal}
              busy={busy}
              url={url}
              token={token}
              setToken={setToken}
              banks={banks}
              bankDirectory={bankDirectory}
              queue={queue}
              sampleId={sampleId}
              sampleBody={sampleBody}
              setSampleId={setSampleId}
              setSampleBody={setSampleBody}
              resetConfirm={resetConfirm}
              onBankSettings={() =>
                openBankSettings(connected && !personal ? 'Mi cuenta' : 'Mis bancos')
              }
              onImportErrors={() => {
                importReviews.resetFilters('FAILED');
                openScreen('Por revisar');
              }}
              onConnect={connectDevelopment}
              onDisconnect={disconnect}
              onLogout={onLogout}
              onEnqueueSample={() => void action(importReviews.enqueueSample)}
              onReset={() => (resetConfirm ? void action(reset) : setResetConfirm(true))}
              onCancelReset={() => setResetConfirm(false)}
            />
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
