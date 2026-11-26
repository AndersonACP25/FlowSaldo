import { SettingsFeature } from './src/SettingsFeature';
import { ConnectionsFeature } from './src/ConnectionsFeature';
import { ReportsScreen } from './src/ReportsScreen';
import { MovementEditor, RefundEditor } from './src/MovementEditors';
import { LoanSimulatorScreen } from './src/LoanSimulatorScreen';
import { MonthlyClosingFeature } from './src/MonthlyClosingFeature';
import { DebtPlansFeature } from './src/DebtPlansFeature';
import { PendingPaymentsScreen } from './src/PendingPaymentsScreen';
import { SavingsGoalsScreen } from './src/SavingsGoalsScreen';
import { CashProjectionFeature } from './src/CashProjectionFeature';
import { settingsSections, type SettingsSection } from './src/SettingsMenu';
import { localDataScope, replaceDemoData } from './src/dataScopes';
import { ThemeProvider } from './src/ThemeProvider';
import { ApkUpdateNotice } from './src/ApkUpdateNotice';
import { useDueNotifications } from './src/DueNotificationSettings';
import { notifyTransaction } from './src/transactionNotifications';
import { RatesScreen } from './src/RatesScreen';
import { localToday, PeriodPicker } from './src/PeriodPicker';
import { IconButton } from './src/IconButton';
import {
  AppHeader,
  type DrawerDestination,
  AppFrame,
  FilterRow,
  OpeningCover,
} from './src/ScreenChrome';
import { testAccount } from './src/testAccount';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  Pressable,
  BackHandler,
  Platform,
} from 'react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  formatMinorAmount,
  pendingOccurrence,
  currencies,
  changeSince,
  previousMonth,
  upgradeCategories,
  categoryName,
  categoryKey,
  movementDate,
  pendingMailMessage,
  categoryExpenses,
  monthlyReportCsv,
  demoMovements,
  dominicanBanks,
  type BankRegistration,
  filterMovements,
  summarize,
  type Category,
  type Movement,
  type Currency,
  type MovementType,
} from '@flowsaldo/domain';
import { SettingsOptionsContext, useTheme } from './src/theme';
import { Button, Choice } from './src/ui';
import { MonthlyComparison } from './src/MonthlyComparison';
import { RecurringPanel } from './src/RecurringPanel';
import { BudgetFeature } from './src/BudgetFeature';
import { useBudgets } from './src/useBudgets';
import { useRecurringTemplates } from './src/useRecurringTemplates';
import { MovementsFeature } from './src/MovementsFeature';
import { MovementForm, type Draft } from './src/MovementForm';
import { loadLocal, updateLocal, type LocalData, type LocalUpdate } from './src/storage';
import { ImportReviewFeature } from './src/ImportReviewFeature';
import { useImportReviews } from './src/useImportReviews';
import { demoReviews } from './src/reviews';
import { WeeklyFlow } from './src/WeeklyFlow';
import { AuthScreen, type AuthRoute } from './src/AuthScreen';
import { type FinancialAccount } from './src/FinancePanel';
import {
  AccessError,
  apiBase,
  accessRequest,
  type Owner,
  type PersonalSession,
} from './src/access';
import { readAccess, writeAccess, clearAccess } from './src/accessVault';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type Preferences,
} from './src/preferences';
import { exportCsvText } from './src/exportCsv';
import { usePendingPayments } from './src/usePendingPayments';
import { useSavingsGoals } from './src/useSavingsGoals';
import { newLocalId } from './src/localRecords';
import { useMovementHistory } from './src/useMovementHistory';
import { movementCommands, type RefundDraft } from './src/movementCommands';
const client = new QueryClient();
const formatMoney = (minor: number, currency: Currency) =>
  `${currency} ${formatMinorAmount(minor)}`;
const currentMonth = () => localToday().slice(0, 7);
function initialData(): LocalData {
  return {
    ...upgradeCategories(
      demoMovements.map((m) => ({ ...m, occurredAt: currentMonth() + m.occurredAt.slice(7) })),
    ),
    accounts: [],
    recurring: [],
    bankIds: [],
    receipts: [],
    categoryBudgets: {},
    cashProjections: {},
    savingsGoals: { demo: [], api: [] },
    pendingItems: {},
    debtPlans: {},
    monthlyClosings: {},
    commerceRules: {},
    budgets: {},
    reviews: demoReviews(),
  };
}
function Home({
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
  const [local, setLocal] = useState<LocalData>(initialData);
  const localRef = useRef(local);
  const [ready, setReady] = useState(false);
  const dueNotificationSettings = useDueNotifications(ready ? local : null);
  const [loadError, setLoadError] = useState('');
  const [currency, setCurrency] = useState<Currency>('DOP');
  const [periodDate, setPeriodDate] = useState(localToday);
  const month = periodDate.slice(0, 7);
  const tabs = ['Inicio', 'Movimientos', 'Por revisar', 'Conexiones'] as const;
  type Tab = (typeof tabs)[number];
  const [screen, setScreen] = useState<
    | Tab
    | 'Configuración'
    | 'Presupuestos'
    | 'Análisis'
    | 'Analíticas y reportes'
    | 'Disponible hasta el próximo cobro'
    | 'Metas de ahorro'
    | 'Pagos y cobros pendientes'
    | 'Plan de pago de tarjetas y préstamos'
    | 'Simulador de préstamos'
    | 'Cierre mensual'
    | 'Tasas'
    | 'Editar movimiento'
    | 'Registrar devolución'
    | 'Nueva plantilla mensual'
    | SettingsSection
  >('Inicio');
  const [transferForSavings, setTransferForSavings] = useState<Movement | null>(null);
  const [movementForPending, setMovementForPending] = useState<Movement | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [pendingOrigin, setPendingOrigin] = useState<'Inicio' | 'Movimientos' | 'Cierre mensual'>(
    'Inicio',
  );
  const [projectionCurrency, setProjectionCurrency] = useState<Currency>('DOP');
  const [previousTab, setPreviousTab] = useState<Tab>('Inicio');
  const secondary =
    screen !== 'Inicio' &&
    screen !== 'Movimientos' &&
    screen !== 'Por revisar' &&
    screen !== 'Conexiones';
  const closing = screen === 'Cierre mensual';
  const reports = screen === 'Analíticas y reportes';
  const showMonth =
    closing ||
    reports ||
    screen === 'Inicio' ||
    screen === 'Movimientos' ||
    screen === 'Presupuestos' ||
    screen === 'Análisis';
  const showSummary =
    reports || screen === 'Inicio' || screen === 'Presupuestos' || screen === 'Análisis';
  const settingsSection = settingsSections.find((section) => section === screen);
  const settingsRoute = screen === 'Configuración' ? screen : settingsSection;
  const inSettings = !!settingsRoute;
  const fromMovements =
    screen === 'Editar movimiento' ||
    screen === 'Registrar devolución' ||
    screen === 'Nueva plantilla mensual' ||
    (screen === 'Metas de ahorro' && !!transferForSavings) ||
    (screen === 'Pagos y cobros pendientes' && pendingOrigin === 'Movimientos');
  const activeTab = inSettings
    ? previousTab
    : fromMovements
      ? 'Movimientos'
      : secondary
        ? 'Inicio'
        : screen;
  const backTo = settingsSection
    ? 'Configuración'
    : screen === 'Configuración'
      ? previousTab
      : screen === 'Pagos y cobros pendientes'
        ? pendingOrigin
        : fromMovements
          ? 'Movimientos'
          : 'Inicio';
  const [accountFilter, setAccountFilter] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<MovementType | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [duplicate, setDuplicate] = useState<Movement | null>(null);
  const [refundDraft, setRefundDraft] = useState<RefundDraft | null>(null);
  const [editor, setEditor] = useState<Movement | 'new' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [developmentSession, setSession] = useState('');
  const session = personal?.token ?? developmentSession;
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [operations, setOperations] = useState(0);
  const busy = operations > 0;
  const goBack = useCallback(() => {
    if (busy) return;
    if (fromMovements) {
      setEditor(null);
      setDuplicate(null);
      setTransferForSavings(null);
      setRefundDraft(null);
    }
    setScreen(backTo);
  }, [backTo, busy, fromMovements]);
  useEffect(() => {
    if (Platform.OS !== 'android' || !secondary) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, secondary]);
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
  useEffect(() => {
    let active = true;
    void loadLocal()
      .then((data) => {
        if (active) {
          if (data) {
            localRef.current = data;
            setLocal(data);
          }
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            'No se pudieron leer los datos locales. No se sobrescribieron. Puedes reintentar recargando o restablecer la demo.',
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function persist(change: LocalUpdate, recoverUnreadable = false) {
    const next = await updateLocal(localRef.current, change, recoverUnreadable);
    localRef.current = next;
    setLocal(next);
  }
  async function request(path: string, options: RequestInit = {}) {
    const response = await fetch(`${url}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
    });
    if (response.status === 401 && personal) {
      await onExpired();
      throw new Error('La sesión ya no está disponible.');
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new AccessError(data?.error ?? 'No se pudo conectar con la API.', response.status);
    }
    return response.status === 204 ? null : response.json();
  }
  async function movementForLink(id: string): Promise<Movement | null> {
    if (!connected)
      return localRef.current.movements.find((movement) => movement.id === id) ?? null;
    try {
      return await request(`/movements/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error instanceof AccessError && error.status === 404) return null;
      throw error;
    }
  }
  const bankDirectory = useQuery({
    queryKey: ['banks', dataScope],
    enabled: !!personal && (screen === 'Mis bancos' || screen === 'Conexiones'),
    retry: false,
    queryFn: async (): Promise<BankRegistration[]> => request('/banks'),
  });
  const banks = connected
    ? (bankDirectory.data ?? [])
    : dominicanBanks.map((bank) => ({ ...bank, registered: local.bankIds.includes(bank.id) }));

  const accountsQuery = useQuery({
    queryKey: ['accounts', dataScope],
    enabled:
      connected &&
      (screen === 'Cuentas y conciliación' ||
        !!editor ||
        screen === 'Por revisar' ||
        screen === 'Movimientos'),
    retry: false,
    queryFn: async (): Promise<FinancialAccount[]> => request('/accounts'),
  });
  const catalog = useQuery({
    queryKey: ['categories', dataScope],
    enabled: connected,
    retry: false,
    queryFn: async (): Promise<Category[]> => request('/categories'),
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
  const categoryCatalog = connected ? (catalog.data ?? []) : local.categories;
  const catalogReady = !connected || catalog.isSuccess;
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
    totals,
    visible,
    recent,
    refreshMovements,
    exportAll,
  } = useMovementHistory({
    connection: connected ? { url, token: session, scope: dataScope, request } : null,
    rows: local.movements,
    month,
    currency,
    periodDate,
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
  const period = filterMovements(local.movements, { currency, month });
  const summary = connected
    ? (totals.data ?? { incomeMinor: 0, expenseMinor: 0, differenceMinor: 0 })
    : summarize(period, currency);
  const priorMonth = previousMonth(month);
  const priorSummary = summarize(
    filterMovements(local.movements, { currency, month: priorMonth }),
    currency,
  );
  const comparison = connected
    ? totals.data?.comparison
    : {
        previousMonth: priorMonth,
        income: changeSince(summary.incomeMinor, priorSummary.incomeMinor),
        expense: changeSince(summary.expenseMinor, priorSummary.expenseMinor),
      };
  const categories = connected ? (totals.data?.categories ?? []) : categoryExpenses(period);
  const positiveCategorySpend = categories.reduce(
    (sum, value) => sum + Math.max(0, value.amountMinor),
    0,
  );
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
  const monthlyReport = {
    ...summary,
    month,
    currency,
    budgetMinor: budget || null,
    categories,
  };
  async function saveCategory(name: string, id?: string) {
    name = categoryName(name);
    const normalizedName = categoryKey(name);
    if (connected) {
      await request(id ? `/categories/${id}` : '/categories', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify({ name }),
      });
      await catalog.refetch();
    } else {
      await persist((current) => {
        const items = current.categories;
        const existing = items.find((c) => c.id === id);
        if (existing?.system) throw new Error('Sin categorizar es una categoría del sistema.');
        if (items.some((c) => c.normalizedName === normalizedName && c.id !== id))
          throw new Error('Ya existe una categoría con ese nombre.');
        const item: Category = {
          id: id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name,
          normalizedName,
          archived: existing?.archived ?? false,
          system: false,
        };
        return {
          ...current,
          categories: id ? items.map((c) => (c.id === id ? item : c)) : [...items, item],
        };
      });
    }
  }
  async function archiveCategory(id: string, archived: boolean) {
    if (connected) {
      await request(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ archived }) });
      await catalog.refetch();
    } else {
      await persist((current) => {
        if (current.categories.find((c) => c.id === id)?.system)
          throw new Error('Sin categorizar es una categoría del sistema.');
        return {
          ...current,
          categories: current.categories.map((c) => (c.id === id ? { ...c, archived } : c)),
        };
      });
    }
  }
  async function deleteCategory(id: string) {
    if (connected) {
      await request(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await catalog.refetch();
    } else {
      await persist((data) => {
        const category = data.categories.find((item) => item.id === id);
        if (!category) throw new Error('Categoría no encontrada.');
        if (category.system) throw new Error('Sin categorizar es una categoría del sistema.');
        const used =
          data.movements.some(
            (m) => m.categoryId === id || m.splits?.some((p) => p.categoryId === id),
          ) ||
          data.recurring.some((item) => item.categoryId === id) ||
          Object.keys(data.categoryBudgets).some((key) => key.split(':').slice(3).join(':') === id);
        if (used)
          throw new Error(
            'La categoría tiene movimientos, plantillas o presupuestos. Puedes archivarla para conservar esos datos.',
          );
        return { ...data, categories: data.categories.filter((item) => item.id !== id) };
      });
    }
    setCategoryFilter((current) => (current === id ? '' : current));
  }
  async function action(work: () => Promise<void>) {
    setError('');
    setNotice('');
    try {
      await saveForm(work);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    }
  }
  async function changeBank(id: string, registered: boolean) {
    if (connected) {
      await request(`/banks/${id}`, { method: 'PATCH', body: JSON.stringify({ registered }) });
      client.setQueryData<BankRegistration[]>(['banks', dataScope], (current) =>
        current?.map((bank) => (bank.id === id ? { ...bank, registered } : bank)),
      );
      await client.invalidateQueries({ queryKey: ['banks', dataScope] });
    } else {
      await persist((current) => {
        const bankIds = new Set(current.bankIds);
        if (registered) bankIds.add(id);
        else bankIds.delete(id);
        return { ...current, bankIds: [...bankIds] };
      });
    }
    setNotice(registered ? 'Banco agregado.' : 'Banco quitado.');
  }
  function isLocalCardPayment(movement: Movement) {
    return (
      !connected && movement.type === 'TRANSFER' && localCardIds.has(movement.targetAccountId ?? '')
    );
  }
  async function saveMovement(draft: Draft) {
    const edit = editor && editor !== 'new' ? editor : null;
    const movementId = await commands.save(draft, edit);
    if (personal && !edit && draft.type !== 'EXPENSE') {
      void notifyTransaction(
        movementId,
        draft.type === 'INCOME' ? 'Ingreso registrado' : 'Transferencia o pago registrado',
      );
    }
    setDuplicate(null);
    setCategoryFilter('');
    setAccountFilter('');
    setPeriodDate(draft.occurredAt.slice(0, 10));
    setCurrency(draft.currency);
    setSearch('');
    setType('ALL');
    setEditor(null);
    setScreen('Movimientos');
    setNotice('Movimiento guardado.');
  }
  async function recordRefund(amountMinor: number, occurredAt: string) {
    if (!refundDraft) return;
    await commands.refund(refundDraft, amountMinor, occurredAt);
    setRefundDraft(null);
    setPeriodDate(occurredAt.slice(0, 10));
    setType('ALL');
    setSearch('');
    setCategoryFilter('');
    setAccountFilter('');
    setScreen('Movimientos');
    setNotice('Devolución registrada.');
  }
  async function remove(id: string) {
    await commands.remove(id);
    setDeleteId(null);
    setNotice('Movimiento eliminado.');
  }
  async function reset() {
    await persist((current) => replaceDemoData(current, initialData()), !!loadError);
    setLoadError('');
    setReady(true);
    setResetConfirm(false);
    setAccountFilter('');
    setNotice('Demo restablecida.');
  }
  function connectDevelopment() {
    client.clear();
    setCategoryFilter('');
    setDuplicate(null);
    setSession(token);
    setToken('');
    setScreen('Inicio');
  }

  function disconnect() {
    setAccountFilter('');
    setSession('');
    setToken('');
    client.clear();
    setEditor(null);
    setDuplicate(null);
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

  function openPending(
    movement: Movement | null,
    focus: string | null,
    origin: 'Inicio' | 'Movimientos' | 'Cierre mensual',
  ) {
    setMovementForPending(movement);
    setPendingFocus(focus);
    setPendingOrigin(origin);
    setDeleteId(null);
    setNotice('');
    setError('');
    setScreen('Pagos y cobros pendientes');
  }

  function clearMovementFilters() {
    setCategoryFilter('');
    setAccountFilter('');
    setSearch('');
    setType('ALL');
    setNotice('');
    setError('');
  }

  async function applyPreferences(value: Preferences) {
    await savePreferences(value);
    setPreferences(value);
    setCurrency(value.currency);
    setAccountFilter('');
  }

  function cancelMovementEditor() {
    setEditor(null);
    setDuplicate(null);
  }

  function editMovement(m: Movement) {
    setDuplicate(null);
    setEditor(m);
    setDeleteId(null);
    setNotice('');
    setError('');
    setScreen('Editar movimiento');
  }
  function duplicateMovement(m: Movement) {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDuplicate({
      ...m,
      occurredAt: movementDate(month, today) + 'T12:00:00.000Z',
    });
    setEditor('new');
    setDeleteId(null);
    setNotice('Borrador duplicado. Revisa los datos y guarda para crear el movimiento.');
  }
  function openRefund(m: Movement) {
    setRefundDraft({ expense: m, requestKey: 'refund-' + newLocalId() });
    setDeleteId(null);
    setEditor(null);
    setNotice('');
    setError('');
    setScreen('Registrar devolución');
  }
  function openSavingsTransfer(m: Movement) {
    setEditor(null);
    setDuplicate(null);
    setDeleteId(null);
    setNotice('');
    setError('');
    setTransferForSavings(m);
    setScreen('Metas de ahorro');
  }

  const addMovement = (
    <Button
      label="+ Nuevo movimiento"
      text="+ Añadir"
      disabled={!ready || busy || !!editor || !catalogReady}
      onPress={() => {
        setDuplicate(null);
        setEditor('new');
        setScreen('Movimientos');
        setError('');
        setNotice('');
      }}
    />
  );
  function navigate(destination: Tab | DrawerDestination | 'Configuración') {
    if (busy) return;
    setEditor(null);
    setTransferForSavings(null);
    setRefundDraft(null);
    setDuplicate(null);
    setDeleteId(null);
    if (destination === 'Configuración') setPreviousTab(activeTab);
    if (destination === 'Disponible hasta el próximo cobro') setProjectionCurrency(currency);
    if (destination === 'Pagos y cobros pendientes') {
      openPending(null, null, 'Inicio');
      return;
    }
    if (destination !== 'Configuración' && !tabs.some((tab) => tab === destination)) {
      setNotice('');
      setError('');
    }
    setScreen(destination);
  }

  const debtPlanScreen = screen === 'Plan de pago de tarjetas y préstamos';
  const backButton = <IconButton icon="back" label="Volver" disabled={busy} onPress={goBack} />;

  const content = (
    <View style={s.root}>
      <AppHeader
        name={personal?.owner.name ?? testAccount.name}
        disabled={busy}
        onSelect={navigate}
        onSettings={() => {
          if (!inSettings) navigate('Configuración');
        }}
        onLogout={() => {
          if (!busy) void onLogout();
        }}
      />
      <ScrollView
        key={screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        {debtPlanScreen && <View style={s.row}>{backButton}</View>}
        <View style={s.between}>
          <Text accessibilityRole="header" style={s.title}>
            {screen}
          </Text>
          {secondary && !debtPlanScreen && backButton}
          {(screen === 'Inicio' || screen === 'Movimientos') && addMovement}
        </View>
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
                link={movementForPending}
                focusId={pendingFocus}
                saving={busy}
                money={money}
                onClearLink={() => setMovementForPending(null)}
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
                  setEditor(null);
                  setDuplicate(null);
                  setSearch('');
                  setType('ALL');
                  setAccountFilter('');
                  setCategoryFilter(uncategorizedId);
                  setScreen('Movimientos');
                }}
                onPending={(id) => openPending(null, id, 'Cierre mensual')}
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
            {showSummary && connected && (totals.isPending || totals.error) && (
              <View style={s.card}>
                <Text style={s.muted}>
                  {totals.error
                    ? 'No se pudo cargar el resumen mensual.'
                    : 'Cargando resumen mensual…'}
                </Text>
                {!!totals.error && (
                  <Button label="Reintentar resumen" onPress={() => void totals.refetch()} />
                )}
              </View>
            )}
            {screen === 'Inicio' && (!connected || totals.isSuccess) && (
              <>
                <View style={s.hero}>
                  <Text style={s.heroText}>Diferencia registrada · {month}</Text>
                  <Text style={s.heroValue}>{money(summary.differenceMinor, currency)}</Text>
                  <Text style={s.heroText}>Ingresos − gastos</Text>
                </View>
                <View style={s.metrics}>
                  <View style={s.metric}>
                    <Text style={s.muted}>Ingresos</Text>
                    <Text style={s.income}>{money(summary.incomeMinor, currency)}</Text>
                  </View>
                  <View style={s.metric}>
                    <Text style={s.muted}>Gastos netos</Text>
                    <Text style={s.expense}>{money(summary.expenseMinor, currency)}</Text>
                  </View>
                  <View style={s.metric}>
                    <Text style={s.muted}>Movimientos</Text>
                    <Text style={s.amount}>{connected ? totals.data?.total : period.length}</Text>
                  </View>
                </View>
                {pending > 0 && (
                  <View style={[s.card, { borderColor: palette.amber }]}>
                    <View style={s.between}>
                      <Text style={s.text}>{pendingMailMessage(pending)}</Text>
                      <Button label="Ir a revisiones" onPress={() => setScreen('Por revisar')} />
                    </View>
                  </View>
                )}
              </>
            )}
            {screen === 'Tasas' && <RatesScreen />}
            {reports &&
              (!connected || (totals.isSuccess && serverBudget.isSuccess) ? (
                <ReportsScreen
                  report={monthlyReport}
                  count={connected ? (totals.data?.total ?? 0) : period.length}
                  comparison={comparison}
                  money={money}
                  hideAmounts={preferences.hideAmounts}
                  busy={busy || (connected && (totals.isFetching || serverBudget.isFetching))}
                  onExport={() =>
                    void action(() =>
                      exportCsvText(
                        monthlyReportCsv(monthlyReport),
                        `FlowSaldo-Reporte-${month}-${currency}.csv`,
                      ),
                    )
                  }
                />
              ) : (
                totals.isSuccess && (
                  <View style={s.card}>
                    <Text style={s.muted}>
                      {serverBudget.isError
                        ? 'No se pudo cargar el presupuesto del reporte.'
                        : 'Cargando presupuesto del reporte…'}
                    </Text>
                    {serverBudget.isError && (
                      <Button
                        label="Reintentar presupuesto"
                        onPress={() => void serverBudget.refetch()}
                      />
                    )}
                  </View>
                )
              ))}
            {screen === 'Análisis' && (!connected || totals.isSuccess) && (
              <>
                {comparison && (
                  <MonthlyComparison
                    comparison={comparison}
                    money={money}
                    currency={currency}
                    hideAmounts={preferences.hideAmounts}
                  />
                )}
                {preferences.hideAmounts ? (
                  <View style={s.card}>
                    <Text style={s.muted}>
                      Flujo semanal oculto por tu preferencia de privacidad.
                    </Text>
                  </View>
                ) : (
                  <WeeklyFlow
                    rows={local.movements}
                    end={periodDate}
                    currency={currency}
                    days={connected ? totals.data?.days : undefined}
                  />
                )}
                <View style={s.card}>
                  <Text style={s.title}>Principales categorías de gastos</Text>
                  {!categories.length && (
                    <Text style={s.muted}>Todavía no hay gastos este mes en esta moneda.</Text>
                  )}
                  {categories.slice(0, 5).map((c) => (
                    <View key={c.category} style={{ gap: 8 }}>
                      <View style={s.between}>
                        <Text style={s.text}>{c.category}</Text>
                        <Text style={s.text}>{money(c.amountMinor, currency)}</Text>
                      </View>
                      <View style={s.track}>
                        <View
                          style={[
                            s.fill,
                            {
                              width: `${positiveCategorySpend ? Math.round((Math.max(0, c.amountMinor) / positiveCategorySpend) * 100) : 0}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
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
                duplicate={duplicate}
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
                onCancel={screen === 'Editar movimiento' ? goBack : cancelMovementEditor}
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
                    setScreen('Movimientos');
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
                filters={{
                  search,
                  type,
                  accountFilter,
                  categoryFilter,
                  setSearch,
                  setType,
                  setAccountFilter,
                  setCategoryFilter,
                }}
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
                onPending={(movement) => openPending(movement, null, 'Movimientos')}
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
                      setEditor(null);
                      setDuplicate(null);
                      setDeleteId(null);
                      setNotice('');
                      setError('');
                      setScreen('Nueva plantilla mensual');
                    }}
                    onToggle={(id, active) => saveForm(() => toggleRecurring(id, active))}
                    onConfirm={(template) => saveForm(() => confirmRecurring(template))}
                    hasPending={(template) =>
                      !!pendingOccurrence(pendingItems, template.id, template.nextDate)
                    }
                    onPending={(template) =>
                      saveForm(async () =>
                        openPending(null, await ensureRecurringPending(template), 'Movimientos'),
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
                onOpen={setScreen}
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
                onBankChange={(id, registered) => void action(() => changeBank(id, registered))}
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
                deleteCategory={deleteCategory}
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
                onBankSettings={() => {
                  setPreviousTab('Conexiones');
                  setScreen(connected && !personal ? 'Mi cuenta' : 'Mis bancos');
                }}
                onImportErrors={() => {
                  importReviews.resetFilters('FAILED');
                  setScreen('Por revisar');
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
      </ScrollView>
      {ready && (
        <View style={s.nav}>
          {tabs.map((item, index) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={item}
              accessibilityState={{ selected: activeTab === item, disabled: busy }}
              disabled={busy}
              onPress={() => navigate(item)}
              style={[s.navItem, activeTab === item && s.navActive]}
            >
              <View style={s.row}>
                <Text
                  style={{
                    color: activeTab === item ? palette.primary : palette.muted,
                    fontSize: 20,
                  }}
                >
                  {['▦', '⇄', '☑', '⌘'][index]}
                </Text>
                {item === 'Por revisar' && pending > 0 && <Text style={s.badge}>{pending}</Text>}
              </View>
              <Text style={[s.navText, activeTab === item && { color: palette.income }]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
  return (
    <SettingsOptionsContext.Provider value={inSettings}>{content}</SettingsOptionsContext.Provider>
  );
}
export default function App() {
  return (
    <ThemeProvider>
      <FlowSaldo />
    </ThemeProvider>
  );
}

function FlowSaldo() {
  const { styles: s, palette } = useTheme();
  const [route, setRoute] = useState<AuthRoute | 'demo' | 'personal'>('login');
  const [personal, setPersonal] = useState<PersonalSession>();
  const [cover, setCover] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setCover(false), 700);
    return () => clearTimeout(timer);
  }, []);
  const [restoring, setRestoring] = useState(true);
  const [notice, setNotice] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  async function forget(message: string) {
    let suffix = '';
    try {
      await clearAccess();
    } catch {
      suffix = ' No se pudo limpiar la sesión guardada en este dispositivo.';
    }
    client.clear();
    setPersonal(undefined);
    setRoute('login');
    setNotice(message + suffix);
    setCanRetry(false);
  }
  async function restore() {
    setRestoring(true);
    setCanRetry(false);
    try {
      const saved = await readAccess();
      if (!saved) return;
      if (saved.apiUrl !== apiBase()) {
        await clearAccess();
        return;
      }
      try {
        const data = await accessRequest('/auth/me', undefined, saved.token);
        client.clear();
        setPersonal({ ...data, token: saved.token });
        setRoute('personal');
        setNotice('');
      } catch (error) {
        if (error instanceof Error && 'status' in error && error.status === 401)
          await forget('Tu sesión venció o se revocó. Inicia sesión nuevamente.');
        else {
          setNotice('No se pudo validar la sesión guardada. Reintenta o inicia sesión.');
          setCanRetry(true);
        }
      }
    } catch {
      setNotice('No se pudo leer la sesión guardada. Puedes iniciar sesión nuevamente.');
    } finally {
      setRestoring(false);
    }
  }
  useEffect(() => {
    void restore();
  }, []);
  async function acceptSession(value: PersonalSession) {
    let warning = '';
    try {
      await writeAccess({ apiUrl: apiBase(), token: value.token });
    } catch {
      warning =
        'La sesión solo se conservará en memoria porque no se pudo guardar de forma segura.';
    }
    client.clear();
    setPersonal(value);
    setNotice(warning);
    setRoute('personal');
    setCanRetry(false);
  }
  async function logout() {
    let message = 'Sesión cerrada.';
    try {
      if (personal) await accessRequest('/auth/logout', {}, personal.token);
    } catch {
      message =
        'Sesión cerrada en este dispositivo. No se pudo confirmar la revocación en el servidor.';
    }
    await forget(message);
  }
  function openAuth(next: AuthRoute) {
    client.clear();
    setRoute(next);
  }
  return (
    <QueryClientProvider client={client}>
      <AppFrame>
        {!cover && <ApkUpdateNotice />}
        {cover ? (
          <OpeningCover />
        ) : restoring ? (
          <View style={s.root}>
            <ActivityIndicator color={palette.primary} />
            <Text style={s.muted}>Validando sesión guardada…</Text>
          </View>
        ) : route === 'demo' || route === 'personal' ? (
          <Home
            key={personal?.sessionId ?? 'demo'}
            onAuth={openAuth}
            personal={route === 'personal' ? personal : undefined}
            onLogout={logout}
            onProfileChanged={(owner) => setPersonal((current) => current && { ...current, owner })}
            onExpired={() => forget('Tu sesión terminó. Inicia sesión nuevamente.')}
            accessNotice={notice}
          />
        ) : (
          <>
            {canRetry && (
              <Button label="Reintentar sesión guardada" onPress={() => void restore()} />
            )}
            <AuthScreen
              key={route}
              route={route}
              onRoute={setRoute}
              onTestLogin={() => {
                client.clear();
                setRoute('demo');
              }}
              onSession={acceptSession}
              onRecovered={() =>
                forget('Contraseña restablecida. Inicia sesión con la nueva contraseña.')
              }
              notice={notice}
            />
          </>
        )}
      </AppFrame>
    </QueryClientProvider>
  );
}
