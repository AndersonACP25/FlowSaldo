import React, { useState } from 'react';
import { Text, View, Switch } from 'react-native';
import { currencies } from '@flowsaldo/domain';
import { Button, Choice } from './ui';
import type { Preferences } from './preferences';
import { useTheme } from './theme';
export function AccountSettings({
  preferences,
  onSave,
}: {
  preferences: Preferences;
  onSave: (value: Preferences) => Promise<void>;
}) {
  const { styles: s, palette } = useTheme();
  const [draft, setDraft] = useState(preferences);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await onSave(draft);
      setMessage('Preferencias guardadas en este dispositivo.');
    } catch {
      setError('No se pudieron guardar las preferencias. Inténtalo nuevamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.title}>Preferencias locales</Text>
      <Text style={s.label}>Moneda predeterminada</Text>
      <View style={s.row}>
        {currencies.map((currency) => (
          <Choice
            key={currency}
            label={currency}
            selected={draft.currency === currency}
            onPress={() => setDraft({ ...draft, currency })}
          />
        ))}
      </View>
      <View style={s.between}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={s.text}>Ocultar importes</Text>
          <Text style={s.muted}>
            Oculta cifras en las consultas. Los archivos exportados y formularios conservan sus
            valores.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Ocultar importes"
          value={draft.hideAmounts}
          onValueChange={(hideAmounts) => setDraft({ ...draft, hideAmounts })}
          trackColor={{ false: palette.border, true: palette.primary }}
        />
      </View>
      <Button
        label={busy ? 'Guardando preferencias…' : 'Guardar preferencias'}
        disabled={busy}
        onPress={() => void save()}
      />
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {message}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
