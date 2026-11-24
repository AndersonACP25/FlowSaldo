import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme';

// Metro needs a static require for bundled React Native images.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const icon = require('../assets/icon.png');

export interface BrandMarkProps {
  cover?: boolean;
}

export function BrandMark({ cover = false }: BrandMarkProps) {
  const { palette } = useTheme();
  return (
    <View style={[styles.brand, cover && styles.cover]}>
      <Image source={icon} accessible={false} style={[styles.icon, cover && styles.coverIcon]} />
      <Text style={[styles.name, { color: palette.ink }, cover && styles.coverName]}>
        FlowSaldo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 12 },
  name: { fontSize: 22, fontWeight: '800' },
  cover: { flexDirection: 'column', gap: 18 },
  coverIcon: { width: 108, height: 108, borderRadius: 28 },
  coverName: { fontSize: 36 },
});
