import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  dominicanDateTime,
  parseAmount,
  parseDominicanDateTime,
  type Currency,
  type Movement,
} from '@flowsaldo/domain';
import { DateTimeField } from './DateTimeField';
import { useTheme } from './theme';
import { Button, Choice, Field } from './ui';

export function RefundScreen({
  source,
  refundedMinor,
  remainingMinor,
  saving,
  money,
  onSave,
}: {
  source: Movement;
  refundedMinor: number;
  remainingMinor: number;
  saving: boolean;
  money: (amount: number, currency: Currency) => string;
  onSave: (amountMinor: number, occurredAt: string) => Promise<void>;
}) {
  const { styles: s } = useTheme();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => dominicanDateTime(new Date()));
  const [error, setError] = useState('');
  const formatted = (minor: number) => money(minor, source.currency);

  async function submit() {
    setError('');
    try {
      const occurred = parseDominicanDateTime(date);
      if (!occurred) throw new Error('Selecciona la fecha y hora de la devolución.');
      const minor = parseAmount(amount);
      if (minor > remainingMinor)
        throw new Error('La devolución supera el importe pendiente de devolver.');
      await onSave(minor, occurred.toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la devolución.');
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.title}>{source.description}</Text>
      <Text style={s.text}>Gasto original · {formatted(source.amountMinor)}</Text>
      <Text style={s.muted}>Devuelto · {formatted(refundedMinor)}</Text>
      <Text style={s.amount}>Pendiente de devolver · {formatted(remainingMinor)}</Text>
      {remainingMinor === 0 ? (
        <Text style={s.muted}>Este gasto ya se devolvió por completo.</Text>
      ) : (
        <>
          <Field
            label="Importe de la devolución"
            value={amount}
            keyboardType="decimal-pad"
            editable={!saving}
            onChangeText={setAmount}
          />
          <Choice
            label="Usar importe restante"
            selected={false}
            disabled={saving}
            onPress={() => setAmount((remainingMinor / 100).toFixed(2))}
          />
          <DateTimeField label="Fecha y hora de la devolución" value={date} onChange={setDate} />
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Button
            label="Guardar devolución"
            disabled={saving || !amount.trim()}
            onPress={() => void submit()}
          />
        </>
      )}
    </View>
  );
}
