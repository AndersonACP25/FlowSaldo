import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from 'react-native';
import { Choice } from './ui';
import {
  colorThemes,
  defaultTheme,
  getTheme,
  ThemeContext,
  themeLabels,
  type ThemeId,
  useTheme,
} from './theme';

const storageKey = 'flowsaldo.theme.v1';
const options = Object.keys(colorThemes) as ThemeId[];
const themeSelection = createContext({
  theme: defaultTheme,
  selectTheme: async (_theme: ThemeId) => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(defaultTheme);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (active && options.includes(value as ThemeId)) setTheme(value as ThemeId);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function selectTheme(next: ThemeId) {
    await AsyncStorage.setItem(storageKey, next);
    setTheme(next);
  }
  return (
    <themeSelection.Provider value={{ theme, selectTheme }}>
      <ThemeContext.Provider value={getTheme(theme)}>{children}</ThemeContext.Provider>
    </themeSelection.Provider>
  );
}

export function ThemeSettings() {
  const { styles: s } = useTheme();
  const { theme, selectTheme } = useContext(themeSelection);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  async function save(value: ThemeId) {
    setSaving(true);
    setError(false);
    try {
      await selectTheme(value);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.title}>Tema de la aplicación</Text>
      <Text style={s.muted}>Tu tema se guarda en este dispositivo.</Text>
      {options.map((id) => (
        <Choice
          key={id}
          label={themeLabels[id]}
          selected={theme === id}
          disabled={saving}
          onPress={() => void save(id)}
        />
      ))}
      {error && (
        <Text accessibilityRole="alert" style={s.error}>
          No se pudo guardar el tema.
        </Text>
      )}
    </View>
  );
}
