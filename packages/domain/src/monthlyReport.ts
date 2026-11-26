import { csvTextCell } from './csv.ts';
import { formatMinorAmount } from './finance.ts';
import { isCurrency, type Currency } from './finance.ts';
import { validDate } from './dateTime.ts';
import { validateExportTable } from './csv.ts';

export type MonthlyReport = {
  month: string;
  currency: Currency;
  incomeMinor: number;
  expenseMinor: number;
  differenceMinor: number;
  budgetMinor: number | null;
  categories: { category: string; amountMinor: number }[];
};

const headers = ['Período', 'Moneda', 'Indicador', 'Categoría', 'Importe'];

export function monthlyReportCsv(report: MonthlyReport) {
  if (!validDate(report.month + '-01') || !isCurrency(report.currency))
    throw new Error('Período o moneda inválidos.');
  const metrics: [string, string, number][] = [
    ['Ingresos', '', report.incomeMinor],
    ['Gastos netos', '', report.expenseMinor],
    ['Balance del mes', '', report.differenceMinor],
  ];
  if (report.budgetMinor !== null) {
    metrics.push(
      ['Presupuesto general', '', report.budgetMinor],
      ['Disponible frente al presupuesto', '', report.budgetMinor - report.expenseMinor],
    );
  }
  for (const { category, amountMinor } of report.categories)
    metrics.push(['Gasto neto por categoría', category, amountMinor]);

  const rows = metrics.map(
    ([metric, category, minor]) =>
      [report.month, report.currency, metric, category, minor] as const,
  );
  validateExportTable(headers, rows);
  return [
    headers.join(','),
    ...rows.map(([month, currency, metric, category, minor]) =>
      [
        ...[month, currency, metric, category].map(csvTextCell),
        formatMinorAmount(minor).replaceAll(',', ''),
      ].join(','),
    ),
  ].join('\r\n');
}
