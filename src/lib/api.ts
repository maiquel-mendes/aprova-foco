import { getAuthProvider } from '../repositories';

function resolveApiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!base) return path;
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthProvider().getAccessToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(resolveApiUrl(path), {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(
      errPayload?.error || `Falha na requisição (${res.status}).`
    );
  }

  return res.json() as Promise<T>;
}
