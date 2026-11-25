import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  currencies,
  parseAmount,
  savingsContributionAmount,
  savingsProgress,
  savingsTransferGoal,
  type Currency,
  type Movement,
  type SavingsGoal,
} from '@flowsaldo/domain';
import { Button, Choice, Field } from './ui';
import { useTheme } from './theme';

type GoalFields = Pick<SavingsGoal, 'name' | 'currency' | 'targetMinor'>;

export function SavingsGoalsScreen({
  goals,
  defaultCurrency,
  linkedTransfer,
  transfers,
  linksPending,
  linksError,
  onRetry,
  saving,
  onSaveGoal,
  onAddManual,
  onLink,
  onRemove,
  money,
}: {
  goals: SavingsGoal[];
  defaultCurrency: Currency;
  linkedTransfer: Movement | null;
  transfers: ReadonlyMap<string, Movement>;
  linksPending: boolean;
  linksError: boolean;
  onRetry: () => void;
  saving: boolean;
  onSaveGoal: (fields: GoalFields, id?: string) => Promise<void>;
  onAddManual: (goalId: string, amountMinor: number) => Promise<void>;
  onLink: (goalId: string, movementId: string) => Promise<void>;
  onRemove: (goalId: string, contributionId: string) => Promise<void>;
  money: (minor: number, currency: Currency) => string;
}) {
  const { styles: s } = useTheme();
  const [editing, setEditing] = useState<SavingsGoal | 'new' | null>(null);
  const [contributing, setContributing] = useState<string>();
  const [removing, setRemoving] = useState<{ goalId: string; contributionId: string }>();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const alreadyLinked = linkedTransfer && savingsTransferGoal(goals, linkedTransfer.id);
  const linkPending = !!linkedTransfer && !alreadyLinked;
  const openGoal = (goal?: SavingsGoal) => {
    setEditing(goal ?? 'new');
    setName(goal?.name ?? '');
    setCurrency(goal?.currency ?? linkedTransfer?.currency ?? defaultCurrency);
    setTarget(goal ? (goal.targetMinor / 100).toFixed(2) : '');
    setContributing(undefined);
    setRemoving(undefined);
    setError('');
    setFeedback('');
  };

  async function run(work: () => Promise<void>, message: string) {
    setFeedback('');
    setError('');
    try {
      await work();
      setFeedback(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    }
  }

  return (
    <>
      {linkedTransfer && (
        <View style={s.card}>
          <Text style={s.title}>{linkedTransfer.description}</Text>
          <Text style={s.amount}>{money(linkedTransfer.amountMinor, linkedTransfer.currency)}</Text>
          <Text style={s.muted}>
            {alreadyLinked
              ? `Vinculada a ${alreadyLinked.name}.`
              : goals.some((goal) => goal.currency === linkedTransfer.currency)
                ? 'Elige la meta para esta transferencia.'
                : `Crea una meta en ${linkedTransfer.currency} para vincularla.`}
          </Text>
        </View>
      )}
      {!!feedback && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {feedback}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {linksError && (
        <View style={s.card}>
          <Text accessibilityRole="alert" style={s.error}>
            No se pudieron verificar las transferencias.
          </Text>
          <Button label="Reintentar transferencias" onPress={onRetry} />
        </View>
      )}
      {editing ? (
        <View style={s.card}>
          <Text style={s.title}>{editing === 'new' ? 'Nueva meta' : 'Editar meta'}</Text>
          <Field label="Nombre de la meta" value={name} onChangeText={setName} maxLength={60} />
          <View style={s.row}>
            {currencies.map((unit) => (
              <Choice
                key={unit}
                label={unit}
                selected={unit === currency}
                disabled={saving || editing !== 'new'}
                onPress={() => setCurrency(unit)}
              />
            ))}
          </View>
          <Field
            label="Monto objetivo"
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
          />
          <Button
            label="Guardar meta"
            disabled={saving || !name.trim() || !target.trim()}
            onPress={() =>
              void run(async () => {
                await onSaveGoal(
                  { name, currency, targetMinor: parseAmount(target) },
                  editing === 'new' ? undefined : editing.id,
                );
                setEditing(null);
              }, 'Meta guardada.')
            }
          />
          <View style={{ alignItems: 'center' }}>
            <Choice
              label="Cancelar meta"
              text="Cancelar"
              selected={false}
              disabled={saving}
              onPress={() => setEditing(null)}
            />
          </View>
        </View>
      ) : (
        <Button label="Nueva meta de ahorro" disabled={saving} onPress={() => openGoal()} />
      )}
      {!goals.length && !editing && <Text style={s.muted}>Tus metas aparecerán aquí.</Text>}
      {goals.map((goal) => {
        const verifying =
          (linksPending || linksError) &&
          goal.contributions.some((item) => item.kind === 'transfer');
        const progress = verifying ? null : savingsProgress(goal, transfers);
        return (
          <View key={goal.id} style={s.card}>
            <Text accessibilityRole="header" style={s.title}>
              {goal.name}
            </Text>
            {progress ? (
              <>
                <Text style={s.amount}>
                  {money(progress.savedMinor, goal.currency)} de{' '}
                  {money(goal.targetMinor, goal.currency)}
                </Text>
                <View style={s.track} accessibilityLabel={`${progress.percent}% de la meta`}>
                  <View style={[s.fill, { width: `${progress.percent}%` }]} />
                </View>
                <Text style={s.muted}>
                  {progress.remainingMinor
                    ? `Faltan ${money(progress.remainingMinor, goal.currency)}`
                    : 'Meta alcanzada'}
                </Text>
              </>
            ) : (
              <Text style={s.muted}>
                {linksError
                  ? 'Avance pendiente de verificación.'
                  : 'Verificando aportes vinculados…'}
              </Text>
            )}
            <View style={s.row}>
              {linkPending && linkedTransfer?.currency === goal.currency && (
                <Button
                  label={`Vincular transferencia a ${goal.name}`}
                  text="Vincular transferencia"
                  disabled={saving}
                  onPress={() =>
                    void run(() => onLink(goal.id, linkedTransfer.id), 'Transferencia vinculada.')
                  }
                />
              )}
              <Choice
                label={`Editar meta ${goal.name}`}
                text="Editar meta"
                selected={false}
                disabled={saving}
                onPress={() => openGoal(goal)}
              />
              <Choice
                label={`Aportar a ${goal.name}`}
                text="Aporte manual"
                selected={contributing === goal.id}
                disabled={saving}
                onPress={() => {
                  setEditing(null);
                  setContributing(goal.id);
                  setRemoving(undefined);
                  setAmount('');
                  setFeedback('');
                  setError('');
                }}
              />
            </View>
            {contributing === goal.id && (
              <>
                <Field
                  label="Monto del aporte"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
                <Button
                  label="Guardar aporte"
                  disabled={saving || !amount.trim()}
                  onPress={() =>
                    void run(async () => {
                      await onAddManual(goal.id, parseAmount(amount));
                      setContributing(undefined);
                    }, 'Aporte guardado.')
                  }
                />
                <View style={{ alignItems: 'center' }}>
                  <Choice
                    label="Cancelar aporte"
                    variant="text"
                    text="Cancelar"
                    selected={false}
                    disabled={saving}
                    onPress={() => setContributing(undefined)}
                  />
                </View>
              </>
            )}
            {goal.contributions.map((item, index) => {
              const name =
                item.kind === 'manual'
                  ? 'Aporte manual'
                  : (transfers.get(item.movementId)?.description ?? 'Transferencia vinculada');
              const amount = savingsContributionAmount(goal.currency, item, transfers);
              const confirm = removing?.goalId === goal.id && removing.contributionId === item.id;
              return (
                <View key={item.id}>
                  <View style={s.between}>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={s.text}>{name}</Text>
                      <Text style={s.muted}>
                        {verifying && item.kind === 'transfer'
                          ? 'Pendiente de verificación'
                          : amount === null
                            ? 'Transferencia no disponible'
                            : money(amount, goal.currency)}
                      </Text>
                    </View>
                    <Choice
                      label={`Quitar aporte ${index + 1} de ${goal.name}`}
                      text="Quitar"
                      selected={confirm}
                      disabled={saving}
                      onPress={() => setRemoving({ goalId: goal.id, contributionId: item.id })}
                    />
                  </View>
                  {confirm && (
                    <View style={{ gap: 8 }}>
                      <Button
                        label="Confirmar retiro de aporte"
                        text="Quitar aporte"
                        disabled={saving}
                        onPress={() =>
                          void run(async () => {
                            await onRemove(goal.id, item.id);
                            setRemoving(undefined);
                          }, 'Aporte quitado.')
                        }
                      />
                      <View style={{ alignItems: 'center' }}>
                        <Choice
                          label="Cancelar retiro de aporte"
                          text="Cancelar"
                          selected={false}
                          disabled={saving}
                          onPress={() => setRemoving(undefined)}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </>
  );
}
