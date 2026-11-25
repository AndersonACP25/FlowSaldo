import React, { useContext, useState } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { SettingsOptionsContext, useTheme } from './theme';

// Metro resolves bundled images through static require calls.
/* eslint-disable @typescript-eslint/no-require-imports */
const icons = {
  eye: require('../assets/icons/eye.png'),
  'eye-off': require('../assets/icons/eye-off.png'),
  logout: require('../assets/icons/logout.png'),
  edit: require('../assets/icons/edit.png'),
  copy: require('../assets/icons/copy.png'),
  trash: require('../assets/icons/trash.png'),
  calendar: require('../assets/icons/calendar.png'),
  menu: require('../assets/icons/menu.png'),
  close: require('../assets/icons/close.png'),
  archive: require('../assets/icons/archive.png'),
  restore: require('../assets/icons/restore.png'),
  add: require('../assets/icons/add.png'),
  check: require('../assets/icons/check.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: keyof typeof icons | 'back';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { styles: s, palette } = useTheme();
  const plain = useContext(SettingsOptionsContext);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        { borderColor: palette.border, backgroundColor: palette.raised },
        plain && { borderWidth: 0, backgroundColor: 'transparent' },
        focused && { borderWidth: 1, borderColor: palette.primary },
        pressed && s.selected,
        disabled && s.disabled,
      ]}
    >
      {icon === 'back' ? (
        <Text accessible={false} style={[styles.arrow, { color: palette.ink }]}>
          ←
        </Text>
      ) : (
        <Image
          source={icons[icon]}
          accessible={false}
          style={[styles.icon, { tintColor: danger ? palette.danger : palette.ink }]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: { width: 21, height: 21 },
  arrow: { fontSize: 24, lineHeight: 28, fontWeight: '600' },
});
