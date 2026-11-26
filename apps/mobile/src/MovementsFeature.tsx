import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import {
  countLabel,
  type Category,
  type Currency,
  type Movement,
  type MovementType,
} from '@flowsaldo/domain';
import { IconButton } from './IconButton';
import { typeLabels } from './MovementForm';
import { FilterChip, FilterRow } from './ScreenChrome';
import { useTheme } from './theme';
import { Button, Choice, Field } from './ui';
import type { useMovementHistory } from './useMovementHistory';

type TypeFilter = MovementType | 'ALL';

export function MovementsFeature({
  connected,
  busy,
  currency,
  accounts,
  categoryCatalog,
  filters,
  visible,
  query,
  refreshMovements,
  onExport,
  isLocalCardPayment,
  money,
  pendingMovementIds,
  savingsTransferIds,
  deleteId,
  onSelectDelete,
  onRemove,
  onEdit,
  onDuplicate,
  onRefund,
  onPending,
  onSavings,
  children,
}: {
  connected: boolean;
  busy: boolean;
  currency: Currency;
  accounts: { id: string; name: string; currency: Currency; archived: boolean }[];
  categoryCatalog: Category[];
  filters: {
    search: string;
    type: TypeFilter;
    accountFilter: string;
    categoryFilter: string;
    setSearch: (search: string) => void;
    setType: (type: TypeFilter) => void;
    setAccountFilter: (id: string) => void;
    setCategoryFilter: (id: string) => void;
  };
  visible: Movement[];
  query: ReturnType<typeof useMovementHistory>['query'];
  refreshMovements: () => Promise<void>;
  onExport: () => void;
  isLocalCardPayment: (movement: Movement) => boolean;
  money: (minor: number, currency: Currency) => string;
  pendingMovementIds: string[];
  savingsTransferIds: string[];
  deleteId: string | null;
  onSelectDelete: (id: string | null) => void;
  onRemove: (id: string) => void;
  onEdit: (movement: Movement) => void;
  onDuplicate: (movement: Movement) => void;
  onRefund: (movement: Movement) => void;
  onPending: (movement: Movement) => void;
  onSavings: (movement: Movement) => void;
  children?: ReactNode;
}) {
  const { styles: s } = useTheme();
  const {
    search,
    type,
    accountFilter,
    categoryFilter,
    setSearch,
    setType,
    setAccountFilter,
    setCategoryFilter,
  } = filters;
  return (
    <>
      <Field
        label="Buscar descripción o categoría"
        value={search}
        onChangeText={setSearch}
        maxLength={100}
        placeholder="Supermercado, transporte…"
      />
      <FilterRow label="Filtrar por tipo">
        <Choice label="Todos" selected={type === 'ALL'} onPress={() => setType('ALL')} />
        {(['INCOME', 'EXPENSE', 'TRANSFER'] as const).map((t) => (
          <Choice key={t} label={typeLabels[t]} selected={type === t} onPress={() => setType(t)} />
        ))}
      </FilterRow>
      {(connected || accounts.length > 0) && (
        <FilterRow label="Filtrar por cuenta">
          <Choice
            label="Todas las cuentas"
            text="Todas"
            selected={!accountFilter}
            onPress={() => setAccountFilter('')}
          />
          {accounts
            .filter((a) => a.currency === currency)
            .map((a) => (
              <Choice
                key={a.id}
                label={`Filtrar cuenta: ${a.name}`}
                text={a.name + (a.archived ? ' · Archivada' : '')}
                selected={accountFilter === a.id}
                onPress={() => setAccountFilter(a.id)}
              />
            ))}
        </FilterRow>
      )}
      <View style={s.card}>
        <Text style={s.title}>Categorías</Text>
        <FilterRow label="Filtrar por categoría">
          <FilterChip
            label="Todas las categorías"
            text="Todas"
            selected={!categoryFilter}
            onPress={() => setCategoryFilter('')}
          />
          {categoryCatalog.map((c) => (
            <FilterChip
              key={c.id}
              label={`Filtrar: ${c.name}`}
              text={c.name + (c.archived ? ' · Archivada' : '')}
              selected={categoryFilter === c.id}
              onPress={() => setCategoryFilter(c.id)}
            />
          ))}
        </FilterRow>
      </View>
      <View style={s.between}>
        <Text style={s.title}>
          {countLabel(
            connected ? (query.data?.pages[0]?.total ?? 0) : visible.length,
            'movimiento',
            'movimientos',
          )}
        </Text>
        <View style={s.row}>
          {connected && <Button label="Actualizar" onPress={() => void refreshMovements()} />}
          <Button
            label="Exportar CSV"
            text="CSV"
            disabled={!visible.length || busy}
            onPress={() => onExport()}
          />
        </View>
      </View>
      {!visible.length && (!connected || query.isSuccess) && (
        <View style={s.card}>
          <Text style={s.title}>No hay movimientos con estos filtros</Text>
        </View>
      )}
      {visible.map((m) => (
        <View key={m.id} style={s.card}>
          <View style={s.between}>
            <View>
              <Text style={s.text}>{m.description}</Text>
              <Text style={s.muted}>
                {m.splits?.length
                  ? countLabel(m.splits.length, 'categoría', 'categorías')
                  : m.category}{' '}
                · {m.occurredAt.slice(0, 10)} ·{' '}
                {m.balanceAdjustment
                  ? 'Ajuste de saldo'
                  : m.refundOfId
                    ? 'Devolución'
                    : isLocalCardPayment(m)
                      ? 'Pago de tarjeta'
                      : typeLabels[m.type]}
              </Text>
            </View>
            <Text
              style={m.type === 'INCOME' ? s.income : m.type === 'EXPENSE' ? s.expense : s.amount}
            >
              {m.balanceAdjustment
                ? m.balanceAdjustment.statementMinor > m.balanceAdjustment.expectedMinor
                  ? '+'
                  : '−'
                : m.type === 'EXPENSE'
                  ? '−'
                  : m.type === 'INCOME'
                    ? '+'
                    : '↔'}{' '}
              {money(m.amountMinor, m.currency)}
            </Text>
          </View>
          {!!m.accountId && (
            <Text style={s.muted}>
              Cuenta: {accounts.find((a) => a.id === m.accountId)?.name ?? 'Asignada'}
              {m.targetAccountId
                ? ` → ${accounts.find((a) => a.id === m.targetAccountId)?.name ?? 'Destino asignado'}`
                : ''}
            </Text>
          )}
          <View style={s.row}>
            {!m.refundOfId && !m.balanceAdjustment && (
              <>
                <IconButton
                  icon="edit"
                  label={`Editar ${m.description}`}
                  onPress={() => onEdit(m)}
                />
                <IconButton
                  icon="copy"
                  label={`Duplicar ${m.description}`}
                  onPress={() => onDuplicate(m)}
                />
              </>
            )}
            {m.type === 'EXPENSE' && (
              <Choice
                label={`Registrar devolución de ${m.description}`}
                text="Devolución"
                selected={false}
                disabled={busy}
                onPress={() => onRefund(m)}
              />
            )}
            <IconButton icon="trash" label="Eliminar" danger onPress={() => onSelectDelete(m.id)} />
            {m.type !== 'TRANSFER' && !m.refundOfId && (
              <Choice
                label={`Vincular a pendiente: ${m.description}`}
                text={pendingMovementIds.includes(m.id) ? 'Ver vínculo' : 'Vincular a pendiente'}
                selected={false}
                disabled={busy}
                onPress={() => onPending(m)}
              />
            )}
            {m.type === 'TRANSFER' && !m.balanceAdjustment && !isLocalCardPayment(m) && (
              <Choice
                label={`Vincular a meta: ${m.description}`}
                text={savingsTransferIds.includes(m.id) ? 'Ver aporte' : 'Vincular a meta'}
                selected={false}
                disabled={busy}
                onPress={() => onSavings(m)}
              />
            )}
          </View>
          {deleteId === m.id && (
            <>
              <Text style={s.error}>
                ¿Eliminar este movimiento? Esta acción no se puede deshacer.
              </Text>
              <View style={s.row}>
                <Button
                  label="Confirmar eliminación"
                  disabled={busy}
                  onPress={() => onRemove(m.id)}
                />
                <Button
                  label="Cancelar eliminación"
                  disabled={busy}
                  onPress={() => onSelectDelete(null)}
                />
              </View>
            </>
          )}
        </View>
      ))}
      {children}
      {connected && query.hasNextPage && (
        <Button
          label={query.isFetchingNextPage ? 'Cargando movimientos…' : 'Cargar más movimientos'}
          disabled={query.isFetching}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
