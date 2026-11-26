import { parseDominicanDateTime } from './dateTime.ts';
import { pendingOccurrence, pendingRemaining, type PendingItem } from './pendingPayments.ts';
import {
  recurringOccurrenceAt,
  type RecurringReceipt,
  type RecurringTemplate,
} from './recurring.ts';
import type { Movement } from './movement.ts';

export interface DueReminder {
  kind: 'payment' | 'monthly';
  id: string;
  dueAt: number;
}

export function dueReminders(
  pending: PendingItem[],
  recurring: RecurringTemplate[],
  receipts: RecurringReceipt[],
  movements: Movement[],
): DueReminder[] {
  const byId = new Map(movements.map((item) => [item.id, item]));
  const confirmed = new Set(
    receipts.map((receipt) => JSON.stringify([receipt.templateId, receipt.scheduledFor])),
  );
  const reminders: DueReminder[] = [];
  for (const item of pending) {
    if (item.kind !== 'pay' || pendingRemaining(item, byId) === 0) continue;
    const due = parseDominicanDateTime(item.dueAt);
    if (due) reminders.push({ kind: 'payment', id: item.id, dueAt: due.getTime() });
  }
  for (const template of recurring) {
    if (!template.active || confirmed.has(JSON.stringify([template.id, template.nextDate])))
      continue;
    const linked = pendingOccurrence(pending, template.id, template.nextDate);
    if (linked && (linked.kind === 'pay' || pendingRemaining(linked, byId) === 0)) continue;
    reminders.push({
      kind: 'monthly',
      id: template.id,
      dueAt: Date.parse(recurringOccurrenceAt(template.nextDate, template.timeOfDay)),
    });
  }
  return reminders;
}

export const dueReminderPrefix = 'flowsaldo-due-v1:';
export const dueReminderId = ({ kind, id, dueAt }: DueReminder, exact: boolean) =>
  dueReminderPrefix + JSON.stringify([kind, id, dueAt, exact]);

export function planDueReminderUpdates(
  reminders: DueReminder[],
  scheduledIds: string[],
  presentedIds: string[],
  now: number,
  exact: boolean,
) {
  const active = new Map(reminders.map((item) => [dueReminderId(item, exact), item]));
  const scheduled = new Set(scheduledIds);
  const presented = new Set(presentedIds);
  return {
    cancel: scheduledIds.filter((id) => id.startsWith(dueReminderPrefix) && !active.has(id)),
    dismiss: presentedIds.filter((id) => id.startsWith(dueReminderPrefix) && !active.has(id)),
    schedule: [...active].filter(
      ([id, item]) => item.dueAt > now && !scheduled.has(id) && !presented.has(id),
    ),
  };
}
