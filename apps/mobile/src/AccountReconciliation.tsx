import React, { useState } from 'react';
import { Text } from 'react-native';
import { validDate, parseSignedAmount, type Currency } from '@flowsaldo/domain';
import { useTheme } from './theme';
import { Button, Field } from './ui';
import type { FinancialAccount } from './FinancePanel';
interface Reconcile {
  accountId: string;
  asOf: string;
  statementMinor: number;
  expectedMinor: number;
  differenceMinor: number;
  expectedRevision: number;
}

export function useAccountReconciliation() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState('');
  const [preview, setPreview] = useState<Reconcile | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; asOf: string; balanceMinor: number }>>(
    [],
  );
  function reset() {
    setStatement('');
    setPreview(null);
    setHistory([]);
  }
  return {
    asOf,
    setAsOf,
    statement,
    setStatement,
    preview,
    setPreview,
    history,
    setHistory,
    reset,
  };
}
export function AccountReconciliation({
  account,
  reconciliation,
  busy,
  run,
  post,
  request,
  onRefresh,
  setNotice,
  money,
}: {
  account: FinancialAccount;
  reconciliation: ReturnType<typeof useAccountReconciliation>;
  busy: boolean;
  run: (work: () => Promise<void>) => Promise<void>;
  post: <T>(path: string, body: unknown) => Promise<T>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  onRefresh: () => Promise<void>;
  setNotice: (value: string) => void;
  money: (n: number, currency: Currency) => string;
}) {
  const { styles: s } = useTheme();
  const { asOf, setAsOf, statement, setStatement, preview, setPreview, history, setHistory } =
    reconciliation;
  return (
    <>
      <Text style={s.title}>Conciliación manual</Text>
      <Text style={s.muted}>
        Compara con el saldo de tu estado de cuenta al cierre del día UTC. Para tarjetas y
        préstamos, escribe la deuda con signo negativo. Solo se confirma si la diferencia es cero;
        no se generan ajustes. Confirmar protege todos los movimientos vinculados hasta esa fecha.
      </Text>
      <Field
        label="Fecha de conciliación (AAAA-MM-DD)"
        value={asOf}
        onChangeText={(v) => {
          setAsOf(v);
          setPreview(null);
        }}
        maxLength={10}
      />
      <Field
        label="Saldo del estado de cuenta"
        value={statement}
        onChangeText={(v) => {
          setStatement(v);
          setPreview(null);
        }}
        placeholder="Ejemplo: -2500.00"
      />
      <Button
        label="Comparar saldos"
        disabled={busy || account.archived}
        onPress={() =>
          void run(async () => {
            if (!validDate(asOf)) throw new Error('Escribe una fecha válida.');
            const result = await post<Reconcile>(`/accounts/${account.id}/reconciliation/preview`, {
              asOf,
              statementMinor: parseSignedAmount(statement, Number.MAX_SAFE_INTEGER),
            });
            setPreview(result);
          })
        }
      />
      {preview && (
        <>
          <Text style={s.text}>
            Saldo calculado: {money(preview.expectedMinor, account.currency)} · Diferencia:{' '}
            {money(preview.differenceMinor, account.currency)}
          </Text>
          <Button
            label="Confirmar conciliación y proteger período"
            disabled={busy || preview.differenceMinor !== 0}
            onPress={() =>
              void run(async () => {
                await post(`/accounts/${account.id}/reconciliation`, {
                  asOf: preview.asOf,
                  statementMinor: preview.statementMinor,
                  expectedRevision: preview.expectedRevision,
                });
                setPreview(null);
                await onRefresh();
                setNotice('Conciliación confirmada. El período quedó protegido.');
              })
            }
          />
        </>
      )}
      <Button
        label="Ver conciliaciones"
        disabled={busy}
        onPress={() =>
          void run(async () =>
            setHistory(
              await request<Array<{ id: string; asOf: string; balanceMinor: number }>>(
                `/accounts/${account.id}/reconciliations`,
              ),
            ),
          )
        }
      />
      {history.map((h) => (
        <Text key={h.id} style={s.muted}>
          {h.asOf} · {money(h.balanceMinor, account.currency)}
        </Text>
      ))}
    </>
  );
}
