import React from 'react';
import { Text, View } from 'react-native';
import { styles as s } from './theme';
import { Button } from './ui';
export interface ImportStats {
  counts: {
    PENDING: number;
    PROCESSING: number;
    FAILED: number;
    REVIEW: number;
    PARSED: number;
    DISMISSED: number;
  };
  scheduledRetries: number;
  expiredLeases: number;
  nextRetryAt: string | null;
  lastProcessedAt: string | null;
}
export function ImportQueue({
  data,
  loading,
  error,
  onRefresh,
  onErrors,
}: {
  data?: ImportStats;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
  onErrors: () => void;
}) {
  return (
    <View style={s.card}>
      <Text style={s.title}>Estado de importaciones</Text>
      <Text style={s.muted}>
        Estado registrado en la API. Esta información no confirma que el worker esté conectado.
      </Text>
      {loading && !data && <Text style={s.muted}>Cargando cola…</Text>}
      {error ? (
        <Text style={s.error}>No se pudo actualizar el estado de la cola.</Text>
      ) : (
        data && (
          <>
            <View style={s.metrics}>
              {(
                [
                  { key: 'PENDING', label: 'En cola' },
                  { key: 'PROCESSING', label: 'Procesando' },
                  { key: 'REVIEW', label: 'Por revisar' },
                  { key: 'FAILED', label: 'Con error' },
                ] as const
              ).map((item) => (
                <View key={item.key} style={s.metric}>
                  <Text style={s.muted}>{item.label}</Text>
                  <Text style={s.amount}>{data.counts[item.key]}</Text>
                </View>
              ))}
            </View>
            <Text style={s.muted}>
              Reintentos programados: {data.scheduledRetries} · Procesamientos a recuperar:{' '}
              {data.expiredLeases}
            </Text>
            {data.nextRetryAt && (
              <Text style={s.muted}>
                Próximo reintento (UTC): {data.nextRetryAt.slice(0, 19).replace('T', ' ')}
              </Text>
            )}
            {data.lastProcessedAt && (
              <Text style={s.muted}>
                Último resultado registrado (UTC):{' '}
                {data.lastProcessedAt.slice(0, 19).replace('T', ' ')}
              </Text>
            )}
            {data.counts.FAILED > 0 && (
              <Button label="Ver importaciones con error" onPress={onErrors} />
            )}
          </>
        )
      )}
      <Button
        label={loading ? 'Actualizando cola…' : 'Actualizar estado de importaciones'}
        disabled={loading}
        onPress={onRefresh}
      />
    </View>
  );
}
