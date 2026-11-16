import { useCallback, useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { accessRequest } from './access';
import { Button } from './ui';
import { styles as s } from './theme';

type Status = 'unavailable' | 'disconnected' | 'connected';

export function GmailConnection({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>();
  const [authorizationUrl, setAuthorizationUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await accessRequest('/integrations/gmail', undefined, token);
    setStatus(result.status);
    setAuthorizationUrl('');
  }, [token]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch {
      setError('No se pudo completar la operación de Gmail. Inténtalo nuevamente.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load().catch(() => setError('No se pudo consultar el estado de Gmail.'));
  }, [load]);

  const label = {
    unavailable: 'Gmail sin configurar en el servidor.',
    disconnected: 'Gmail desconectado.',
    connected: 'Gmail conectado.',
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>Gmail</Text>
      <Text style={s.muted}>{status ? label[status] : 'Consultando conexión…'}</Text>
      {status === 'disconnected' && !authorizationUrl && (
        <Button
          label="Conectar Gmail"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const { authorizationUrl } = await accessRequest(
                '/integrations/gmail/connect',
                {},
                token,
              );
              setAuthorizationUrl(authorizationUrl);
            })
          }
        />
      )}
      {!!authorizationUrl && (
        <Button
          label="Autorizar en Google"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await Linking.openURL(authorizationUrl);
              setMessage('Después de autorizar en Google, vuelve aquí y pulsa Actualizar estado.');
            })
          }
        />
      )}
      {status === 'connected' && (
        <Button
          label="Desconectar Gmail"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await accessRequest('/integrations/gmail', undefined, token, 'DELETE');
              await load();
            })
          }
        />
      )}
      <Button label="Actualizar estado" disabled={busy} onPress={() => void run(load)} />
      {!!message && <Text style={s.muted}>{message}</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
