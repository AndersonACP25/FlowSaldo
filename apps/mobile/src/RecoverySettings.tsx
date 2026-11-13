import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Button, Field } from './ui';
import { styles as s } from './theme';
import { accessRequest } from './access';
export function RecoverySettings({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!codes) return;
    const timer = setTimeout(() => setCodes(null), 300000);
    return () => clearTimeout(timer);
  }, [codes]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    setCodes(null);
    try {
      await work();
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.title}>Recuperación de cuenta</Text>
      <Text style={s.muted}>
        Genera cinco códigos y guárdalos fuera de este dispositivo. Se muestran una sola vez y
        vencen en 90 días. Cualquiera que tenga un código y tu correo puede restablecer la
        contraseña.
      </Text>
      <Text style={s.muted}>
        Generar otro lote, cambiar la contraseña o recuperar la cuenta invalida todos los códigos
        anteriores. Recuperar también cierra todas las sesiones. No se envían correos.
      </Text>
      <Field
        label="Contraseña para gestionar códigos"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        maxLength={128}
      />
      <View style={s.row}>
        <Button
          label="Generar códigos de recuperación"
          disabled={busy || !password}
          onPress={() =>
            void run(async () => {
              const result = await accessRequest(
                '/auth/recovery-codes',
                { currentPassword: password },
                token,
              );
              setCodes(result.codes);
              setExpires(result.expiresAt);
            })
          }
        />
        <Button
          label="Revocar códigos de recuperación"
          disabled={busy || !password}
          onPress={() =>
            void run(async () => {
              await accessRequest(
                '/auth/recovery-codes/revoke',
                { currentPassword: password },
                token,
              );
              setNotice('Códigos anteriores revocados.');
            })
          }
        />
      </View>
      {codes && (
        <View style={s.banner}>
          <Text style={s.text}>
            Guárdalos ahora. Se ocultarán automáticamente en cinco minutos.
          </Text>
          <Text style={s.muted}>Vencimiento (UTC): {expires.slice(0, 10)}</Text>
          {codes.map((code) => (
            <Text key={code} selectable style={s.text}>
              {code}
            </Text>
          ))}
          <Button label="Ocultar códigos" onPress={() => setCodes(null)} />
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {notice}
        </Text>
      )}
    </View>
  );
}
