import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, URL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const env = {
  ...process.env,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000',
};
async function run(args, cwd) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`La comprobación terminó con código ${code}`);
}
await run(
  [
    fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url)),
    'export',
    '--platform',
    'web',
    '--output-dir',
    '../../dist/web',
  ],
  fileURLToPath(new URL('../apps/mobile/', import.meta.url)),
);
await run(['scripts/web-smoke.mjs'], root);
