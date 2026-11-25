import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { countLabel, dueReminders } from '@flowsaldo/domain';
import {
  allowExactDueNotifications,
  setDueNotificationsEnabled,
  syncDueNotifications,
  type DueNotificationStatus,
} from './dueNotifications';
import type { LocalData } from './storage';
import { useTheme } from './theme';
import { Button, Choice } from './ui';

export function useDueNotifications(data: LocalData | null) {
  const [status, setStatus] = useState<DueNotificationStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = data?.pendingItems.demo;
  const templates = data?.recurring;
  const receipts = data?.receipts;
  const movements = data?.movements;
  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android' || !templates || !receipts || !movements) return;
    try {
      const result = await syncDueNotifications(
        dueReminders(pending ?? [], templates, receipts, movements),
      );
      setStatus(result);
      setError('');
    } catch {
      setError('No se pudieron actualizar los recordatorios.');
    }
  }, [pending, templates, receipts, movements]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => listener.remove();
  }, [refresh]);

  async function change(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
      await refresh();
    } catch {
      setError('No se pudo cambiar la configuración de recordatorios.');
    } finally {
      setBusy(false);
    }
  }

  return {
    status,
    busy,
    error,
    onEnable: (enabled: boolean) => void change(() => setDueNotificationsEnabled(enabled)),
    onExact: () => void change(allowExactDueNotifications),
  };
}

export function DueNotificationSettings({
  status,
  busy,
  error,
  onEnable,
  onExact,
}: ReturnType<typeof useDueNotifications>) {
  const { styles: s } = useTheme();
  if (Platform.OS !== 'android') return null;
  return (
    <View style={s.card}>
      <Text style={s.title}>Recordatorios de vencimiento</Text>
      <Text style={s.muted}>
        Recibe un aviso por pagos pendientes y plantillas mensuales de la cuenta de prueba.
      </Text>
      {!status?.enabled && (
        <Button label="Activar recordatorios" disabled={busy} onPress={() => onEnable(true)} />
      )}
      {status?.enabled && !status.allowed && (
        <>
          <Text style={s.muted}>
            Permite las notificaciones de FlowSaldo y el canal Vencimientos en Android.
          </Text>
          <Choice
            label="Reintentar permiso"
            selected={false}
            disabled={busy}
            onPress={() => onEnable(true)}
          />
        </>
      )}
      {status?.enabled && status.allowed && (
        <>
          <Text style={s.text} accessibilityLiveRegion="polite">
            {countLabel(status.scheduled, 'recordatorio programado', 'recordatorios programados')}
          </Text>
          {!status.exact && (
            <>
              <Text style={s.muted}>
                Android puede retrasar los avisos si la hora exacta está desactivada.
              </Text>
              <Choice
                label="Permitir hora exacta"
                selected={false}
                disabled={busy}
                onPress={onExact}
              />
            </>
          )}
        </>
      )}
      {(status?.enabled || !!error) && (
        <Choice
          label="Desactivar recordatorios"
          selected={false}
          disabled={busy}
          onPress={() => onEnable(false)}
        />
      )}
      {!!error && (
        <Text style={s.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}
