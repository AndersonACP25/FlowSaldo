import React from 'react';
import { Text, View } from 'react-native';
import {
  monthlyReportCsv,
  pendingMailMessage,
  type Currency,
  type Movement,
} from '@flowsaldo/domain';
import { exportCsvText } from './exportCsv';
import { MonthlyComparison } from './MonthlyComparison';
import { ReportsScreen } from './ReportsScreen';
import { useTheme } from './theme';
import { Button } from './ui';
import type { useBudgets } from './useBudgets';
import type { useMonthlyOverview } from './useMonthlyOverview';
import { WeeklyFlow } from './WeeklyFlow';

export type OverviewScreen = 'Inicio' | 'Análisis' | 'Analíticas y reportes' | 'Presupuestos';

export function MonthlyOverview({
  screen,
  overview,
  connected,
  month,
  currency,
  pending,
  onReviews,
  budgetModel,
  rows,
  periodDate,
  money,
  hideAmounts,
  busy,
  action,
}: {
  screen: OverviewScreen;
  overview: ReturnType<typeof useMonthlyOverview>;
  connected: boolean;
  month: string;
  currency: Currency;
  pending: number;
  onReviews: () => void;
  budgetModel: Pick<ReturnType<typeof useBudgets>, 'serverBudget' | 'budget'>;
  rows: Movement[];
  periodDate: string;
  money: (minor: number, currency: Currency) => string;
  hideAmounts: boolean;
  busy: boolean;
  action: (work: () => Promise<void>) => Promise<void>;
}) {
  const { styles: s, palette } = useTheme();
  const { totals, summary, categories, comparison, count } = overview;
  const { serverBudget, budget } = budgetModel;
  const monthlyReport = { ...summary, month, currency, budgetMinor: budget || null, categories };
  const positiveCategorySpend = categories.reduce(
    (sum, value) => sum + Math.max(0, value.amountMinor),
    0,
  );
  return (
    <>
      {connected && (totals.isPending || totals.error) && (
        <View style={s.card}>
          <Text style={s.muted}>
            {totals.error ? 'No se pudo cargar el resumen mensual.' : 'Cargando resumen mensual…'}
          </Text>
          {!!totals.error && (
            <Button label="Reintentar resumen" onPress={() => void totals.refetch()} />
          )}
        </View>
      )}
      {screen === 'Inicio' && (!connected || totals.isSuccess) && (
        <>
          <View style={s.hero}>
            <Text style={s.heroText}>Diferencia registrada · {month}</Text>
            <Text style={s.heroValue}>{money(summary.differenceMinor, currency)}</Text>
            <Text style={s.heroText}>Ingresos − gastos</Text>
          </View>
          <View style={s.metrics}>
            <View style={s.metric}>
              <Text style={s.muted}>Ingresos</Text>
              <Text style={s.income}>{money(summary.incomeMinor, currency)}</Text>
            </View>
            <View style={s.metric}>
              <Text style={s.muted}>Gastos netos</Text>
              <Text style={s.expense}>{money(summary.expenseMinor, currency)}</Text>
            </View>
            <View style={s.metric}>
              <Text style={s.muted}>Movimientos</Text>
              <Text style={s.amount}>{connected ? totals.data?.total : count}</Text>
            </View>
          </View>
          {pending > 0 && (
            <View style={[s.card, { borderColor: palette.amber }]}>
              <View style={s.between}>
                <Text style={s.text}>{pendingMailMessage(pending)}</Text>
                <Button label="Ir a revisiones" onPress={onReviews} />
              </View>
            </View>
          )}
        </>
      )}
      {screen === 'Analíticas y reportes' &&
        (!connected || (totals.isSuccess && serverBudget.isSuccess) ? (
          <ReportsScreen
            report={monthlyReport}
            count={count}
            comparison={comparison}
            money={money}
            hideAmounts={hideAmounts}
            busy={busy || (connected && (totals.isFetching || serverBudget.isFetching))}
            onExport={() =>
              void action(() =>
                exportCsvText(
                  monthlyReportCsv(monthlyReport),
                  `FlowSaldo-Reporte-${month}-${currency}.csv`,
                ),
              )
            }
          />
        ) : (
          totals.isSuccess && (
            <View style={s.card}>
              <Text style={s.muted}>
                {serverBudget.isError
                  ? 'No se pudo cargar el presupuesto del reporte.'
                  : 'Cargando presupuesto del reporte…'}
              </Text>
              {serverBudget.isError && (
                <Button
                  label="Reintentar presupuesto"
                  onPress={() => void serverBudget.refetch()}
                />
              )}
            </View>
          )
        ))}
      {screen === 'Análisis' && (!connected || totals.isSuccess) && (
        <>
          {comparison && (
            <MonthlyComparison
              comparison={comparison}
              money={money}
              currency={currency}
              hideAmounts={hideAmounts}
            />
          )}
          {hideAmounts ? (
            <View style={s.card}>
              <Text style={s.muted}>Flujo semanal oculto por tu preferencia de privacidad.</Text>
            </View>
          ) : (
            <WeeklyFlow
              rows={rows}
              end={periodDate}
              currency={currency}
              days={connected ? totals.data?.days : undefined}
            />
          )}
          <View style={s.card}>
            <Text style={s.title}>Principales categorías de gastos</Text>
            {!categories.length && (
              <Text style={s.muted}>Todavía no hay gastos este mes en esta moneda.</Text>
            )}
            {categories.slice(0, 5).map((c) => (
              <View key={c.category} style={{ gap: 8 }}>
                <View style={s.between}>
                  <Text style={s.text}>{c.category}</Text>
                  <Text style={s.text}>{money(c.amountMinor, currency)}</Text>
                </View>
                <View style={s.track}>
                  <View
                    style={[
                      s.fill,
                      {
                        width: `${positiveCategorySpend ? Math.round((Math.max(0, c.amountMinor) / positiveCategorySpend) * 100) : 0}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );
}
