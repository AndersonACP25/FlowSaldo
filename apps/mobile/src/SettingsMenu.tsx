import React from 'react';
import { Platform, View } from 'react-native';
import { useTheme } from './theme';
import { Choice } from './ui';

export const settingsSections = [
  'Mi cuenta',
  'Preferencias',
  'Tasa del día',
  'Apariencia',
  'Mis bancos',
  'Administrar categorías',
  'Reglas por comercio',
  'Cuentas y saldos',
  'Cuentas y conciliación',
  'Notificaciones',
  'Correo y Gmail',
  'Seguridad y privacidad',
  'Respaldo y restauración',
  'Preguntas frecuentes',
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
    if (section === 'Cuentas y saldos') return !connected;
    if (section === 'Respaldo y restauración') return !connected;
    if (section === 'Mis bancos') return personal || !connected;
    if (section === 'Notificaciones') return personal || (!connected && Platform.OS === 'android');
    if (section === 'Correo y Gmail' || section === 'Seguridad y privacidad') return personal;
    return true;
  });

  return (
    <View style={[s.card, { borderWidth: 0 }]}>
      {visible.map((section) => (
        <Choice key={section} label={section} selected={false} onPress={() => onOpen(section)} />
      ))}
    </View>
  );
}
