import { backupSizeMessage, maxBackupBytes } from './localBackup';

export async function exportBackupFile(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function selectBackupFile(): Promise<{ name: string; text: string } | null> {
  const file = await new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
  if (!file) return null;
  if (file.size > maxBackupBytes) throw new Error(backupSizeMessage);
  return { name: file.name, text: await file.text() };
}
