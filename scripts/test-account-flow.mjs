import {testAccount} from '../apps/mobile/src/testAccount.ts';

export async function loginAsTestAccount(page) {
 await page.getByLabel('Correo electrónico',{exact:true}).fill(testAccount.email);
 await page.getByLabel('Contraseña',{exact:true}).fill(testAccount.password);
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
}
