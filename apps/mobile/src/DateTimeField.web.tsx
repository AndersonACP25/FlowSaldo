import React, { useId } from 'react';
import { View } from 'react-native';
import type { DateTimeFieldProps } from './DateTimeField';
import { useTheme } from './theme';

export function DateTimeField({ label, value, onChange }: DateTimeFieldProps) {
  const id = useId();
  const { palette } = useTheme();

  return (
    <View style={{ gap: 6 }}>
      <label htmlFor={id} style={{ color: palette.muted, fontSize: 13, fontWeight: 700 }}>
        {label}
      </label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          font: 'inherit',
          fontSize: 16,
          minHeight: 44,
          minWidth: 0,
          borderRadius: 12,
          border: `1px solid ${palette.border}`,
          backgroundColor: palette.raised,
          color: palette.ink,
          colorScheme: palette.scheme,
          padding: '0 12px',
        }}
      />
    </View>
  );
}
