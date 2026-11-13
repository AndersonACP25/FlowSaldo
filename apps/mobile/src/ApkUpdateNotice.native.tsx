import { useEffect } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import { applicationId, nativeBuildVersion } from 'expo-application';
import { fetchApkUpdate } from './apkReleases';

const interval = 60 * 60 * 1000;

export function ApkUpdateNotice() {
  useEffect(() => {
    if (Platform.OS !== 'android' || applicationId !== 'com.andersonacp.flowsaldo') return;
    if (!nativeBuildVersion || !/^\d+$/.test(nativeBuildVersion)) return;
    const installedCode = Number(nativeBuildVersion);
    let active = true;
    let lastCheck = 0;
    let promptedCode = 0;
    let pending: AbortController | undefined;

    async function check() {
      if (pending || Date.now() - lastCheck < interval) return;
      lastCheck = Date.now();
      const controller = new AbortController();
      pending = controller;
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const update = await fetchApkUpdate(installedCode, controller.signal);
        if (!active || !update || update.versionCode === promptedCode) return;
        if (AppState.currentState === 'background' || AppState.currentState === 'inactive') {
          lastCheck = 0;
          return;
        }
        promptedCode = update.versionCode;
        Alert.alert(
          'Actualización disponible',
          `FlowSaldo ${update.label} está disponible en GitHub.`,
          [
            { text: 'Más tarde', style: 'cancel' },
            {
              text: 'Descargar',
              onPress: () => {
                void Linking.openURL(update.releaseUrl).catch(() => {
                  Alert.alert(
                    'No se pudo abrir GitHub',
                    'Puedes visitar GitHub Releases desde tu navegador.',
                  );
                });
              },
            },
          ],
        );
      } catch {
        // La consulta es opcional. Sin Internet, la app sigue disponible.
      } finally {
        clearTimeout(timeout);
        pending = undefined;
      }
    }

    void check();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      active = false;
      listener.remove();
      pending?.abort();
    };
  }, []);

  return null;
}
