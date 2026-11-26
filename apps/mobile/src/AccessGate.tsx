import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ApkUpdateNotice } from './ApkUpdateNotice';
import { AuthScreen } from './AuthScreen';
import { AppFrame, OpeningCover } from './ScreenChrome';
import { useTheme } from './theme';
import { Button } from './ui';
import { usePersonalAccess } from './usePersonalAccess';
import { Workspace } from './Workspace';

export function AccessGate() {
  const { styles: s, palette } = useTheme();
  const [cover, setCover] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setCover(false), 700);
    return () => clearTimeout(timer);
  }, []);

  const {
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
  } = usePersonalAccess();
  return (
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
        <Workspace
          key={personal?.sessionId ?? 'demo'}
          onAuth={openAuth}
          personal={route === 'personal' ? personal : undefined}
          onLogout={logout}
          onProfileChanged={updateProfile}
          onExpired={expireSession}
          accessNotice={notice}
        />
      ) : (
        <>
          {canRetry && <Button label="Reintentar sesión guardada" onPress={() => void restore()} />}
          <AuthScreen
            key={route}
            route={route}
            onRoute={setRoute}
            onTestLogin={openDemo}
            onSession={acceptSession}
            onRecovered={completeRecovery}
            notice={notice}
          />
        </>
      )}
    </AppFrame>
  );
}
