import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiBase } from './access';
import { createApiClient } from './apiClient';

export function useWorkspaceConnection({
  personalToken,
  onExpired,
  clearAccountFilter,
  clearCategoryFilter,
  closeDraft,
  clearDeletion,
  openHome,
  resetDemo,
  action,
  setNotice,
}: {
  personalToken?: string;
  onExpired?: () => Promise<void>;
  clearAccountFilter: () => void;
  clearCategoryFilter: () => void;
  closeDraft: () => void;
  clearDeletion: () => void;
  openHome: () => void;
  resetDemo: () => Promise<void>;
  action: (work: () => Promise<void>) => Promise<void>;
  setNotice: (notice: string) => void;
}) {
  const client = useQueryClient();
  const [token, setToken] = useState('');
  const [developmentSession, setSession] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const session = personalToken ?? developmentSession;
  let url = '';
  try {
    url = apiBase();
  } catch {
    /* Auth screen explains invalid API configuration. Demo stays available. */
  }
  const api = createApiClient({ baseUrl: url, token: session, onUnauthorized: onExpired });

  function connectDevelopment() {
    client.clear();
    clearCategoryFilter();
    closeDraft();
    setSession(token);
    setToken('');
    openHome();
  }

  function disconnect() {
    clearAccountFilter();
    setSession('');
    setToken('');
    client.clear();
    closeDraft();
    clearCategoryFilter();
    clearDeletion();
    setNotice('Sesión cerrada. Volviste a la demo local.');
  }

  function requestReset() {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    void action(async () => {
      await resetDemo();
      setResetConfirm(false);
      clearAccountFilter();
      setNotice('Demo restablecida.');
    });
  }

  return {
    url,
    api,
    connected: !!session,
    token,
    setToken,
    resetConfirm,
    connectDevelopment,
    disconnect,
    requestReset,
    cancelReset: () => setResetConfirm(false),
  };
}
