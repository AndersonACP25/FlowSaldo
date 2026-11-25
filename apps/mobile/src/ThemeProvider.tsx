import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, Text, View } from 'react-native';
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
  const { styles: s, palette } = useTheme();
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
      <View style={[s.row, { alignItems: 'stretch' }]}>
        {options.map((id) => {
          const colors = colorThemes[id];
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={themeLabels[id]}
              accessibilityState={{ selected: theme === id, disabled: saving }}
              disabled={saving}
              onPress={() => void save(id)}
              style={({ pressed }) => [
                s.card,
                {
                  flexBasis: 132,
                  flexGrow: 1,
                  padding: 12,
                  gap: 8,
                  minHeight: 64,
                  borderWidth: 0,
                  backgroundColor: palette.raised,
                },
                (theme === id || pressed) && s.selected,
                saving && s.disabled,
              ]}
            >
              <View style={s.row} importantForAccessibility="no-hide-descendants">
                {[colors.background, colors.surface, colors.primary, colors.cyan].map(
                  (color, index) => (
                    <View
                      key={index}
                      style={{
                        height: 14,
                        width: 14,
                        borderRadius: 7,
                        backgroundColor: color,
                        borderColor: colors.border,
                        borderWidth: 1,
                      }}
                    />
                  ),
                )}
              </View>
              <Text style={s.text}>{themeLabels[id]}</Text>
            </Pressable>
          );
        })}
      </View>
      {error && (
        <Text accessibilityRole="alert" style={s.error}>
          No se pudo guardar el tema.
        </Text>
      )}
    </View>
  );
}
