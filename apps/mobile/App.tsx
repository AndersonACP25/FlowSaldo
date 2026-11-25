import { DebtPlansScreen } from './src/DebtPlansScreen';
import { PendingPaymentsScreen } from './src/PendingPaymentsScreen';
import { SavingsGoalsScreen } from './src/SavingsGoalsScreen';
import { CashProjectionScreen } from './src/CashProjectionScreen';
import { SettingsMenu, settingsSections, type SettingsSection } from './src/SettingsMenu';
import { ThemeProvider, ThemeSettings } from './src/ThemeProvider';
import { DateTimeField } from './src/DateTimeField';
import { AboutApp } from './src/AboutApp';
import { BankConnections, BankSettings } from './src/BankDirectory';
import { GmailConnection } from './src/GmailConnection';
import { ApkUpdateNotice } from './src/ApkUpdateNotice';
import { NotificationSettings } from './src/NotificationSettings';
import { notifyTransaction } from './src/transactionNotifications';
import { RatesScreen } from './src/RatesScreen';
import { localToday, PeriodPicker } from './src/PeriodPicker';
import { IconButton } from './src/IconButton';
import { BrandMark } from './src/BrandMark';
import {
  AccountActions,
  AppFrame,
  FilterChip,
  FilterRow,
  filterStyles,
  HomeOptions,
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
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useInfiniteQuery,
} from '@tanstack/react-query';
import {
  formatMinorAmount,
  addSavingsContribution,
  addPendingSettlement,
  checkPendingDraft,
  checkDebtPlan,
  type DebtPlan,
  pendingOccurrence,
  pendingRemaining,
  type PendingDraft,
  type PendingItem,
  checkSavingsGoal,
  type SavingsGoal,
  type SavingsContribution,
  currencies,
  prepareOccurrence,
  changeSince,
  previousMonth,
  upgradeCategories,
  selectedCategory,
  categoryName,
  categoryKey,
  movementDate,
  countLabel,
  pendingMailMessage,
  categoryExpenses,
  movementCategories,
  demoMovements,
  dominicanDateTime,
  parseDominicanDateTime,
  recurringOccurrenceAt,
  dominicanBanks,
  type BankRegistration,
  filterMovements,
  parseAmount,
  summarize,
  type RecurringTemplate,
  type Category,
  type Movement,
  type Currency,
  type MovementType,
} from '@flowsaldo/domain';
import { SettingsOptionsContext, useTheme } from './src/theme';
import { Button, Choice, Field } from './src/ui';
import { ImportQueue, type ImportStats } from './src/ImportQueue';
import { MonthlyComparison } from './src/MonthlyComparison';
import { RecurringPanel } from './src/RecurringPanel';
import { CategoryManager } from './src/CategoryManager';
import { CategoryBudgets, BudgetProgress } from './src/CategoryBudgets';
import { MovementForm, type Draft, typeLabels } from './src/MovementForm';
import { loadLocal, saveLocal, type LocalData } from './src/storage';
import { ReviewInbox } from './src/ReviewInbox';
import { demoReviews, type ReviewItem } from './src/reviews';
import { WeeklyFlow } from './src/WeeklyFlow';
import { AuthScreen, type AuthRoute } from './src/AuthScreen';
import { RecoverySettings } from './src/RecoverySettings';
import { FinancePanel, type FinancialAccount, type ServerBudget } from './src/FinancePanel';
import { DataRetention } from './src/DataRetention';
import { PersonalAccount } from './src/PersonalAccount';
import {
  AccessError,
  apiBase,
  accessRequest,
  type Owner,
  type PersonalSession,
} from './src/access';
import { readAccess, writeAccess, clearAccess } from './src/accessVault';
import { AccountSettings } from './src/AccountSettings';
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type Preferences,
} from './src/preferences';
import { exportCsv, exportCsvText } from './src/exportCsv';
import { movementParams, type Page, type MonthlySummary } from './src/history';
const client = new QueryClient();
const formatMoney = (minor: number, currency: Currency) =>
  `${currency} ${formatMinorAmount(minor)}`;
const currentMonth = () => localToday().slice(0, 7);
function initialData(): LocalData {
  return {
    ...upgradeCategories(
      demoMovements.map((m) => ({ ...m, occurredAt: currentMonth() + m.occurredAt.slice(7) })),
    ),
    recurring: [],
    bankIds: [],
    receipts: [],
    categoryBudgets: {},
    cashProjections: {},
    savingsGoals: { demo: [], api: [] },
    pendingItems: {},
    debtPlans: {},
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
  const confirming = useRef(new Set<string>());
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
    | 'Disponible hasta el próximo cobro'
    | 'Metas de ahorro'
    | 'Pagos y cobros pendientes'
    | 'Plan de pago de tarjetas y préstamos'
    | 'Tasas'
    | 'Editar movimiento'
    | 'Nueva plantilla mensual'
    | SettingsSection
  >('Inicio');
  const [transferForSavings, setTransferForSavings] = useState<Movement | null>(null);
  const [movementForPending, setMovementForPending] = useState<Movement | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [pendingFromMovements, setPendingFromMovements] = useState(false);
  const [projectionCurrency, setProjectionCurrency] = useState<Currency>('DOP');
  const [previousTab, setPreviousTab] = useState<Tab>('Inicio');
  const secondary =
    screen !== 'Inicio' &&
    screen !== 'Movimientos' &&
    screen !== 'Por revisar' &&
    screen !== 'Conexiones';
  const showMonth =
    screen === 'Inicio' ||
    screen === 'Movimientos' ||
    screen === 'Presupuestos' ||
    screen === 'Análisis';
  const showSummary = screen === 'Inicio' || screen === 'Presupuestos' || screen === 'Análisis';
  const settingsSection = settingsSections.some((section) => section === screen);
  const inSettings = settingsSection || screen === 'Configuración';
  const fromMovements =
    screen === 'Editar movimiento' ||
    screen === 'Nueva plantilla mensual' ||
    (screen === 'Metas de ahorro' && !!transferForSavings) ||
    (screen === 'Pagos y cobros pendientes' && pendingFromMovements);
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
      : fromMovements
        ? 'Movimientos'
        : 'Inicio';
  const [accountFilter, setAccountFilter] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<MovementType | 'ALL'>('ALL');
  const [reviewStatus, setReviewStatus] = useState<ReviewItem['status'] | 'ALL'>('REVIEW');
  const [reviewFrom, setReviewFrom] = useState('');
  const [reviewTo, setReviewTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [duplicate, setDuplicate] = useState<Movement | null>(null);
  const [editor, setEditor] = useState<Movement | 'new' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [developmentSession, setSession] = useState('');
  const session = personal?.token ?? developmentSession;
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const goBack = useCallback(() => {
    if (busy) return;
    if (fromMovements) {
      setEditor(null);
      setDuplicate(null);
      setTransferForSavings(null);
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
  const [budgetInput, setBudgetInput] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [sampleId, setSampleId] = useState('');
  const [sampleBody, setSampleBody] = useState('Aviso de prueba sin formato reconocido');
  let url = '';
  try {
    url = apiBase();
  } catch {
    /* Auth screen explains invalid API configuration. Demo stays available. */
  }
  const connected = !!session;
  const savingsMode = connected ? 'api' : 'demo';
  const savingsGoals = local.savingsGoals[savingsMode];
  const pendingScope = personal ? `owner:${personal.owner.id}` : savingsMode;
  const pendingItems = local.pendingItems[pendingScope] ?? [];
  const debtScope = connected ? JSON.stringify([url, personal?.owner.id ?? 'development']) : 'demo';
  const debtPlans = local.debtPlans[debtScope] ?? [];
  const pendingMovementIds = [
    ...new Set(
      pendingItems.flatMap((item) =>
        item.settlements.flatMap((settlement) =>
          settlement.kind === 'movement' ? [settlement.movementId] : [],
        ),
      ),
    ),
  ].sort();
  const savingsTransferIds = [
    ...new Set(
      savingsGoals.flatMap((goal) =>
        goal.contributions.flatMap((item) => (item.kind === 'transfer' ? [item.movementId] : [])),
      ),
    ),
  ].sort();
  const projectionKey = `${connected ? 'api' : 'demo'}:${projectionCurrency}` as const;
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
  async function persist(next: LocalData) {
    await saveLocal(next);
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
  const savingsTransfersQuery = useQuery({
    queryKey: ['savings-transfers', url, savingsTransferIds],
    enabled: connected && screen === 'Metas de ahorro' && savingsTransferIds.length > 0,
    retry: false,
    queryFn: async () => {
      const results = await Promise.all(savingsTransferIds.map(movementForLink));
      return results.filter((movement): movement is Movement => movement !== null);
    },
  });

  async function pendingLinks(ids: string[]) {
    const results = await Promise.all(ids.map(movementForLink));
    return new Map(
      results.flatMap((movement) => (movement ? [[movement.id, movement] as const] : [])),
    );
  }
  const pendingLinksQuery = useQuery({
    queryKey: ['pending-links', url, pendingScope, pendingMovementIds],
    enabled:
      connected &&
      pendingMovementIds.length > 0 &&
      (screen === 'Pagos y cobros pendientes' || screen === 'Disponible hasta el próximo cobro'),
    retry: false,
    queryFn: () => pendingLinks(pendingMovementIds),
  });
  const pendingLinksReady = !connected || !pendingMovementIds.length || pendingLinksQuery.isSuccess;
  const linkedPendingMovements = connected
    ? (pendingLinksQuery.data ?? new Map<string, Movement>())
    : new Map(local.movements.map((movement) => [movement.id, movement]));

  const bankDirectory = useQuery({
    queryKey: ['banks', personal?.owner.id],
    enabled: !!personal && (screen === 'Mis bancos' || screen === 'Conexiones'),
    retry: false,
    queryFn: async (): Promise<BankRegistration[]> => request('/banks'),
  });
  const banks = connected
    ? (bankDirectory.data ?? [])
    : dominicanBanks.map((bank) => ({ ...bank, registered: local.bankIds.includes(bank.id) }));

  const accountsQuery = useQuery({
    queryKey: ['accounts', connected],
    enabled:
      connected &&
      (screen === 'Cuentas y conciliación' ||
        !!editor ||
        screen === 'Por revisar' ||
        screen === 'Movimientos'),
    retry: false,
    queryFn: async (): Promise<FinancialAccount[]> => request('/accounts'),
  });
  const serverBudget = useQuery({
    queryKey: ['budgets', connected, month, currency],
    enabled: connected,
    retry: false,
    queryFn: async (): Promise<ServerBudget> =>
      request(`/budgets?month=${month}&currency=${currency}`),
  });
  const catalog = useQuery({
    queryKey: ['categories', connected],
    enabled: connected,
    retry: false,
    queryFn: async (): Promise<Category[]> => request('/categories'),
  });
  const queue = useQuery({
    queryKey: ['import-stats', connected],
    enabled: connected,
    retry: false,
    refetchInterval: connected && screen === 'Conexiones' ? 5000 : false,
    queryFn: async (): Promise<ImportStats> => request('/imports/stats'),
  });
  const recurringQuery = useQuery({
    queryKey: ['recurring', connected],
    enabled: connected,
    retry: false,
    queryFn: async (): Promise<RecurringTemplate[]> => request('/recurring'),
  });
  const recurring = connected ? (recurringQuery.data ?? []) : local.recurring;
  const categoryCatalog = connected ? (catalog.data ?? []) : local.categories;
  const catalogReady = !connected || catalog.isSuccess;
  const params =
    movementParams(month, currency, type, search, categoryFilter) +
    (connected && accountFilter ? `&accountId=${encodeURIComponent(accountFilter)}` : '');
  const query = useInfiniteQuery({
    queryKey: ['movements', connected, params],
    enabled: connected,
    retry: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<Page<Movement>> =>
      request(
        `/movements?page=true&${params}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const totals = useQuery({
    queryKey: ['summary', connected, month, currency, periodDate],
    enabled: connected,
    retry: false,
    queryFn: async (): Promise<MonthlySummary> =>
      request(`/summary?month=${month}&currency=${currency}&weekEnd=${periodDate}`),
  });
  const rangeStart = parseDominicanDateTime(reviewFrom);
  const endMinute = parseDominicanDateTime(reviewTo);
  const rangeEnd = endMinute ? new Date(endMinute.getTime() + 60_000) : null;
  const reviewParams = `${reviewStatus === 'ALL' ? '' : `&status=${reviewStatus}`}${rangeStart ? `&from=${encodeURIComponent(rangeStart.toISOString())}` : ''}${rangeEnd ? `&to=${encodeURIComponent(rangeEnd.toISOString())}` : ''}`;
  const reviewDateError =
    (reviewFrom && !rangeStart) ||
    (reviewTo && !rangeEnd) ||
    (rangeStart && rangeEnd && rangeStart >= rangeEnd);
  const imports = useInfiniteQuery({
    queryKey: ['imports', connected, reviewParams],
    enabled: connected && !reviewDateError,
    retry: false,
    refetchInterval:
      connected && (screen === 'Por revisar' || screen === 'Conexiones') ? 5000 : false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<Page<ReviewItem>> =>
      request(
        `/imports?page=true${reviewParams}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const reviews = connected
    ? (imports.data?.pages.flatMap((p) => p.items) ?? [])
    : local.reviews.filter(
        (i) =>
          (reviewStatus === 'ALL' || i.status === reviewStatus) &&
          (!rangeStart || (!!i.createdAt && Date.parse(i.createdAt) >= rangeStart.getTime())) &&
          (!rangeEnd || (!!i.createdAt && Date.parse(i.createdAt) < rangeEnd.getTime())),
      );
  const pending = connected
    ? (imports.data?.pages[0]?.pendingTotal ?? 0)
    : local.reviews.filter((i) => i.status === 'REVIEW').length;
  const period = filterMovements(local.movements, { currency, month });
  const visible = connected
    ? (query.data?.pages.flatMap((p) => p.items) ?? [])
    : filterMovements(local.movements, {
        currency,
        month,
        type,
        search,
        categoryId: categoryFilter || undefined,
      });
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
  async function refreshMovements() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['movements'] }),
      client.invalidateQueries({ queryKey: ['savings-transfers'] }),
      client.invalidateQueries({ queryKey: ['pending-links'] }),
      client.invalidateQueries({ queryKey: ['summary'] }),
      client.invalidateQueries({ queryKey: ['accounts'] }),
    ]);
  }
  async function exportAll() {
    if (!connected) {
      await exportCsv(visible, month);
      return;
    }
    const response = await fetch(`${url}/movements/export?${params}`, {
      headers: { Authorization: `Bearer ${session}` },
    });
    if (!response.ok) throw new Error('No se pudo exportar. Reintenta la descarga.');
    await exportCsvText(await response.text(), `FlowSaldo-${month}.csv`);
  }
  const budgetKey = `${connected ? 'api' : 'demo'}:${month}:${currency}`;
  const budget = connected ? (serverBudget.data?.limitMinor ?? 0) : (local.budgets[budgetKey] ?? 0);
  const categoryBudgets = connected
    ? Object.fromEntries(
        (serverBudget.data?.categoryLimits ?? []).map((c) => [c.categoryId, c.limitMinor]),
      )
    : Object.fromEntries(
        categoryCatalog
          .filter((c) => local.categoryBudgets[`${budgetKey}:${c.id}`])
          .map((c) => [c.id, local.categoryBudgets[`${budgetKey}:${c.id}`]]),
      );
  const categoryTotals = connected
    ? (totals.data?.categoryTotals ?? [])
    : categoryCatalog.map((c) => ({
        categoryId: c.id,
        amountMinor: period
          .filter((m) => m.type === 'EXPENSE')
          .flatMap(movementCategories)
          .filter((part) => part.categoryId === c.id)
          .reduce((n, part) => n + part.amountMinor, 0),
      }));
  const recent = [
    ...new Set(
      (connected
        ? (query.data?.pages.flatMap((p) => p.items) ?? [])
        : [...local.movements].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      )
        .map((m) => m.categoryId)
        .filter((id): id is string => !!id),
    ),
  ].slice(0, 5);
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
      const items = localRef.current.categories;
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
      await persist({
        ...localRef.current,
        categories: id ? items.map((c) => (c.id === id ? item : c)) : [...items, item],
      });
    }
  }
  async function archiveCategory(id: string, archived: boolean) {
    if (connected) {
      await request(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ archived }) });
      await catalog.refetch();
    } else {
      if (localRef.current.categories.find((c) => c.id === id)?.system)
        throw new Error('Sin categorizar es una categoría del sistema.');
      await persist({
        ...localRef.current,
        categories: localRef.current.categories.map((c) => (c.id === id ? { ...c, archived } : c)),
      });
    }
  }
  async function deleteCategory(id: string) {
    if (connected) {
      await request(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await catalog.refetch();
    } else {
      const data = localRef.current;
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
      await persist({ ...data, categories: data.categories.filter((item) => item.id !== id) });
    }
    setCategoryFilter((current) => (current === id ? '' : current));
  }
  async function saveServerBudget(
    limitMinor: number | null,
    categoryLimits: Array<{ categoryId: string; limitMinor: number }>,
  ) {
    if (!serverBudget.isSuccess || serverBudget.isFetching)
      throw new Error('Actualiza el presupuesto del servidor antes de guardar.');
    try {
      await request('/budgets', {
        method: 'POST',
        body: JSON.stringify({
          month,
          currency,
          expectedVersion: serverBudget.data.version,
          limitMinor,
          categoryLimits,
        }),
      });
    } catch (error) {
      await serverBudget.refetch();
      throw error;
    }
    await serverBudget.refetch();
  }
  async function saveGeneralBudget(value: number | null) {
    if (connected) {
      await saveServerBudget(value, serverBudget.data?.categoryLimits ?? []);
      return;
    }
    const budgets = { ...localRef.current.budgets };
    if (value === null) delete budgets[budgetKey];
    else budgets[budgetKey] = value;
    await persist({ ...localRef.current, budgets });
  }
  async function saveCategoryBudget(id: string, value: number | null) {
    if (value !== null && categoryCatalog.find((c) => c.id === id)?.archived)
      throw new Error('Selecciona una categoría activa.');
    if (connected) {
      const limits = (serverBudget.data?.categoryLimits ?? []).filter((c) => c.categoryId !== id);
      if (value !== null) limits.push({ categoryId: id, limitMinor: value });
      await saveServerBudget(serverBudget.data?.limitMinor ?? null, limits);
      return;
    }
    const budgets = { ...localRef.current.categoryBudgets };
    const key = `${budgetKey}:${id}`;
    if (value === null) delete budgets[key];
    else budgets[key] = value;
    await persist({ ...localRef.current, categoryBudgets: budgets });
  }
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
      const existing = localRef.current.recurring.find((t) => t.id === id);
      const category = selectedCategory(
        localRef.current.categories,
        draft.categoryId ?? undefined,
        draft.category,
        existing
          ? {
              ...existing,
              occurredAt: recurringOccurrenceAt(existing.nextDate, existing.timeOfDay),
            }
          : undefined,
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
      await persist({
        ...localRef.current,
        recurring: id
          ? localRef.current.recurring.map((t) => (t.id === id ? item : t))
          : [...localRef.current.recurring, item],
      });
    }
    setCurrency(draft.currency);
  }
  async function toggleRecurring(id: string, active: boolean) {
    if (connected) {
      await request(`/recurring/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) });
      await recurringQuery.refetch();
    } else
      await persist({
        ...localRef.current,
        recurring: localRef.current.recurring.map((t) =>
          t.id === id ? { ...t, active, version: t.version + 1 } : t,
        ),
      });
  }
  async function confirmRecurring(template: RecurringTemplate, recordMovement = true) {
    if (
      recordMovement &&
      pendingOccurrence(
        localRef.current.pendingItems[pendingScope] ?? [],
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
        if (personal && result.movement)
          void notifyTransaction(result.movement.id, 'Movimiento recurrente confirmado');
      } else {
        const existing = localRef.current.recurring.find((t) => t.id === template.id);
        if (!existing) throw new Error('Plantilla no encontrada.');
        if (existing.version !== template.version)
          throw new Error('La plantilla cambió. Revisa sus datos antes de confirmar.');
        const occurrence = prepareOccurrence(
          existing,
          template.nextDate,
          new Date().toISOString(),
          localRef.current.receipts,
          recordMovement,
        );
        const movement: Movement | null = recordMovement
          ? {
              ...occurrence.movement,
              ...selectedCategory(
                localRef.current.categories,
                existing.categoryId,
                existing.category,
              ),
              id: `occurrence-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            }
          : null;
        await persist({
          ...localRef.current,
          movements: movement
            ? [movement, ...localRef.current.movements]
            : localRef.current.movements,
          recurring: localRef.current.recurring.map((t) =>
            t.id === existing.id
              ? { ...t, nextDate: occurrence.nextDate, version: t.version + 1 }
              : t,
          ),
          receipts: [
            ...localRef.current.receipts,
            {
              templateId: existing.id,
              scheduledFor: template.nextDate,
              movementId: movement?.id ?? null,
            },
          ],
        });
      }
    } finally {
      confirming.current.delete(key);
    }
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  }
  async function changeBank(id: string, registered: boolean) {
    if (connected) {
      await request(`/banks/${id}`, { method: 'PATCH', body: JSON.stringify({ registered }) });
      client.setQueryData<BankRegistration[]>(['banks', personal?.owner.id], (current) =>
        current?.map((bank) => (bank.id === id ? { ...bank, registered } : bank)),
      );
      await client.invalidateQueries({ queryKey: ['banks', personal?.owner.id] });
    } else {
      const current = localRef.current;
      const bankIds = new Set(current.bankIds);
      if (registered) bankIds.add(id);
      else bankIds.delete(id);
      await persist({ ...current, bankIds: [...bankIds] });
    }
    setNotice(registered ? 'Banco agregado.' : 'Banco quitado.');
  }
  async function saveMovement(draft: Draft) {
    const edit = editor && editor !== 'new' ? editor : null;
    let movementId: string;
    if (connected) {
      const movement: Movement = await request(edit ? `/movements/${edit.id}` : '/movements', {
        method: edit ? 'PATCH' : 'POST',
        body: JSON.stringify(draft),
      });
      movementId = movement.id;
      await refreshMovements();
    } else {
      const item: Movement = {
        ...draft,
        ...selectedCategory(
          localRef.current.categories,
          draft.categoryId ?? undefined,
          draft.category,
          edit ?? undefined,
        ),
        id: edit?.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      movementId = item.id;
      await persist({
        ...localRef.current,
        movements: edit
          ? localRef.current.movements.map((m) => (m.id === item.id ? item : m))
          : [item, ...localRef.current.movements],
      });
    }
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
  async function remove(id: string) {
    if (connected) {
      await request(`/movements/${id}`, { method: 'DELETE' });
      await refreshMovements();
    } else
      await persist({
        ...localRef.current,
        movements: localRef.current.movements.filter((m) => m.id !== id),
        receipts: localRef.current.receipts.map((r) =>
          r.movementId === id ? { ...r, movementId: null } : r,
        ),
        reviews: localRef.current.reviews.map((r) =>
          r.movement?.id === id ? { ...r, movement: null } : r,
        ),
      });
    setDeleteId(null);
    setNotice('Movimiento eliminado.');
  }
  async function resolveReview(id: string, draft: Draft) {
    if (connected) {
      const movement: Movement = await request(`/imports/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify(draft),
      });
      await Promise.all([client.invalidateQueries({ queryKey: ['imports'] }), refreshMovements()]);
      if (personal) void notifyTransaction(movement.id, 'Transacción de aviso confirmada');
    } else {
      const review = localRef.current.reviews.find((i) => i.id === id);
      if (review?.status !== 'REVIEW') throw new Error('Este correo ya fue revisado.');
      await persist({
        ...localRef.current,
        movements: [
          {
            ...draft,
            ...selectedCategory(
              localRef.current.categories,
              draft.categoryId ?? undefined,
              draft.category,
            ),
            id: `reviewed-${id}`,
          },
          ...localRef.current.movements,
        ],
        reviews: localRef.current.reviews.map((i) =>
          i.id === id
            ? { ...i, status: 'PARSED' as const, body: '', movement: { id: `reviewed-${id}` } }
            : i,
        ),
      });
    }
    setNotice('Revisión confirmada. Movimiento registrado.');
  }
  async function retryImport(id: string) {
    await request(`/imports/${id}/retry`, { method: 'POST' });
    await Promise.all([
      client.invalidateQueries({ queryKey: ['imports'] }),
      client.invalidateQueries({ queryKey: ['import-stats'] }),
    ]);
    setNotice('Importación reencolada. Se iniciará otro ciclo limitado de intentos.');
  }
  async function discardReview(id: string) {
    if (connected) {
      await request(`/imports/${id}/dismiss`, { method: 'POST' });
      await client.invalidateQueries({ queryKey: ['imports'] });
    } else
      await persist({
        ...localRef.current,
        reviews: localRef.current.reviews.map((i) =>
          i.id === id ? { ...i, status: 'DISMISSED' as const, body: '' } : i,
        ),
      });
    setNotice('Correo descartado sin contabilizar.');
  }
  async function reset() {
    const next = initialData();
    next.cashProjections = Object.fromEntries(
      Object.entries(localRef.current.cashProjections).filter(([key]) => key.startsWith('api:')),
    );
    next.savingsGoals.api = localRef.current.savingsGoals.api;
    next.pendingItems = { ...localRef.current.pendingItems };
    delete next.pendingItems.demo;
    next.debtPlans = { ...localRef.current.debtPlans };
    delete next.debtPlans.demo;
    await persist(next);
    setLoadError('');
    setReady(true);
    setResetConfirm(false);
    setNotice('Demo restablecida.');
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
    setBusy(true);
    try {
      await save();
    } finally {
      setBusy(false);
    }
  }

  function updateSavingsGoals(update: (goals: SavingsGoal[]) => SavingsGoal[]) {
    const current = localRef.current;
    return persist({
      ...current,
      savingsGoals: {
        ...current.savingsGoals,
        [savingsMode]: update(current.savingsGoals[savingsMode]),
      },
    });
  }

  function newLocalId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
      const transfer = item.kind === 'transfer' ? await movementForLink(item.movementId) : null;
      const transfers = new Map(transfer ? [[transfer.id, transfer]] : []);
      await updateSavingsGoals((goals) => addSavingsContribution(goals, goalId, item, transfers));
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

  function openPending(movement: Movement | null, focus: string | null, fromList: boolean) {
    setMovementForPending(movement);
    setPendingFocus(focus);
    setPendingFromMovements(fromList);
    setDeleteId(null);
    setNotice('');
    setError('');
    setScreen('Pagos y cobros pendientes');
  }

  function updatePending(update: (items: PendingItem[]) => PendingItem[]) {
    const current = localRef.current;
    return persist({
      ...current,
      pendingItems: {
        ...current.pendingItems,
        [pendingScope]: update(current.pendingItems[pendingScope] ?? []),
      },
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

  async function openRecurringPending(template: RecurringTemplate) {
    const existing = pendingOccurrence(
      localRef.current.pendingItems[pendingScope] ?? [],
      template.id,
      template.nextDate,
    );
    const id = existing?.id ?? newLocalId();
    if (!existing) {
      if (!template.active || template.type === 'TRANSFER')
        throw new Error('Esta plantilla no admite pagos ni cobros pendientes.');
      const occurrence = { templateId: template.id, scheduledFor: template.nextDate };
      await updatePending((items) => [
        ...items,
        {
          ...checkPendingDraft({
            name: template.description,
            kind: template.type === 'EXPENSE' ? 'pay' : 'collect',
            currency: template.currency,
            dueAt: dominicanDateTime(
              new Date(recurringOccurrenceAt(template.nextDate, template.timeOfDay)),
            ),
            amountMinor: template.amountMinor,
          }),
          id,
          occurrence,
          settlements: [],
        },
      ]);
    }
    openPending(null, id, true);
  }

  function currentPendingTemplate(item: PendingItem) {
    return recurring.find(
      (template) =>
        template.id === item.occurrence?.templateId &&
        template.nextDate === item.occurrence.scheduledFor &&
        template.active,
    );
  }

  async function verifiedPendingMovements(item: PendingItem, extraId?: string) {
    const ids = item.settlements.flatMap((entry) =>
      entry.kind === 'movement' ? [entry.movementId] : [],
    );
    if (extraId) ids.push(extraId);
    return pendingLinks([...new Set(ids)]);
  }

  function updateDebtPlans(update: (plans: DebtPlan[]) => DebtPlan[]) {
    return saveForm(() => {
      const current = localRef.current;
      return persist({
        ...current,
        debtPlans: {
          ...current.debtPlans,
          [debtScope]: update(current.debtPlans[debtScope] ?? []),
        },
      });
    });
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
  const content = (
    <View style={s.root}>
      <ScrollView
        key={screen}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <View style={s.between}>
          <BrandMark />
          {!secondary && (
            <AccountActions
              name={personal?.owner.name ?? testAccount.name}
              onSettings={() => {
                if (busy) return;
                setPreviousTab(screen);
                setEditor(null);
                setScreen('Configuración');
              }}
              onLogout={() => void onLogout()}
            />
          )}
        </View>
        {secondary ? (
          <View style={s.between}>
            <Text accessibilityRole="header" style={s.title}>
              {screen}
            </Text>
            <Choice
              label="Volver"
              text={inSettings ? 'Volver' : '‹ Volver'}
              selected={false}
              disabled={busy}
              onPress={goBack}
            />
          </View>
        ) : screen === 'Inicio' ? (
          <HomeOptions onSelect={setScreen}>{addMovement}</HomeOptions>
        ) : (
          <View style={s.between}>
            <Text accessibilityRole="header" style={s.title}>
              {screen}
            </Text>
            {screen === 'Movimientos' && addMovement}
          </View>
        )}
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
            {screen === 'Inicio' && (
              <View style={s.row}>
                <Choice
                  label="Disponible hasta el próximo cobro"
                  selected={false}
                  disabled={busy}
                  onPress={() => {
                    setProjectionCurrency(currency);
                    setNotice('');
                    setError('');
                    setScreen('Disponible hasta el próximo cobro');
                  }}
                />
                <Choice
                  label="Pagos y cobros pendientes"
                  selected={false}
                  disabled={busy}
                  onPress={() => openPending(null, null, false)}
                />
                <Choice
                  label="Plan de pago de tarjetas y préstamos"
                  text="Plan de pago"
                  selected={false}
                  disabled={busy}
                  onPress={() => {
                    setNotice('');
                    setError('');
                    setScreen('Plan de pago de tarjetas y préstamos');
                  }}
                />
                <Choice
                  label="Metas de ahorro"
                  selected={false}
                  disabled={busy}
                  onPress={() => {
                    setTransferForSavings(null);
                    setNotice('');
                    setError('');
                    setScreen('Metas de ahorro');
                  }}
                />
              </View>
            )}
            {screen === 'Disponible hasta el próximo cobro' &&
              ((!connected || recurringQuery.isSuccess) && pendingLinksReady ? (
                <CashProjectionScreen
                  key={projectionKey}
                  currency={projectionCurrency}
                  onCurrency={setProjectionCurrency}
                  templates={recurring}
                  pending={pendingItems.map((item) => ({
                    ...item,
                    remainingMinor: pendingRemaining(item, linkedPendingMovements),
                  }))}
                  saved={local.cashProjections[projectionKey]}
                  saving={busy}
                  onSave={(plan) =>
                    saveForm(() =>
                      persist({
                        ...localRef.current,
                        cashProjections: {
                          ...localRef.current.cashProjections,
                          [projectionKey]: plan,
                        },
                      }),
                    )
                  }
                  money={money}
                />
              ) : (
                <View style={s.card}>
                  <Text style={s.muted}>
                    {recurringQuery.isError || pendingLinksQuery.isError
                      ? 'No se pudieron cargar los compromisos.'
                      : 'Cargando compromisos…'}
                  </Text>
                  {(recurringQuery.isError || pendingLinksQuery.isError) && (
                    <Button
                      label="Reintentar compromisos"
                      onPress={() => {
                        if (recurringQuery.isError) void recurringQuery.refetch();
                        if (pendingLinksQuery.isError) void pendingLinksQuery.refetch();
                      }}
                    />
                  )}
                </View>
              ))}
            {screen === 'Pagos y cobros pendientes' && (
              <PendingPaymentsScreen
                items={pendingItems}
                defaultCurrency={currency}
                movements={linkedPendingMovements}
                link={movementForPending}
                focusId={pendingFocus}
                ready={pendingLinksReady}
                linksError={pendingLinksQuery.isError}
                saving={busy}
                money={money}
                canClose={(item) => !!currentPendingTemplate(item)}
                onSave={savePending}
                onSettle={(id, settlement) =>
                  saveForm(async () => {
                    const item = (localRef.current.pendingItems[pendingScope] ?? []).find(
                      (entry) => entry.id === id,
                    );
                    if (!item) throw new Error('El pendiente ya no está disponible.');
                    const movements = await verifiedPendingMovements(
                      item,
                      settlement.kind === 'movement' ? settlement.movementId : undefined,
                    );
                    await updatePending((items) =>
                      addPendingSettlement(
                        items,
                        id,
                        { ...settlement, id: newLocalId() },
                        movements,
                      ),
                    );
                  })
                }
                onRemove={(id, settlementId) =>
                  saveForm(() =>
                    updatePending((items) =>
                      items.map((item) =>
                        item.id === id
                          ? {
                              ...item,
                              settlements: item.settlements.filter(
                                (entry) => entry.id !== settlementId,
                              ),
                            }
                          : item,
                      ),
                    ),
                  )
                }
                onDelete={(id) =>
                  saveForm(() =>
                    updatePending((items) => {
                      const item = items.find((entry) => entry.id === id);
                      if (item?.settlements.length)
                        throw new Error('Quita los abonos antes de eliminar el pendiente.');
                      if (
                        item?.occurrence &&
                        !recurring.some(
                          (template) =>
                            template.id === item.occurrence?.templateId &&
                            template.nextDate === item.occurrence.scheduledFor,
                        )
                      )
                        throw new Error('El vencimiento ya se cerró.');
                      return items.filter((entry) => entry.id !== id);
                    }),
                  )
                }
                onClose={(item) =>
                  saveForm(async () => {
                    const template = currentPendingTemplate(item);
                    const current = (localRef.current.pendingItems[pendingScope] ?? []).find(
                      (entry) => entry.id === item.id,
                    );
                    if (
                      !template ||
                      !current ||
                      pendingRemaining(current, await verifiedPendingMovements(current)) !== 0
                    )
                      throw new Error('El vencimiento debe estar saldado y la plantilla activa.');
                    await confirmRecurring(template, false);
                  })
                }
                onRetry={() => void pendingLinksQuery.refetch()}
                onClearLink={() => setMovementForPending(null)}
              />
            )}
            {screen === 'Plan de pago de tarjetas y préstamos' && (
              <DebtPlansScreen
                key={debtScope}
                plans={debtPlans}
                defaultCurrency={currency}
                saving={busy}
                money={money}
                onSave={async (input, id) => {
                  const plan = { ...checkDebtPlan(input), id: id ?? newLocalId() };
                  await updateDebtPlans((items) => {
                    if (!id) return [...items, plan];
                    if (!items.some((item) => item.id === id))
                      throw new Error('El plan de pago ya no está disponible.');
                    return items.map((item) => (item.id === id ? plan : item));
                  });
                  return plan.id;
                }}
                onRemove={(id) =>
                  updateDebtPlans((items) => items.filter((item) => item.id !== id))
                }
              />
            )}
            {screen === 'Metas de ahorro' && (
              <SavingsGoalsScreen
                goals={savingsGoals}
                defaultCurrency={currency}
                linkedTransfer={transferForSavings}
                transfers={
                  new Map(
                    (connected ? (savingsTransfersQuery.data ?? []) : local.movements).map(
                      (movement) => [movement.id, movement],
                    ),
                  )
                }
                linksPending={
                  connected &&
                  savingsTransferIds.length > 0 &&
                  !savingsTransfersQuery.isError &&
                  (!savingsTransfersQuery.isSuccess || savingsTransfersQuery.isFetching)
                }
                linksError={
                  connected && savingsTransferIds.length > 0 && savingsTransfersQuery.isError
                }
                onRetry={() => void savingsTransfersQuery.refetch()}
                saving={busy}
                onSaveGoal={saveSavingsGoal}
                onAddManual={(goalId, amountMinor) =>
                  addSavings(goalId, { id: newLocalId(), kind: 'manual', amountMinor })
                }
                onLink={(goalId, movementId) =>
                  addSavings(goalId, { id: newLocalId(), kind: 'transfer', movementId })
                }
                onRemove={removeSavings}
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
                    <Text style={s.muted}>Gastos</Text>
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
            {(screen === 'Tasas' || screen === 'Tasa del día') && <RatesScreen />}
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
                              width: `${Math.round((c.amountMinor / summary.expenseMinor) * 100)}%`,
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
              <>
                <View style={s.card}>
                  <Text style={s.title}>Tu presupuesto mensual</Text>
                  <Text style={s.muted}>
                    Límite de gastos para {month} en {currency}.{' '}
                    {connected
                      ? 'Guardado en el servidor de esta cuenta personal.'
                      : 'Guardado en este dispositivo para la demo.'}
                  </Text>
                  {budget > 0 && (
                    <BudgetProgress
                      spent={summary.expenseMinor}
                      limit={budget}
                      money={money}
                      currency={currency}
                    />
                  )}
                  <Field
                    label="Nuevo límite mensual"
                    value={budgetInput}
                    onChangeText={setBudgetInput}
                    keyboardType="decimal-pad"
                    placeholder="Ejemplo: 20000"
                  />
                  <View style={s.row}>
                    <Button
                      label="Guardar presupuesto"
                      disabled={
                        busy || (connected && (!serverBudget.isSuccess || serverBudget.isFetching))
                      }
                      onPress={() =>
                        void action(async () => {
                          const value = parseAmount(budgetInput);
                          await saveGeneralBudget(value);
                          setBudgetInput('');
                          setNotice('Presupuesto guardado.');
                        })
                      }
                    />
                    {budget > 0 && (
                      <Button
                        label="Quitar límite"
                        disabled={busy}
                        onPress={() =>
                          void action(async () => {
                            await saveGeneralBudget(null);
                            setNotice('Límite mensual eliminado.');
                          })
                        }
                      />
                    )}
                  </View>
                </View>
                {connected && (
                  <View style={s.card}>
                    <Text style={s.muted}>
                      {serverBudget.isFetching
                        ? 'Actualizando presupuestos…'
                        : serverBudget.error
                          ? 'No se pudo cargar el presupuesto.'
                          : 'Presupuestos sincronizados con el servidor. Los cambios de otro dispositivo se consultan al actualizar.'}
                    </Text>
                    <Button
                      label="Actualizar presupuestos"
                      onPress={() => void serverBudget.refetch()}
                    />
                    {serverBudget.data?.version === 0 &&
                      (!!local.budgets[budgetKey] ||
                        categoryCatalog.some(
                          (c) => !!local.categoryBudgets[`${budgetKey}:${c.id}`],
                        )) && (
                        <>
                          <Text style={s.muted}>
                            Hay límites antiguos guardados en este dispositivo. Puedes copiar el
                            límite general y los límites de categorías activas al período vacío del
                            servidor; los locales se conservan como respaldo.
                          </Text>
                          <Button
                            label="Copiar presupuestos locales al servidor"
                            disabled={busy || serverBudget.isFetching}
                            onPress={() =>
                              void action(async () => {
                                await saveServerBudget(
                                  local.budgets[budgetKey] ?? null,
                                  categoryCatalog
                                    .filter(
                                      (c) =>
                                        !c.archived &&
                                        local.categoryBudgets[`${budgetKey}:${c.id}`],
                                    )
                                    .map((c) => ({
                                      categoryId: c.id,
                                      limitMinor: local.categoryBudgets[`${budgetKey}:${c.id}`],
                                    })),
                                );
                                setNotice('Presupuestos locales copiados al servidor.');
                              })
                            }
                          />
                        </>
                      )}
                  </View>
                )}
                {catalogReady && (!connected || serverBudget.isSuccess) && (
                  <CategoryBudgets
                    synced={connected}
                    disabled={connected && serverBudget.isFetching}
                    key={budgetKey}
                    items={categoryCatalog}
                    budgets={categoryBudgets}
                    expenses={categoryTotals}
                    onSave={saveCategoryBudget}
                    money={money}
                    currency={currency}
                  />
                )}
              </>
            )}
            {editor && (screen === 'Movimientos' || screen === 'Editar movimiento') && (
              <>
                {connected && !accountsQuery.isSuccess && (
                  <View style={s.card}>
                    <Text style={s.muted}>
                      {accountsQuery.error
                        ? 'No se pudieron cargar las cuentas.'
                        : 'Cargando cuentas…'}
                    </Text>
                    {accountsQuery.error && (
                      <Button
                        label="Reintentar cuentas"
                        onPress={() => void accountsQuery.refetch()}
                      />
                    )}
                  </View>
                )}
                {catalogReady && (!connected || accountsQuery.isSuccess) && (
                  <MovementForm
                    allowSplits
                    accounts={connected ? accountsQuery.data : undefined}
                    categories={categoryCatalog}
                    recent={recent}
                    editing={editor !== 'new'}
                    title={
                      screen === 'Editar movimiento'
                        ? null
                        : duplicate
                          ? 'Duplicar movimiento'
                          : undefined
                    }
                    key={editor === 'new' ? 'new-' + (duplicate?.id ?? '') : editor.id}
                    movement={editor === 'new' ? (duplicate ?? undefined) : editor}
                    currency={currency}
                    month={month}
                    onSave={(draft) => saveForm(() => saveMovement(draft))}
                    onCancel={
                      screen === 'Editar movimiento'
                        ? goBack
                        : () => {
                            setEditor(null);
                            setDuplicate(null);
                          }
                    }
                  />
                )}
              </>
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
              <>
                <Field
                  label="Buscar descripción o categoría"
                  value={search}
                  onChangeText={setSearch}
                  maxLength={100}
                  placeholder="Supermercado, transporte…"
                />
                <FilterRow label="Filtrar por tipo">
                  <Choice label="Todos" selected={type === 'ALL'} onPress={() => setType('ALL')} />
                  {(['INCOME', 'EXPENSE', 'TRANSFER'] as const).map((t) => (
                    <Choice
                      key={t}
                      label={typeLabels[t]}
                      selected={type === t}
                      onPress={() => setType(t)}
                    />
                  ))}
                </FilterRow>
                {connected && (
                  <FilterRow label="Filtrar por cuenta">
                    <Choice
                      label="Todas las cuentas"
                      text="Todas"
                      selected={!accountFilter}
                      onPress={() => setAccountFilter('')}
                    />
                    {(accountsQuery.data ?? [])
                      .filter((a) => a.currency === currency)
                      .map((a) => (
                        <Choice
                          key={a.id}
                          label={`Filtrar cuenta: ${a.name}`}
                          text={a.name + (a.archived ? ' · Archivada' : '')}
                          selected={accountFilter === a.id}
                          onPress={() => setAccountFilter(a.id)}
                        />
                      ))}
                  </FilterRow>
                )}
                <View style={s.card}>
                  <Text style={s.title}>Categorías</Text>
                  <FilterRow label="Filtrar por categoría">
                    <FilterChip
                      label="Todas las categorías"
                      text="Todas"
                      selected={!categoryFilter}
                      onPress={() => setCategoryFilter('')}
                    />
                    {categoryCatalog.map((c) => (
                      <FilterChip
                        key={c.id}
                        label={`Filtrar: ${c.name}`}
                        text={c.name + (c.archived ? ' · Archivada' : '')}
                        selected={categoryFilter === c.id}
                        onPress={() => setCategoryFilter(c.id)}
                      />
                    ))}
                  </FilterRow>
                </View>
                <View style={s.between}>
                  <Text style={s.title}>
                    {countLabel(
                      connected ? (query.data?.pages[0]?.total ?? 0) : visible.length,
                      'movimiento',
                      'movimientos',
                    )}
                  </Text>
                  <View style={s.row}>
                    {connected && (
                      <Button label="Actualizar" onPress={() => void refreshMovements()} />
                    )}
                    <Button
                      label="Exportar CSV"
                      text="CSV"
                      disabled={!visible.length || busy}
                      onPress={() => void action(exportAll)}
                    />
                  </View>
                </View>
                {!visible.length && (!connected || query.isSuccess) && (
                  <View style={s.card}>
                    <Text style={s.title}>No hay movimientos con estos filtros</Text>
                  </View>
                )}
                {visible.map((m) => (
                  <View key={m.id} style={s.card}>
                    <View style={s.between}>
                      <View>
                        <Text style={s.text}>{m.description}</Text>
                        <Text style={s.muted}>
                          {m.splits?.length
                            ? countLabel(m.splits.length, 'categoría', 'categorías')
                            : m.category}{' '}
                          · {m.occurredAt.slice(0, 10)} · {typeLabels[m.type]}
                        </Text>
                      </View>
                      <Text
                        style={
                          m.type === 'INCOME'
                            ? s.income
                            : m.type === 'EXPENSE'
                              ? s.expense
                              : s.amount
                        }
                      >
                        {m.type === 'EXPENSE' ? '−' : m.type === 'INCOME' ? '+' : '↔'}{' '}
                        {money(m.amountMinor, m.currency)}
                      </Text>
                    </View>
                    {!!m.accountId && (
                      <Text style={s.muted}>
                        Cuenta:{' '}
                        {accountsQuery.data?.find((a) => a.id === m.accountId)?.name ?? 'Asignada'}
                        {m.targetAccountId
                          ? ` → ${accountsQuery.data?.find((a) => a.id === m.targetAccountId)?.name ?? 'Destino asignado'}`
                          : ''}
                      </Text>
                    )}
                    <View style={s.row}>
                      <IconButton
                        icon="edit"
                        label={`Editar ${m.description}`}
                        onPress={() => {
                          setDuplicate(null);
                          setEditor(m);
                          setDeleteId(null);
                          setNotice('');
                          setError('');
                          setScreen('Editar movimiento');
                        }}
                      />
                      <IconButton
                        icon="copy"
                        label={`Duplicar ${m.description}`}
                        onPress={() => {
                          const d = new Date();
                          const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                          setDuplicate({
                            ...m,
                            occurredAt: movementDate(month, today) + 'T12:00:00.000Z',
                          });
                          setEditor('new');
                          setDeleteId(null);
                          setNotice(
                            'Borrador duplicado. Revisa los datos y guarda para crear el movimiento.',
                          );
                        }}
                      />
                      <IconButton
                        icon="trash"
                        label="Eliminar"
                        danger
                        onPress={() => setDeleteId(m.id)}
                      />
                      {m.type !== 'TRANSFER' && (
                        <Choice
                          label={`Vincular a pendiente: ${m.description}`}
                          text={
                            pendingMovementIds.includes(m.id)
                              ? 'Ver vínculo'
                              : 'Vincular a pendiente'
                          }
                          selected={false}
                          disabled={busy}
                          onPress={() => openPending(m, null, true)}
                        />
                      )}
                      {m.type === 'TRANSFER' && (
                        <Choice
                          label={`Vincular a meta: ${m.description}`}
                          text={
                            savingsTransferIds.includes(m.id) ? 'Ver aporte' : 'Vincular a meta'
                          }
                          selected={false}
                          disabled={busy}
                          onPress={() => {
                            setEditor(null);
                            setDuplicate(null);
                            setDeleteId(null);
                            setNotice('');
                            setError('');
                            setTransferForSavings(m);
                            setScreen('Metas de ahorro');
                          }}
                        />
                      )}
                    </View>
                    {deleteId === m.id && (
                      <>
                        <Text style={s.error}>
                          ¿Eliminar este movimiento? Esta acción no se puede deshacer.
                        </Text>
                        <View style={s.row}>
                          <Button
                            label="Confirmar eliminación"
                            disabled={busy}
                            onPress={() => void action(() => remove(m.id))}
                          />
                          <Button
                            label="Cancelar eliminación"
                            disabled={busy}
                            onPress={() => setDeleteId(null)}
                          />
                        </View>
                      </>
                    )}
                  </View>
                ))}
              </>
            )}
            {screen === 'Movimientos' &&
              catalogReady &&
              (!connected || recurringQuery.isSuccess) && (
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
                  onPending={(template) => saveForm(() => openRecurringPending(template))}
                  money={money}
                />
              )}
            {screen === 'Movimientos' && connected && recurringQuery.error && (
              <View style={s.card}>
                <Text style={s.error}>No se pudieron cargar las plantillas.</Text>
                <Button
                  label="Reintentar plantillas"
                  onPress={() => void recurringQuery.refetch()}
                />
              </View>
            )}
            {screen === 'Movimientos' && connected && query.hasNextPage && (
              <Button
                label={
                  query.isFetchingNextPage ? 'Cargando movimientos…' : 'Cargar más movimientos'
                }
                disabled={query.isFetching}
                onPress={() => void query.fetchNextPage()}
              />
            )}
            {screen === 'Configuración' && (
              <SettingsMenu personal={!!personal} connected={connected} onOpen={setScreen} />
            )}
            {screen === 'Acerca de la aplicación' && <AboutApp />}
            {screen === 'Apariencia' && <ThemeSettings />}
            {screen === 'Mis bancos' &&
              (!connected || bankDirectory.isSuccess ? (
                <BankSettings
                  banks={banks}
                  busy={busy}
                  local={!connected}
                  onChange={(id, registered) => void action(() => changeBank(id, registered))}
                />
              ) : (
                <View style={s.card}>
                  <Text style={s.muted}>
                    {bankDirectory.isError
                      ? 'No se pudieron cargar los bancos.'
                      : 'Cargando bancos…'}
                  </Text>
                  {bankDirectory.isError && (
                    <Choice
                      label="Reintentar bancos"
                      selected={false}
                      onPress={() => void bankDirectory.refetch()}
                    />
                  )}
                </View>
              ))}
            {screen === 'Cuentas y conciliación' &&
              connected &&
              (accountsQuery.isSuccess ? (
                <FinancePanel
                  items={accountsQuery.data}
                  request={request}
                  money={money}
                  onRefresh={async () => {
                    await accountsQuery.refetch();
                  }}
                />
              ) : (
                <View style={s.card}>
                  <Text style={s.muted}>
                    {accountsQuery.error
                      ? 'No se pudieron cargar las cuentas.'
                      : 'Cargando cuentas…'}
                  </Text>
                  {accountsQuery.error && (
                    <Button
                      label="Reintentar cuentas"
                      onPress={() => void accountsQuery.refetch()}
                    />
                  )}
                </View>
              ))}
            {screen === 'Mi cuenta' &&
              (personal ? (
                <PersonalAccount
                  session={personal}
                  onLogout={onLogout}
                  onPasswordChanged={onExpired}
                  onProfileChanged={onProfileChanged}
                />
              ) : (
                <View style={s.card}>
                  <Text style={s.title}>{testAccount.name}</Text>
                  <Text style={s.muted}>{testAccount.email}</Text>
                  <Button label="Ver inicio de sesión" onPress={() => onAuth('login')} />
                  <Choice label="Registrarse" selected={false} onPress={() => onAuth('register')} />
                  <IconButton icon="logout" label="Cerrar sesión" onPress={() => void onLogout()} />
                </View>
              ))}
            {screen === 'Notificaciones' && personal && <NotificationSettings />}
            {screen === 'Correo y Gmail' && personal && <GmailConnection token={personal.token} />}
            {screen === 'Seguridad y privacidad' && personal && (
              <>
                <RecoverySettings token={personal.token} />
                <DataRetention
                  token={personal.token}
                  onApplied={async () => {
                    await Promise.all([
                      client.invalidateQueries({ queryKey: ['imports'] }),
                      client.invalidateQueries({ queryKey: ['import-stats'] }),
                    ]);
                  }}
                />
              </>
            )}
            {screen === 'Preferencias' && (
              <AccountSettings
                preferences={preferences}
                onSave={async (value) => {
                  await savePreferences(value);
                  setPreferences(value);
                  setCurrency(value.currency);
                }}
              />
            )}
            {screen === 'Administrar categorías' && catalogReady && (
              <CategoryManager
                items={categoryCatalog}
                onSave={saveCategory}
                onArchive={archiveCategory}
                onDelete={deleteCategory}
              />
            )}
            {screen === 'Por revisar' && (
              <>
                <View style={s.card}>
                  <Text style={s.title}>Filtros de revisiones</Text>
                  <FilterRow label="Filtrar por estado">
                    {(
                      [
                        'REVIEW',
                        'PENDING',
                        'PROCESSING',
                        'FAILED',
                        'PARSED',
                        'DISMISSED',
                        'ALL',
                      ] as const
                    ).map((status) => (
                      <FilterChip
                        key={status}
                        label={
                          {
                            REVIEW: 'Por confirmar',
                            PENDING: 'En cola',
                            PROCESSING: 'Procesando',
                            FAILED: 'Con error',
                            PARSED: 'Confirmados',
                            DISMISSED: 'Descartados',
                            ALL: 'Todos los estados',
                          }[status]
                        }
                        selected={reviewStatus === status}
                        onPress={() => setReviewStatus(status)}
                      />
                    ))}
                  </FilterRow>
                  <Text style={s.label}>Fecha de recepción · hora dominicana</Text>
                  <View style={filterStyles.dates}>
                    <View style={filterStyles.date}>
                      <DateTimeField
                        label="Recibido desde"
                        value={reviewFrom}
                        onChange={setReviewFrom}
                        clearable
                      />
                    </View>
                    <View style={filterStyles.date}>
                      <DateTimeField
                        label="Recibido hasta"
                        value={reviewTo}
                        onChange={setReviewTo}
                        clearable
                      />
                    </View>
                  </View>
                  {!!reviewDateError && (
                    <Text accessibilityRole="alert" style={s.error}>
                      Selecciona fechas y horas válidas. El inicio debe ser anterior o igual al fin.
                    </Text>
                  )}
                  <Button
                    label="Limpiar filtros de revisiones"
                    onPress={() => {
                      setReviewStatus('REVIEW');
                      setReviewFrom('');
                      setReviewTo('');
                    }}
                  />
                </View>
                {connected && imports.isFetching && <ActivityIndicator color={palette.primary} />}
                {connected && imports.error && <Text style={s.error}>{imports.error.message}</Text>}
                {connected && (
                  <Button label="Actualizar revisiones" onPress={() => void imports.refetch()} />
                )}
                {connected && !accountsQuery.isSuccess && (
                  <View style={s.card}>
                    <Text style={s.muted}>
                      {accountsQuery.error
                        ? 'No se pudieron cargar las cuentas para revisar.'
                        : 'Cargando cuentas para revisar…'}
                    </Text>
                    <Button
                      label="Reintentar cuentas de revisión"
                      onPress={() => void accountsQuery.refetch()}
                    />
                  </View>
                )}
                {!reviewDateError &&
                  (!connected || (imports.isSuccess && accountsQuery.isSuccess)) && (
                    <ReviewInbox
                      accounts={connected ? accountsQuery.data : undefined}
                      onRetry={connected ? retryImport : undefined}
                      money={money}
                      onMovement={async (id) =>
                        connected
                          ? request(`/movements/${id}`)
                          : (localRef.current.movements.find((m) => m.id === id) ?? null)
                      }
                      categories={categoryCatalog}
                      key={reviewParams}
                      total={connected ? imports.data?.pages[0]?.total : reviews.length}
                      showHistory={reviewStatus !== 'REVIEW'}
                      items={reviews}
                      month={month}
                      currency={currency}
                      onResolve={resolveReview}
                      onDiscard={discardReview}
                      onSuggestion={
                        connected
                          ? async (id) => (await request(`/imports/${id}`)).suggestion
                          : undefined
                      }
                    />
                  )}
              </>
            )}
            {screen === 'Por revisar' && connected && imports.hasNextPage && (
              <Button
                label={
                  imports.isFetchingNextPage ? 'Cargando revisiones…' : 'Cargar más revisiones'
                }
                disabled={imports.isFetching}
                onPress={() => void imports.fetchNextPage()}
              />
            )}
            {screen === 'Conexiones' && (
              <>
                <BankConnections
                  banks={banks}
                  loading={!!personal && bankDirectory.isPending}
                  failed={bankDirectory.isError}
                  onSettings={() => {
                    setPreviousTab('Conexiones');
                    setScreen(connected && !personal ? 'Mi cuenta' : 'Mis bancos');
                  }}
                />
                <Text style={s.title}>Centro de conexiones</Text>
                {connected && (
                  <ImportQueue
                    data={queue.data}
                    loading={queue.isFetching}
                    error={!!queue.error}
                    onRefresh={() => void queue.refetch()}
                    onErrors={() => {
                      setReviewStatus('FAILED');
                      setReviewFrom('');
                      setReviewTo('');
                      setScreen('Por revisar');
                    }}
                  />
                )}
                <View style={s.card}>
                  <Text style={s.title}>Correo</Text>
                  <View style={s.between}>
                    <Text style={s.text}>Gmail</Text>
                    <Text style={s.muted}>
                      {personal ? 'Gestionar en Configuración' : 'Requiere cuenta personal'}
                    </Text>
                  </View>
                  <View style={s.between}>
                    <Text style={s.text}>Outlook</Text>
                    <Text style={s.muted}>Próximamente</Text>
                  </View>
                </View>

                <View style={s.card}>
                  <Text style={s.title}>Conexión personal</Text>
                  <Text style={s.text}>
                    {url || 'Configura EXPO_PUBLIC_API_URL para conectar la API.'}
                  </Text>
                  {connected ? (
                    personal ? (
                      <IconButton
                        icon="logout"
                        label="Cerrar sesión y volver al acceso"
                        onPress={() => void onLogout()}
                      />
                    ) : (
                      <IconButton
                        icon="logout"
                        label="Desconectar y volver a demo"
                        onPress={disconnect}
                      />
                    )
                  ) : (
                    <>
                      <Field
                        label="Token de desarrollo"
                        value={token}
                        onChangeText={setToken}
                        secureTextEntry
                        autoCapitalize="none"
                      />
                      <Button
                        label="Conectar API"
                        disabled={!url || token.length < 24}
                        onPress={() => {
                          client.clear();
                          setCategoryFilter('');
                          setDuplicate(null);
                          setSession(token);
                          setToken('');
                          setScreen('Inicio');
                        }}
                      />
                    </>
                  )}
                  <Text style={s.muted}>
                    {personal
                      ? 'Usa datos ficticios.'
                      : 'El token de desarrollo funciona antes de crear la cuenta personal.'}
                  </Text>
                </View>
                {connected && (
                  <View style={s.card}>
                    <Text style={s.title}>Laboratorio de correo sintético</Text>
                    <Text style={s.muted}>
                      Usa avisos ficticios. Los retiros admitidos de BHD y Popular aparecen en Por
                      revisar.
                    </Text>
                    <Field
                      label="Identificador del correo de prueba"
                      value={sampleId}
                      onChangeText={setSampleId}
                      maxLength={200}
                    />
                    <Field
                      label="Contenido sintético"
                      value={sampleBody}
                      onChangeText={setSampleBody}
                      maxLength={10000}
                      multiline
                    />
                    <Button
                      label="Encolar correo de prueba"
                      disabled={busy || !sampleId.trim() || !sampleBody.trim()}
                      onPress={() =>
                        void action(async () => {
                          await request('/imports', {
                            method: 'POST',
                            body: JSON.stringify({ externalId: sampleId.trim(), body: sampleBody }),
                          });
                          await Promise.all([
                            client.invalidateQueries({ queryKey: ['imports'] }),
                            queue.refetch(),
                          ]);
                          setNotice('Correo encolado. Espera al worker y actualiza revisiones.');
                        })
                      }
                    />
                  </View>
                )}
                <View style={s.card}>
                  <Text style={s.title}>Datos de demostración</Text>
                  <Text style={s.muted}>
                    El restablecimiento borra los datos de demostración de este dispositivo.
                  </Text>
                  <Button
                    label={resetConfirm ? 'Confirmar restablecimiento local' : 'Restablecer demo'}
                    disabled={busy || connected}
                    onPress={() => (resetConfirm ? void action(reset) : setResetConfirm(true))}
                  />
                  {resetConfirm && (
                    <Button
                      label="Cancelar restablecimiento"
                      onPress={() => setResetConfirm(false)}
                    />
                  )}
                </View>
              </>
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
              onPress={() => {
                setScreen(item);
                setEditor(null);
                setTransferForSavings(null);
                setDuplicate(null);
                setDeleteId(null);
              }}
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
