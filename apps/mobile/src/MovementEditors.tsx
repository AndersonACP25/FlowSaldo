import React from 'react';
import { Text, View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Category, CommerceRule, Currency, Movement } from '@flowsaldo/domain';
import { MovementForm, type Draft, type MovementAccount } from './MovementForm';
import { RefundScreen } from './RefundScreen';
import { useTheme } from './theme';
import { Button } from './ui';
import type { useMovementHistory } from './useMovementHistory';

export function MovementEditor({
  editor,
  duplicate,
  fullScreen,
  connected,
  accountsQuery,
  movementAccounts,
  catalogReady,
  categoryCatalog,
  commerceRules,
  recent,
  currency,
  month,
  onSave,
  onCancel,
}: {
  editor: Movement | 'new';
  duplicate: Movement | null;
  fullScreen: boolean;
  connected: boolean;
  accountsQuery: Pick<UseQueryResult, 'isSuccess' | 'error' | 'refetch'>;
  movementAccounts?: MovementAccount[];
  catalogReady: boolean;
  categoryCatalog: Category[];
  commerceRules: CommerceRule[];
  recent: string[];
  currency: Currency;
  month: string;
  onSave: (draft: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const { styles: s } = useTheme();
  return (
    <>
      {connected && !accountsQuery.isSuccess && (
        <View style={s.card}>
          <Text style={s.muted}>
            {accountsQuery.error ? 'No se pudieron cargar las cuentas.' : 'Cargando cuentas…'}
          </Text>
          {accountsQuery.error && (
            <Button label="Reintentar cuentas" onPress={() => void accountsQuery.refetch()} />
          )}
        </View>
      )}
      {catalogReady && (!connected || accountsQuery.isSuccess) && (
        <MovementForm
          allowSplits
          commerceRules={commerceRules}
          accounts={movementAccounts}
          localAccounts={!connected}
          categories={categoryCatalog}
          recent={recent}
          editing={editor !== 'new'}
          title={fullScreen ? null : duplicate ? 'Duplicar movimiento' : undefined}
          key={editor === 'new' ? 'new-' + (duplicate?.id ?? '') : editor.id}
          movement={editor === 'new' ? (duplicate ?? undefined) : editor}
          currency={currency}
          month={month}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
    </>
  );
}

export function RefundEditor({
  requestKey,
  connected,
  refundQuery,
  refundInfo,
  busy,
  money,
  onSave,
}: {
  requestKey: string;
  connected: boolean;
  refundQuery: Pick<UseQueryResult, 'isSuccess' | 'isError' | 'refetch'>;
  refundInfo: ReturnType<typeof useMovementHistory>['refundInfo'];
  busy: boolean;
  money: (minor: number, currency: Currency) => string;
  onSave: (amountMinor: number, occurredAt: string) => Promise<void>;
}) {
  const { styles: s } = useTheme();
  return connected && !refundQuery.isSuccess ? (
    <View style={s.card}>
      <Text style={s.muted}>
        {refundQuery.isError ? 'No se pudo consultar el gasto.' : 'Consultando gasto…'}
      </Text>
      {refundQuery.isError && (
        <Button label="Reintentar consulta del gasto" onPress={() => void refundQuery.refetch()} />
      )}
    </View>
  ) : (
    refundInfo && (
      <RefundScreen
        key={requestKey}
        source={refundInfo.source}
        refundedMinor={refundInfo.refundedMinor}
        remainingMinor={refundInfo.remainingMinor}
        saving={busy}
        money={money}
        onSave={onSave}
      />
    )
  );
}
