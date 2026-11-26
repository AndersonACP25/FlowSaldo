import React from 'react';
import { Text, View } from 'react-native';
import { currencies, type Currency } from '@flowsaldo/domain';
import { Button, Choice, Field } from './ui';
import { useTheme } from './theme';
export function SavingsGoalEditor({
  creating,
  saving,
  name,
  currency,
  target,
  setName,
  setCurrency,
  setTarget,
  onSave,
  onCancel,
}: {
  creating: boolean;
  saving: boolean;
  name: string;
  currency: Currency;
  target: string;
  setName: (value: string) => void;
  setCurrency: (value: Currency) => void;
  setTarget: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { styles: s } = useTheme();
  return (
    <View style={s.card}>
      <Text style={s.title}>{creating ? 'Nueva meta' : 'Editar meta'}</Text>
      <Field label="Nombre de la meta" value={name} onChangeText={setName} maxLength={60} />
      <View style={s.row}>
        {currencies.map((unit) => (
          <Choice
            key={unit}
            label={unit}
            selected={unit === currency}
            disabled={saving || !creating}
            onPress={() => setCurrency(unit)}
          />
        ))}
      </View>
      <Field
        label="Monto objetivo"
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
      />
      <Button
        label="Guardar meta"
        disabled={saving || !name.trim() || !target.trim()}
        onPress={onSave}
      />
      <Button
        label="Cancelar meta"
        text="Cancelar"
        variant="secondary"
        disabled={saving}
        onPress={onCancel}
      />
    </View>
  );
}
