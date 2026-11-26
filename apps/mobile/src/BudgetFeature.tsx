import React from 'react';
import { Text, View } from 'react-native';
import { parseAmount, type Category, type Currency } from '@flowsaldo/domain';
import { BudgetProgress, CategoryBudgets } from './CategoryBudgets';
import { useTheme } from './theme';
import { Button, Field } from './ui';
import type { useBudgets } from './useBudgets';

export function BudgetFeature({
  model,
  connected,
  busy,
  month,
  currency,
  categoryCatalog,
  catalogReady,
  expenseMinor,
  money,
  action,
  setNotice,
}: {
  model: ReturnType<typeof useBudgets>;
  connected: boolean;
  busy: boolean;
  month: string;
  currency: Currency;
  categoryCatalog: Category[];
  catalogReady: boolean;
  expenseMinor: number;
  money: (minor: number, currency: Currency) => string;
  action: (work: () => Promise<void>) => Promise<void>;
  setNotice: (notice: string) => void;
}) {
  const { styles: s } = useTheme();
  const {
    serverBudget,
    budget,
    budgetKey,
    budgetInput,
    setBudgetInput,
    categoryBudgets,
    categoryTotals,
    saveGeneralBudget,
    saveCategoryBudget,
    canCopyLocalBudgets,
    copyLocalBudgets,
  } = model;
  return (
    <>
      <View style={s.card}>
        <Text style={s.title}>Tu presupuesto mensual</Text>
        <Text style={s.muted}>
          Límite de gastos para {month} en {currency}.{' '}
          {connected
            ? 'Guardado en el servidor de esta cuenta personal.'
            : 'Guardado en este dispositivo para la demo.'}
        </Text>
        {budget > 0 && (
          <BudgetProgress spent={expenseMinor} limit={budget} money={money} currency={currency} />
        )}
        <Field
          label="Nuevo límite mensual"
          value={budgetInput}
          onChangeText={setBudgetInput}
          keyboardType="decimal-pad"
          placeholder="Ejemplo: 20000"
        />
        <View style={s.row}>
          <Button
            label="Guardar presupuesto"
            disabled={busy || (connected && (!serverBudget.isSuccess || serverBudget.isFetching))}
            onPress={() =>
              void action(async () => {
                const value = parseAmount(budgetInput);
                await saveGeneralBudget(value);
                setBudgetInput('');
                setNotice('Presupuesto guardado.');
              })
            }
          />
          {budget > 0 && (
            <Button
              label="Quitar límite"
              disabled={busy}
              onPress={() =>
                void action(async () => {
                  await saveGeneralBudget(null);
                  setNotice('Límite mensual eliminado.');
                })
              }
            />
          )}
        </View>
      </View>
      {connected && (
        <View style={s.card}>
          <Text style={s.muted}>
            {serverBudget.isFetching
              ? 'Actualizando presupuestos…'
              : serverBudget.error
                ? 'No se pudo cargar el presupuesto.'
                : 'Presupuestos sincronizados con el servidor. Los cambios de otro dispositivo se consultan al actualizar.'}
          </Text>
          <Button label="Actualizar presupuestos" onPress={() => void serverBudget.refetch()} />
          {canCopyLocalBudgets && (
            <>
              <Text style={s.muted}>
                Hay límites antiguos guardados en este dispositivo. Puedes copiar el límite general
                y los límites de categorías activas al período vacío del servidor; los locales se
                conservan como respaldo.
              </Text>
              <Button
                label="Copiar presupuestos locales al servidor"
                disabled={busy || serverBudget.isFetching}
                onPress={() =>
                  void action(async () => {
                    await copyLocalBudgets();
                    setNotice('Presupuestos locales copiados al servidor.');
                  })
                }
              />
            </>
          )}
        </View>
      )}
      {catalogReady && (!connected || serverBudget.isSuccess) && (
        <CategoryBudgets
          synced={connected}
          disabled={connected && serverBudget.isFetching}
          key={budgetKey}
          items={categoryCatalog}
          budgets={categoryBudgets}
          expenses={categoryTotals}
          onSave={saveCategoryBudget}
          money={money}
          currency={currency}
        />
      )}
    </>
  );
}
