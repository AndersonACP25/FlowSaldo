import { readMovement } from './apiContracts';
import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseDominicanDateTime, selectedCategory } from '@flowsaldo/domain';
import type { LocalScope } from './dataScopes';
import type { Page } from './history';
import type { ApiRequest } from './apiClient';
import type { ImportStats } from './ImportQueue';
import { checkLocalMovementAccounts } from './movementCommands';
import type { Draft } from './MovementForm';
import type { ReviewItem } from './reviews';
import type { LocalData, LocalUpdate } from './storage';
import { notifyTransaction } from './transactionNotifications';

export function useImportReviews({
  connected,
  dataScope,
  notify,
  connectionsOpen,
  reviewsOpen,
  local,
  localRef,
  request,
  persist,
  refreshMovements,
  setNotice,
}: {
  connected: boolean;
  dataScope: LocalScope;
  notify: boolean;
  connectionsOpen: boolean;
  reviewsOpen: boolean;
  local: LocalData;
  localRef: { current: LocalData };
  request: ApiRequest;
  persist: (update: LocalUpdate) => Promise<void>;
  refreshMovements: () => Promise<void>;
  setNotice: (notice: string) => void;
}) {
  const client = useQueryClient();
  const [reviewStatus, setReviewStatus] = useState<ReviewItem['status'] | 'ALL'>('REVIEW');
  const [reviewFrom, setReviewFrom] = useState('');
  const [reviewTo, setReviewTo] = useState('');
  const [sampleId, setSampleId] = useState('');
  const [sampleBody, setSampleBody] = useState('Aviso de prueba sin formato reconocido');
  const queue = useQuery({
    queryKey: ['import-stats', dataScope],
    enabled: connected,
    retry: false,
    refetchInterval: connected && connectionsOpen ? 5000 : false,
    queryFn: async (): Promise<ImportStats> => request('/imports/stats'),
  });
  const rangeStart = parseDominicanDateTime(reviewFrom);
  const endMinute = parseDominicanDateTime(reviewTo);
  const rangeEnd = endMinute ? new Date(endMinute.getTime() + 60_000) : null;
  const reviewParams = `${reviewStatus === 'ALL' ? '' : `&status=${reviewStatus}`}${rangeStart ? `&from=${encodeURIComponent(rangeStart.toISOString())}` : ''}${rangeEnd ? `&to=${encodeURIComponent(rangeEnd.toISOString())}` : ''}`;
  const reviewDateError =
    (reviewFrom && !rangeStart) ||
    (reviewTo && !rangeEnd) ||
    (rangeStart && rangeEnd && rangeStart >= rangeEnd);
  const imports = useInfiniteQuery({
    queryKey: ['imports', dataScope, reviewParams],
    enabled: connected && !reviewDateError,
    retry: false,
    refetchInterval: connected && (reviewsOpen || connectionsOpen) ? 5000 : false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<Page<ReviewItem>> =>
      request(
        `/imports?page=true${reviewParams}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const reviews = connected
    ? (imports.data?.pages.flatMap((p) => p.items) ?? [])
    : local.reviews.filter(
        (i) =>
          (reviewStatus === 'ALL' || i.status === reviewStatus) &&
          (!rangeStart || (!!i.createdAt && Date.parse(i.createdAt) >= rangeStart.getTime())) &&
          (!rangeEnd || (!!i.createdAt && Date.parse(i.createdAt) < rangeEnd.getTime())),
      );
  const pending = connected
    ? (imports.data?.pages[0]?.pendingTotal ?? 0)
    : local.reviews.filter((i) => i.status === 'REVIEW').length;
  async function resolveReview(id: string, draft: Draft) {
    if (connected) {
      const movement = readMovement(
        await request(`/imports/${id}/resolve`, {
          method: 'POST',
          body: JSON.stringify(draft),
        }),
      );
      await Promise.all([client.invalidateQueries({ queryKey: ['imports'] }), refreshMovements()]);
      if (notify) void notifyTransaction(movement.id, 'Transacción de aviso confirmada');
    } else {
      await persist((current) => {
        const review = current.reviews.find((i) => i.id === id);
        if (review?.status !== 'REVIEW') throw new Error('Este correo ya fue revisado.');
        checkLocalMovementAccounts(current.accounts, draft);
        return {
          ...current,
          movements: [
            {
              ...draft,
              ...selectedCategory(
                current.categories,
                draft.categoryId ?? undefined,
                draft.category,
              ),
              id: `reviewed-${id}`,
            },
            ...current.movements,
          ],
          reviews: current.reviews.map((i) =>
            i.id === id
              ? { ...i, status: 'PARSED' as const, body: '', movement: { id: `reviewed-${id}` } }
              : i,
          ),
        };
      });
    }
    setNotice('Revisión confirmada. Movimiento registrado.');
  }
  async function retryImport(id: string) {
    await request(`/imports/${id}/retry`, { method: 'POST' });
    await refreshImports();
    setNotice('Importación reencolada. Se iniciará otro ciclo limitado de intentos.');
  }
  async function discardReview(id: string) {
    if (connected) {
      await request(`/imports/${id}/dismiss`, { method: 'POST' });
      await client.invalidateQueries({ queryKey: ['imports'] });
    } else
      await persist((current) => ({
        ...current,
        reviews: current.reviews.map((i) =>
          i.id === id ? { ...i, status: 'DISMISSED' as const, body: '' } : i,
        ),
      }));
    setNotice('Correo descartado sin contabilizar.');
  }

  function resetFilters(status: ReviewItem['status'] | 'ALL' = 'REVIEW') {
    setReviewStatus(status);
    setReviewFrom('');
    setReviewTo('');
  }

  async function refreshImports() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['imports'] }),
      client.invalidateQueries({ queryKey: ['import-stats'] }),
    ]);
  }

  async function enqueueSample() {
    await request('/imports', {
      method: 'POST',
      body: JSON.stringify({ externalId: sampleId.trim(), body: sampleBody }),
    });
    await Promise.all([client.invalidateQueries({ queryKey: ['imports'] }), queue.refetch()]);
    setNotice('Correo encolado. Espera al worker y actualiza revisiones.');
  }

  async function getReviewedMovement(id: string) {
    return connected
      ? readMovement(await request(`/movements/${encodeURIComponent(id)}`))
      : (localRef.current.movements.find((movement) => movement.id === id) ?? null);
  }

  async function getSuggestion(id: string) {
    return (await request<Pick<ReviewItem, 'suggestion'>>(`/imports/${id}`)).suggestion;
  }

  return {
    queue,
    pending,
    imports,
    reviews,
    reviewParams,
    reviewDateError,
    reviewStatus,
    reviewFrom,
    reviewTo,
    setReviewStatus,
    setReviewFrom,
    setReviewTo,
    resetFilters,
    resolveReview,
    discardReview,
    retryImport,
    refreshImports,
    getReviewedMovement,
    getSuggestion,
    sampleId,
    setSampleId,
    sampleBody,
    setSampleBody,
    enqueueSample,
  };
}
