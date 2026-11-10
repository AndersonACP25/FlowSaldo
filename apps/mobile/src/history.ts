import type { Currency, dailyCashFlow } from '@flowsaldo/domain';
export interface Page<T> { items:T[];total:number;nextCursor:string|null;pendingTotal?:number }
export interface MonthlySummary {
 currency:Currency;month:string;incomeMinor:number;expenseMinor:number;differenceMinor:number;total:number;
 categories:Array<{category:string;amountMinor:number}>;days:ReturnType<typeof dailyCashFlow>;
}
export function movementParams(month:string,currency:Currency,type:string,search:string) {
 return `month=${encodeURIComponent(month)}&currency=${currency}${type==='ALL'?'':`&type=${type}`}${search.trim()?`&search=${encodeURIComponent(search.trim())}`:''}`;
}
