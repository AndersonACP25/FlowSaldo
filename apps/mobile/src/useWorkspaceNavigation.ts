import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import type { Currency, Movement } from '@flowsaldo/domain';
import type { DrawerDestination } from './ScreenChrome';
import { settingsSections, type SettingsSection } from './SettingsMenu';

export const workspaceTabs = ['Inicio', 'Movimientos', 'Por revisar', 'Conexiones'] as const;
export type WorkspaceTab = (typeof workspaceTabs)[number];
export type WorkspaceDestination = WorkspaceTab | DrawerDestination | 'Configuración';
export type WorkspaceScreen =
  | WorkspaceDestination
  | SettingsSection
  | 'Editar movimiento'
  | 'Registrar devolución'
  | 'Nueva plantilla mensual';

type PendingEntry = {
  movement: Movement | null;
  focusId: string | null;
  origin: 'Inicio' | 'Movimientos' | 'Cierre mensual';
};

export function useWorkspaceNavigation({
  busy,
  currency,
  closeDraft,
  clearDeletion,
  clearFeedback,
}: {
  busy: boolean;
  currency: Currency;
  closeDraft: () => void;
  clearDeletion: () => void;
  clearFeedback: () => void;
}) {
  const [screen, openScreen] = useState<WorkspaceScreen>('Inicio');
  const [transferForSavings, setTransferForSavings] = useState<Movement | null>(null);
  const [pendingEntry, setPendingEntry] = useState<PendingEntry>({
    movement: null,
    focusId: null,
    origin: 'Inicio',
  });
  const [projectionCurrency, setProjectionCurrency] = useState<Currency>('DOP');
  const [previousTab, setPreviousTab] = useState<WorkspaceTab>('Inicio');
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
  const overviewScreen =
    screen === 'Analíticas y reportes' ||
    screen === 'Inicio' ||
    screen === 'Presupuestos' ||
    screen === 'Análisis'
      ? screen
      : null;
  const settingsSection = settingsSections.find((section) => section === screen);
  const settingsRoute = screen === 'Configuración' ? screen : settingsSection;
  const inSettings = !!settingsRoute;
  const fromMovements =
    screen === 'Editar movimiento' ||
    screen === 'Registrar devolución' ||
    screen === 'Nueva plantilla mensual' ||
    (screen === 'Metas de ahorro' && !!transferForSavings) ||
    (screen === 'Pagos y cobros pendientes' && pendingEntry.origin === 'Movimientos');
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
        ? pendingEntry.origin
        : fromMovements
          ? 'Movimientos'
          : 'Inicio';
  const goBack = useCallback(() => {
    if (busy) return;
    if (fromMovements) {
      closeDraft();
      setTransferForSavings(null);
    }
    openScreen(backTo);
  }, [backTo, busy, closeDraft, fromMovements]);
  useEffect(() => {
    if (Platform.OS !== 'android' || !secondary) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, secondary]);

  function openPending(entry: PendingEntry) {
    setPendingEntry(entry);
    clearDeletion();
    clearFeedback();
    openScreen('Pagos y cobros pendientes');
  }

  function clearPendingLink() {
    setPendingEntry((entry) => ({ ...entry, movement: null }));
  }

  function openSavingsTransfer(movement: Movement) {
    closeDraft();
    clearDeletion();
    clearFeedback();
    setTransferForSavings(movement);
    openScreen('Metas de ahorro');
  }

  function openBankSettings(destination: 'Mi cuenta' | 'Mis bancos') {
    setPreviousTab('Conexiones');
    openScreen(destination);
  }

  function navigate(destination: WorkspaceDestination) {
    if (busy) return;
    closeDraft();
    setTransferForSavings(null);
    if (destination === 'Pagos y cobros pendientes') {
      openPending({ movement: null, focusId: null, origin: 'Inicio' });
      return;
    }
    clearDeletion();
    if (destination === 'Configuración') setPreviousTab(activeTab);
    if (destination === 'Disponible hasta el próximo cobro') setProjectionCurrency(currency);
    if (destination !== 'Configuración' && !workspaceTabs.some((tab) => tab === destination)) {
      clearFeedback();
    }
    openScreen(destination);
  }

  function openSettings() {
    if (!inSettings) navigate('Configuración');
  }

  return {
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
  };
}
