import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from './theme';

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
