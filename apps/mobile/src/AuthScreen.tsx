import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BrandMark } from './BrandMark';
import { Button, Field, Choice } from './ui';
import { useTheme } from './theme';
import { isTestAccountEmail, testAccount } from './testAccount';
import { AccessError, accessRequest, type PersonalSession } from './access';
const invalidCredentials = 'Correo o contraseña incorrectos. Revisa tus datos e intenta de nuevo.';

export type AuthRoute = 'login' | 'register' | 'recover';
export function AuthScreen({
  route,
  onRoute,
  onTestLogin,
  onSession,
  onRecovered,
  notice,
}: {
  onRecovered: () => Promise<void>;
  route: AuthRoute;
  onRoute: (route: AuthRoute) => void;
  onTestLogin: () => void;
  onSession: (session: PersonalSession) => Promise<void>;
  notice?: string;
}) {
  const { styles: s } = useTheme();
  const register = route === 'register';
  const recover = route === 'recover';
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (register) {
        if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
        if (password.length < 15) throw new Error('Usa una contraseña de al menos 15 caracteres.');
        await accessRequest('/auth/setup', { name, email, password }, setupToken);
        setPassword('');
        setConfirmation('');
        setSetupToken('');
        setMessage('Cuenta personal creada. Ahora inicia sesión.');
      } else if (recover) {
        if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
        await accessRequest('/auth/recover', { email, code: code.trim(), newPassword: password });
        setCode('');
        setPassword('');
        setConfirmation('');
        await onRecovered();
      } else if (isTestAccountEmail(email)) {
        setPassword('');
        if (password === testAccount.password) onTestLogin();
        else setError(invalidCredentials);
      } else {
        const session: PersonalSession = await accessRequest('/auth/login', { email, password });
        setPassword('');
        await onSession(session);
      }
    } catch (e) {
      if (route === 'login' && e instanceof AccessError && e.status === 401) {
        setPassword('');
        setError(invalidCredentials);
      } else if (
        e instanceof TypeError ||
        (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError'))
      ) {
        setError(
          'No se pudo conectar con la API de FlowSaldo. Comprueba la conexión e intenta de nuevo.',
        );
      } else setError(e instanceof Error ? e.message : 'No se pudo completar el acceso.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.content,
          { maxWidth: register || recover ? 600 : 520, paddingTop: 32, paddingHorizontal: 12 },
        ]}
      >
        <BrandMark />
        {!!notice && <Text style={s.muted}>{notice}</Text>}
        <View style={[s.card, { paddingHorizontal: 14 }]}>
          <Text style={s.title}>
            {register ? 'Registro' : recover ? 'Recuperar cuenta' : 'Iniciar sesión'}
          </Text>
          {register && (
            <>
              <Field label="Nombre" value={name} onChangeText={setName} maxLength={60} />
              <Field
                label="Token de configuración inicial"
                value={setupToken}
                onChangeText={setSetupToken}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                maxLength={300}
              />
              <Text style={s.muted}>El token inicial lo configura el administrador.</Text>
            </>
          )}
          <Field
            label="Correo electrónico"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="off"
            maxLength={120}
          />
          {recover && (
            <Field
              label="Código de recuperación"
              value={code}
              onChangeText={setCode}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              maxLength={80}
            />
          )}
          <Field
            label={recover ? 'Nueva contraseña de recuperación' : 'Contraseña'}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setError('');
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            maxLength={128}
          />
          {(register || recover) && (
            <>
              <Text style={s.muted}>Mínimo 15 caracteres.</Text>
              <Field
                label="Confirmar contraseña"
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                maxLength={128}
              />
            </>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          {!!message && (
            <Text accessibilityLiveRegion="polite" style={s.success}>
              {message}
            </Text>
          )}
          <Button
            label={
              busy
                ? 'Validando acceso…'
                : register
                  ? 'Crear cuenta personal'
                  : recover
                    ? 'Restablecer contraseña'
                    : 'Entrar'
            }
            disabled={
              busy ||
              !email ||
              !password ||
              (register && (!name.trim() || !setupToken)) ||
              (recover && !code)
            }
            onPress={() => void submit()}
          />
          {route === 'login' && (
            <Choice
              label="Usar cuenta de prueba"
              selected={false}
              disabled={busy}
              onPress={() => {
                setEmail(testAccount.email);
                setPassword(testAccount.password);
                setError('');
              }}
            />
          )}
          <Choice
            label={register || recover ? 'Ir a iniciar sesión' : 'Registrarse'}
            selected={false}
            onPress={() => onRoute(register || recover ? 'login' : 'register')}
          />
          {route === 'login' && (
            <Choice
              label="Recuperar cuenta con código"
              selected={false}
              onPress={() => onRoute('recover')}
            />
          )}
          {recover && (
            <Text style={s.muted}>
              Usa un código guardado. El cambio cierra todas las sesiones e invalida los códigos
              anteriores.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
