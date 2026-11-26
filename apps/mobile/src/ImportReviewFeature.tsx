import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { Category, Currency } from '@flowsaldo/domain';
import type { UseQueryResult } from '@tanstack/react-query';
import { DateTimeField } from './DateTimeField';
import type { MovementAccount } from './MovementForm';
import { ReviewInbox } from './ReviewInbox';
import { FilterChip, FilterRow, filterStyles } from './ScreenChrome';
import { useTheme } from './theme';
import { Button } from './ui';
import type { useImportReviews } from './useImportReviews';

export function ImportReviewFeature({
  model,
  connected,
  accountsQuery,
  movementAccounts,
  categoryCatalog,
  month,
  currency,
  money,
}: {
  model: ReturnType<typeof useImportReviews>;
  connected: boolean;
  accountsQuery: Pick<UseQueryResult, 'isSuccess' | 'error' | 'refetch'>;
  movementAccounts?: MovementAccount[];
  categoryCatalog: Category[];
  month: string;
  currency: Currency;
  money: (minor: number, currency: Currency) => string;
}) {
  const { styles: s, palette } = useTheme();
  const {
    imports,
    reviewStatus,
    reviewDateError,
    reviewFrom,
    reviewTo,
    reviewParams,
    reviews,
    setReviewStatus,
    setReviewFrom,
    setReviewTo,
    resetFilters,
    retryImport,
    resolveReview,
    discardReview,
    getReviewedMovement,
    getSuggestion,
  } = model;
  return (
    <>
      <View style={s.card}>
        <Text style={s.title}>Filtros de revisiones</Text>
        <FilterRow label="Filtrar por estado">
          {(
            ['REVIEW', 'PENDING', 'PROCESSING', 'FAILED', 'PARSED', 'DISMISSED', 'ALL'] as const
          ).map((status) => (
            <FilterChip
              key={status}
              label={
                {
                  REVIEW: 'Por confirmar',
                  PENDING: 'En cola',
                  PROCESSING: 'Procesando',
                  FAILED: 'Con error',
                  PARSED: 'Confirmados',
                  DISMISSED: 'Descartados',
                  ALL: 'Todos los estados',
                }[status]
              }
              selected={reviewStatus === status}
              onPress={() => setReviewStatus(status)}
            />
          ))}
        </FilterRow>
        <Text style={s.label}>Fecha de recepción · hora dominicana</Text>
        <View style={filterStyles.dates}>
          <View style={filterStyles.date}>
            <DateTimeField
              label="Recibido desde"
              value={reviewFrom}
              onChange={setReviewFrom}
              clearable
            />
          </View>
          <View style={filterStyles.date}>
            <DateTimeField
              label="Recibido hasta"
              value={reviewTo}
              onChange={setReviewTo}
              clearable
            />
          </View>
        </View>
        {!!reviewDateError && (
          <Text accessibilityRole="alert" style={s.error}>
            Selecciona fechas y horas válidas. El inicio debe ser anterior o igual al fin.
          </Text>
        )}
        <Button label="Limpiar filtros de revisiones" onPress={() => resetFilters()} />
      </View>
      {connected && imports.isFetching && <ActivityIndicator color={palette.primary} />}
      {connected && imports.error && <Text style={s.error}>{imports.error.message}</Text>}
      {connected && <Button label="Actualizar revisiones" onPress={() => void imports.refetch()} />}
      {connected && !accountsQuery.isSuccess && (
        <View style={s.card}>
          <Text style={s.muted}>
            {accountsQuery.error
              ? 'No se pudieron cargar las cuentas para revisar.'
              : 'Cargando cuentas para revisar…'}
          </Text>
          <Button
            label="Reintentar cuentas de revisión"
            onPress={() => void accountsQuery.refetch()}
          />
        </View>
      )}
      {!reviewDateError && (!connected || (imports.isSuccess && accountsQuery.isSuccess)) && (
        <ReviewInbox
          accounts={movementAccounts}
          localAccounts={!connected}
          onRetry={connected ? retryImport : undefined}
          money={money}
          onMovement={getReviewedMovement}
          categories={categoryCatalog}
          key={reviewParams}
          total={connected ? imports.data?.pages[0]?.total : reviews.length}
          showHistory={reviewStatus !== 'REVIEW'}
          items={reviews}
          month={month}
          currency={currency}
          onResolve={resolveReview}
          onDiscard={discardReview}
          onSuggestion={connected ? getSuggestion : undefined}
        />
      )}
      {connected && imports.hasNextPage && (
        <Button
          label={imports.isFetchingNextPage ? 'Cargando revisiones…' : 'Cargar más revisiones'}
          disabled={imports.isFetching}
          onPress={() => void imports.fetchNextPage()}
        />
      )}
    </>
  );
}
