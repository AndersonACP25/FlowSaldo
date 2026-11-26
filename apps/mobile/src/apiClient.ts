export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type ApiRequest = <T = unknown>(path: string, options?: RequestInit) => Promise<T>;

export function createApiClient({
  baseUrl,
  token,
  onUnauthorized,
  fallbackMessage = 'No se pudo conectar con la API.',
  timeoutMs = 10_000,
}: {
  baseUrl: string;
  token?: string;
  onUnauthorized?: () => Promise<void>;
  fallbackMessage?: string;
  timeoutMs?: number;
}) {
  async function request<T>(
    path: string,
    format: 'json' | 'text',
    read: (response: Response) => Promise<T>,
    options: RequestInit = {},
  ): Promise<T> {
    if (!baseUrl) throw new Error('La API de FlowSaldo no está configurada en esta instalación.');
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Ruta de API inválida.');

    const { signal, ...init } = options;
    const headers = new Headers(init.headers);
    if (format === 'json' && !headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel);
    let timedOut = false;
    const timer = setTimeout(
      () => {
        timedOut = true;
        cancel();
      },
      format === 'text' ? Math.max(timeoutMs, 30_000) : timeoutMs,
    );

    try {
      const response = await fetch(baseUrl + path, { ...init, headers, signal: controller.signal });
      if (response.status === 401 && onUnauthorized) {
        await onUnauthorized();
        throw new ApiError('La sesión ya no está disponible.', 401);
      }
      if (!response.ok) {
        const data: { error?: unknown } | null = await response.json().catch((error) => {
          if (controller.signal.aborted) throw error;
          return null;
        });
        throw new ApiError(
          typeof data?.error === 'string' ? data.error : fallbackMessage,
          response.status,
        );
      }
      return await read(response);
    } catch (error) {
      if (timedOut && !(error instanceof ApiError))
        throw new Error('La API tardó demasiado en responder. Intenta de nuevo.');
      if (error instanceof SyntaxError) throw new Error('La API devolvió una respuesta inválida.');
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  const json: ApiRequest = <T>(path: string, options?: RequestInit) =>
    request<T>(
      path,
      'json',
      async (response) => (response.status === 204 ? null : await response.json()) as T,
      options,
    );
  return {
    json,
    text: (path: string, options?: RequestInit) =>
      request(path, 'text', (response) => response.text(), options),
  };
}
