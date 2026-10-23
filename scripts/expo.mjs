import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobile=resolve(root,'apps/mobile');
const require=createRequire(resolve(mobile,'package.json'));
const mode=process.argv[2]??'go';
if(!['web','go','android'].includes(mode)) throw new Error('Modo desconocido');
try { for(const name of ['expo/package.json', ...(mode==='web'?['react-dom/package.json','react-native-web/package.json','@expo/metro-runtime/package.json']:[])]) require.resolve(name); }
catch { console.error('Faltan dependencias. Ejecuta pnpm install --frozen-lockfile desde la raíz de FlowSaldo.'); process.exit(1); }
const cli=resolve(dirname(require.resolve('expo/package.json')),'bin/cli');
const args=['start',...(mode==='web'?['--web']:['--go',...(mode==='android'?['--android']:[])]),'--clear',...process.argv.slice(3)];
const child=spawn(process.execPath,[cli,...args],{cwd:mobile,stdio:'inherit',env:process.env});
process.on('SIGTERM',()=>child.kill('SIGTERM'));
process.on('SIGINT',()=>child.kill('SIGINT'));
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
