import { Platform } from 'react-native';
import { shareCsvFile } from './shareCsv';
import {
  movementsCsv,
  movementExportHeaders,
  validateExportName,
  validateExportTable,
  type Movement,
} from '@flowsaldo/domain';
export async function exportCsv(rows: Movement[], month: string) {
  const name = `FlowSaldo-${month}.csv`;
  validateExportName(name);
  validateExportTable(
    movementExportHeaders,
    rows.map((m) => [m.occurredAt, m.type, m.currency, m.amountMinor, m.description, m.category]),
  );
  await exportCsvText(movementsCsv(rows), name);
}
export async function exportCsvText(csv: string, name: string) {
  validateExportName(name);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + csv.replace(/^\uFEFF/, '')], { type: 'text/csv;charset=utf-8;' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    await shareCsvFile(csv, name);
  }
}
