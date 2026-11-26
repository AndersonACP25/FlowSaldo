import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { accessRequest, apiBase, type Owner, type PersonalSession } from './access';
import { clearAccess, readAccess, writeAccess } from './accessVault';
import type { AuthRoute } from './AuthScreen';

export function usePersonalAccess() {
  const client = useQueryClient();
  const [route, setRoute] = useState<AuthRoute | 'demo' | 'personal'>('login');
  const [personal, setPersonal] = useState<PersonalSession>();
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

  function openDemo() {
    client.clear();
    setRoute('demo');
  }

  function updateProfile(owner: Owner) {
    setPersonal((current) => current && { ...current, owner });
  }

  function expireSession() {
    return forget('Tu sesión terminó. Inicia sesión nuevamente.');
  }

  function completeRecovery() {
    return forget('Contraseña restablecida. Inicia sesión con la nueva contraseña.');
  }

  return {
    route,
    setRoute,
    personal,
    notice,
    restoring,
    canRetry,
    restore,
    acceptSession,
    logout,
    openAuth,
    openDemo,
    updateProfile,
    expireSession,
    completeRecovery,
  };
}
