import { Directory,File,Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
// Retain the attachment in OS-managed cache so the receiving app can still read it.
export async function shareCsvFile(csv:string,name:string) {
 if(!await Sharing.isAvailableAsync())throw new Error('Compartir archivos no está disponible en este dispositivo.');
 const directory=new Directory(Paths.cache,`flowsaldo-${Date.now()}-${Math.random().toString(36).slice(2)}`);
 const file=new File(directory,name);
 directory.create({intermediates:true});
 file.create();
 file.write('\uFEFF'+csv.replace(/^\uFEFF/,''));
 await Sharing.shareAsync(file.uri,{mimeType:'text/csv',dialogTitle:'Exportar movimientos',UTI:'public.comma-separated-values-text'});
}
