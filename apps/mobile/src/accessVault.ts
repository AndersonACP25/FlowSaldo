import type {StoredAccess} from './access';
// Web never persists a bearer credential in localStorage, sessionStorage or cookies.
export async function readAccess():Promise<StoredAccess|null>{return null;}
export async function writeAccess(value:StoredAccess):Promise<void>{void value;}
export async function clearAccess():Promise<void>{}
