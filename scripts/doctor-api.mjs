import { URL } from 'node:url';

/* global AbortSignal */
const address = new URL(process.argv[2] ?? `http://127.0.0.1:${process.env.PORT || '3000'}`);

async function probe(path) {
  const url = new URL(path, address);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}${typeof data?.error === 'string' ? ` · ${data.error}` : ''}`,
      );
    }
    if (!data || typeof data !== 'object')
      throw new Error('La respuesta no contiene un objeto JSON.');
    return data;
  } catch (error) {
    console.error(`${url.origin}${path} · ${error.message}`);
    process.exitCode = 1;
    return null;
  }
}

const health = await probe('/health');
if (health) {
  if (health.status !== 'ok' || health.mode !== 'personal-development') {
    console.error('/health · La respuesta no corresponde a FlowSaldo.');
    process.exitCode = 1;
  } else {
    console.info('/health · La API de FlowSaldo está activa.');
    const auth = await probe('/auth/status');
    if (typeof auth?.configured === 'boolean') {
      console.info(
        `/auth/status · PostgreSQL respondió. Cuenta personal: ${auth.configured ? 'configurada' : 'pendiente de registro'}.`,
      );
    } else if (auth !== null) {
      console.error('/auth/status · Respuesta inesperada.');
      process.exitCode = 1;
    }
  }
}
