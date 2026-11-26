import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  currencies,
  parseAmount,
  parseSignedAmount,
  type Currency,
  type DebtPlan,
  type DebtPlanDraft,
} from '@flowsaldo/domain';
import { DateTimeField } from './DateTimeField';
import { FilterRow } from './ScreenFilters';
import { useTheme } from './theme';
import { Button, Choice, Field } from './ui';
import { debtKindLabels } from './debtKindLabels';
const amountFields = [
  ['principalMinor', 'Capital pendiente', true],
  ['statementInterestMinor', 'Interés al corte', false],
  ['chargesMinor', 'Cargos al corte', false],
  ['annualRateBasisPoints', 'Tasa nominal anual (%)', false],
  ['monthlyPaymentMinor', 'Cuota mensual', true],
  ['extraMonthlyMinor', 'Abono adicional mensual', false],
] as const;

export function DebtPlanForm({
  initial,
  defaultCurrency,
  saving,
  onSave,
  onCancel,
}: {
  initial?: DebtPlan;
  defaultCurrency: Currency;
  saving: boolean;
  onSave: (draft: DebtPlanDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const { styles: s } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<DebtPlanDraft['kind']>(initial?.kind ?? 'card');
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [statementAt, setStatementAt] = useState(initial?.statementAt ?? '');
  const [dueAt, setDueAt] = useState(initial?.dueAt ?? '');
  const [amounts, setAmounts] = useState(() => ({
    principalMinor: initial ? (initial.principalMinor / 100).toFixed(2) : '',
    statementInterestMinor: initial ? (initial.statementInterestMinor / 100).toFixed(2) : '',
    chargesMinor: initial ? (initial.chargesMinor / 100).toFixed(2) : '',
    annualRateBasisPoints: initial ? String(initial.annualRateBasisPoints / 100) : '',
    monthlyPaymentMinor: initial ? (initial.monthlyPaymentMinor / 100).toFixed(2) : '',
    extraMonthlyMinor: initial ? (initial.extraMonthlyMinor / 100).toFixed(2) : '',
  }));
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    const optionalAmount = (value: string) => parseSignedAmount(value.trim() || '0');
    try {
      await onSave({
        name,
        kind,
        currency,
        statementAt,
        dueAt,
        principalMinor: parseAmount(amounts.principalMinor),
        statementInterestMinor: optionalAmount(amounts.statementInterestMinor),
        chargesMinor: optionalAmount(amounts.chargesMinor),
        annualRateBasisPoints: parseSignedAmount(amounts.annualRateBasisPoints, 100_000),
        monthlyPaymentMinor: parseAmount(amounts.monthlyPaymentMinor),
        extraMonthlyMinor: optionalAmount(amounts.extraMonthlyMinor),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revisa los datos del plan.');
    }
  }

  return (
    <View style={s.card}>
      <FilterRow label="Tipo de deuda">
        {(['card', 'loan'] as const).map((type) => (
          <Choice
            key={type}
            label={debtKindLabels[type]}
            selected={type === kind}
            disabled={saving}
            onPress={() => setKind(type)}
          />
        ))}
      </FilterRow>
      <FilterRow label="Moneda del plan">
        {currencies.map((unit) => (
          <Choice
            key={unit}
            label={unit}
            selected={unit === currency}
            disabled={saving}
            onPress={() => setCurrency(unit)}
          />
        ))}
      </FilterRow>
      <Field
        label="Nombre del plan"
        value={name}
        onChangeText={setName}
        maxLength={100}
        editable={!saving}
      />
      <DateTimeField label="Fecha y hora de corte" value={statementAt} onChange={setStatementAt} />
      <DateTimeField
        label="Fecha y hora del próximo vencimiento"
        value={dueAt}
        onChange={setDueAt}
      />
      {amountFields.map(([field, label, required]) => (
        <Field
          key={field}
          label={label}
          value={amounts[field]}
          onChangeText={(value) => setAmounts((current) => ({ ...current, [field]: value }))}
          keyboardType="decimal-pad"
          editable={!saving}
          placeholder={required || field === 'annualRateBasisPoints' ? undefined : '0.00'}
          maxLength={16}
        />
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <View style={s.row}>
        <Button label="Guardar y comparar" disabled={saving} onPress={() => void submit()} />
        <Choice
          label="Cancelar edición del plan"
          centered
          text="Cancelar"
          selected={false}
          disabled={saving}
          onPress={onCancel}
        />
      </View>
    </View>
  );
}
