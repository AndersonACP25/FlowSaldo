import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  filterMovements,
  refundBalance,
  type Currency,
  type Movement,
  type MovementType,
} from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import { exportCsv, exportCsvText } from './exportCsv';
import { movementParams, type MovementRequest, type Page } from './history';

export function useMovementHistory({
  connection,
  rows,
  month,
  currency,
  filters,
  closing,
  refundSource,
}: {
  connection: { url: string; token: string; scope: LocalScope; request: MovementRequest } | null;
  rows: Movement[];
  month: string;
  currency: Currency;
  filters: { type: MovementType | 'ALL'; search: string; categoryId: string; accountId: string };
  closing: { active: boolean; categoryId?: string };
  refundSource: Movement | null;
}) {
  const client = useQueryClient();
  const connected = !!connection;
  const { type, search, categoryId, accountId } = filters;
  const params =
    movementParams(month, currency, type, search, categoryId) +
    (connected && accountId ? `&accountId=${encodeURIComponent(accountId)}` : '');

  const query = useInfiniteQuery({
    queryKey: ['movements', connection?.scope, params],
    enabled: connected,
    retry: false,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      connection!.request<Page<Movement>>(
        `/movements?page=true&${params}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const closingUncategorized = useQuery({
    queryKey: [
      'movements',
      'closing-uncategorized',
      connection?.scope,
      month,
      currency,
      closing.categoryId,
    ],
    enabled: connected && closing.active && !!closing.categoryId,
    retry: false,
    queryFn: async () => {
      const query = movementParams(month, currency, 'ALL', '', closing.categoryId ?? '');
      const page = await connection!.request<Page<Movement>>(
        `/movements?page=true&limit=1&${query}`,
      );
      return page.total;
    },
  });
  const refundQuery = useQuery({
    queryKey: ['movements', 'refunds', connection?.scope, refundSource?.id],
    enabled: connected && !!refundSource,
    retry: false,
    queryFn: () =>
      connection!.request<{ source: Movement; refundedMinor: number; remainingMinor: number }>(
        `/movements/${encodeURIComponent(refundSource!.id)}/refunds`,
      ),
  });
  const pagedRows = query.data?.pages.flatMap((page) => page.items) ?? [];
  const visible = connected
    ? pagedRows
    : filterMovements(rows, {
        currency,
        month,
        type,
        search,
        categoryId: categoryId || undefined,
      }).filter(
        (movement) =>
          !accountId || movement.accountId === accountId || movement.targetAccountId === accountId,
      );
  const recent = [
    ...new Set(
      (connected ? pagedRows : [...rows].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)))
        .map((movement) => movement.categoryId)
        .filter((id): id is string => !!id),
    ),
  ].slice(0, 5);
  const refundInfo =
    refundSource &&
    (connected ? refundQuery.data : { source: refundSource, ...refundBalance(refundSource, rows) });

  async function refreshMovements() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['movements'] }),
      client.invalidateQueries({ queryKey: ['savings-transfers'] }),
      client.invalidateQueries({ queryKey: ['pending-links'] }),
      client.invalidateQueries({ queryKey: ['summary'] }),
      client.invalidateQueries({ queryKey: ['accounts'] }),
    ]);
  }

  async function exportAll() {
    if (!connection) {
      await exportCsv(visible, month);
      return;
    }
    const response = await fetch(`${connection.url}/movements/export?${params}`, {
      headers: { Authorization: `Bearer ${connection.token}` },
    });
    if (!response.ok) throw new Error('No se pudo exportar. Reintenta la descarga.');
    await exportCsvText(await response.text(), `FlowSaldo-${month}.csv`);
  }

  return {
    query,
    closingUncategorized,
    refundQuery,
    refundInfo,
    visible,
    recent,
    refreshMovements,
    exportAll,
  };
}
