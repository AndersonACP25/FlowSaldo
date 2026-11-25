import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  countLabel,
  dominicanDateTime,
  ledgerBalance,
  type ClosingPending,
  type Currency,
  type MonthlyClosing,
} from '@flowsaldo/domain';
import { useTheme } from './theme';
import { Button, Choice } from './ui';

export function MonthlyClosingScreen({
  current,
  saved,
  previous,
  pending,
  loadingError,
  saving,
  onRetry,
  onSave,
  onMovements,
  onPending,
  money,
}: {
  current?: MonthlyClosing;
  saved?: MonthlyClosing;
  previous?: MonthlyClosing;
  pending: ClosingPending[];
  loadingError: boolean;
  saving: boolean;
  onRetry?: () => void;
  onSave: (closing: MonthlyClosing) => Promise<void>;
  onMovements: () => void;
  onPending: (id: string) => void;
  money: (minor: number, currency: Currency) => string;
}) {
  const { styles: s } = useTheme();
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const view = showSaved ? saved : current;

  async function save() {
    if (!current || saving) return;
    setError('');
    setNotice('');
    try {
      await onSave({ ...current, capturedAt: new Date().toISOString() });
      setShowSaved(true);
      setNotice('Cierre mensual guardado.');
    } catch {
      setError('No se pudo guardar el cierre mensual.');
    }
  }

  function amount(minor: number) {
    return view ? money(minor, view.currency) : '';
  }

  function budgetLine(name: string, limit: number, spent: number) {
    const remaining = limit - spent;
    return (
      <>
        <Text style={s.text}>{name}</Text>
        <Text style={s.muted}>
          Gastado {amount(spent)} de {amount(limit)}
        </Text>
        <Text style={remaining < 0 ? s.expense : s.text}>
          {remaining < 0 ? 'Exceso' : 'Disponible'} · {amount(Math.abs(remaining))}
        </Text>
      </>
    );
  }

  return (
    <>
      {saved && (
        <View style={s.row}>
          <Choice label="Datos del mes" selected={!showSaved} onPress={() => setShowSaved(false)} />
          <Choice label="Cierre guardado" selected={showSaved} onPress={() => setShowSaved(true)} />
        </View>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {notice}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!view ? (
        <View style={s.card}>
          <Text style={s.muted}>
            {loadingError ? 'No se pudo preparar el cierre.' : 'Preparando el cierre…'}
          </Text>
          {onRetry && <Button label="Reintentar datos del cierre" onPress={onRetry} />}
        </View>
      ) : (
        <>
          <View style={s.hero}>
            <Text style={s.label}>
              {view.month} · {view.currency}
            </Text>
            <Text style={s.heroValue}>
              {amount(ledgerBalance(0, view.incomeMinor, view.expenseMinor, 0))}
            </Text>
            <Text style={s.muted}>Ingresos menos gastos</Text>
            <View style={{ gap: 6 }}>
              <Text style={s.income}>Ingresos · {amount(view.incomeMinor)}</Text>
              <Text style={s.expense}>Gastos · {amount(view.expenseMinor)}</Text>
            </View>
            {showSaved && (
              <Text style={s.muted}>
                Guardado el {dominicanDateTime(new Date(view.capturedAt)).replace('T', ' a las ')}
              </Text>
            )}
          </View>
          <View style={s.card}>
            <Text accessibilityRole="header" style={s.title}>
              Movimientos sin categorizar
            </Text>
            <Text style={s.text}>
              {countLabel(
                view.uncategorizedCount,
                'movimiento por revisar',
                'movimientos por revisar',
              )}
            </Text>
            {!showSaved && view.uncategorizedCount > 0 && (
              <Button label="Revisar movimientos sin categorizar" onPress={onMovements} />
            )}
          </View>
          <View style={s.card}>
            <Text accessibilityRole="header" style={s.title}>
              Pagos y cobros pendientes
            </Text>
            <Text style={s.muted}>
              {countLabel(
                view.pendingCount,
                'pendiente con vencimiento en el mes',
                'pendientes con vencimiento en el mes',
              )}
            </Text>
            <View style={s.between}>
              <Text style={s.expense}>Por pagar · {amount(view.toPayMinor)}</Text>
              <Text style={s.income}>Por cobrar · {amount(view.toCollectMinor)}</Text>
            </View>
            {!showSaved &&
              pending.map((item) => (
                <View key={item.id} style={s.between}>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={s.text}>{item.name}</Text>
                    <Text style={s.muted}>
                      {item.kind === 'pay' ? 'Por pagar' : 'Por cobrar'} ·{' '}
                      {item.dueAt.replace('T', ' · ')} · {amount(item.remainingMinor)}
                    </Text>
                  </View>
                  <Choice
                    label={`Revisar pendiente ${item.name}`}
                    text="Revisar"
                    selected={false}
                    onPress={() => onPending(item.id)}
                  />
                </View>
              ))}
          </View>
          <View style={s.card}>
            <Text accessibilityRole="header" style={s.title}>
              Presupuesto del mes
            </Text>
            {view.budgetMinor === null ? (
              <Text style={s.muted}>Sin límite general.</Text>
            ) : (
              budgetLine('Límite general', view.budgetMinor, view.expenseMinor)
            )}
            {view.categories.map((category) => (
              <View key={category.categoryId} style={{ gap: 4 }}>
                {budgetLine(category.name, category.limitMinor, category.spentMinor)}
              </View>
            ))}
          </View>
          {previous && (
            <View style={s.card}>
              <Text accessibilityRole="header" style={s.title}>
                Frente al cierre de {previous.month}
              </Text>
              <Text style={s.muted}>
                Variación de ingresos · {amount(view.incomeMinor - previous.incomeMinor)}
              </Text>
              <Text style={s.muted}>
                Variación de gastos · {amount(view.expenseMinor - previous.expenseMinor)}
              </Text>
            </View>
          )}
          {!showSaved && (
            <Button
              label={saved ? 'Actualizar cierre mensual' : 'Guardar cierre mensual'}
              disabled={saving}
              onPress={() => void save()}
            />
          )}
        </>
      )}
    </>
  );
}
