import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const envFile = resolve(root, '.env');
const mode = process.argv[2] ?? 'web';
if (!['web', 'android', 'go'].includes(mode)) throw new Error('Modo de Expo no válido.');
if (!existsSync(envFile)) {
  console.error(
    'Falta .env en la raíz. Copia .env.example y prepara PostgreSQL con pnpm db:setup.',
  );
  process.exitCode = 1;
} else {
  const config = parseEnv(readFileSync(envFile, 'utf8'));
  const mobileFile = resolve(root, 'apps/mobile/.env');
  const mobileConfig = existsSync(mobileFile) ? parseEnv(readFileSync(mobileFile, 'utf8')) : {};
  const frontendEnv = { ...process.env };
  if (mode === 'web' && !frontendEnv.EXPO_PUBLIC_API_URL && !mobileConfig.EXPO_PUBLIC_API_URL) {
    frontendEnv.EXPO_PUBLIC_API_URL = `http://127.0.0.1:${process.env.PORT ?? config.PORT ?? '3000'}`;
  }
  const children = [];
  let stopping = false;
  function stop(code) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) {
      if (!child.pid) continue;
      if (process.platform === 'win32') {
        if (child.exitCode === null)
          spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).on(
            'error',
            () => child.kill(),
          );
      } else {
        const pid = child.pid;
        try {
          process.kill(-pid, 'SIGTERM');
        } catch {
          /* Process group already ended. */
        }
        const deadline = setTimeout(() => {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {
            /* Process group already ended. */
          }
        }, 5000);
        deadline.unref();
      }
    }
  }
  function start(name, args, env = process.env) {
    console.info(`Iniciando ${name}…`);
    const child = spawn(process.execPath, args, {
      cwd: root,
      env,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
    });
    children.push(child);
    child.once('error', (error) => {
      console.error(`${name}: ${error.message}`);
      stop(1);
    });
    child.once('exit', (code) => {
      if (!stopping) {
        console.error(`${name} se detuvo.`);
        stop(code || 1);
      }
    });
  }
  process.on('SIGINT', () => stop(0));
  process.on('SIGTERM', () => stop(0));
  start('API', ['--watch', '--import', 'tsx', '--env-file=.env', 'apps/api/src/index.ts']);
  start('worker', ['--watch', '--import', 'tsx', '--env-file=.env', 'apps/worker/src/index.ts']);
  start('Expo', ['scripts/expo.mjs', mode, ...process.argv.slice(3)], frontendEnv);
}
