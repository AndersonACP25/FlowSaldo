import React from 'react';
import { Text, View } from 'react-native';
import {
  pendingRemaining,
  type Currency,
  type Movement,
  type PendingItem,
  type RecurringTemplate,
} from '@flowsaldo/domain';
import { CashProjectionScreen } from './CashProjectionScreen';
import { cashProjectionKey, type LocalScope } from './dataScopes';
import type { LocalData, LocalUpdate } from './storage';
import { useTheme } from './theme';
import { Button } from './ui';

interface QueryReadState {
  isError: boolean;
  refetch: () => Promise<unknown>;
}

export function CashProjectionFeature({
  dataScope,
  currency,
  onCurrency,
  connected,
  recurringQuery,
  templates,
  pending,
  movements,
  pendingLinksQuery,
  pendingLinksReady,
  projections,
  saving,
  money,
  persist,
  saveForm,
}: {
  dataScope: LocalScope;
  currency: Currency;
  onCurrency: (currency: Currency) => void;
  connected: boolean;
  recurringQuery: QueryReadState & { isSuccess: boolean };
  templates: RecurringTemplate[];
  pending: PendingItem[];
  movements: ReadonlyMap<string, Movement>;
  pendingLinksQuery: QueryReadState;
  pendingLinksReady: boolean;
  projections: LocalData['cashProjections'];
  saving: boolean;
  money: (amountMinor: number, currency: Currency) => string;
  persist: (update: LocalUpdate) => Promise<void>;
  saveForm: (save: () => Promise<void>) => Promise<void>;
}) {
  const { styles: s } = useTheme();
  const projectionKey = cashProjectionKey(dataScope, currency);
  return (!connected || recurringQuery.isSuccess) && pendingLinksReady ? (
    <CashProjectionScreen
      key={projectionKey}
      currency={currency}
      onCurrency={onCurrency}
      templates={templates}
      pending={pending.map((item) => ({
        ...item,
        remainingMinor: pendingRemaining(item, movements),
      }))}
      saved={projections[projectionKey]}
      saving={saving}
      onSave={(plan) =>
        saveForm(() =>
          persist((current) => ({
            ...current,
            cashProjections: {
              ...current.cashProjections,
              [projectionKey]: plan,
            },
          })),
        )
      }
      money={money}
    />
  ) : (
    <View style={s.card}>
      <Text style={s.muted}>
        {recurringQuery.isError || pendingLinksQuery.isError
          ? 'No se pudieron cargar los compromisos.'
          : 'Cargando compromisos…'}
      </Text>
      {(recurringQuery.isError || pendingLinksQuery.isError) && (
        <Button
          label="Reintentar compromisos"
          onPress={() => {
            if (recurringQuery.isError) void recurringQuery.refetch();
            if (pendingLinksQuery.isError) void pendingLinksQuery.refetch();
          }}
        />
      )}
    </View>
  );
}
