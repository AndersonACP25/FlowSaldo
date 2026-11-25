import React, { useContext, useEffect, useState } from 'react';
import { Icon, IconButton, type IconName } from './IconButton';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SettingsOptionsContext, useTheme } from './theme';
export function Button({
  label,
  onPress,
  disabled = false,
  text,
  centered = false,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  text?: string;
  centered?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const { styles: s, palette } = useTheme();
  const secondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        secondary && { backgroundColor: palette.raised },
        centered && { alignSelf: 'center' },
        disabled && s.disabled,
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: palette.ink }]}>{text ?? label}</Text>
    </Pressable>
  );
}
export function Choice({
  label,
  selected,
  onPress,
  disabled = false,
  text,
  compact = false,
  variant = 'default',
  icon,
  centered = false,
}: {
  compact?: boolean;
  variant?: 'default' | 'text';
  icon?: IconName;
  centered?: boolean;
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  text?: string;
}) {
  const { styles: s, palette } = useTheme();
  const inSettings = useContext(SettingsOptionsContext);
  const plain = inSettings || variant === 'text';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.pill,
        plain && s.settingsOption,
        icon && {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 10,
        },
        centered && { alignSelf: 'center' },
        compact && { paddingHorizontal: 0 },
        selected && s.selected,
        plain && pressed && { backgroundColor: palette.raised },
        disabled && s.disabled,
      ]}
    >
      {icon && <Icon name={icon} />}
      <Text
        style={[
          s.pillText,
          icon && { flexShrink: 1 },
          variant === 'text' && { textAlign: 'center' },
        ]}
      >
        {text ?? label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  secureTextEntry = false,
  style,
  ...props
}: TextInputProps & { label: string }) {
  const { styles: s, palette } = useTheme();
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (props.value === '') setRevealed(false);
  }, [props.value]);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View
        style={secureTextEntry ? { flexDirection: 'row', alignItems: 'center', gap: 8 } : undefined}
      >
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor={palette.muted}
          secureTextEntry={secureTextEntry && !revealed}
          style={[s.input, secureTextEntry && { flex: 1, minWidth: 0 }, style]}
        />
        {secureTextEntry && (
          <IconButton
            icon={revealed ? 'eye-off' : 'eye'}
            label={`${revealed ? 'Ocultar' : 'Mostrar'}: ${label}`}
            onPress={() => setRevealed((value) => !value)}
          />
        )}
      </View>
    </View>
  );
}
