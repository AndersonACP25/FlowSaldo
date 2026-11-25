import React from 'react';
import { Platform, View } from 'react-native';
import { useTheme } from './theme';
import type { IconName } from './IconButton';
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

const sectionIcons: Record<SettingsSection, IconName> = {
  'Mi cuenta': 'user',
  Preferencias: 'sliders-horizontal',
  'Tasa del día': 'arrow-left-right',
  Apariencia: 'palette',
  'Mis bancos': 'landmark',
  'Administrar categorías': 'tags',
  'Reglas por comercio': 'list-filter',
  'Cuentas y saldos': 'wallet',
  'Cuentas y conciliación': 'list-checks',
  Notificaciones: 'bell',
  'Correo y Gmail': 'mail',
  'Seguridad y privacidad': 'shield',
  'Respaldo y restauración': 'archive',
  'Preguntas frecuentes': 'circle-help',
  'Acerca de la aplicación': 'info',
};

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
        <Choice
          key={section}
          label={section}
          icon={sectionIcons[section]}
          selected={false}
          onPress={() => onOpen(section)}
        />
      ))}
    </View>
  );
}
