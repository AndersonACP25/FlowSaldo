import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { type Currency, type DebtPlan, type DebtPlanDraft } from '@flowsaldo/domain';
import { IconButton } from './IconButton';
import { FilterRow } from './ScreenChrome';
import { useTheme } from './theme';
import { Button, Choice } from './ui';

import { DebtPlanForm } from './DebtPlanForm';
import { DebtComparison } from './DebtComparison';

type Money = (amountMinor: number, currency: Currency) => string;

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
