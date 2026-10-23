import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateExportName, validateExportTable } from '../packages/domain/src/index.ts';
export function parseCsv(source){
 const rows=[];let row=[],field='',quoted=false,closed=false;
 const push=()=>{row.push(field);field='';closed=false;};
 const line=()=>{push();if(row.some(v=>v!==''))rows.push(row);row=[];};
 source=source.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quoted){if(c==='"'){if(source[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c===','){push();continue;}
  if(c==='\r'||c==='\n'){line();if(c==='\r'&&source[i+1]==='\n')i++;continue;}
  if(closed)throw new Error('Contenido después de una celda entre comillas');
  if(c==='"'){if(field)throw new Error('Comillas CSV inválidas');quoted=true;}else field+=c;
 }
 if(quoted)throw new Error('Celda CSV sin cerrar');
 if(field!==''||row.length||closed)line();
 return rows;
}
export async function checkExport(path){
 validateExportName(basename(path));const extension=extname(path).toLowerCase();
 if(extension==='.csv'){
  const [headers,...rows]=parseCsv(await readFile(path,'utf8'));
  validateExportTable(headers??[],rows);return {file:basename(path),columns:headers.length,rows:rows.length};
 }
 if(extension==='.xlsx'){
  const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(path);
  if(!workbook.worksheets.length)throw new Error('El Excel no contiene hojas');
  const sheets=[];
  for(const sheet of workbook.worksheets){
   if(sheet.model.merges?.length)throw new Error('El Excel tabular no debe contener celdas combinadas');
   const width=sheet.getRow(1).cellCount;const headers=Array.from({length:width},(_,i)=>sheet.getRow(1).getCell(i+1).text);const rows=[];
   sheet.eachRow((row,index)=>{if(index>1){if(row.cellCount>width)throw new Error('Hay datos fuera de las columnas declaradas');rows.push(Array.from({length:width},(_,i)=>row.getCell(i+1).value));}});
   validateExportTable(headers,rows);sheets.push({sheet:sheet.name,columns:width,rows:rows.length});
  }
  return {file:basename(path),sheets};
 }
 if(extension==='.xls')throw new Error('El guardián admite Excel .xlsx. Convierte .xls antes de validarlo.');
 await readFile(path);return {file:basename(path),nameValid:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const files=process.argv.slice(2).filter(p=>p!=='--');if(!files.length)throw new Error('Indica archivos: pnpm exports:check FlowSaldo.csv Reporte.xlsx');for(const file of files)console.log(JSON.stringify(await checkExport(file)));}
 catch(error){console.error(error instanceof Error?error.message:'Exportación inválida');process.exitCode=1;}
}
