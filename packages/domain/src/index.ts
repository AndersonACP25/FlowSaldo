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

export function parseAmount(value: string): number {
  // One decimal separator, never guess thousands separators.
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Usa un monto positivo sin separadores de miles; ejemplo: 1250.50');
  const [major, fraction = ''] = normalized.split('.');
  const minor = Number(major) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 2147483647) throw new Error('Monto fuera de rango');
  return minor;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(value + 'T12:00:00.000Z');
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0,10) === value;
}
export function filterMovements(rows: Movement[], filter: { currency: Currency; month: string; type?: MovementType | 'ALL'; search?: string }): Movement[] {
  const search = (filter.search ?? '').trim().toLocaleLowerCase('es');
  return rows.filter(m => m.currency === filter.currency && m.occurredAt.startsWith(filter.month) && (!filter.type || filter.type === 'ALL' || m.type === filter.type) && (!search || `${m.description} ${m.category}`.toLocaleLowerCase('es').includes(search))).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt));
}
export function categoryExpenses(rows: Movement[]): Array<{ category: string; amountMinor: number }> {
  const totals = new Map<string, number>();
  for (const m of rows.filter(m => m.type === 'EXPENSE')) totals.set(m.category, (totals.get(m.category) ?? 0) + m.amountMinor);
  return Array.from(totals, ([category, amountMinor]) => ({ category, amountMinor })).sort((a,b) => b.amountMinor - a.amountMinor);
}
export function movementsCsv(rows: Movement[]): string {
  const cell = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"';
  return ['fecha,tipo,moneda,monto,descripcion,categoria', ...rows.map(m => [m.occurredAt.slice(0,10), m.type, m.currency, (m.amountMinor / 100).toFixed(2), m.description, m.category].map(cell).join(','))].join('\r\n');
}

export function dailyCashFlow(rows: Movement[], endDate: string) {
  if(!validDate(endDate)) throw new Error('Fecha inválida');
  const end=new Date(endDate+'T12:00:00.000Z');
  return Array.from({length:7},(_,i)=>{
    const d=new Date(end); d.setUTCDate(end.getUTCDate()-6+i); const day=d.toISOString().slice(0,10);
    const selected=rows.filter(m=>m.occurredAt.startsWith(day));
    const incomeMinor=selected.filter(m=>m.type==='INCOME').reduce((n,m)=>n+m.amountMinor,0);
    const expenseMinor=selected.filter(m=>m.type==='EXPENSE').reduce((n,m)=>n+m.amountMinor,0);
    return {day,incomeMinor,expenseMinor,netMinor:incomeMinor-expenseMinor};
  });
}
