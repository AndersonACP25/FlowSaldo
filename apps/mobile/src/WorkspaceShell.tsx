import React, { type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { IconButton } from './IconButton';
import { AppHeader } from './ScreenChrome';
import { SettingsOptionsContext, useTheme } from './theme';
import {
  workspaceTabs,
  type WorkspaceDestination,
  type WorkspaceScreen,
  type WorkspaceTab,
} from './useWorkspaceNavigation';

export function WorkspaceShell({
  screen,
  name,
  busy,
  ready,
  activeTab,
  secondary,
  inSettings,
  pending,
  addMovement,
  navigate,
  openSettings,
  goBack,
  onLogout,
  children,
}: {
  screen: WorkspaceScreen;
  name: string;
  busy: boolean;
  ready: boolean;
  activeTab: WorkspaceTab;
  secondary: boolean;
  inSettings: boolean;
  pending: number;
  addMovement: ReactNode;
  navigate: (destination: WorkspaceDestination) => void;
  openSettings: () => void;
  goBack: () => void;
  onLogout: () => Promise<void>;
  children: ReactNode;
}) {
  const { styles: s, palette } = useTheme();
  const debtPlanScreen = screen === 'Plan de pago de tarjetas y préstamos';
  const backButton = <IconButton icon="back" label="Volver" disabled={busy} onPress={goBack} />;

  return (
    <SettingsOptionsContext.Provider value={inSettings}>
      <View style={s.root}>
        <AppHeader
          name={name}
          disabled={busy}
          onSelect={navigate}
          onSettings={openSettings}
          onLogout={() => {
            if (!busy) void onLogout();
          }}
        />
        <ScrollView
          key={screen}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {debtPlanScreen && <View style={s.row}>{backButton}</View>}
          <View style={s.between}>
            <Text accessibilityRole="header" style={s.title}>
              {screen}
            </Text>
            {secondary && !debtPlanScreen && backButton}
            {(screen === 'Inicio' || screen === 'Movimientos') && addMovement}
          </View>
          {children}
        </ScrollView>
        {ready && (
          <View style={s.nav}>
            {workspaceTabs.map((item, index) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={item}
                accessibilityState={{ selected: activeTab === item, disabled: busy }}
                disabled={busy}
                onPress={() => navigate(item)}
                style={[s.navItem, activeTab === item && s.navActive]}
              >
                <View style={s.row}>
                  <Text
                    style={{
                      color: activeTab === item ? palette.primary : palette.muted,
                      fontSize: 20,
                    }}
                  >
                    {['▦', '⇄', '☑', '⌘'][index]}
                  </Text>
                  {item === 'Por revisar' && pending > 0 && <Text style={s.badge}>{pending}</Text>}
                </View>
                <Text style={[s.navText, activeTab === item && { color: palette.income }]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </SettingsOptionsContext.Provider>
  );
}
