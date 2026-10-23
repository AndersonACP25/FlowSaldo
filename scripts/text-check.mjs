import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve('apps/mobile');
const rules=[[/\b1 movimientos\b/u,'1 movimiento'],[/\b1 correos\b/u,'1 correo'],[/\bIniciar sesion\b/u,'Iniciar sesión'],[/\bConfiguracion\b/u,'Configuración'],[/\bContrasena\b/u,'Contraseña'],[/\bInformacion\b/u,'Información'],[/\bDescripcion\b/u,'Descripción'],[/\bCategoria\b/u,'Categoría']];
const findings=[];
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(['node_modules','.expo','android','ios'].includes(entry.name))continue;const path=resolve(dir,entry.name);if(entry.isDirectory())await scan(path);else if(/\.(tsx|ts)$/.test(path)){const source=await readFile(path,'utf8');for(const [pattern,suggestion] of rules)if(pattern.test(source))findings.push(`${path}: revisar «${suggestion}»`);}}}
await scan(root);if(findings.length){console.error(findings.join('\n'));process.exitCode=1;}else console.log('Reglas lingüísticas conocidas aprobadas. La revisión integral corresponde al agente lingüístico.');
