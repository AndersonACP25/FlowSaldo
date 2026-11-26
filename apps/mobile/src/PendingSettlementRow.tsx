import React from 'react';
import { Text, View } from 'react-native';
import {
  parseAmount,
  settlementAmount,
  type Currency,
  type Movement,
  type PendingItem,
  type PendingSettlement,
} from '@flowsaldo/domain';
import { IconButton } from './IconButton';
import { Field } from './ui';
import { useTheme } from './theme';

type EditedSettlement = { id: string; amount: string } | null;

export function PendingSettlementRow({
  item,
  entry,
  movements,
  money,
  ready,
  blocked,
  canEdit,
  edited,
  setEdited,
  removing,
  setRemoving,
  clearError,
  run,
  onRemove,
  onEdit,
}: {
  item: PendingItem;
  entry: PendingSettlement;
  movements: ReadonlyMap<string, Movement>;
  money: (minor: number, currency: Currency) => string;
  ready: boolean;
  blocked: boolean;
  canEdit: boolean;
  edited: EditedSettlement;
  setEdited: (value: EditedSettlement) => void;
  removing: string;
  setRemoving: (id: string) => void;
  clearError: () => void;
  run: (work: () => Promise<void>, message: string) => Promise<void>;
  onRemove: (id: string, settlementId: string) => Promise<void>;
  onEdit: (id: string, settlementId: string, amountMinor: number) => Promise<void>;
}) {
  const { styles: s } = useTheme();
  const applied = settlementAmount(item, entry, movements);
  const movement = entry.kind === 'movement' ? movements.get(entry.movementId) : undefined;
  const label = entry.kind === 'manual' ? 'Abono manual' : (movement?.description ?? 'Movimiento');
  return (
    <View style={{ gap: 8 }}>
      <View style={s.between}>
        <Text style={[s.muted, { flexShrink: 1 }]}>
          {label} ·{' '}
          {!ready && entry.kind === 'movement'
            ? 'Por verificar'
            : applied
              ? money(applied, item.currency)
              : 'Ya no coincide o no está disponible'}
        </Text>
        <View style={s.row}>
          {entry.kind === 'manual' && canEdit && (
            <IconButton
              icon="edit"
              label="Editar abono manual"
              disabled={blocked}
              onPress={() => {
                setEdited({
                  id: entry.id,
                  amount: String(entry.amountMinor / 100),
                });
                setRemoving('');
                clearError();
              }}
            />
          )}
          <IconButton
            icon={removing === entry.id ? 'check' : 'trash'}
            label={removing === entry.id ? 'Confirmar quitar abono' : `Quitar ${label}`}
            danger={removing !== entry.id}
            disabled={blocked}
            onPress={() => {
              if (removing !== entry.id) {
                setEdited(null);
                setRemoving(entry.id);
                return;
              }
              void run(async () => {
                await onRemove(item.id, entry.id);
                setRemoving('');
              }, 'Abono quitado.');
            }}
          />
          {removing === entry.id && (
            <IconButton
              icon="close"
              label="Cancelar retiro de abono"
              disabled={blocked}
              onPress={() => setRemoving('')}
            />
          )}
        </View>
      </View>
      {edited?.id === entry.id && (
        <>
          <Field
            label="Nuevo monto del abono"
            value={edited.amount}
            keyboardType="decimal-pad"
            editable={!blocked}
            onChangeText={(value) => setEdited({ id: entry.id, amount: value })}
          />
          <View style={[s.row, { justifyContent: 'center' }]}>
            <IconButton
              icon="check"
              label="Guardar cambios del abono"
              disabled={blocked || !edited.amount.trim()}
              onPress={() =>
                void run(async () => {
                  await onEdit(item.id, entry.id, parseAmount(edited.amount));
                  setEdited(null);
                }, 'Abono actualizado.')
              }
            />
            <IconButton
              icon="close"
              label="Cancelar edición del abono"
              disabled={blocked}
              onPress={() => {
                setEdited(null);
                clearError();
              }}
            />
          </View>
        </>
      )}
    </View>
  );
}
