import type { Comparison } from './MonthlyComparison';
import type { Currency, dailyCashFlow } from '@flowsaldo/domain';
export interface Page<T> { items:T[];total:number;nextCursor:string|null;pendingTotal?:number }
export interface MonthlySummary {
 comparison:Comparison;
 currency:Currency;month:string;incomeMinor:number;expenseMinor:number;differenceMinor:number;total:number;
 categoryTotals:Array<{categoryId:string|null;amountMinor:number}>;
 categories:Array<{category:string;amountMinor:number}>;days:ReturnType<typeof dailyCashFlow>;
}
export function movementParams(month:string,currency:Currency,type:string,search:string,categoryId:string) {
 return `${categoryId?`categoryId=${encodeURIComponent(categoryId)}&`:''}month=${encodeURIComponent(month)}&currency=${currency}${type==='ALL'?'':`&type=${type}`}${search.trim()?`&search=${encodeURIComponent(search.trim())}`:''}`;
}
