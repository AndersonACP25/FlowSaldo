import {parseAmount} from './index.ts';
export function parseSignedAmount(value:string):number {
 const text=value.trim();if(/^[-+]?0([.,]0{1,2})?$/.test(text))return 0;
 return text.startsWith('-')?-parseAmount(text.slice(1)):parseAmount(text);
}
export function ledgerBalance(opening:number,income:number,outgoing:number,incomingTransfers:number):number {
 for(const n of [opening,income,outgoing,incomingTransfers])if(!Number.isSafeInteger(n))throw new Error('Saldo fuera de rango.');
 const n=BigInt(opening)+BigInt(income)-BigInt(outgoing)+BigInt(incomingTransfers);
 const result=Number(n);if(!Number.isSafeInteger(result))throw new Error('Saldo fuera de rango.');return result;
}
