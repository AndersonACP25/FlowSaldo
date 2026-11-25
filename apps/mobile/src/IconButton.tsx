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
  user: require('../assets/icons/user.png'),
  'sliders-horizontal': require('../assets/icons/sliders-horizontal.png'),
  'arrow-left-right': require('../assets/icons/arrow-left-right.png'),
  palette: require('../assets/icons/palette.png'),
  landmark: require('../assets/icons/landmark.png'),
  tags: require('../assets/icons/tags.png'),
  'list-filter': require('../assets/icons/list-filter.png'),
  wallet: require('../assets/icons/wallet.png'),
  'list-checks': require('../assets/icons/list-checks.png'),
  bell: require('../assets/icons/bell.png'),
  mail: require('../assets/icons/mail.png'),
  shield: require('../assets/icons/shield.png'),
  'circle-help': require('../assets/icons/circle-help.png'),
  info: require('../assets/icons/info.png'),
  'chart-column': require('../assets/icons/chart-column.png'),
  'chart-pie': require('../assets/icons/chart-pie.png'),
  'piggy-bank': require('../assets/icons/piggy-bank.png'),
  calculator: require('../assets/icons/calculator.png'),
  'credit-card': require('../assets/icons/credit-card.png'),
  link: require('../assets/icons/link.png'),
  'chevron-down': require('../assets/icons/chevron-down.png'),
  'chevron-up': require('../assets/icons/chevron-up.png'),
  coins: require('../assets/icons/coins.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export type IconName = keyof typeof icons | 'back';

export function Icon({ name, danger = false }: { name: IconName; danger?: boolean }) {
  const { palette } = useTheme();
  if (name === 'back')
    return (
      <Text accessible={false} aria-hidden style={[styles.arrow, { color: palette.ink }]}>
        ←
      </Text>
    );
  return (
    <Image
      source={icons[name]}
      accessible={false}
      aria-hidden
      style={[styles.icon, { tintColor: danger ? palette.danger : palette.ink }]}
    />
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  icon: IconName;
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
      <Icon name={icon} danger={danger} />
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
