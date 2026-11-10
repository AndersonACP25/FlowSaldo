import * as SecureStore from 'expo-secure-store';
import type {StoredAccess} from './access';
const key='flowsaldo.personal-access.v1';
export async function readAccess():Promise<StoredAccess|null>{const raw=await SecureStore.getItemAsync(key);if(!raw)return null;const value=JSON.parse(raw);if(typeof value?.token!=='string'||typeof value?.apiUrl!=='string')throw new Error('Sesión guardada inválida.');return value;}
export async function writeAccess(value:StoredAccess){await SecureStore.setItemAsync(key,JSON.stringify(value),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}
export async function clearAccess(){await SecureStore.deleteItemAsync(key);}
