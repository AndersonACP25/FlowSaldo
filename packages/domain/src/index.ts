export type Currency = 'DOP' | 'USD';
export type MovementType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export interface Movement { id: string; amountMinor: number; currency: Currency; type: MovementType; description: string; occurredAt: string; category: string }
export interface MailInput { externalId: string; body: string }
export type ParseResult = { status: 'PARSED'; movement: Omit<Movement, 'id'> } | { status: 'REVIEW'; reason: string };
// Only a synthetic, strict fixture format. Real banks need separate versioned parsers.
export function parseDemoMail(body: string): ParseResult {
  const match = /^FLOWSALDO-DEMO\|(INCOME|EXPENSE|TRANSFER)\|(DOP|USD)\|([0-9]+)\.([0-9]{2})\|(\d{4}-\d{2}-\d{2})\|([^|\r\n]{1,100})$/.exec(body.trim());
  if (!match) return { status: 'REVIEW', reason: 'Formato desconocido o incompleto' };
  const [, type, currency, major, minor, date, description] = match;
  const amountMinor = Number(major) * 100 + Number(minor);
  const occurredAt = date + 'T12:00:00.000Z';
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !Number.isFinite(Date.parse(occurredAt)) || new Date(occurredAt).toISOString().slice(0, 10) !== date)
    return { status: 'REVIEW', reason: 'Monto o fecha inválidos' };
  return { status: 'PARSED', movement: { type: type as MovementType, currency: currency as Currency, amountMinor, occurredAt, description, category: 'Sin categorizar' } };
}
export function summarize(movements: Movement[], currency: Currency) {
  let incomeMinor = 0, expenseMinor = 0;
  for (const m of movements.filter(m => m.currency === currency)) {
    if (!Number.isSafeInteger(m.amountMinor) || m.amountMinor <= 0) throw new Error('Monto inválido');
    if (m.type === 'INCOME') incomeMinor += m.amountMinor;
    if (m.type === 'EXPENSE') expenseMinor += m.amountMinor;
    if (!Number.isSafeInteger(incomeMinor) || !Number.isSafeInteger(expenseMinor)) throw new Error('Total fuera de rango');
  }
  return { incomeMinor, expenseMinor, differenceMinor: incomeMinor - expenseMinor };
}
export const demoMovements: Movement[] = [
  { id: 'demo-1', type: 'INCOME', amountMinor: 4500000, currency: 'DOP', description: 'Ingreso de ejemplo', occurredAt: '2026-10-20T12:00:00.000Z', category: 'Salario' },
  { id: 'demo-2', type: 'EXPENSE', amountMinor: 245050, currency: 'DOP', description: 'Supermercado de ejemplo', occurredAt: '2026-10-21T12:00:00.000Z', category: 'Alimentación' },
  { id: 'demo-3', type: 'TRANSFER', amountMinor: 500000, currency: 'DOP', description: 'Entre cuentas propias', occurredAt: '2026-10-22T12:00:00.000Z', category: 'Transferencias' },
  { id: 'demo-4', type: 'EXPENSE', amountMinor: 1299, currency: 'USD', description: 'Suscripción de ejemplo', occurredAt: '2026-10-22T12:00:00.000Z', category: 'Servicios' }
];
