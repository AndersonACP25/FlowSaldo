// These public credentials open the isolated offline demo, never an API session.
export const testAccount = {
 email: 'prueba@flowsaldo.test',
 password: 'FlowSaldo-Prueba-2026',
} as const;

export function isTestAccount(email: string, password: string) {
 return email.trim().toLowerCase() === testAccount.email && password === testAccount.password;
}
