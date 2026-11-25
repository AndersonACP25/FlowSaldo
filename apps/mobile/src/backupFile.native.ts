import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { backupSizeMessage, maxBackupBytes } from './localBackup';

export async function exportBackupFile(text: string, name: string) {
  if (!(await isAvailableAsync()))
    throw new Error('Compartir archivos no está disponible en este dispositivo.');
  const directory = new Directory(
    Paths.cache,
    `flowsaldo-backup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  directory.create();
  const file = new File(directory, name);
  file.create();
  file.write(text);
  await shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Exportar respaldo',
  });
}

export async function selectBackupFile(): Promise<{ name: string; text: string } | null> {
  const result = await getDocumentAsync({ copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > maxBackupBytes) throw new Error(backupSizeMessage);
    return { name: asset.name, text: await file.text() };
  } finally {
    try {
      file.delete();
    } catch {
      // The OS can still reclaim the temporary copy.
    }
  }
}
