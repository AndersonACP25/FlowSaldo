import { parseAmount, validDate, type Movement } from './index.ts';

export type BankParserVersion = 'bhd-withdrawal-v1' | 'popular-withdrawal-v1';
type BankSuggestion = { parserVersion: BankParserVersion; movement: Omit<Movement, 'id'> };
const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();
const columns = (line: string) => line.split(/\t+| {2,}/).map((value) => value.trim());
const bhdHeader = 'fecha|moneda|monto|comercio|estado|tipo';
const popularHeader = 'monto|moneda|fecha|cajero automatico|estatus';

export function parseBankWithdrawal(body: string): BankSuggestion | null {
  const rows = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(columns);
  const headers = rows.map((row) => row.map(normalize).join('|'));
  const bankHeaders = headers.filter((header) => header === bhdHeader || header === popularHeader);
  if (bankHeaders.length !== 1) return null;
  const [header] = bankHeaders;
  const index = headers.indexOf(header);
  const [row, ...tail] = rows.slice(index + 1);
  if (!row || tail.some((next) => next.length > 1)) return null;
  const bhd = header === bhdHeader;
  if (
    bhd &&
    (!headers.slice(0, index).includes('bhd notificacion de transacciones') || row.length !== 6)
  )
    return null;
  if (!bhd && row.length !== 5) return null;
  const [date, currency, amount, merchant, status, type] = bhd
    ? row
    : [row[2], row[1], row[0], row[3], row[4]];
  if (normalize(status) !== 'aprobada' || !merchant || merchant.length > 100) return null;
  if (
    bhd
      ? normalize(currency) !== 'rd' || normalize(type) !== 'retiro de efectivo'
      : normalize(currency) !== 'peso dominicano'
  )
    return null;
  const datePattern = bhd
    ? /^(\d{2})\/(\d{2})\/(\d{4}) (?:0?[1-9]|1[0-2]):[0-5]\d [ap]m$/i
    : /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const dateParts = datePattern.exec(date);
  const moneyPattern = bhd
    ? /^\$((?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2})$/
    : /^RD\$((?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2})$/;
  const money = moneyPattern.exec(amount);
  if (!dateParts || !money) return null;
  const [, day, month, year] = dateParts;
  const iso = `${year}-${month}-${day}`;
  if (!validDate(iso)) return null;
  try {
    return {
      parserVersion: bhd ? 'bhd-withdrawal-v1' : 'popular-withdrawal-v1',
      movement: {
        type: 'EXPENSE',
        currency: 'DOP',
        amountMinor: parseAmount(money[1].replaceAll(',', '')),
        occurredAt: iso + 'T12:00:00.000Z',
        description: merchant,
        category: 'Sin categorizar',
      },
    };
  } catch {
    return null;
  }
}
