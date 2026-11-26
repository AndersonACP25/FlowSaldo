import { useQuery } from '@tanstack/react-query';
import {
  categoryExpenses,
  changeSince,
  filterMovements,
  previousMonth,
  summarize,
  type Currency,
  type Movement,
} from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import type { MonthlySummary } from './history';
import type { ApiRequest } from './apiClient';

export function useMonthlyOverview({
  dataScope,
  connected,
  request,
  rows,
  month,
  currency,
  periodDate,
}: {
  dataScope: LocalScope;
  connected: boolean;
  request: ApiRequest;
  rows: Movement[];
  month: string;
  currency: Currency;
  periodDate: string;
}) {
  const totals = useQuery({
    queryKey: ['summary', dataScope, month, currency, periodDate],
    enabled: connected,
    retry: false,
    queryFn: () =>
      request<MonthlySummary>(`/summary?month=${month}&currency=${currency}&weekEnd=${periodDate}`),
  });

  const period = filterMovements(rows, { currency, month });
  const summary = connected
    ? (totals.data ?? { incomeMinor: 0, expenseMinor: 0, differenceMinor: 0 })
    : summarize(period, currency);
  const priorMonth = previousMonth(month);
  const priorSummary = summarize(filterMovements(rows, { currency, month: priorMonth }), currency);
  const comparison = connected
    ? totals.data?.comparison
    : {
        previousMonth: priorMonth,
        income: changeSince(summary.incomeMinor, priorSummary.incomeMinor),
        expense: changeSince(summary.expenseMinor, priorSummary.expenseMinor),
      };
  const categories = connected ? (totals.data?.categories ?? []) : categoryExpenses(period);

  return {
    totals,
    period,
    summary,
    comparison,
    categories,
    count: connected ? (totals.data?.total ?? 0) : period.length,
  };
}
