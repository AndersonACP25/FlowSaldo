export function parseSignedAmount(value:string,maxMinor=2147483647):number {
 const match=/^(-?)([0-9]+)(?:[.,]([0-9]{1,2}))?$/.exec(value.trim());
 if(!match)throw new Error('Usa un monto sin separadores de miles; ejemplo: -1250.50');
 const magnitude=BigInt(match[2])*100n+BigInt((match[3]??'').padEnd(2,'0'));
 if(magnitude>BigInt(maxMinor))throw new Error('Monto fuera de rango.');
 return Number(magnitude)*(match[1]&&magnitude!==0n?-1:1);
}
export function ledgerBalance(opening:number,income:number,outgoing:number,incomingTransfers:number):number {
 for(const n of [opening,income,outgoing,incomingTransfers])if(!Number.isSafeInteger(n))throw new Error('Saldo fuera de rango.');
 const n=BigInt(opening)+BigInt(income)-BigInt(outgoing)+BigInt(incomingTransfers);
 const result=Number(n);if(!Number.isSafeInteger(result))throw new Error('Saldo fuera de rango.');return result;
}
