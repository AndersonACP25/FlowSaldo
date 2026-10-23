import type { Movement } from '@flowsaldo/domain';
export interface ReviewItem { id:string; externalId:string; reason:string|null; status:'REVIEW'|'PARSED'|'DISMISSED'|'PENDING'; body?:string; suggestion?:Movement }
export function demoReviews():ReviewItem[] {
 const date=new Date().toISOString().slice(0,10)+'T12:00:00.000Z';
 return [
  {id:'review-1',externalId:'demo-transferencia',status:'REVIEW',reason:'Confirma si es un traslado entre tus cuentas o un ingreso. La demo no lo clasificará por ti.',body:'CORREO SINTÉTICO: se recibió DOP 3500.00. Referencia: traslado de ejemplo.',suggestion:{id:'suggestion-1',description:'Transferencia por revisar',amountMinor:350000,currency:'DOP',type:'TRANSFER',occurredAt:date,category:'Transferencias'}},
  {id:'review-2',externalId:'demo-suscripcion',status:'REVIEW',reason:'El comercio no tiene categoría confirmada. Revisa los datos antes de registrarlo.',body:'CORREO SINTÉTICO: compra USD 24.99. Comercio: Servicio de ejemplo.',suggestion:{id:'suggestion-2',description:'Servicio de ejemplo',amountMinor:2499,currency:'USD',type:'EXPENSE',occurredAt:date,category:'Servicios'}},
  {id:'review-3',externalId:'demo-formato-desconocido',status:'REVIEW',reason:'Formato desconocido. Introduce manualmente monto, moneda y fecha; ningún valor será inferido.',body:'CORREO SINTÉTICO: aviso bancario sin datos suficientes para contabilizar.'}
 ];
}
