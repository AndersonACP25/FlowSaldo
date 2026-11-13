import React, { useState } from 'react';
import { View, Text } from 'react-native';
import type { Category, Currency, RecurringTemplate } from '@flowsaldo/domain';
import { MovementForm, type Draft } from './MovementForm';
import { Button } from './ui';
import { styles as s } from './theme';
export function RecurringPanel({
  items,
  categories,
  currency,
  month,
  onSave,
  onToggle,
  onConfirm,
  money,
}: {
  items: RecurringTemplate[];
  categories: Category[];
  currency: Currency;
  month: string;
  onSave: (draft: Draft, id?: string) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onConfirm: (template: RecurringTemplate) => Promise<void>;
  money: (value: number, currency: Currency) => string;
}) {
  const [editor, setEditor] = useState<RecurringTemplate | 'new' | null>(null);
  const [confirm, setConfirm] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  async function run(work: () => Promise<void>, message: string) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await work();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.title}>Movimientos recurrentes</Text>
      <Text style={s.muted}>
        Plantillas mensuales de {currency}. El vencimiento no se contabiliza hasta confirmarlo. Se
        muestran también fechas fuera del mes del historial. Pausar conserva los vencimientos
        pendientes.
      </Text>
      <Button
        label="Nueva plantilla mensual"
        disabled={busy || !!editor}
        onPress={() => setEditor('new')}
      />
      {editor && (
        <MovementForm
          saveLabel="Guardar plantilla mensual"
          key={editor === 'new' ? 'new' : editor.id}
          categories={categories}
          currency={currency}
          month={month}
          title={editor === 'new' ? 'Crear plantilla mensual' : 'Editar plantilla mensual'}
          editing={editor !== 'new'}
          fixedDate={editor !== 'new'}
          movement={
            editor === 'new'
              ? undefined
              : { ...editor, occurredAt: editor.nextDate + 'T12:00:00.000Z' }
          }
          onSave={async (draft) => {
            await onSave(draft, editor === 'new' ? undefined : editor.id);
            setEditor(null);
            setNotice('Plantilla mensual guardada.');
          }}
          onCancel={() => setEditor(null)}
        />
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
      {!items.length && <Text style={s.muted}>Todavía no tienes plantillas en esta moneda.</Text>}
      {items.map((item) => (
        <View key={item.id} style={{ gap: 10 }}>
          <Text style={s.text}>
            {item.description} · {money(item.amountMinor, item.currency)}
          </Text>
          <Text style={s.muted}>
            {item.active
              ? item.nextDate <= today
                ? 'Pendiente de registrar'
                : 'Próximo vencimiento'
              : 'Pausada'}
            : {item.nextDate} · Día {item.anchorDay} de cada mes (ajustado al último día si hace
            falta).
          </Text>
          <View style={s.row}>
            <Button
              label={`Editar plantilla ${item.description}`}
              text="Editar"
              disabled={busy || !!editor}
              onPress={() => setEditor(item)}
            />
            <Button
              label={`${item.active ? 'Pausar' : 'Reactivar'} plantilla ${item.description}`}
              text={item.active ? 'Pausar' : 'Reactivar'}
              disabled={busy}
              onPress={() =>
                void run(() => onToggle(item.id, !item.active), 'Plantilla actualizada.')
              }
            />
            {item.active && (
              <Button
                label={`Registrar vencimiento ${item.description}`}
                text="Registrar vencimiento"
                disabled={busy || item.nextDate > today}
                onPress={() => setConfirm(item.id)}
              />
            )}
          </View>
          {confirm === item.id && (
            <>
              <Text style={s.muted}>
                ¿Registrar {money(item.amountMinor, item.currency)} con fecha {item.nextDate}? Esta
                acción crea un movimiento.
              </Text>
              <View style={s.row}>
                <Button
                  label="Confirmar registro de vencimiento"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await onConfirm(item);
                      setConfirm(undefined);
                    }, 'Vencimiento registrado una sola vez.')
                  }
                />
                <Button
                  label="Cancelar registro de vencimiento"
                  disabled={busy}
                  onPress={() => setConfirm(undefined)}
                />
              </View>
            </>
          )}
        </View>
      ))}
    </View>
  );
}
