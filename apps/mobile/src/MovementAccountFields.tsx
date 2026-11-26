import React from 'react';
import { Text } from 'react-native';
import type { Currency } from '@flowsaldo/domain';
import type { MovementAccount } from './MovementForm';
import { FilterRow } from './ScreenFilters';
import { Choice } from './ui';
import { useTheme } from './theme';
export function MovementAccountFields({
  accounts,
  destinations,
  unit,
  isTransfer,
  localAccounts,
  accountId,
  targetAccountId,
  isCardPayment,
  setAccountId,
  setTargetAccountId,
}: {
  accounts: MovementAccount[];
  destinations: MovementAccount[];
  unit: Currency;
  isTransfer: boolean;
  localAccounts: boolean;
  accountId: string;
  targetAccountId: string;
  isCardPayment: boolean;
  setAccountId: (value: string) => void;
  setTargetAccountId: (value: string) => void;
}) {
  const { styles: s } = useTheme();
  return (
    <>
      <Text style={s.label}>{isTransfer ? 'Cuenta de origen' : 'Cuenta del movimiento'}</Text>
      {!localAccounts && (
        <Text style={s.muted}>
          Sin cuenta asignada, el movimiento queda fuera de la conciliación.
        </Text>
      )}
      <FilterRow label="Seleccionar cuenta del movimiento">
        <Choice
          label="Sin cuenta asignada"
          selected={!accountId}
          onPress={() => {
            setAccountId('');
            setTargetAccountId('');
          }}
        />
        {accounts
          .filter((a) => a.currency === unit && (!a.archived || a.id === accountId))
          .map((a) => (
            <Choice
              key={a.id}
              label={`Cuenta: ${a.name}`}
              text={a.name + (a.archived ? ' · Archivada' : '')}
              selected={accountId === a.id}
              onPress={() => {
                setAccountId(a.id);
                if (targetAccountId === a.id) setTargetAccountId('');
              }}
            />
          ))}
      </FilterRow>
      {isTransfer && !!accountId && (
        <>
          <Text style={s.label}>Cuenta de destino</Text>
          {localAccounts && !destinations.length ? (
            <Text style={s.muted}>Agrega otra cuenta activa de la misma moneda.</Text>
          ) : (
            <FilterRow label="Seleccionar cuenta de destino">
              {destinations.map((a) => (
                <Choice
                  key={a.id}
                  label={`Destino: ${a.name}`}
                  text={a.name + (a.archived ? ' · Archivada' : '')}
                  selected={targetAccountId === a.id}
                  onPress={() => setTargetAccountId(a.id)}
                />
              ))}
            </FilterRow>
          )}
          {isCardPayment && <Text style={s.muted}>El abono reduce la deuda de la tarjeta.</Text>}
          {!localAccounts && (
            <Text style={s.muted}>
              Los pagos de deuda reducen el saldo pendiente de la cuenta de destino.
            </Text>
          )}
        </>
      )}
    </>
  );
}
