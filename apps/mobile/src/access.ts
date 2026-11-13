export class AccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
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
export async function accessRequest(
  path: string,
  body?: unknown,
  token?: string,
  method = body === undefined ? 'GET' : 'POST',
) {
  const base = apiBase();
  if (!base) throw new Error('La API de FlowSaldo no está configurada en esta instalación.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new AccessError(
        data?.error ?? 'No se pudo completar la solicitud de acceso.',
        response.status,
      );
    }
    return response.status === 204 ? null : await response.json();
  } finally {
    clearTimeout(timer);
  }
}
