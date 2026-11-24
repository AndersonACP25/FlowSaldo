import React from 'react';
import { View } from 'react-native';
import { useTheme } from './theme';
import { Choice } from './ui';

export const settingsSections = [
  'Mi cuenta',
  'Preferencias',
  'Apariencia',
  'Mis bancos',
  'Administrar categorías',
  'Cuentas y conciliación',
  'Notificaciones',
  'Correo y Gmail',
  'Seguridad y privacidad',
  'Acerca de la aplicación',
] as const;

export type SettingsSection = (typeof settingsSections)[number];

export function SettingsMenu({
  personal,
  connected,
  onOpen,
}: {
  personal: boolean;
  connected: boolean;
  onOpen: (section: SettingsSection) => void;
}) {
  const { styles: s } = useTheme();
  const visible = settingsSections.filter((section) => {
    if (section === 'Cuentas y conciliación') return connected;
    if (section === 'Mis bancos') return personal || !connected;
    if (
      section === 'Notificaciones' ||
      section === 'Correo y Gmail' ||
      section === 'Seguridad y privacidad'
    )
      return personal;
    return true;
  });

  return (
    <View style={s.card}>
      {visible.map((section) => (
        <Choice
          key={section}
          label={section}
          text={section + '  ›'}
          selected={false}
          onPress={() => onOpen(section)}
        />
      ))}
    </View>
  );
}
