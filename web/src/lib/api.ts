const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function handleResponse(res: Response): Promise<any> {
  if (res.status === 401) throw new Error('No autenticado');
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') ?? '';
  const body = ct.includes('application/pdf') ? await res.arrayBuffer() : await res.json();
  if (!res.ok) {
    const message =
      typeof body?.error === 'string'
        ? body.error
        : typeof body?.message === 'string'
          ? body.message
          : `Error en la solicitud (${res.status})`;
    throw new Error(message);
  }
  return body;
}

async function request(path: string, opts: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string> | undefined) ?? {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: 'include' });
  return handleResponse(res);
}

export const api = {
  get: (p: string) => request(p, { method: 'GET' }),
  post: (p: string, body?: any) =>
    request(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (p: string, body?: any) => request(p, { method: 'PUT', body: JSON.stringify(body) }),
  del: (p: string) => request(p, { method: 'DELETE' }),
  delete: (p: string) => request(p, { method: 'DELETE' }),
  postFile: async (p: string, formData: FormData) => {
    const res = await fetch(`${API_BASE}${p}`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    return handleResponse(res);
  },
};
