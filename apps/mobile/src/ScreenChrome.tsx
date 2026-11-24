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
import { useTheme } from './theme';
import { IconButton } from './IconButton';
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

type HomeDestination = 'Presupuestos' | 'Análisis' | 'Tasas';

export function HomeOptions({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: (option: HomeDestination) => void;
}) {
  const { styles: s } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={s.between}>
        <View style={s.row}>
          <IconButton icon="menu" label="Menú de Inicio" onPress={() => setOpen(true)} />
          <Text accessibilityRole="header" style={s.title}>
            Inicio
          </Text>
        </View>
        {children}
      </View>
      {open && (
        <HomeDrawer
          onClose={() => setOpen(false)}
          onSelect={(option) => {
            setOpen(false);
            onSelect(option);
          }}
        />
      )}
    </>
  );
}

function HomeDrawer({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (option: HomeDestination) => void;
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
          <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            <Choice
              label="Ver presupuestos"
              text="Presupuestos"
              selected={false}
              onPress={() => onSelect('Presupuestos')}
            />
            <Choice
              label="Ver análisis"
              text="Análisis"
              selected={false}
              onPress={() => onSelect('Análisis')}
            />
            <Choice
              label="Ver tasas de cambio"
              text="Tasas de cambio"
              selected={false}
              onPress={() => onSelect('Tasas')}
            />
          </ScrollView>
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

export function AccountActions({
  name,
  onSettings,
  onLogout,
}: {
  name: string;
  onSettings: () => void;
  onLogout: () => void;
}) {
  const { styles: s, palette } = useTheme();
  const initials = name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join('')
    .toLocaleUpperCase();
  return (
    <View style={s.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Configuración"
        onPress={onSettings}
        style={[styles.avatar, { backgroundColor: palette.selected, borderColor: palette.primary }]}
      >
        <Text style={[styles.avatarText, { color: palette.income }]}>{initials || 'FS'}</Text>
      </Pressable>
      <IconButton icon="logout" label="Cerrar sesión" onPress={onLogout} />
    </View>
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
