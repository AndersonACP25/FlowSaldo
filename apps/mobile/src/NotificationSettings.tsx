import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { enableTransactionNotifications } from './transactionNotifications';
import { Button } from './ui';
import { styles as s } from './theme';

export function NotificationSettings() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (Platform.OS !== 'android') return null;

  async function enable() {
    setBusy(true);
    try {
      const enabled = await enableTransactionNotifications();
      setMessage(
        enabled ? 'Notificaciones habilitadas.' : 'Puedes habilitarlas en los ajustes de Android.',
      );
    } catch {
      setMessage('No se pudo activar el permiso de notificaciones.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.title}>Notificaciones de transacciones</Text>
      <Text style={s.muted}>
        Recibe avisos de ingresos, transferencias, retiros y pagos confirmados en este dispositivo.
        Puedes desactivarlos en los ajustes de Android.
      </Text>
      <Button label="Activar notificaciones" disabled={busy} onPress={() => void enable()} />
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {message}
        </Text>
      )}
    </View>
  );
}
