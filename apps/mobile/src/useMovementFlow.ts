import { useCallback, useState } from 'react';
import { movementDate, type Movement, type MovementType } from '@flowsaldo/domain';
import { newLocalId } from './localRecords';
import type { RefundDraft } from './movementCommands';

export type MovementEditorDraft =
  { kind: 'new'; duplicate?: Movement } | { kind: 'edit'; movement: Movement };

type MovementDraft = MovementEditorDraft | { kind: 'refund'; data: RefundDraft };

export function useMovementFlow(month: string) {
  const [accountFilter, setAccountFilter] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<MovementType | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [draft, setDraft] = useState<MovementDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const closeDraft = useCallback(() => setDraft(null), []);

  function resetFilters(categoryId = '') {
    setAccountFilter('');
    setSearch('');
    setType('ALL');
    setCategoryFilter(categoryId);
  }

  function startNew() {
    setDraft({ kind: 'new' });
  }

  function startEdit(movement: Movement) {
    setDraft({ kind: 'edit', movement });
    setDeleteId(null);
  }

  function startDuplicate(movement: Movement) {
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setDraft({
      kind: 'new',
      duplicate: { ...movement, occurredAt: movementDate(month, today) + 'T12:00:00.000Z' },
    });
    setDeleteId(null);
  }

  function startRefund(expense: Movement) {
    setDraft({ kind: 'refund', data: { expense, requestKey: 'refund-' + newLocalId() } });
    setDeleteId(null);
  }

  return {
    filters: {
      search,
      type,
      accountFilter,
      categoryFilter,
      setSearch,
      setType,
      setAccountFilter,
      setCategoryFilter,
    },
    resetFilters,
    editor: draft && draft.kind !== 'refund' ? draft : null,
    refundDraft: draft?.kind === 'refund' ? draft.data : null,
    deleteId,
    setDeleteId,
    closeDraft,
    startNew,
    startEdit,
    startDuplicate,
    startRefund,
  };
}
