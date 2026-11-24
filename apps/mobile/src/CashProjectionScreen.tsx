import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  countLabel,
  currencies,
  ledgerBalance,
  parseSignedAmount,
  projectAvailableCash,
  type CashProjectionPlan,
  type Currency,
  type RecurringTemplate,
} from '@flowsaldo/domain';
import { DateTimeField } from './DateTimeField';
import { useTheme } from './theme';
import { Button, Choice, Field } from './ui';

export function CashProjectionScreen({
  currency,
  onCurrency,
  templates,
  saved,
  saving,
  onSave,
  money,
}: {
  currency: Currency;
  onCurrency: (currency: Currency) => void;
  templates: RecurringTemplate[];
  saved?: CashProjectionPlan;
  saving: boolean;
  onSave: (plan: CashProjectionPlan) => Promise<void>;
  money: (amountMinor: number, currency: Currency) => string;
}) {
  const { styles: s } = useTheme();
  const [balance, setBalance] = useState(() =>
    saved ? (saved.balanceMinor / 100).toFixed(2) : '',
  );
  const [nextIncomeAt, setNextIncomeAt] = useState(saved?.nextIncomeAt ?? '');
  const [simulated, setSimulated] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'error'>();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  let plan: CashProjectionPlan | undefined;
  let projection: ReturnType<typeof projectAvailableCash> | undefined;
  let error = '';
  let simulatedAvailable: number | undefined;
  let simulationError = '';
  if (balance.trim() && nextIncomeAt) {
    try {
      plan = { balanceMinor: parseSignedAmount(balance), nextIncomeAt };
      projection = projectAvailableCash({ ...plan, currency, templates, now });
    } catch (e) {
      error = e instanceof Error ? e.message : 'No se pudo calcular la proyección.';
    }
  }
  if (projection && simulated.trim()) {
    try {
      const amount = parseSignedAmount(simulated);
      if (amount < 0) throw new Error('Escribe un gasto simulado de cero o más.');
      simulatedAvailable = ledgerBalance(projection.availableMinor, 0, amount, 0);
    } catch (e) {
      simulationError = e instanceof Error ? e.message : 'Gasto simulado inválido.';
    }
  }

  const savedInputs =
    plan && saved?.balanceMinor === plan.balanceMinor && saved.nextIncomeAt === plan.nextIncomeAt;

  async function save() {
    if (!plan || !projection) return;
    try {
      await onSave(plan);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }

  return (
    <>
      <View style={s.card}>
        <Text style={s.label}>Moneda</Text>
        <View style={s.row}>
          {currencies.map((unit) => (
            <Choice
              key={unit}
              label={unit}
              selected={unit === currency}
              disabled={saving}
              onPress={() => onCurrency(unit)}
            />
          ))}
        </View>
        <Field
          label="Saldo disponible hoy"
          value={balance}
          editable={!saving}
          onChangeText={(value) => {
            setBalance(value);
            setSaveStatus(undefined);
          }}
        />
        <DateTimeField
          label="Fecha y hora del próximo cobro"
          value={nextIncomeAt}
          onChange={(value) => {
            setNextIncomeAt(value);
            setSaveStatus(undefined);
          }}
        />
        <Text style={s.muted}>
          Hora dominicana. El saldo y el próximo cobro se guardan en este dispositivo.
        </Text>
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        <Button
          label="Guardar proyección"
          disabled={!projection || saving}
          onPress={() => void save()}
        />
        {saveStatus === 'saved' && savedInputs && (
          <Text accessibilityLiveRegion="polite" style={s.success}>
            Proyección guardada.
          </Text>
        )}
        {saveStatus === 'error' && (
          <Text accessibilityRole="alert" style={s.error}>
            No se pudo guardar la proyección.
          </Text>
        )}
      </View>
      {projection && (
        <>
          <View style={s.hero}>
            <Text style={s.label}>Disponible estimado</Text>
            <Text style={s.heroValue} accessibilityLiveRegion="polite">
              {money(projection.availableMinor, currency)}
            </Text>
            <Text style={s.muted}>
              Gastos recurrentes pendientes: {money(projection.committedMinor, currency)}
            </Text>
          </View>
          <View style={s.card}>
            <Text style={s.title}>Simular un gasto</Text>
            <Field
              label="Gasto simulado"
              value={simulated}
              onChangeText={setSimulated}
              keyboardType="decimal-pad"
            />
            {simulatedAvailable !== undefined && (
              <Text accessibilityLiveRegion="polite" style={s.amount}>
                Después del gasto: {money(simulatedAvailable, currency)}
              </Text>
            )}
            {!!simulationError && (
              <Text accessibilityRole="alert" style={s.error}>
                {simulationError}
              </Text>
            )}
          </View>
          <View style={s.card}>
            <Text style={s.title}>Compromisos antes del cobro</Text>
            {projection.commitments.length === 0 && (
              <Text style={s.muted}>Sin gastos recurrentes pendientes.</Text>
            )}
            {projection.commitments.map((item) => (
              <View key={item.id} style={s.between}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={s.text}>{item.description}</Text>
                  <Text style={s.muted}>
                    {countLabel(item.occurrences, 'vencimiento', 'vencimientos')} · Desde{' '}
                    {item.firstDueAt.replace('T', ' · ')}
                  </Text>
                </View>
                <Text style={s.amount}>{money(item.totalMinor, currency)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}
