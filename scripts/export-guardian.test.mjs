import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ExcelJS from 'exceljs';
import { checkExport,parseCsv } from './export-guardian.mjs';
test('CSV preserves quoted commas and newlines in separate columns',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'flowsaldo-export-'));
 try{const path=join(dir,'FlowSaldo.csv');await writeFile(path,'\uFEFFFecha,Descripción,Monto\r\n2026-10-22,"Compra, tienda\ncentral",1250.50');assert.equal((await checkExport(path)).columns,3);assert.equal(parseCsv(await (await import('node:fs/promises')).readFile(path,'utf8'))[1][1],'Compra, tienda\ncentral');}finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects lowercase names, malformed CSV and combined fields',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'flowsaldo-export-'));
 try{await assert.rejects(()=>checkExport(join(dir,'reporte.csv')));assert.throws(()=>parseCsv('Fecha,Monto\n"sin cerrar'));const path=join(dir,'Reporte.csv');await writeFile(path,'Fecha;Monto\na;b');await assert.rejects(()=>checkExport(path));await writeFile(path,'Fecha,Monto\na,b,c');await assert.rejects(()=>checkExport(path));}finally{await rm(dir,{recursive:true,force:true});}
});
test('Excel data must occupy independent header columns',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'flowsaldo-export-'));
 try{const good=new ExcelJS.Workbook();const table=good.addWorksheet('Movimientos');table.addRow(['Fecha','Descripción','Monto']);table.addRow(['2026-10-22','Compra',1250.5]);const path=join(dir,'Reporte.xlsx');await good.xlsx.writeFile(path);const result=await checkExport(path);assert.equal(result.sheets[0].columns,3);
 const bad=new ExcelJS.Workbook();bad.addWorksheet('Movimientos').addRow(['Fecha,Monto']);await bad.xlsx.writeFile(path);await assert.rejects(()=>checkExport(path));
 const combined=new ExcelJS.Workbook();const combinedSheet=combined.addWorksheet('Movimientos');combinedSheet.addRow(['Fecha','Descripción','Monto']);combinedSheet.addRow(['2026-10-22,Compra,1250.50']);await combined.xlsx.writeFile(path);await assert.rejects(()=>checkExport(path));
 const lower=new ExcelJS.Workbook();lower.addWorksheet('Movimientos').addRow(['Fecha','monto']);await lower.xlsx.writeFile(path);await assert.rejects(()=>checkExport(path));
 }finally{await rm(dir,{recursive:true,force:true});}
});
