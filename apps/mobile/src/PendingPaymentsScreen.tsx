import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  dominicanDateTime,
  parseAmount,
  pendingRemaining,
  type Currency,
  type Movement,
  type PendingDraft,
  type PendingItem,
  type PendingSettlement,
} from '@flowsaldo/domain';
import { IconButton } from './IconButton';
import { PendingSettlementRow } from './PendingSettlementRow';
import { PendingPaymentEditor } from './PendingPaymentEditor';
import { useTheme } from './theme';
import { Button, Choice, Field } from './ui';

export function PendingPaymentsScreen({
  items,
  defaultCurrency,
  movements,
  link,
  focusId,
  ready,
  linksError,
  saving,
  money,
  canClose,
  canEdit,
  onSave,
  onSettle,
  onRemove,
  onEdit,
  onDelete,
  onClose,
  onRetry,
  onClearLink,
}: {
  items: PendingItem[];
  defaultCurrency: Currency;
  movements: ReadonlyMap<string, Movement>;
  link: Movement | null;
  focusId: string | null;
  ready: boolean;
  linksError: boolean;
  saving: boolean;
  money: (amountMinor: number, currency: Currency) => string;
  canClose: (item: PendingItem) => boolean;
  canEdit: (item: PendingItem) => boolean;
  onSave: (draft: PendingDraft) => Promise<void>;
  onSettle: (
    id: string,
    settlement:
      | Omit<Extract<PendingSettlement, { kind: 'manual' }>, 'id'>
      | Omit<Extract<PendingSettlement, { kind: 'movement' }>, 'id'>,
  ) => Promise<void>;
  onEdit: (id: string, settlementId: string, amountMinor: number) => Promise<void>;
  onRemove: (id: string, settlementId: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: (item: PendingItem) => Promise<void>;
  onRetry: () => void;
  onClearLink: () => void;
}) {
  const { styles: s } = useTheme();
  const [filter, setFilter] = useState<'open' | 'settled'>('open');
  const [expanded, setExpanded] = useState(focusId);
  const [editor, setEditor] = useState(false);
  const [kind, setKind] = useState<PendingDraft['kind']>('pay');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [partial, setPartial] = useState('');
  const [edited, setEdited] = useState<{ id: string; amount: string } | null>(null);
  const processing = useRef(false);
  const [removing, setRemoving] = useState('');
  const [deleting, setDeleting] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const blocked = saving || !ready;
  const alreadyLinked =
    link &&
    items.find((item) =>
      item.settlements.some((entry) => entry.kind === 'movement' && entry.movementId === link.id),
    );
  const rows = items
    .map((item) => ({ item, remaining: pendingRemaining(item, movements) }))
    .filter(({ item, remaining }) => {
      if (alreadyLinked) return item.id === alreadyLinked.id;
      if (link)
        return (
          remaining >= link.amountMinor &&
          item.currency === link.currency &&
          item.kind === (link.type === 'EXPENSE' ? 'pay' : 'collect')
        );
      // During a refresh keep the requested record visible and preserve the selected filter.
      if (item.id === focusId && item.id === expanded) return true;
      return filter === 'open'
        ? remaining > 0 || canClose(item)
        : remaining === 0 && !canClose(item);
    })
    .sort((a, b) => a.item.dueAt.localeCompare(b.item.dueAt));

  async function run(work: () => Promise<void>, message: string) {
    if (processing.current) return;
    processing.current = true;
    setError('');
    setNotice('');
    try {
      await work();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      processing.current = false;
    }
  }

  return (
    <>
      {link ? (
        <View style={s.card}>
          <Text style={s.title}>{link.description}</Text>
          <Text style={s.muted}>
            {money(link.amountMinor, link.currency)}{' '}
            {alreadyLinked ? '· Vinculado' : '· Elige un pendiente'}
          </Text>
          <Choice
            label="Ver todos los pendientes"
            selected={false}
            disabled={saving}
            onPress={onClearLink}
          />
        </View>
      ) : (
        <>
          <View style={s.between}>
            <View style={s.row}>
              {(['open', 'settled'] as const).map((status) => (
                <Choice
                  key={status}
                  label={status === 'open' ? 'Pendientes' : 'Saldados'}
                  selected={filter === status}
                  onPress={() => {
                    setExpanded(null);
                    setEdited(null);
                    setFilter(status);
                  }}
                />
              ))}
            </View>
            <Button label="Nuevo pendiente" disabled={saving} onPress={() => setEditor(true)} />
          </View>
          {editor && (
            <PendingPaymentEditor
              kind={kind}
              currency={currency}
              name={name}
              amount={amount}
              date={date}
              saving={saving}
              setKind={setKind}
              setCurrency={setCurrency}
              setName={setName}
              setAmount={setAmount}
              setDate={setDate}
              onSave={() =>
                void run(async () => {
                  await onSave({
                    name,
                    kind,
                    currency,
                    dueAt: date,
                    amountMinor: parseAmount(amount),
                  });
                  setName('');
                  setAmount('');
                  setDate('');
                  setEditor(false);
                  setFilter('open');
                }, 'Pendiente guardado.')
              }
              onCancel={() => {
                setEditor(false);
                setError('');
              }}
            />
          )}
        </>
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
      {!ready && (
        <View style={s.card}>
          <Text style={s.muted}>
            {linksError
              ? 'No se pudieron verificar los movimientos vinculados.'
              : 'Verificando movimientos…'}
          </Text>
          {linksError && <Button label="Reintentar movimientos vinculados" onPress={onRetry} />}
        </View>
      )}
      {ready && !rows.length && (
        <Text style={s.muted}>
          {link
            ? 'Sin pendientes compatibles.'
            : filter === 'open'
              ? 'Sin pagos ni cobros pendientes.'
              : 'Sin pendientes saldados.'}
        </Text>
      )}
      {rows.map(({ item, remaining }) => {
        const open = expanded === item.id || !!alreadyLinked;
        const closable = ready && canClose(item) && remaining === 0;
        const status = !ready
          ? 'Calculando saldo'
          : remaining === 0
            ? 'Saldado'
            : item.dueAt < dominicanDateTime(new Date())
              ? 'Vencido'
              : 'Pendiente';
        return (
          <View style={s.card} key={item.id}>
            <View style={s.between}>
              <Text style={[s.title, { flexShrink: 1 }]}>{item.name}</Text>
              {ready && <Text style={s.amount}>{money(remaining, item.currency)}</Text>}
            </View>
            <Text style={s.muted}>
              {item.kind === 'pay' ? 'Por pagar' : 'Por cobrar'} · {status} ·{' '}
              {item.dueAt.replace('T', ' · ')}
            </Text>
            {link && !alreadyLinked ? (
              <IconButton
                icon="link"
                label={`Vincular a ${item.name}`}
                disabled={blocked}
                onPress={() =>
                  void run(
                    () => onSettle(item.id, { kind: 'movement', movementId: link.id }),
                    'Movimiento vinculado.',
                  )
                }
              />
            ) : (
              <>
                <IconButton
                  icon={open ? 'chevron-up' : 'chevron-down'}
                  label={`${open ? 'Ocultar' : 'Ver'} detalle de ${item.name}`}
                  disabled={saving || !!alreadyLinked}
                  onPress={() => {
                    setExpanded(open ? null : item.id);
                    setPartial('');
                    setEdited(null);
                    setRemoving('');
                  }}
                />
                {open && (
                  <>
                    <Text style={s.text}>
                      Monto original · {money(item.amountMinor, item.currency)}
                    </Text>
                    {item.settlements.map((entry) => (
                      <PendingSettlementRow
                        key={entry.id}
                        item={item}
                        entry={entry}
                        movements={movements}
                        money={money}
                        ready={ready}
                        blocked={blocked}
                        canEdit={entry.kind === 'manual' && canEdit(item)}
                        edited={edited}
                        setEdited={setEdited}
                        removing={removing}
                        setRemoving={setRemoving}
                        clearError={() => setError('')}
                        run={run}
                        onRemove={onRemove}
                        onEdit={onEdit}
                      />
                    ))}
                    {!item.settlements.length && !alreadyLinked && (
                      <Choice
                        label={
                          deleting === item.id
                            ? 'Confirmar eliminar pendiente'
                            : 'Eliminar pendiente'
                        }
                        selected={deleting === item.id}
                        disabled={blocked}
                        onPress={() => {
                          if (deleting !== item.id) {
                            setDeleting(item.id);
                            return;
                          }
                          void run(async () => {
                            await onDelete(item.id);
                            setDeleting('');
                          }, 'Pendiente eliminado.');
                        }}
                      />
                    )}
                    {remaining > 0 && !alreadyLinked && (
                      <>
                        <Field
                          label="Monto del abono"
                          value={partial}
                          onChangeText={setPartial}
                          keyboardType="decimal-pad"
                          editable={!blocked}
                        />
                        <Text style={s.muted}>El abono actualiza solo este pendiente.</Text>
                        <IconButton
                          icon="add"
                          label="Registrar abono"
                          disabled={blocked || !partial.trim()}
                          onPress={() =>
                            void run(async () => {
                              await onSettle(item.id, {
                                kind: 'manual',
                                amountMinor: parseAmount(partial),
                              });
                              setPartial('');
                            }, 'Abono registrado.')
                          }
                        />
                      </>
                    )}
                  </>
                )}
                {closable && (
                  <Button
                    label="Cerrar vencimiento"
                    disabled={saving}
                    onPress={() =>
                      void run(async () => {
                        await onClose(item);
                        setExpanded(item.id);
                        setFilter('settled');
                      }, 'Vencimiento cerrado.')
                    }
                  />
                )}
              </>
            )}
          </View>
        );
      })}
    </>
  );
}
