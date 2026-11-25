import { validDate, type Movement } from './index.ts';
import { parseDominicanDateTime } from './dateTime.ts';
export interface RecurringTemplate {
  id: string;
  version: number;
  description: string;
  amountMinor: number;
  currency: Movement['currency'];
  type: Movement['type'];
  category: string;
  categoryId: string;
  startDate: string;
  timeOfDay?: string | null;
  nextDate: string;
  anchorDay: number;
  active: boolean;
}
export interface RecurringReceipt {
  templateId: string;
  scheduledFor: string;
  movementId: string | null;
}
export function nextMonthlyDate(date: string, anchorDay: number): string {
  if (!validDate(date) || !Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31)
    throw new Error('Fecha de recurrencia inválida.');
  const month = new Date(date + 'T12:00:00.000Z');
  month.setUTCDate(1);
  month.setUTCMonth(month.getUTCMonth() + 1);
  const end = new Date(month);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  month.setUTCDate(Math.min(anchorDay, end.getUTCDate()));
  const result = month.toISOString().slice(0, 10);
  if (!validDate(result)) throw new Error('Fecha fuera de rango.');
  return result;
}
export function recurringOccurrenceAt(date: string, timeOfDay?: string | null) {
  if (!timeOfDay) return date + 'T12:00:00.000Z';
  const timestamp = parseDominicanDateTime(date + 'T' + timeOfDay);
  if (!timestamp) throw new Error('Fecha y hora de recurrencia inválidas.');
  return timestamp.toISOString();
}

export function recurringIsDue(
  template: Pick<RecurringTemplate, 'nextDate' | 'timeOfDay'>,
  now: Date,
) {
  return template.timeOfDay
    ? Date.parse(recurringOccurrenceAt(template.nextDate, template.timeOfDay)) <= now.getTime()
    : template.nextDate <= now.toISOString().slice(0, 10);
}

export function prepareOccurrence(
  template: RecurringTemplate,
  scheduledFor: string,
  now: string,
  receipts: RecurringReceipt[] = [],
  recordMovement = true,
) {
  if (!template.active) throw new Error('La plantilla está pausada.');
  if (
    !validDate(scheduledFor) ||
    (now.length === 10 ? !validDate(now) : !Number.isFinite(Date.parse(now))) ||
    scheduledFor !== template.nextDate ||
    receipts.some((r) => r.templateId === template.id && r.scheduledFor === scheduledFor)
  )
    throw new Error('El vencimiento ya se registró o cambió. Actualiza la lista.');
  if (recordMovement && !recurringIsDue(template, new Date(now)))
    throw new Error('El vencimiento todavía no ha llegado.');
  return {
    nextDate: nextMonthlyDate(scheduledFor, template.anchorDay),
    movement: {
      description: template.description,
      amountMinor: template.amountMinor,
      currency: template.currency,
      type: template.type,
      category: template.category,
      categoryId: template.categoryId,
      occurredAt: recurringOccurrenceAt(scheduledFor, template.timeOfDay),
    },
  };
}
export function changeSince(current: number, previous: number) {
  if (
    !Number.isSafeInteger(current) ||
    !Number.isSafeInteger(previous) ||
    current < 0 ||
    previous < 0
  )
    throw new Error('Total inválido.');
  return {
    previousMinor: previous,
    deltaMinor: current - previous,
    percentage:
      previous === 0
        ? current === 0
          ? 0
          : null
        : Math.round(((current - previous) / previous) * 1000) / 10,
  };
}
export function previousMonth(month: string): string {
  if (!validDate(month + '-01')) throw new Error('Mes inválido.');
  const date = new Date(month + '-01T12:00:00.000Z');
  date.setUTCMonth(date.getUTCMonth() - 1);
  const result = date.toISOString().slice(0, 7);
  if (!validDate(result + '-01')) throw new Error('Mes fuera de rango.');
  return result;
}
