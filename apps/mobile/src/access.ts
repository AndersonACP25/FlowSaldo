import { createApiClient } from './apiClient';

export interface Owner {
  id: number;
  name: string;
  email: string;
}
export interface PersonalSession {
  token: string;
  owner: Owner;
  expiresAt: string;
  sessionId: string;
}
export interface StoredAccess {
  apiUrl: string;
  token: string;
}
export function apiBase() {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return '';
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  const octets = host.split('.').map(Number);
  const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && octets.every((n) => n >= 0 && n <= 255);
  const local =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    (ipv4 &&
      (octets[0] === 10 ||
        (octets[0] === 192 && octets[1] === 168) ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)));
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['http:', 'https:'].includes(url.protocol) ||
    (url.protocol === 'http:' && !local)
  )
    throw new Error('Configura una URL HTTPS, o una dirección local de desarrollo.');
  return url.toString().replace(/\/$/, '');
}
export function accessRequest<T = unknown>(
  path: string,
  body?: unknown,
  token?: string,
  method = body === undefined ? 'GET' : 'POST',
) {
  return createApiClient({
    baseUrl: apiBase(),
    token,
    fallbackMessage: 'No se pudo completar la solicitud de acceso.',
  }).json<T>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
