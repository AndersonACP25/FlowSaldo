import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Currency } from '@flowsaldo/domain';
export interface Preferences { currency:Currency; hideAmounts:boolean }
export const defaultPreferences:Preferences={currency:'DOP',hideAmounts:false};
const key='flowsaldo.preferences.v1';
export async function loadPreferences():Promise<Preferences>{
 const raw=await AsyncStorage.getItem(key);if(!raw)return defaultPreferences;
 const parsed=JSON.parse(raw) as Preferences;
 if(!['DOP','USD'].includes(parsed.currency)||typeof parsed.hideAmounts!=='boolean')throw new Error('Preferencias locales inválidas');
 return {currency:parsed.currency,hideAmounts:parsed.hideAmounts};
}
export const savePreferences=(value:Preferences)=>AsyncStorage.setItem(key,JSON.stringify(value));
