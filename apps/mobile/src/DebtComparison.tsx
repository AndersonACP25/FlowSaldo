import React from 'react';
import { Text, View } from 'react-native';
import { compareDebtPlan, countLabel, type Currency, type DebtPlan } from '@flowsaldo/domain';
import { useTheme } from './theme';
import { debtKindLabels } from './debtKindLabels';
type Money = (amountMinor: number, currency: Currency) => string;

export function DebtComparison({ plan, money }: { plan: DebtPlan; money: Money }) {
  const { styles: s } = useTheme();
  const { base, extra, savings } = compareDebtPlan(plan);
  const format = (minor: number) => money(minor, plan.currency);
  const date = (value: string) => value.replace('T', ' · ');

  function scenario(title: string, result: typeof base, monthly: number) {
    const messages = {
      'first-payment-too-low': 'La primera cuota no cubre los intereses y cargos al corte.',
      'interest-too-high': 'La cuota no reduce el capital con la tasa indicada.',
      'beyond-horizon': 'La deuda supera el horizonte de 600 cuotas.',
    };
    return (
      <View style={[s.card, { flexGrow: 1, flexBasis: 250, maxWidth: '100%' }]}>
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
        <Text style={s.muted}>Cuota mensual · {format(monthly)}</Text>
        {result.status === 'paid' ? (
          <>
            <Text style={s.heroValue}>{countLabel(result.months, 'cuota', 'cuotas')}</Text>
            <Text style={s.text}>Último pago estimado · {date(result.payoffAt)}</Text>
            <Text style={s.text}>Interés total · {format(result.interestMinor)}</Text>
            <Text style={s.text}>Total a pagar · {format(result.totalMinor)}</Text>
            <Text style={s.muted}>
              Primer pago · {format(result.first.paymentMinor)} (
              {format(result.first.principalMinor)} a capital)
            </Text>
          </>
        ) : (
          <Text style={s.error}>{messages[result.status]}</Text>
        )}
      </View>
    );
  }

  return (
    <>
      <View style={s.hero}>
        <Text style={s.label}>
          {debtKindLabels[plan.kind]} · {plan.currency}
        </Text>
        <Text style={s.title}>{plan.name}</Text>
        <Text style={s.heroValue}>{format(plan.principalMinor)}</Text>
        <Text style={s.muted}>Capital pendiente</Text>
        <Text style={s.text}>Corte · {date(plan.statementAt)}</Text>
        <Text style={s.text}>Próximo vencimiento · {date(plan.dueAt)}</Text>
        <Text style={s.muted}>
          Interés al corte · {format(plan.statementInterestMinor)} · Cargos ·{' '}
          {format(plan.chargesMinor)}
        </Text>
      </View>
      {savings && (
        <View style={s.card}>
          <Text style={s.success}>
            {format(savings.interestMinor)} menos en intereses ·{' '}
            {countLabel(savings.months, 'cuota menos', 'cuotas menos')}
          </Text>
        </View>
      )}
      <View style={[s.row, { alignItems: 'stretch' }]}>
        {scenario('Cuota base', base, plan.monthlyPaymentMinor)}
        {extra &&
          scenario('Con abono adicional', extra, plan.monthlyPaymentMinor + plan.extraMonthlyMinor)}
      </View>
      <Text style={s.muted}>
        Estimación con tasa fija de {plan.annualRateBasisPoints / 100} % anual dividida entre 12. La
        primera cuota usa el interés y los cargos al corte. Las siguientes aplican interés sobre el
        capital pendiente. Supone pagos mensuales, sin compras ni cargos nuevos.
      </Text>
    </>
  );
}
