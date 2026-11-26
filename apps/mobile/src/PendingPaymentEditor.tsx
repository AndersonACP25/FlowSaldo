import React from 'react';
import { ScrollView, View } from 'react-native';
import { currencies, type Currency, type PendingDraft } from '@flowsaldo/domain';
import { DateTimeField } from './DateTimeField';
import { Button, Choice, Field } from './ui';
import { useTheme } from './theme';
export function PendingPaymentEditor({
  kind,
  currency,
  name,
  amount,
  date,
  saving,
  setKind,
  setCurrency,
  setName,
  setAmount,
  setDate,
  onSave,
  onCancel,
}: {
  kind: PendingDraft['kind'];
  currency: Currency;
  name: string;
  amount: string;
  date: string;
  saving: boolean;
  setKind: (value: PendingDraft['kind']) => void;
  setCurrency: (value: Currency) => void;
  setName: (value: string) => void;
  setAmount: (value: string) => void;
  setDate: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { styles: s } = useTheme();
  return (
    <View style={s.card}>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        <Choice
          label="Por pagar"
          selected={kind === 'pay'}
          onPress={() => setKind('pay')}
          disabled={saving}
        />
        <Choice
          label="Por cobrar"
          selected={kind === 'collect'}
          onPress={() => setKind('collect')}
          disabled={saving}
        />
        {currencies.map((unit) => (
          <Choice
            key={unit}
            label={unit}
            selected={unit === currency}
            onPress={() => setCurrency(unit)}
            disabled={saving}
          />
        ))}
      </ScrollView>
      <Field
        label="Nombre del pendiente"
        value={name}
        onChangeText={setName}
        maxLength={100}
        editable={!saving}
      />
      <Field
        label="Monto pendiente"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        editable={!saving}
      />
      <DateTimeField label="Fecha y hora de vencimiento" value={date} onChange={setDate} />
      <View style={s.row}>
        <Button label="Guardar pendiente" disabled={saving} onPress={onSave} />
        <Choice
          label="Cancelar pendiente"
          text="Cancelar"
          selected={false}
          disabled={saving}
          onPress={onCancel}
        />
      </View>
    </View>
  );
}
