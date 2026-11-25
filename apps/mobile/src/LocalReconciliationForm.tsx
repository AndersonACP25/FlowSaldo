import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  dominicanDateTime,
  parseDominicanDateTime,
  parseSignedAmount,
  previewLocalReconciliation,
  type Currency,
  type LocalAccount,
  type LocalReconciliation,
  type Movement,
} from '@flowsaldo/domain';
import { DateTimeField } from './DateTimeField';
import { useTheme } from './theme';
import { Button, Choice, Field } from './ui';

export function LocalReconciliationForm({
  account,
  accounts,
  movements,
  money,
  busy,
  onConfirm,
  onCancel,
}: {
  account: LocalAccount;
  accounts: LocalAccount[];
  movements: Movement[];
  money: (minor: number, currency: Currency) => string;
  busy: boolean;
  onConfirm: (preview: LocalReconciliation) => Promise<void>;
  onCancel: () => void;
}) {
  const { styles: s } = useTheme();
  const [asOf, setAsOf] = useState(() => dominicanDateTime(new Date()));
  const [statement, setStatement] = useState('');
  const [preview, setPreview] = useState<LocalReconciliation | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const saving = useRef(false);
  const credit = account.kind === 'CREDIT_CARD';

  function clearResult() {
    setPreview(null);
    setNotice('');
    setError('');
  }

  function compare() {
    clearResult();
    try {
      const cutoff = parseDominicanDateTime(asOf);
      if (!cutoff) throw new Error('Selecciona una fecha y hora de corte válidas.');
      const entered = parseSignedAmount(statement);
      setPreview(
        previewLocalReconciliation(accounts, movements, {
          accountId: account.id,
          occurredAt: cutoff.toISOString(),
          statementMinor: credit ? -entered : entered,
        }),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo comparar el saldo.');
    }
  }

  async function confirm(candidate: LocalReconciliation) {
    if (saving.current || busy) return;
    saving.current = true;
    setError('');
    try {
      await onConfirm(candidate);
      setPreview(null);
      setNotice('Ajuste registrado.');
    } catch (failure) {
      setPreview(null);
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el ajuste.');
    } finally {
      saving.current = false;
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.title}>Conciliar {account.name}</Text>
      <DateTimeField
        label="Fecha y hora de corte"
        value={asOf}
        onChange={(value) => {
          setAsOf(value);
          clearResult();
        }}
      />
      <Text style={s.muted}>Hora dominicana</Text>
      <Field
        label={credit ? 'Deuda del estado de cuenta' : 'Saldo del estado de cuenta'}
        value={statement}
        onChangeText={(value) => {
          setStatement(value);
          clearResult();
        }}
        keyboardType="numbers-and-punctuation"
      />
      {credit && (
        <Text style={s.muted}>Usa un importe negativo si la tarjeta tiene saldo a favor.</Text>
      )}
      <Button label="Comparar saldos" onPress={compare} disabled={busy} />
      {preview && (
        <View style={s.banner} accessibilityLiveRegion="polite">
          <Text style={s.text}>
            Saldo en FlowSaldo · {money(preview.expectedMinor, account.currency)}
          </Text>
          <Text style={s.text}>
            Estado de cuenta · {money(preview.statementMinor, account.currency)}
          </Text>
          {preview.differenceMinor === 0 ? (
            <Text style={s.success}>Los saldos coinciden.</Text>
          ) : (
            <>
              <Text style={s.text}>
                Diferencia · {money(preview.differenceMinor, account.currency)}
              </Text>
              <Button
                label="Confirmar ajuste"
                disabled={busy}
                onPress={() => void confirm(preview)}
              />
            </>
          )}
        </View>
      )}
      {!!notice && (
        <Text style={s.success} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}
      {!!error && (
        <Text style={s.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Choice label="Cerrar conciliación" selected={false} disabled={busy} onPress={onCancel} />
    </View>
  );
}
