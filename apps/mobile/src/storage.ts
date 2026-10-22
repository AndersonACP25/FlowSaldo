import AsyncStorage from '@react-native-async-storage/async-storage';
import { validDate, type Movement } from '@flowsaldo/domain';
export interface LocalData { movements: Movement[]; budgets: Record<string,number> }
const key = 'flowsaldo.demo.v2';
export async function loadLocal(): Promise<LocalData | null> {
 const raw = await AsyncStorage.getItem(key);
 if (!raw) return null;
 const value = JSON.parse(raw) as LocalData;
 if (!Array.isArray(value.movements) || !value.budgets || typeof value.budgets !== 'object') throw new Error('Datos locales inválidos');
 for(const m of value.movements) if (!m || typeof m.id !== 'string' || typeof m.description !== 'string' || typeof m.category !== 'string' || typeof m.occurredAt !== 'string' || !validDate(m.occurredAt.slice(0,10)) || !Number.isInteger(m.amountMinor) || m.amountMinor<=0 || m.amountMinor>2147483647 || !['DOP','USD'].includes(m.currency) || !['INCOME','EXPENSE','TRANSFER'].includes(m.type)) throw new Error('Movimiento local inválido');
 for(const amount of Object.values(value.budgets)) if (!Number.isInteger(amount) || amount<0 || amount>2147483647) throw new Error('Presupuesto local inválido');
 return value;
}
export const saveLocal = (data: LocalData) => AsyncStorage.setItem(key, JSON.stringify(data));
