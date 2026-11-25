import { FilterRow } from './ScreenChrome';
import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  movementDate,
  currencies,
  dominicanDateTime,
  parseDominicanDateTime,
  selectedCategory,
  suggestCommerceCategory,
  type CommerceRule,
  checkMovementSplits,
  parseAmount,
  validDate,
  type Category,
  type Currency,
  type Movement,
  type MovementType,
} from '@flowsaldo/domain';
import { Button, Choice, Field } from './ui';
import { DatePicker } from './DatePicker';
import { DateTimeField } from './DateTimeField';
import { useTheme } from './theme';
import { MovementSplitsEditor, type SplitDraft } from './MovementSplitsEditor';
import type { FinancialAccount } from './FinancePanel';
export const typeLabels = { INCOME: 'Ingreso', EXPENSE: 'Gasto', TRANSFER: 'Transferencia' };
export type Draft = Omit<Movement, 'id'>;
export type MovementAccount = Pick<
  FinancialAccount,
  'id' | 'name' | 'currency' | 'archived' | 'kind'
>;
export function MovementForm({
  movement,
  currency,
  month,
  onSave,
  onCancel,
  title,
  categories,
  recent = [],
  editing = false,
  fixedDate = false,
  recurringDateTime = false,
  saveLabel = 'Guardar movimiento',
  accounts,
  localAccounts = false,
  allowSplits = false,
  commerceRules,
}: {
  allowSplits?: boolean;
  commerceRules?: CommerceRule[];
  accounts?: MovementAccount[];
  localAccounts?: boolean;
  saveLabel?: string;
  fixedDate?: boolean;
  recurringDateTime?: boolean;
  categories: Category[];
  recent?: string[];
  editing?: boolean;
  movement?: Movement;
  currency: Currency;
  month: string;
  onSave: (draft: Draft) => Promise<void>;
  onCancel: () => void;
  title?: string | null;
}) {
  const { styles: s } = useTheme();
  const initialAccountId = movement?.accountId ?? '';
  const initialTargetId = movement?.targetAccountId ?? '';
  const archivedLink =
    localAccounts &&
    !editing &&
    accounts?.some(
      (account) =>
        account.archived && (account.id === initialAccountId || account.id === initialTargetId),
    );
  const [accountId, setAccountId] = useState(archivedLink ? '' : initialAccountId);
  const [targetAccountId, setTargetAccountId] = useState(archivedLink ? '' : initialTargetId);
  const [requestKey] = useState(
    () =>
      `manual-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
  );
  const [description, setDescription] = useState(movement?.description ?? '');
  const [amount, setAmount] = useState(movement ? String(movement.amountMinor / 100) : '');
  const today = new Date();
  const todayLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(
    movement?.occurredAt.slice(0, 10) ?? movementDate(month, todayLabel),
  );
  const [dateTime, setDateTime] = useState(() => {
    const current = dominicanDateTime(today);
    return movementDate(month, current.slice(0, 10)) + current.slice(10);
  });
  const [categoryId, setCategoryId] = useState(
    movement?.categoryId ??
      categories.find(
        (c) =>
          c.normalizedName === (movement?.category ?? 'Sin categorizar').toLocaleLowerCase('es'),
      )?.id ??
      '',
  );
  const [splitEnabled, setSplitEnabled] = useState(!!movement?.splits?.length);
  const [parts, setParts] = useState<SplitDraft[]>(() =>
    movement?.splits?.length
      ? movement.splits.map((part) => ({
          categoryId: part.categoryId,
          amount: String(part.amountMinor / 100),
        }))
      : [
          { categoryId: '', amount: '' },
          { categoryId: '', amount: '' },
        ],
  );
  const [type, setType] = useState<MovementType>(movement?.type ?? 'EXPENSE');
  const editingMovement = editing && !fixedDate;
  const splitting = allowSplits && type === 'EXPENSE' && splitEnabled;
  const [unit, setUnit] = useState<Currency>(movement?.currency ?? currency);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const isTransfer = type === 'TRANSFER';
  const destinations = (accounts ?? []).filter(
    (account) =>
      account.currency === unit &&
      account.id !== accountId &&
      (!account.archived || (localAccounts && editing && account.id === movement?.targetAccountId)),
  );
  const isCardPayment =
    localAccounts &&
    isTransfer &&
    destinations.some(
      (account) => account.id === targetAccountId && account.kind === 'CREDIT_CARD',
    );
  const [dismissedRule, setDismissedRule] = useState<string>();
  const suggestion =
    commerceRules?.length && !splitting && type !== 'TRANSFER'
      ? suggestCommerceCategory(description, commerceRules, categories)
      : null;

  function chooseCategory(id: string) {
    setCategoryId(id);
    setDismissedRule(suggestion?.rule.id);
  }

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setError('');
    try {
      const amountMinor = parseAmount(amount);
      if (!description.trim()) throw new Error('Escribe una descripción.');
      const selectedTime = recurringDateTime ? parseDominicanDateTime(dateTime) : null;
      if (recurringDateTime ? !selectedTime : !validDate(date))
        throw new Error(
          recurringDateTime
            ? 'Selecciona una fecha y hora válidas.'
            : 'Escribe una fecha válida: AAAA-MM-DD.',
        );
      if (
        accounts &&
        isTransfer &&
        accountId &&
        (!targetAccountId || targetAccountId === accountId)
      )
        throw new Error('Selecciona otra cuenta de destino.');
      const previous = editing ? movement : undefined;
      if (splitting && parts.some((part) => !part.categoryId))
        throw new Error('Elige una categoría para cada parte.');
      const splits = splitting
        ? parts.map((part) => ({
            ...selectedCategory(
              categories,
              part.categoryId,
              'Sin categorizar',
              previous?.splits?.find((item) => item.categoryId === part.categoryId),
            ),
            amountMinor: parseAmount(part.amount),
          }))
        : [];
      checkMovementSplits(type, amountMinor, splits);
      const category = selectedCategory(
        categories,
        splitting ? (previous?.categoryId ?? categories.find((c) => c.system)?.id) : categoryId,
        'Sin categorizar',
        previous,
      );
      setBusy(true);
      await onSave({
        description: description.trim(),
        amountMinor,
        occurredAt: selectedTime?.toISOString() ?? date + 'T12:00:00.000Z',
        ...category,
        ...(allowSplits ? { splits } : {}),
        type,
        currency: unit,
        ...(accounts
          ? {
              accountId: accountId || null,
              targetAccountId: isTransfer ? targetAccountId || null : null,
            }
          : {}),
        ...(!editing ? { requestKey } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      {title !== null && (
        <Text style={s.title}>
          {title ?? (movement ? 'Editar movimiento' : 'Nuevo movimiento')}
        </Text>
      )}
      <View style={s.row}>
        {(['INCOME', 'EXPENSE', 'TRANSFER'] as const).map((t) => (
          <Choice
            key={t}
            label={typeLabels[t]}
            selected={type === t}
            onPress={() => {
              if (type === t) return;
              setType(t);
              setTargetAccountId('');
            }}
          />
        ))}
      </View>
      <Field
        label="Descripción"
        value={description}
        onChangeText={setDescription}
        maxLength={100}
      />
      <Field
        label="Monto (sin separadores de miles)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="1250.50"
      />
      <View style={s.row}>
        {currencies.map((c) => (
          <Choice
            key={c}
            label={c}
            selected={unit === c}
            onPress={() => {
              if (unit === c) return;
              setUnit(c);
              setAccountId('');
              setTargetAccountId('');
            }}
          />
        ))}
      </View>
      {accounts && (
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
              {isCardPayment && (
                <Text style={s.muted}>El abono reduce la deuda de la tarjeta.</Text>
              )}
              {!localAccounts && (
                <Text style={s.muted}>
                  Los pagos de deuda reducen el saldo pendiente de la cuenta de destino.
                </Text>
              )}
            </>
          )}
        </>
      )}
      {fixedDate ? (
        <Text style={s.muted}>
          Próximo vencimiento:{' '}
          {movement ? dominicanDateTime(new Date(movement.occurredAt)).replace('T', ' · ') : date}.
          Editar conserva el calendario original.
        </Text>
      ) : recurringDateTime ? (
        <>
          <DateTimeField label="Fecha y hora de inicio" value={dateTime} onChange={setDateTime} />
          <Text style={s.muted}>Hora dominicana</Text>
        </>
      ) : (
        <DatePicker value={date} onChange={setDate} />
      )}
      {allowSplits && type === 'EXPENSE' && (
        <MovementSplitsEditor
          active={splitting}
          amount={amount}
          categories={categories}
          previousIds={editing ? (movement?.splits ?? []).map((part) => part.categoryId) : []}
          parts={parts}
          onToggle={() => setSplitEnabled(!splitEnabled)}
          onChange={setParts}
        />
      )}
      {!splitting && (
        <>
          <Text style={s.label}>Categoría</Text>
          {suggestion &&
            suggestion.rule.id !== dismissedRule &&
            suggestion.category.id !== categoryId && (
              <View style={s.banner}>
                <Text style={s.text}>Categoría sugerida · {suggestion.category.name}</Text>
                <View style={s.row}>
                  <Choice
                    label={`Usar ${suggestion.category.name}`}
                    selected={false}
                    disabled={busy}
                    onPress={() => chooseCategory(suggestion.category.id)}
                  />
                  <Choice
                    label="Omitir sugerencia"
                    selected={false}
                    disabled={busy}
                    onPress={() => setDismissedRule(suggestion.rule.id)}
                  />
                </View>
              </View>
            )}
          {recent.length > 0 && (
            <>
              <Text style={s.label}>Categorías recientes</Text>
              <FilterRow label="Elegir categoría reciente">
                {categories
                  .filter((c) => !c.archived && recent.includes(c.id))
                  .map((c) => (
                    <Choice
                      key={c.id}
                      label={`Reciente: ${c.name}`}
                      text={c.name}
                      selected={categoryId === c.id}
                      onPress={() => chooseCategory(c.id)}
                    />
                  ))}
              </FilterRow>
            </>
          )}
          <FilterRow label="Seleccionar categoría">
            {categories
              .filter((c) => !c.archived || (editing && c.id === movement?.categoryId))
              .map((c) => (
                <Choice
                  key={c.id}
                  label={`Categoría: ${c.name}`}
                  text={c.name + (c.archived ? ' · Archivada' : '')}
                  selected={categoryId === c.id}
                  onPress={() => chooseCategory(c.id)}
                />
              ))}
          </FilterRow>
        </>
      )}
      {type === 'TRANSFER' && (
        <Text style={s.muted}>
          Transferencia entre cuentas propias: no cuenta como ingreso ni gasto.
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <Button
        label={busy ? 'Guardando…' : isCardPayment ? 'Guardar pago de tarjeta' : saveLabel}
        disabled={busy}
        onPress={() => void save()}
      />
      <Button
        label="Cancelar"
        centered={!editingMovement}
        variant={editingMovement ? 'secondary' : 'primary'}
        disabled={busy}
        onPress={onCancel}
      />
    </View>
  );
}
