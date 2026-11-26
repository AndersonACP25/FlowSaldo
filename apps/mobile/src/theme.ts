import { createContext, useContext } from 'react';
import { colorThemes, defaultTheme, type ThemeId } from './themePalettes';
import { createStyles } from './themeStyles';
export { colorThemes, defaultTheme, themeLabels, type ThemeId } from './themePalettes';
const styles = Object.fromEntries(
  Object.entries(colorThemes).map(([id, palette]) => [id, createStyles(palette)]),
) as Record<ThemeId, ReturnType<typeof createStyles>>;

export function getTheme(theme: ThemeId) {
  return { palette: colorThemes[theme], styles: styles[theme] };
}

export const SettingsOptionsContext = createContext(false);
export const ThemeContext = createContext(getTheme(defaultTheme));
export const useTheme = () => useContext(ThemeContext);
