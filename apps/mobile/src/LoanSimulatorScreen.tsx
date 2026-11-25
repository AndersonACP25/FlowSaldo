import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  currencies,
  compareLoanTerms,
  countLabel,
  maxLoanRateBasisPoints,
  parseAmount,
  parseSignedAmount,
  simulateLoan,
  type Currency,
} from '@flowsaldo/domain';
import { DateTimeField } from './DateTimeField';
import { FilterRow } from './ScreenChrome';
import { useTheme } from './theme';
import { Button, Choice, Field } from './ui';

const pageSize = 12;
const optionalAmount = (value: string) => parseSignedAmount(value.trim() || '0');

const amountFields = [
  ['principal', 'Monto del préstamo', 'decimal-pad'],
  ['rate', 'Tasa nominal anual (%)', 'decimal-pad'],
  ['count', 'Número de cuotas mensuales', 'number-pad'],
  ['fee', 'Comisión inicial (opcional)', 'decimal-pad'],
  ['insurance', 'Seguro mensual (opcional)', 'decimal-pad'],
] as const;

export function LoanSimulatorScreen({
  defaultCurrency,
  money,
}: {
  defaultCurrency: Currency;
  money: (minor: number, currency: Currency) => string;
}) {
  const { styles: s } = useTheme();
  const [currency, setCurrency] = useState(defaultCurrency);
  const [fields, setFields] = useState({
    principal: '',
    rate: '',
    count: '',
    fee: '',
    insurance: '',
  });
  const [firstDueAt, setFirstDueAt] = useState('');
  const [result, setResult] = useState<ReturnType<typeof simulateLoan>>();
  const [scenarios, setScenarios] = useState<ReturnType<typeof compareLoanTerms>>([]);
  const [error, setError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [page, setPage] = useState(0);

  function clearResult() {
    setResult(undefined);
    setScenarios([]);
    setError('');
    setShowSchedule(false);
    setPage(0);
  }

  function calculate() {
    clearResult();
    try {
      const input = {
        principalMinor: parseAmount(fields.principal),
        currency,
        annualRateBasisPoints: parseSignedAmount(fields.rate, maxLoanRateBasisPoints),
        upfrontFeeMinor: optionalAmount(fields.fee),
        monthlyInsuranceMinor: optionalAmount(fields.insurance),
      };
      const count = fields.count.trim();
      if (!count) {
        setScenarios(compareLoanTerms(input));
        return;
      }
      if (!/^\d+$/.test(count)) throw new Error('Indica un número entero de cuotas.');
      setResult(simulateLoan({ ...input, installmentCount: Number(count), firstDueAt }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo calcular el préstamo.');
    }
  }

  const amount = (minor: number) => money(minor, result?.currency ?? currency);
  const first = result?.schedule[0];
  const last = result?.schedule.at(-1);
  const visible = result?.schedule.slice(page * pageSize, (page + 1) * pageSize) ?? [];
  const pages = Math.ceil((result?.schedule.length ?? 0) / pageSize);

  return (
    <>
      <View style={s.card}>
        <FilterRow label="Moneda del préstamo">
          {currencies.map((unit) => (
            <Choice
              key={unit}
              label={unit}
              selected={currency === unit}
              onPress={() => {
                setCurrency(unit);
                clearResult();
              }}
            />
          ))}
        </FilterRow>
        {amountFields.map(([key, label, keyboardType]) => (
          <Field
            key={key}
            label={label}
            value={fields[key]}
            keyboardType={keyboardType}
            placeholder={key === 'count' ? 'Deja vacío para comparar plazos' : undefined}
            maxLength={16}
            onChangeText={(value) => {
              setFields((current) => ({ ...current, [key]: value }));
              clearResult();
            }}
          />
        ))}
        <DateTimeField
          label="Fecha y hora del primer pago (opcional)"
          clearable
          value={firstDueAt}
          onChange={(date) => {
            setFirstDueAt(date);
            clearResult();
          }}
        />
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
        <Button label="Calcular préstamo" onPress={calculate} />
      </View>
      {scenarios.length > 0 && (
        <View style={s.card}>
          <Text accessibilityRole="header" style={s.title}>
            Comparación de plazos
          </Text>
          {scenarios.map((scenario) => (
            <View key={scenario.installmentCount} style={s.banner}>
              <Text style={s.label}>
                {countLabel(scenario.installmentCount, 'cuota', 'cuotas')}
              </Text>
              <Text style={s.amount}>
                Primera cuota estimada · {amount(scenario.firstPaymentMinor)}
              </Text>
              <Text style={s.muted}>
                Costo · {amount(scenario.totalCostMinor)} · Total ·{' '}
                {amount(scenario.totalPaidMinor)}
              </Text>
              <Choice
                label={`Elegir ${countLabel(scenario.installmentCount, 'cuota', 'cuotas')}`}
                selected={false}
                onPress={() => {
                  setFields((current) => ({
                    ...current,
                    count: String(scenario.installmentCount),
                  }));
                  clearResult();
                }}
              />
            </View>
          ))}
        </View>
      )}
      {result && first && last && (
        <>
          <View style={s.hero} accessibilityLiveRegion="polite">
            <Text style={s.label}>Primera cuota estimada</Text>
            <Text style={s.heroValue}>{amount(first.paymentMinor)}</Text>
            {last.dueAt && (
              <Text style={s.muted}>Último pago · {last.dueAt.replace('T', ' · ')}</Text>
            )}
          </View>
          <View style={s.metrics}>
            {(
              [
                ['Capital', result.principalMinor],
                ['Intereses', result.totalInterestMinor],
                ['Seguro', result.totalInsuranceMinor],
                ['Comisión inicial', result.upfrontFeeMinor],
                ['Costo del préstamo', result.totalCostMinor],
                ['Total a pagar', result.totalPaidMinor],
              ] as const
            ).map(([label, value]) => (
              <View key={label} style={s.metric}>
                <Text style={s.muted}>{label}</Text>
                <Text style={s.amount}>{amount(value)}</Text>
              </View>
            ))}
          </View>
          <Text style={s.muted}>
            Estimación con tasa fija sobre el saldo y pagos mensuales en hora dominicana. La
            comisión se paga al inicio y el seguro se suma a cada cuota. El redondeo puede ajustar
            los importes.
          </Text>
          <Choice
            label={showSchedule ? 'Ocultar amortización' : 'Ver amortización'}
            selected={showSchedule}
            onPress={() => setShowSchedule(!showSchedule)}
          />
          {showSchedule && (
            <View style={s.card}>
              <Text accessibilityRole="header" style={s.title}>
                Amortización
              </Text>
              {visible.map((item) => (
                <View key={item.number} style={{ gap: 4, paddingVertical: 6 }}>
                  <View style={s.between}>
                    <Text style={s.text}>
                      Cuota {item.number}
                      {item.dueAt ? ' · ' + item.dueAt.replace('T', ' · ') : ''}
                    </Text>
                    <Text style={s.amount}>{amount(item.paymentMinor)}</Text>
                  </View>
                  <Text style={s.muted}>
                    Capital {amount(item.principalMinor)} · Interés {amount(item.interestMinor)}
                    {item.insuranceMinor > 0 ? ` · Seguro ${amount(item.insuranceMinor)}` : ''}
                  </Text>
                  <Text style={s.muted}>Saldo restante · {amount(item.remainingMinor)}</Text>
                </View>
              ))}
              {pages > 1 && (
                <View style={s.between}>
                  <Choice
                    label="Cuotas anteriores"
                    selected={false}
                    disabled={page === 0}
                    onPress={() => setPage(page - 1)}
                  />
                  <Text style={s.muted}>
                    {page + 1} de {pages}
                  </Text>
                  <Choice
                    label="Cuotas siguientes"
                    selected={false}
                    disabled={page >= pages - 1}
                    onPress={() => setPage(page + 1)}
                  />
                </View>
              )}
            </View>
          )}
        </>
      )}
    </>
  );
}
