export function parseSignedAmount(value: string, maxMinor = 2147483647): number {
  const match = /^(-?)([0-9]+)(?:[.,]([0-9]{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error('Usa un monto sin separadores de miles; ejemplo: -1250.50');
  const magnitude = BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'));
  if (magnitude > BigInt(maxMinor)) throw new Error('Monto fuera de rango.');
  return Number(magnitude) * (match[1] && magnitude !== 0n ? -1 : 1);
}
export function ledgerBalance(
  opening: number,
  income: number,
  outgoing: number,
  incomingTransfers: number,
): number {
  for (const n of [opening, income, outgoing, incomingTransfers])
    if (!Number.isSafeInteger(n)) throw new Error('Saldo fuera de rango.');
  const n = BigInt(opening) + BigInt(income) - BigInt(outgoing) + BigInt(incomingTransfers);
  const result = Number(n);
  if (!Number.isSafeInteger(result)) throw new Error('Saldo fuera de rango.');
  return result;
}

export function formatMinorAmount(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new Error('Monto fuera de rango.');
  const n = BigInt(minor);
  const magnitude = n < 0n ? -n : n;
  return (
    (n < 0n ? '-' : '') +
    (magnitude / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
    '.' +
    (magnitude % 100n).toString().padStart(2, '0')
  );
}

// Nominal annual basis points divided by 12, rounded to the nearest cent.
export function monthlyInterestMinor(principalMinor: number, annualRateBasisPoints: number) {
  return Number((BigInt(principalMinor) * BigInt(annualRateBasisPoints) + 60_000n) / 120_000n);
}
