import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  compareDebtPlan,
  countLabel,
  currencies,
  parseAmount,
  parseSignedAmount,
  type Currency,
  type DebtPlan,
  type DebtPlanDraft,
} from '@flowsaldo/domain';
import { DateTimeField } from './DateTimeField';
import { IconButton } from './IconButton';
import { FilterRow } from './ScreenChrome';
import { useTheme } from './theme';
import { Button, Choice, Field } from './ui';

type Money = (amountMinor: number, currency: Currency) => string;

const typeLabels = { card: 'Tarjeta de crédito', loan: 'Préstamo' };
const amountFields = [
  ['principalMinor', 'Capital pendiente', true],
  ['statementInterestMinor', 'Interés al corte', false],
  ['chargesMinor', 'Cargos al corte', false],
  ['annualRateBasisPoints', 'Tasa nominal anual (%)', false],
  ['monthlyPaymentMinor', 'Cuota mensual', true],
  ['extraMonthlyMinor', 'Abono adicional mensual', false],
] as const;

export function DebtPlansScreen({
  plans,
  defaultCurrency,
  saving,
  money,
  onSave,
  onRemove,
}: {
  plans: DebtPlan[];
  defaultCurrency: Currency;
  saving: boolean;
  money: Money;
  onSave: (input: DebtPlanDraft, id?: string) => Promise<string>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { styles: s } = useTheme();
  const [selectedId, setSelectedId] = useState(plans[0]?.id);
  const [editor, setEditor] = useState<'new' | DebtPlan>();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0];

  return (
    <>
      <View style={s.between}>
        <Button
          label="Nuevo plan de pago"
          disabled={saving || !!editor}
          onPress={() => {
            setError('');
            setNotice('');
            setRemoving(false);
            setEditor('new');
          }}
        />
        {selected && !editor && (
          <View style={s.row}>
            <IconButton
              icon="edit"
              label="Editar plan de pago"
              onPress={() => {
                if (saving) return;
                setRemoving(false);
                setError('');
                setNotice('');
                setEditor(selected);
              }}
            />
            <IconButton
              icon="trash"
              label="Eliminar plan de pago"
              danger
              onPress={() => {
                if (saving) return;
                setError('');
                setNotice('');
                setRemoving(true);
              }}
            />
          </View>
        )}
      </View>
      {plans.length > 0 && !editor && (
        <FilterRow label="Planes guardados">
          {plans.map((plan) => (
            <Choice
              key={plan.id}
              label={`${plan.name} · ${plan.currency}`}
              selected={selected?.id === plan.id}
              disabled={saving}
              onPress={() => {
                setSelectedId(plan.id);
                setRemoving(false);
                setError('');
                setNotice('');
              }}
            />
          ))}
        </FilterRow>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {notice}
        </Text>
      )}
      {editor ? (
        <DebtPlanForm
          key={editor === 'new' ? 'new' : editor.id}
          initial={editor === 'new' ? undefined : editor}
          defaultCurrency={defaultCurrency}
          saving={saving}
          onCancel={() => {
            setEditor(undefined);
            setError('');
          }}
          onSave={async (draft) => {
            setError('');
            const id = await onSave(draft, editor === 'new' ? undefined : editor.id);
            setSelectedId(id);
            setEditor(undefined);
            setNotice('Plan de pago guardado.');
          }}
        />
      ) : selected ? (
        <>
          {removing && (
            <View style={s.card}>
              <Text style={s.text}>¿Eliminar {selected.name}?</Text>
              <View style={s.row}>
                <Button
                  label="Confirmar eliminación del plan"
                  disabled={saving}
                  onPress={() => {
                    setError('');
                    void onRemove(selected.id)
                      .then(() => {
                        setRemoving(false);
                        setNotice('Plan de pago eliminado.');
                      })
                      .catch(() => setError('No se pudo eliminar el plan.'));
                  }}
                />
                <Choice
                  label="Cancelar eliminación"
                  selected={false}
                  disabled={saving}
                  onPress={() => setRemoving(false)}
                />
              </View>
            </View>
          )}
          <DebtComparison plan={selected} money={money} />
        </>
      ) : (
        <Text style={s.muted}>Crea un plan para estimar el pago de una tarjeta o un préstamo.</Text>
      )}
    </>
  );
}

function DebtPlanForm({
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
            label={typeLabels[type]}
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
      <View style={[s.row, { alignItems: 'flex-start' }]}>
        {amountFields.map(([field, label, required]) => (
          <View key={field} style={{ flexGrow: 1, flexBasis: 180, maxWidth: '100%' }}>
            <Field
              label={label}
              value={amounts[field]}
              onChangeText={(value) => setAmounts((current) => ({ ...current, [field]: value }))}
              keyboardType="decimal-pad"
              editable={!saving}
              placeholder={required || field === 'annualRateBasisPoints' ? undefined : '0.00'}
              maxLength={16}
            />
          </View>
        ))}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <View style={s.row}>
        <Button label="Guardar y comparar" disabled={saving} onPress={() => void submit()} />
        <Choice
          label="Cancelar edición del plan"
          text="Cancelar"
          selected={false}
          disabled={saving}
          onPress={onCancel}
        />
      </View>
    </View>
  );
}

function DebtComparison({ plan, money }: { plan: DebtPlan; money: Money }) {
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
          {typeLabels[plan.kind]} · {plan.currency}
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
