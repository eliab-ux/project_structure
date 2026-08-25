const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function adminFetch<T = unknown>(token: string, path: string, init: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(init.headers ?? {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Erro ao se comunicar com o backend');
  }

  return payload as T;
}
