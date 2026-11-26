export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(value + 'T12:00:00.000Z');
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}

export const validClockTime = (value: string) => /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);

export function dominicanDateTime(value: Date) {
  return new Date(value.getTime() - 4 * 60 * 60_000).toISOString().slice(0, 16);
}

export function parseDominicanDateTime(value: string) {
  if (
    value.length !== 16 ||
    value[10] !== 'T' ||
    !validDate(value.slice(0, 10)) ||
    !validClockTime(value.slice(11))
  )
    return null;
  return new Date(value + ':00-04:00');
}
