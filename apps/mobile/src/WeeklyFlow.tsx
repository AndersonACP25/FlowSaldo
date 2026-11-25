import React from 'react';
import { Text, View } from 'react-native';
import { dailyCashFlow, type Currency, type Movement } from '@flowsaldo/domain';
import { useTheme } from './theme';
export function WeeklyFlow({
  rows,
  end,
  currency,
  days: aggregated,
}: {
  rows: Movement[];
  end: string;
  currency: Currency;
  days?: ReturnType<typeof dailyCashFlow>;
}) {
  const { styles: s, palette } = useTheme();
  const days =
    aggregated ??
    dailyCashFlow(
      rows.filter((row) => row.currency === currency),
      end,
    );
  const max = Math.max(1, ...days.flatMap((d) => [d.incomeMinor, Math.abs(d.expenseMinor)]));
  return (
    <View style={s.card}>
      <Text style={s.title}>Flujo de 7 días</Text>
      <Text style={s.muted}>
        {days[0].day} — {end} · {currency}
      </Text>
      <View style={{ flexDirection: 'row', height: 140, gap: 8, alignItems: 'flex-end' }}>
        {days.map((day) => (
          <View
            key={day.day}
            accessibilityLabel={`${day.day}: ingreso ${(day.incomeMinor / 100).toFixed(2)}, gasto ${(day.expenseMinor / 100).toFixed(2)} ${currency}`}
            style={{ flex: 1, alignItems: 'center', gap: 8 }}
          >
            <View style={{ height: 110, flexDirection: 'row', gap: 3, alignItems: 'flex-end' }}>
              <View
                style={{
                  width: 10,
                  height: day.incomeMinor ? Math.max(3, (day.incomeMinor / max) * 110) : 2,
                  backgroundColor: day.incomeMinor ? palette.primary : palette.soft,
                  borderRadius: 3,
                }}
              />
              <View
                style={{
                  width: 10,
                  height: day.expenseMinor
                    ? Math.max(3, (Math.abs(day.expenseMinor) / max) * 110)
                    : 2,
                  backgroundColor:
                    day.expenseMinor < 0
                      ? palette.amber
                      : day.expenseMinor
                        ? palette.cyan
                        : palette.soft,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={s.muted}>{day.day.slice(8)}</Text>
          </View>
        ))}
      </View>
      <Text style={s.muted}>
        ● Esmeralda: ingresos · ● Cian: gastos netos
        {days.some((day) => day.expenseMinor < 0) ? ' · ● Ámbar: devoluciones netas' : ''}.
      </Text>
    </View>
  );
}
