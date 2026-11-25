import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  currencies,
  localAccountBalances,
  localAccountKinds,
  localAccountName,
  parseSignedAmount,
  type Currency,
  type LocalAccount,
  type LocalReconciliation,
  type Movement,
} from '@flowsaldo/domain';
import { accountKindLabels } from './FinancePanel';
import { LocalReconciliationForm } from './LocalReconciliationForm';
import { FilterRow } from './ScreenChrome';
import { useTheme } from './theme';
import { Button, Choice, Field } from './ui';

type NewAccount = Omit<LocalAccount, 'id' | 'archived'>;

export function LocalAccountsScreen({
  accounts,
  movements,
  currency,
  money,
  busy,
  onCreate,
  onUpdate,
  onReconcile,
}: {
  accounts: LocalAccount[];
  movements: Movement[];
  currency: Currency;
  money: (amountMinor: number, currency: Currency) => string;
  busy: boolean;
  onReconcile: (preview: LocalReconciliation) => Promise<void>;
  onCreate: (account: NewAccount) => Promise<void>;
  onUpdate: (
    id: string,
    changes: Partial<Pick<LocalAccount, 'name' | 'archived'>>,
  ) => Promise<void>;
}) {
  const { styles: s } = useTheme();
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LocalAccount['kind']>('BANK');
  const [unit, setUnit] = useState(currency);
  const [opening, setOpening] = useState('0');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const inProgress = useRef(false);
  const balances = localAccountBalances(accounts, movements);

  function openForm(account?: LocalAccount) {
    setReconcileId(null);
    setCreating(!account);
    setEditId(account?.id ?? null);
    setName(account?.name ?? '');
    setKind('BANK');
    setUnit(currency);
    setOpening('0');
    setNotice('');
    setError('');
  }

  async function run(work: () => Promise<void>, message: string) {
    if (busy || inProgress.current) return;
    inProgress.current = true;
    setNotice('');
    setError('');
    try {
      await work();
      setNotice(message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar la cuenta.');
    } finally {
      inProgress.current = false;
    }
  }

  async function submit() {
    const normalizedName = localAccountName(name);
    if (editId) {
      await onUpdate(editId, { name: normalizedName });
    } else {
      const amountMinor = parseSignedAmount(opening);
      if (kind === 'CREDIT_CARD' && amountMinor < 0)
        throw new Error('Ingresa la deuda inicial como un monto positivo o cero.');
      await onCreate({
        name: normalizedName,
        kind,
        currency: unit,
        openingMinor: kind === 'CREDIT_CARD' ? -amountMinor : amountMinor,
      });
    }
    setCreating(false);
    setEditId(null);
  }

  return (
    <>
      <Button label="Nueva cuenta" disabled={busy || creating} onPress={() => openForm()} />
      {accounts.length > 0 && (
        <Text style={s.muted}>Registra transferencias y pagos de tarjeta desde Movimientos.</Text>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {notice}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {(creating || editId) && (
        <View style={s.card}>
          <Text style={s.title}>{creating ? 'Nueva cuenta' : 'Editar nombre de cuenta'}</Text>
          <Field label="Nombre de la cuenta" value={name} onChangeText={setName} maxLength={60} />
          {creating && (
            <>
              <Text style={s.label}>Tipo de cuenta</Text>
              <FilterRow label="Seleccionar tipo de cuenta">
                {localAccountKinds.map((value) => (
                  <Choice
                    key={value}
                    label={accountKindLabels[value]}
                    selected={kind === value}
                    onPress={() => setKind(value)}
                  />
                ))}
              </FilterRow>
              <Text style={s.label}>Moneda</Text>
              <FilterRow label="Seleccionar moneda de la cuenta">
                {currencies.map((value) => (
                  <Choice
                    key={value}
                    label={value}
                    selected={unit === value}
                    onPress={() => setUnit(value)}
                  />
                ))}
              </FilterRow>
              <Field
                label={kind === 'CREDIT_CARD' ? 'Deuda inicial' : 'Saldo inicial'}
                value={opening}
                onChangeText={setOpening}
                keyboardType="numbers-and-punctuation"
                maxLength={20}
              />
              <Text style={s.muted}>
                Usa el importe anterior a los movimientos que vas a vincular.
              </Text>
            </>
          )}
          <Button
            label="Guardar cuenta"
            disabled={busy}
            onPress={() => void run(submit, creating ? 'Cuenta creada.' : 'Nombre actualizado.')}
          />
          <Choice
            label="Cancelar"
            centered
            selected={false}
            disabled={busy}
            onPress={() => {
              setCreating(false);
              setEditId(null);
              setError('');
            }}
          />
        </View>
      )}
      {!accounts.length && !creating && (
        <Text style={s.muted}>Agrega una cuenta para vincular ingresos y gastos.</Text>
      )}
      {accounts.map((account) => {
        const balance = balances.get(account.id)!;
        const credit = account.kind === 'CREDIT_CARD';
        const balanceLabel = credit ? (balance > 0 ? 'Saldo a favor' : 'Deuda') : 'Saldo';
        return (
          <View key={account.id} style={s.card}>
            <Text style={s.title}>{account.name}</Text>
            <Text style={s.muted}>
              {accountKindLabels[account.kind]} · {account.currency}
              {account.archived ? ' · Archivada' : ''}
            </Text>
            <Text style={s.text}>
              {balanceLabel} · {money(credit ? Math.abs(balance) : balance, account.currency)}
            </Text>
            <View style={s.row}>
              {!account.archived && (
                <Choice
                  label={`Conciliar cuenta ${account.name}`}
                  text="Conciliar"
                  selected={reconcileId === account.id}
                  disabled={busy}
                  onPress={() => {
                    setEditId(null);
                    setCreating(false);
                    setReconcileId(account.id);
                  }}
                />
              )}
              <Choice
                label={`Editar cuenta ${account.name}`}
                text="Editar nombre"
                selected={editId === account.id}
                disabled={busy}
                onPress={() => openForm(account)}
              />
              <Choice
                label={`${account.archived ? 'Reactivar' : 'Archivar'} cuenta ${account.name}`}
                text={account.archived ? 'Reactivar' : 'Archivar'}
                selected={false}
                disabled={busy}
                onPress={() =>
                  void run(
                    () => onUpdate(account.id, { archived: !account.archived }),
                    account.archived ? 'Cuenta reactivada.' : 'Cuenta archivada.',
                  )
                }
              />
            </View>
            {!account.archived && reconcileId === account.id && (
              <LocalReconciliationForm
                account={account}
                accounts={accounts}
                movements={movements}
                money={money}
                busy={busy}
                onConfirm={onReconcile}
                onCancel={() => setReconcileId(null)}
              />
            )}
          </View>
        );
      })}
    </>
  );
}
