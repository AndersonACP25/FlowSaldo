import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import {
  recurringIsDue,
  recurringOccurrenceAt,
  type Category,
  type Currency,
  type RecurringTemplate,
} from '@flowsaldo/domain';
import { MovementForm, type Draft } from './MovementForm';
import { Button } from './ui';
import { useTheme } from './theme';
export function RecurringPanel({
  items,
  categories,
  currency,
  month,
  onSave,
  onCreate,
  onToggle,
  onConfirm,
  money,
}: {
  items: RecurringTemplate[];
  categories: Category[];
  currency: Currency;
  month: string;
  onSave: (draft: Draft, id: string) => Promise<void>;
  onCreate: () => void;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onConfirm: (template: RecurringTemplate) => Promise<void>;
  money: (value: number, currency: Currency) => string;
}) {
  const { styles: s } = useTheme();
  const [editor, setEditor] = useState<RecurringTemplate | null>(null);
  const [confirm, setConfirm] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
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
      <Text style={s.muted}>{currency} · Confirma cada vencimiento para registrarlo.</Text>
      <Button label="Nueva plantilla mensual" disabled={busy || !!editor} onPress={onCreate} />
      {editor && (
        <MovementForm
          saveLabel="Guardar plantilla mensual"
          key={editor.id}
          categories={categories}
          currency={currency}
          month={month}
          title="Editar plantilla mensual"
          editing
          fixedDate
          movement={{
            ...editor,
            occurredAt: recurringOccurrenceAt(editor.nextDate, editor.timeOfDay),
          }}
          onSave={async (draft) => {
            await onSave(draft, editor.id);
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
              ? recurringIsDue(item, now)
                ? 'Pendiente de registrar'
                : 'Próximo vencimiento'
              : 'Pausada'}
            : {item.nextDate}
            {item.timeOfDay ? ` · ${item.timeOfDay}` : ''} · Día {item.anchorDay} de cada mes
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
                disabled={busy || !recurringIsDue(item, now)}
                onPress={() => setConfirm(item.id)}
              />
            )}
          </View>
          {confirm === item.id && (
            <>
              <Text style={s.muted}>
                ¿Registrar {money(item.amountMinor, item.currency)} con fecha {item.nextDate}
                {item.timeOfDay ? ` a las ${item.timeOfDay}` : ''}?
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
