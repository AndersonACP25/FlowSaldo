import React, { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { countLabel } from '@flowsaldo/domain';
import { exportBackupFile, selectBackupFile } from './backupFile';
import { createLocalBackup, readLocalBackup } from './localBackup';
import type { LocalData } from './storage';
import { useTheme } from './theme';
import { Button, Choice } from './ui';

export function BackupSettings({
  local,
  busy,
  onRestore,
}: {
  local: LocalData;
  busy: boolean;
  onRestore: (backup: LocalData, expected: LocalData) => Promise<void>;
}) {
  const { styles: s } = useTheme();
  const [preview, setPreview] = useState<
    (ReturnType<typeof readLocalBackup> & { name: string; expected: LocalData }) | null
  >(null);
  const [working, setWorking] = useState(false);
  const inProgress = useRef(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const disabled = busy || working;

  async function run(task: () => Promise<void>) {
    if (busy || inProgress.current) return;
    inProgress.current = true;
    setWorking(true);
    setStatus('');
    setError('');
    try {
      await task();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo completar la operación.');
    } finally {
      inProgress.current = false;
      setWorking(false);
    }
  }

  return (
    <>
      <View style={s.card}>
        <Text style={s.muted}>
          Copia del modo local. El archivo JSON contiene datos financieros sin cifrar.
        </Text>
        <Button
          label="Exportar respaldo"
          disabled={disabled}
          onPress={() =>
            void run(async () => {
              const { name, text } = createLocalBackup(local);
              await exportBackupFile(text, name);
              if (Platform.OS === 'web') setStatus('Descarga del respaldo iniciada.');
            })
          }
        />
        <Choice
          label="Seleccionar respaldo"
          selected={false}
          disabled={disabled}
          onPress={() =>
            void run(async () => {
              setPreview(null);
              const file = await selectBackupFile();
              if (file)
                setPreview({ name: file.name, expected: local, ...readLocalBackup(file.text) });
            })
          }
        />
      </View>
      {preview && (
        <View style={s.card}>
          <Text style={s.title}>Confirmar restauración</Text>
          <Text style={s.text}>{preview.name}</Text>
          <Text style={s.muted}>{new Date(preview.createdAt).toLocaleString('es-DO')}</Text>
          <Text style={s.text}>
            {[
              countLabel(preview.data.movements.length, 'movimiento', 'movimientos'),
              countLabel(
                preview.data.movements.filter((movement) => movement.refundOfId).length,
                'devolución',
                'devoluciones',
              ),
              countLabel(preview.data.categories.length, 'categoría', 'categorías'),
              countLabel(preview.data.accounts.length, 'cuenta', 'cuentas'),
            ].join(' · ')}
          </Text>
          <Text style={s.muted}>Esta acción reemplaza los datos locales actuales.</Text>
          <Button
            label="Restaurar y reemplazar datos"
            disabled={disabled}
            onPress={() =>
              void run(async () => {
                await onRestore(preview.data, preview.expected);
                setPreview(null);
                setStatus('Respaldo restaurado.');
              })
            }
          />
          <Choice
            label="Cancelar"
            selected={false}
            disabled={disabled}
            onPress={() => {
              setPreview(null);
              setError('');
            }}
          />
        </View>
      )}
      {!!status && (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {status}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </>
  );
}
