import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { countLabel, type Movement, type Category, type Currency } from '@flowsaldo/domain';
import type { FinancialAccount } from './FinancePanel';
import { MovementForm, type Draft } from './MovementForm';
import type { ReviewItem } from './reviews';
import { Button, Choice } from './ui';
import { styles as s, palette } from './theme';
export function ReviewInbox({
  items,
  currency,
  month,
  onResolve,
  onDiscard,
  onOriginal,
  onSuggestion,
  total,
  showHistory = false,
  categories,
  onMovement,
  money,
  onRetry,
  accounts,
}: {
  accounts?: FinancialAccount[];
  onRetry?: (id: string) => Promise<void>;
  onMovement: (id: string) => Promise<Movement | null>;
  money: (minor: number, currency: Currency) => string;
  categories: Category[];
  total?: number;
  showHistory?: boolean;
  items: ReviewItem[];
  currency: Currency;
  month: string;
  onResolve: (id: string, draft: Draft) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
  onOriginal: (id: string) => Promise<string>;
  onSuggestion?: (id: string) => Promise<Movement | undefined>;
}) {
  const [retry, setRetry] = useState<string | null>(null);
  const [movement, setMovement] = useState<Movement | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Movement>();
  const [discard, setDiscard] = useState<string | null>(null);
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = showHistory ? items : items.filter((i) => i.status === 'REVIEW');
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la revisión.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={s.eyebrow}>TU CRITERIO ES PRIMERO</Text>
        <Text style={s.title}>
          {showHistory
            ? countLabel(total ?? pending.length, 'correo', 'correos')
            : countLabel(total ?? pending.length, 'movimiento', 'movimientos') + ' por confirmar'}
        </Text>
        <Text style={s.muted}>
          Ningún pendiente afecta tus totales hasta que confirmes todos sus datos.
        </Text>
      </View>
      {movement && (
        <View style={s.card}>
          <Text style={s.title}>Movimiento generado</Text>
          <Text style={s.text}>{movement.description}</Text>
          <Text style={s.text}>
            {money(movement.amountMinor, movement.currency)} · {movement.occurredAt.slice(0, 10)}
          </Text>
          <Text style={s.muted}>
            {movement.category} · Referencia: {movement.id}
          </Text>
          <Button label="Cerrar movimiento generado" onPress={() => setMovement(null)} />
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!pending.length && (
        <View style={s.card}>
          <Text style={s.income}>Sin resultados</Text>
          <Text style={s.muted}>No hay correos con estos filtros.</Text>
        </View>
      )}
      {pending.map((item) => (
        <View key={item.id} style={[s.card, { borderColor: '#2d3748' }]}>
          <View style={s.between}>
            <Text style={s.title}>{item.suggestion?.description ?? item.externalId}</Text>
            <Text style={{ color: palette.amber }}>
              {
                {
                  REVIEW: '● Por revisar',
                  PENDING: 'En cola',
                  PROCESSING: 'Procesando',
                  FAILED: 'Con error',
                  PARSED: 'Confirmado',
                  DISMISSED: 'Descartado',
                }[item.status]
              }
            </Text>
          </View>
          {item.attempts !== undefined && (
            <Text style={s.muted}>
              Intentos del ciclo: {item.attempts} · Reintentos manuales: {item.manualRetries ?? 0}
            </Text>
          )}
          {item.lastErrorCode && (
            <Text style={s.muted}>Código de resultado: {item.lastErrorCode}</Text>
          )}
          {item.status === 'PENDING' && (item.attempts ?? 0) > 0 && item.nextAttemptAt && (
            <Text style={s.muted}>
              Reintento programado (UTC): {item.nextAttemptAt.slice(0, 19).replace('T', ' ')}
            </Text>
          )}
          {item.status === 'FAILED' && onRetry && (
            <>
              <Button
                label="Reintentar importación"
                disabled={busy}
                onPress={() => setRetry(item.id)}
              />
              {retry === item.id && (
                <>
                  <Text style={s.muted}>
                    ¿Reencolar este aviso? Se iniciará otro ciclo limitado de intentos. No se creará
                    un movimiento hasta que se procese.
                  </Text>
                  <View style={s.row}>
                    <Button
                      label="Confirmar reintento de importación"
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          await onRetry(item.id);
                          setRetry(null);
                        })
                      }
                    />
                    <Button
                      label="Cancelar reintento de importación"
                      disabled={busy}
                      onPress={() => setRetry(null)}
                    />
                  </View>
                </>
              )}
            </>
          )}
          {!!item.createdAt && <Text style={s.muted}>Recibido: {item.createdAt.slice(0, 10)}</Text>}
          <View style={[s.banner, { backgroundColor: palette.raised }]}>
            <Text style={s.muted}>
              {item.reason ??
                {
                  REVIEW: 'Revisa los datos antes de confirmar.',
                  PENDING: 'El aviso espera su turno en la cola.',
                  PROCESSING: 'El aviso se está procesando. Puede recuperarse si se interrumpe.',
                  FAILED: 'El procesamiento requiere atención antes de reintentar.',
                  PARSED: 'Este aviso ya se incorporó a los movimientos.',
                  DISMISSED: 'Este aviso se descartó sin contabilizar.',
                }[item.status]}
            </Text>
          </View>
          {item.status === 'REVIEW' &&
            (editing === item.id ? (
              <MovementForm
                accounts={accounts}
                categories={categories}
                title="Confirmar movimiento"
                movement={suggestion ?? item.suggestion}
                currency={currency}
                month={month}
                onSave={async (draft) => {
                  await onResolve(item.id, draft);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <View style={s.row}>
                <Button
                  label="Revisar y confirmar"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      const bank =
                        item.parserVersion === 'bhd-withdrawal-v1' ||
                        item.parserVersion === 'popular-withdrawal-v1';
                      setSuggestion(bank ? await onSuggestion?.(item.id) : undefined);
                      setEditing(item.id);
                    })
                  }
                />
                <Choice label="Descartar" selected={false} onPress={() => setDiscard(item.id)} />
              </View>
            ))}
          {discard === item.id && (
            <>
              <Text style={s.error}>¿Descartar este correo sin crear un movimiento?</Text>
              <View style={s.row}>
                <Button
                  label="Confirmar descarte"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await onDiscard(item.id);
                      setDiscard(null);
                    })
                  }
                />
                <Button label="Cancelar descarte" onPress={() => setDiscard(null)} />
              </View>
            </>
          )}
          {item.status === 'PARSED' &&
            (item.movement ? (
              <Button
                label="Ver movimiento generado"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    const found = await onMovement(item.movement!.id);
                    if (!found) throw new Error('El movimiento generado ya no está disponible.');
                    setMovement(found);
                  })
                }
              />
            ) : (
              <Text style={s.muted}>El movimiento generado ya no está disponible.</Text>
            ))}
          <Choice
            label={original[item.id] ? 'Ocultar correo de prueba' : 'Ver correo de prueba'}
            selected={!!original[item.id]}
            onPress={() =>
              void run(async () => {
                if (original[item.id]) setOriginal((prev) => ({ ...prev, [item.id]: '' }));
                else {
                  const body = item.body ?? (await onOriginal(item.id));
                  setOriginal((prev) => ({
                    ...prev,
                    [item.id]: body || 'Sin contenido disponible.',
                  }));
                }
              })
            }
          />
          {!!original[item.id] && (
            <Text selectable style={s.muted}>
              {original[item.id]}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
