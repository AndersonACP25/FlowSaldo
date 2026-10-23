import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countLabel,pendingMailMessage,validateExportName,validateExportTable,movementExportHeaders,movementsCsv,demoMovements } from '../src/index.ts';
test('Spanish agreement covers zero, one and multiple items',()=>{
 assert.equal(countLabel(0,'movimiento','movimientos'),'0 movimientos');assert.equal(countLabel(1,'movimiento','movimientos'),'1 movimiento');assert.equal(countLabel(2,'movimiento','movimientos'),'2 movimientos');
 assert.equal(pendingMailMessage(1),'1 correo necesita tu criterio');assert.equal(pendingMailMessage(2),'2 correos necesitan tu criterio');assert.throws(()=>countLabel(-1,'x','xs'));
});
test('exports require uppercase names, uppercase headers and separate columns',()=>{
 validateExportName('FlowSaldo-2026-10.csv');assert.throws(()=>validateExportName('flowsaldo.csv'));assert.throws(()=>validateExportName('../FlowSaldo.csv'));
 validateExportTable(movementExportHeaders,[[1,2,3,4,5,6]]);assert.throws(()=>validateExportTable(['Fecha;Monto'],[['a;b']]));assert.throws(()=>validateExportTable(['Fecha','monto'],[]));assert.throws(()=>validateExportTable(['Fecha','Monto'],[['a;b']]));
 assert.equal(movementsCsv(demoMovements).split('\r\n')[0],movementExportHeaders.join(','));
});
