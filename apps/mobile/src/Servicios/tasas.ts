import {validDate} from '@flowsaldo/domain';

export const rateCurrencies=['USD','EUR'] as const;
export type RateCurrency=(typeof rateCurrencies)[number];
export interface ExchangeRate {
 base:RateCurrency;
 quote:'DOP';
 date:string;
 rate:number;
}

export async function fetchRates(date?:string, signal?:AbortSignal):Promise<ExchangeRate[]> {
 if(date!==undefined&&!validDate(date))throw new Error('Fecha de consulta inválida.');
 const controller=new AbortController();
 const cancel=()=>controller.abort();
 if(signal?.aborted)cancel();
 else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(cancel,8000);
 try{
  return await Promise.all(rateCurrencies.map(async base=>{
   const query=date?`?date=${date}`:'';
   const response=await fetch(`https://api.frankfurter.dev/v2/rate/${base}/DOP${query}`,{signal:controller.signal});
   if(!response.ok)throw new Error('Frankfurter no devolvió una tasa para este período.');
   const row:Partial<ExchangeRate>|null=await response.json();
   if(!row||row.base!==base||row.quote!=='DOP'||typeof row.date!=='string'||!validDate(row.date)
    ||typeof row.rate!=='number'||!Number.isFinite(row.rate)||row.rate<=0||!!date&&row.date>date){
    throw new Error('Frankfurter devolvió una tasa inválida.');
   }
   return {base,quote:'DOP' as const,date:row.date,rate:row.rate};
  }));
 }finally{
  clearTimeout(timer);
  signal?.removeEventListener('abort',cancel);
  controller.abort();
 }
}
