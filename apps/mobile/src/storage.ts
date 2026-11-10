import { demoReviews, type ReviewItem } from './reviews';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { upgradeCategories,validDate, type RecurringReceipt,type RecurringTemplate,type Category,type Movement } from '@flowsaldo/domain';
export interface LocalData { movements: Movement[]; budgets: Record<string,number>; reviews:ReviewItem[];categories:Category[];categoryBudgets:Record<string,number>;recurring:RecurringTemplate[];receipts:RecurringReceipt[] }
const key = 'flowsaldo.demo.v2';
export async function loadLocal(): Promise<LocalData | null> {
 const raw = await AsyncStorage.getItem(key);
 if (!raw) return null;
 const value = JSON.parse(raw) as LocalData;
 if (!Array.isArray(value.movements) || !value.budgets || typeof value.budgets !== 'object') throw new Error('Datos locales inválidos');
 for(const m of value.movements) if (!m || typeof m.id !== 'string' || typeof m.description !== 'string' || typeof m.category !== 'string' || typeof m.occurredAt !== 'string' || !validDate(m.occurredAt.slice(0,10)) || !Number.isInteger(m.amountMinor) || m.amountMinor<=0 || m.amountMinor>2147483647 || !['DOP','USD'].includes(m.currency) || !['INCOME','EXPENSE','TRANSFER'].includes(m.type)) throw new Error('Movimiento local inválido');
 for(const amount of Object.values(value.budgets)) if (!Number.isInteger(amount) || amount<0 || amount>2147483647) throw new Error('Presupuesto local inválido');
 if(value.reviews===undefined) value.reviews=demoReviews();
 if(!Array.isArray(value.reviews) || value.reviews.some(item=>!item || typeof item.id!=='string' || typeof item.externalId!=='string' || !['REVIEW','PARSED','DISMISSED','PENDING','PROCESSING','FAILED'].includes(item.status))) throw new Error('Revisiones locales inválidas');
 const upgraded=upgradeCategories(value.movements,value.categories);
 value.categories=upgraded.categories;value.movements=upgraded.movements;
 if(value.categoryBudgets===undefined)value.categoryBudgets={};
 if(!value.categoryBudgets||typeof value.categoryBudgets!=='object'||Array.isArray(value.categoryBudgets)||Object.values(value.categoryBudgets).some(n=>!Number.isInteger(n)||n<=0||n>2147483647))throw new Error('Presupuestos por categoría inválidos');
 if(value.recurring===undefined)value.recurring=[];if(value.receipts===undefined)value.receipts=[];
 if(!Array.isArray(value.recurring)||value.recurring.some(t=>!t||typeof t.id!=='string'||!t.id||!Number.isInteger(t.version)||t.version<0||typeof t.description!=='string'||!t.description.trim()||!Number.isInteger(t.amountMinor)||t.amountMinor<=0||t.amountMinor>2147483647||!['DOP','USD'].includes(t.currency)||!['INCOME','EXPENSE','TRANSFER'].includes(t.type)||!validDate(t.startDate)||!validDate(t.nextDate)||t.nextDate<t.startDate||!Number.isInteger(t.anchorDay)||t.anchorDay<1||t.anchorDay>31||typeof t.active!=='boolean'||!value.categories.some(c=>c.id===t.categoryId))||new Set(value.recurring.map(t=>t.id)).size!==value.recurring.length)throw new Error('Plantillas locales inválidas');
 if(!Array.isArray(value.receipts)||value.receipts.some(r=>!r||!value.recurring.some(t=>t.id===r.templateId)||!validDate(r.scheduledFor)||(r.movementId!==null&&typeof r.movementId!=='string'))||new Set(value.receipts.map(r=>JSON.stringify([r.templateId,r.scheduledFor]))).size!==value.receipts.length)throw new Error('Confirmaciones locales inválidas');
 value.reviews=value.reviews.map(r=>r.status==='PARSED'&&!r.movement?{...r,movement:value.movements.some(m=>m.id===`reviewed-${r.id}`)?{id:`reviewed-${r.id}`}:null}:r);
 return value;
}
export const saveLocal = (data: LocalData) => AsyncStorage.setItem(key, JSON.stringify(data));
