import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BrandMark } from './BrandMark';
import { SettingsOptionsContext, useTheme } from './theme';
import { IconButton, type IconName } from './IconButton';
import { Choice } from './ui';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { styles: s, palette } = useTheme();
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style={palette.scheme === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={s.root}>{children}</SafeAreaView>
    </SafeAreaProvider>
  );
}

const destinations = [
  ['Inicio'],
  ['Presupuestos', 'Ver presupuestos', 'Presupuestos'],
  ['Análisis', 'Ver análisis', 'Análisis'],
  ['Analíticas y reportes'],
  ['Tasas', 'Ver tasas de cambio', 'Tasas de cambio'],
  ['Disponible hasta el próximo cobro'],
  ['Pagos y cobros pendientes'],
  ['Cierre mensual'],
  ['Plan de pago de tarjetas y préstamos'],
  ['Metas de ahorro'],
  ['Simulador de préstamos'],
] as const;

export type DrawerDestination = (typeof destinations)[number][0];

const drawerIcons: Record<DrawerDestination, IconName> = {
  Inicio: 'house',
  Presupuestos: 'wallet',
  Análisis: 'chart-pie',
  'Analíticas y reportes': 'chart-column',
  Tasas: 'arrow-left-right',
  'Disponible hasta el próximo cobro': 'coins',
  'Pagos y cobros pendientes': 'list-checks',
  'Cierre mensual': 'calendar',
  'Plan de pago de tarjetas y préstamos': 'credit-card',
  'Metas de ahorro': 'piggy-bank',
  'Simulador de préstamos': 'calculator',
};

export function AppHeader({
  name,
  disabled,
  onSelect,
  onSettings,
  onLogout,
}: {
  name: string;
  disabled: boolean;
  onSelect: (option: DrawerDestination) => void;
  onSettings: () => void;
  onLogout: () => void;
}) {
  const { styles: s } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={[s.between, styles.header]}>
        <View style={s.row}>
          <IconButton
            icon="menu"
            label="Abrir menú"
            disabled={disabled}
            onPress={() => setOpen(true)}
          />
          <BrandMark />
        </View>
        <AccountAvatar name={name} onSettings={onSettings} />
      </View>
      {open && (
        <HomeDrawer
          disabled={disabled}
          onClose={() => setOpen(false)}
          onSelect={(option) => {
            setOpen(false);
            onSelect(option);
          }}
          onLogout={() => {
            setOpen(false);
            onLogout();
          }}
        />
      )}
    </>
  );
}

function HomeDrawer({
  disabled,
  onClose,
  onSelect,
  onLogout,
}: {
  disabled: boolean;
  onClose: () => void;
  onSelect: (option: DrawerDestination) => void;
  onLogout: () => void;
}) {
  const { palette, styles: s } = useTheme();
  const insets = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(-320));
  useEffect(() => {
    const animation = Animated.timing(slide, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [slide]);
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={[styles.drawerOverlay, { backgroundColor: palette.canvasOverlay }]}>
        <Pressable
          accessible={false}
          tabIndex={-1}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.drawer,
            {
              backgroundColor: palette.surface,
              paddingTop: insets.top + 18,
              paddingBottom: insets.bottom + 18,
              paddingLeft: insets.left + 18,
              transform: [{ translateX: slide }],
            },
          ]}
        >
          <View style={s.between}>
            <Text accessibilityRole="header" style={s.title}>
              Explorar FlowSaldo
            </Text>
            <IconButton icon="close" label="Cerrar menú" onPress={onClose} />
          </View>
          <SettingsOptionsContext.Provider value>
            <ScrollView contentContainerStyle={{ gap: 4 }} keyboardShouldPersistTaps="handled">
              {destinations.map(([key, label, title]) => (
                <Choice
                  key={key}
                  label={label ?? key}
                  icon={drawerIcons[key]}
                  text={title ?? key}
                  selected={false}
                  disabled={disabled}
                  onPress={() => onSelect(key)}
                />
              ))}
              <Choice
                label="Salir"
                icon="logout"
                selected={false}
                disabled={disabled}
                onPress={onLogout}
              />
            </ScrollView>
          </SettingsOptionsContext.Provider>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function OpeningCover() {
  const { styles: s } = useTheme();
  return (
    <View style={[s.root, styles.cover]}>
      <BrandMark cover />
    </View>
  );
}

function AccountAvatar({ name, onSettings }: { name: string; onSettings: () => void }) {
  const { palette } = useTheme();
  const initials = name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join('')
    .toLocaleUpperCase();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Configuración"
      onPress={onSettings}
      style={[styles.avatar, { backgroundColor: palette.selected, borderColor: palette.primary }]}
    >
      <Text style={[styles.avatarText, { color: palette.income }]}>{initials || 'FS'}</Text>
    </Pressable>
  );
}

export function FilterChip({
  label,
  text = label,
  selected,
  onPress,
}: {
  label: string;
  text?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: palette.raised, borderColor: palette.border },
        selected && { backgroundColor: palette.selected, borderColor: palette.primary },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? palette.income : palette.ink }]}>
        {selected ? '✓ ' : ''}
        {text}
      </Text>
    </Pressable>
  );
}

export const filterStyles = StyleSheet.create({
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  date: { flex: 1, minWidth: 190 },
});

const styles = StyleSheet.create({
  header: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawer: { width: '84%', maxWidth: 320, gap: 18, paddingRight: 18 },

  cover: { alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800' },
  chip: {
    minHeight: 44,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});

export function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      accessibilityLabel={label}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      contentContainerStyle={{ gap: 8, alignItems: 'center', paddingBottom: 8 }}
    >
      {children}
    </ScrollView>
  );
}
