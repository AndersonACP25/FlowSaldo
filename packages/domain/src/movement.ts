import type { Currency } from './finance.ts';

export type SplitAmount = { categoryId: string; amountMinor: number };
export type MovementSplit = SplitAmount & { category: string };

export type MovementType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export interface Movement {
  id: string;
  amountMinor: number;
  currency: Currency;
  type: MovementType;
  description: string;
  occurredAt: string;
  category: string;
  categoryId?: string | null;
  splits?: MovementSplit[];
  accountId?: string | null;
  targetAccountId?: string | null;
  requestKey?: string | null;
  refundOfId?: string | null;
  balanceAdjustment?: { expectedMinor: number; statementMinor: number };
}
