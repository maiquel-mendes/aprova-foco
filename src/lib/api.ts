import { getFirebaseIdToken } from './firebase';

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getFirebaseIdToken();
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

  const res = await fetch(path, {
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
