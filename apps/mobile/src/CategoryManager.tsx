import React, { useState } from 'react';
import { View, Text } from 'react-native';
import type { Category } from '@flowsaldo/domain';
import { IconButton } from './IconButton';
import { Button, Field } from './ui';
import { styles as s } from './theme';
export function CategoryManager({
  items,
  onSave,
  onArchive,
  onDelete,
}: {
  items: Category[];
  onSave: (name: string, id?: string) => Promise<void>;
  onArchive: (id: string, archived: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string>();
  const [confirm, setConfirm] = useState<{ id: string; action: 'archive' | 'delete' }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function run(work: () => Promise<void>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la categoría.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.title}>Administrar categorías</Text>
      <Text style={s.muted}>
        Los cambios se aplican al modo actual. Renombrar conserva las etiquetas históricas. Archivar
        impide nuevas asignaciones. Puedes eliminar las categorías sin uso.
      </Text>
      <Field
        label={editing ? 'Nuevo nombre de categoría' : 'Nombre de categoría'}
        value={name}
        onChangeText={setName}
        maxLength={60}
      />
      <View style={s.row}>
        <Button
          label={editing ? 'Guardar nombre' : 'Crear categoría'}
          disabled={busy || !name.trim()}
          onPress={() =>
            void run(async () => {
              await onSave(name, editing);
              setName('');
              setEditing(undefined);
            }, 'Categoría guardada.')
          }
        />
        {editing && (
          <Button
            label="Cancelar edición de categoría"
            disabled={busy}
            onPress={() => {
              setEditing(undefined);
              setName('');
            }}
          />
        )}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {notice}
        </Text>
      )}
      {items.map((c) => (
        <View key={c.id} style={{ gap: 8 }}>
          <View style={s.between}>
            <Text style={[s.text, { flexShrink: 1 }]}>
              {c.name} · {c.archived ? 'Archivada' : 'Activa'}
            </Text>
            {!c.system && (
              <View style={s.row}>
                <Button
                  label={`Renombrar ${c.name}`}
                  text="Renombrar"
                  disabled={busy}
                  onPress={() => {
                    setEditing(c.id);
                    setName(c.name);
                  }}
                />
                <Button
                  label={`${c.archived ? 'Reactivar' : 'Archivar'} ${c.name}`}
                  text={c.archived ? 'Reactivar' : 'Archivar'}
                  disabled={busy}
                  onPress={() =>
                    c.archived
                      ? void run(() => onArchive(c.id, false), 'Categoría reactivada.')
                      : setConfirm({ id: c.id, action: 'archive' })
                  }
                />
                <IconButton
                  icon="trash"
                  label={`Eliminar ${c.name}`}
                  danger
                  disabled={busy}
                  onPress={() => setConfirm({ id: c.id, action: 'delete' })}
                />
              </View>
            )}
          </View>
          {confirm?.id === c.id && (
            <>
              <Text style={s.muted}>
                {confirm.action === 'delete'
                  ? '¿Eliminar definitivamente esta categoría? Solo se permite si está sin uso.'
                  : '¿Archivar esta categoría? Sus movimientos y presupuestos se conservarán.'}
              </Text>
              <View style={s.row}>
                <Button
                  label={
                    confirm.action === 'delete'
                      ? 'Confirmar eliminación de categoría'
                      : 'Confirmar archivo de categoría'
                  }
                  disabled={busy}
                  onPress={() =>
                    void run(
                      async () => {
                        if (confirm.action === 'delete') {
                          await onDelete(c.id);
                          if (editing === c.id) {
                            setEditing(undefined);
                            setName('');
                          }
                        } else await onArchive(c.id, true);
                        setConfirm(undefined);
                      },
                      confirm.action === 'delete' ? 'Categoría eliminada.' : 'Categoría archivada.',
                    )
                  }
                />
                <Button label="Cancelar" disabled={busy} onPress={() => setConfirm(undefined)} />
              </View>
            </>
          )}
        </View>
      ))}
    </View>
  );
}
