import React from 'react';
import { Text, View } from 'react-native';
import { countLabel, type Currency, type MonthlyReport } from '@flowsaldo/domain';
import { MonthlyComparison, type Comparison } from './MonthlyComparison';
import { useTheme } from './theme';
import { Button } from './ui';

export function ReportsScreen({
  report,
  count,
  comparison,
  money,
  busy,
  hideAmounts,
  onExport,
}: {
  report: MonthlyReport;
  count: number;
  comparison?: Comparison;
  money: (minor: number, currency: Currency) => string;
  busy: boolean;
  hideAmounts: boolean;
  onExport: () => void;
}) {
  const { styles: s } = useTheme();
  const amount = (minor: number) => money(minor, report.currency);
  const remaining = report.budgetMinor === null ? null : report.budgetMinor - report.expenseMinor;

  return (
    <>
      <View style={s.hero}>
        <Text style={s.label}>Balance del mes · {report.month}</Text>
        <Text style={s.heroValue}>{amount(report.differenceMinor)}</Text>
        <Text style={s.muted}>
          {countLabel(count, 'movimiento', 'movimientos')} · {report.currency}
        </Text>
      </View>
      <View style={s.metrics}>
        <View style={s.metric}>
          <Text style={s.label}>Ingresos</Text>
          <Text style={s.income}>{amount(report.incomeMinor)}</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.label}>Gastos netos</Text>
          <Text style={s.expense}>{amount(report.expenseMinor)}</Text>
        </View>
        {remaining !== null && (
          <View style={s.metric}>
            <Text style={s.label}>
              {remaining < 0 ? 'Exceso de presupuesto' : 'Presupuesto disponible'}
            </Text>
            <Text style={remaining < 0 ? s.expense : s.amount}>{amount(Math.abs(remaining))}</Text>
          </View>
        )}
      </View>
      {comparison && (
        <MonthlyComparison
          comparison={comparison}
          money={money}
          hideAmounts={hideAmounts}
          currency={report.currency}
        />
      )}
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.title}>
          Gasto neto por categoría
        </Text>
        {report.categories.length ? (
          report.categories.map((item) => (
            <View key={item.category} style={s.between}>
              <Text style={[s.text, { flexShrink: 1 }]}>{item.category}</Text>
              <Text style={s.amount}>{amount(item.amountMinor)}</Text>
            </View>
          ))
        ) : (
          <Text style={s.muted}>Todavía no hay gastos en este período.</Text>
        )}
      </View>
      <View style={s.card}>
        <Button label="Exportar reporte CSV" disabled={busy} onPress={onExport} />
        {hideAmounts && <Text style={s.muted}>El archivo incluye los importes del reporte.</Text>}
      </View>
    </>
  );
}
