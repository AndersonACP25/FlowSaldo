import { Platform, Share } from 'react-native';
import { movementsCsv, type Movement } from '@flowsaldo/domain';
export async function exportCsv(rows: Movement[], month: string) {
 const csv = movementsCsv(rows);
 if (Platform.OS === 'web') {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'}));
  const link = document.createElement('a'); link.href=url; link.download=`flowsaldo-${month}.csv`; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 } else { await Share.share({ title:'FlowSaldo CSV', message:csv }); }
}
