import React from 'react';
import { Platform, ScrollView, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from './BrandMark';
import { palette, styles as s } from './theme';
import { IconButton } from './IconButton';

export const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

export function OpeningCover() {
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
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>{initials || 'FS'}</Text>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      {...(Platform.OS === 'web' ? { 'aria-pressed': selected } : {})}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
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
  cover: { alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: '#13342d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#a7f3d0', fontSize: 15, fontWeight: '800' },
  chip: {
    minHeight: 44,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: palette.raised,
    borderWidth: 1,
    borderColor: '#303849',
  },
  chipSelected: { backgroundColor: '#13342d', borderColor: palette.primary },
  chipText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: '#a7f3d0' },
  pressed: { opacity: 0.75 },
});

export function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      accessibilityLabel={label}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 8, alignItems: 'center', paddingBottom: 8 }}
    >
      {children}
    </ScrollView>
  );
}
