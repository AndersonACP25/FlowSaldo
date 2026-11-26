import { dominicanDateTime, parseDominicanDateTime } from './dateTime.ts';
import { ledgerBalance } from './finance.ts';
import type { Currency } from './finance.ts';
import { pendingOccurrence, type PendingItem } from './pendingPayments.ts';
import {
  nextMonthlyDate,
  previousMonth,
  recurringOccurrenceAt,
  type RecurringTemplate,
} from './recurring.ts';

export interface CashProjectionPlan {
  balanceMinor: number;
  nextIncomeAt: string;
}

function monthNumber(date: string) {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
}

export function projectAvailableCash({
  balanceMinor,
  nextIncomeAt,
  currency,
  templates,
  pending = [],
  now,
}: CashProjectionPlan & {
  currency: Currency;
  templates: RecurringTemplate[];
  pending?: (Pick<PendingItem, 'id' | 'name' | 'kind' | 'currency' | 'dueAt' | 'occurrence'> & {
    remainingMinor: number;
  })[];
  now: Date;
}) {
  const cutoff = parseDominicanDateTime(nextIncomeAt);
  if (!cutoff || !Number.isFinite(now.getTime()) || cutoff <= now)
    throw new Error('El próximo cobro debe estar en el futuro.');
  if (!Number.isSafeInteger(balanceMinor)) throw new Error('Monto inválido.');

  const commitments = templates.flatMap((template) => {
    if (!template.active || template.currency !== currency || template.type !== 'EXPENSE')
      return [];
    const firstAt = recurringOccurrenceAt(template.nextDate, template.timeOfDay);
    if (Date.parse(firstAt) >= cutoff.getTime()) return [];
    const cutoffCalendar = template.timeOfDay
      ? new Date(nextIncomeAt.slice(0, 10) + 'T00:00:00Z')
      : cutoff;
    const cutoffYear = cutoffCalendar.getUTCFullYear();
    const months =
      cutoffYear * 12 + cutoffCalendar.getUTCMonth() + 1 - monthNumber(template.nextDate);
    let occurrences = 1;
    if (months > 0) occurrences = months;
    if (months > 0 && cutoffYear <= 9999) {
      // The first pending date may be custom. Only later months use the anchor day.
      const cutoffMonth = cutoffCalendar.toISOString().slice(0, 7);
      const lastDate = nextMonthlyDate(previousMonth(cutoffMonth) + '-01', template.anchorDay);
      const lastAt = recurringOccurrenceAt(lastDate, template.timeOfDay);
      occurrences += Number(Date.parse(lastAt) < cutoff.getTime());
    }
    const tracked = pendingOccurrence(pending, template.id, template.nextDate);
    const firstScheduled = tracked
      ? nextMonthlyDate(template.nextDate, template.anchorDay)
      : template.nextDate;
    occurrences -= Number(!!tracked);
    if (!occurrences) return [];
    const totalMinor = template.amountMinor * occurrences;
    if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0)
      throw new Error('Compromisos fuera de rango.');
    return [
      {
        id: template.id,
        description: template.description,
        firstDueAt: dominicanDateTime(
          new Date(recurringOccurrenceAt(firstScheduled, template.timeOfDay)),
        ),
        source: 'recurring' as 'recurring' | 'pending',
        occurrences,
        totalMinor,
      },
    ];
  });
  for (const item of pending) {
    if (item.kind !== 'pay' || item.currency !== currency || item.remainingMinor === 0) continue;
    const due = parseDominicanDateTime(item.dueAt);
    if (!due || due >= cutoff) continue;
    if (!Number.isSafeInteger(item.remainingMinor) || item.remainingMinor < 0)
      throw new Error('Monto pendiente inválido.');
    commitments.push({
      id: item.id,
      description: item.name,
      firstDueAt: item.dueAt,
      source: 'pending',
      occurrences: 1,
      totalMinor: item.remainingMinor,
    });
  }
  commitments.sort((a, b) => a.firstDueAt.localeCompare(b.firstDueAt));
  const committedMinor = commitments.reduce(
    (total, item) => ledgerBalance(total, item.totalMinor, 0, 0),
    0,
  );
  const availableMinor = ledgerBalance(balanceMinor, 0, committedMinor, 0);
  return {
    commitments,
    committedMinor,
    availableMinor,
  };
}
