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
    ...((opts.headers as Record<string, string> | undefined) ?? {}),
  };
  // Solo declarar content-type JSON cuando se envía cuerpo: Fastify responde 400
  // a un DELETE/GET con content-type application/json y cuerpo vacío.
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const responseType = (opts as any).responseType;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: 'include' });

  if (responseType === 'blob') {
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.blob();
  }
  if (responseType === 'arrayBuffer') {
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res.arrayBuffer();
  }

  return handleResponse(res);
}

export const api = {
  get: (path: string, opts?: { responseType?: 'blob' | 'arrayBuffer' }) =>
    request(path, { method: 'GET', ...(opts ? { responseType: opts.responseType } : {}) }),
  post: (path: string, body?: any) =>
    request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: any) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path: string) => request(path, { method: 'DELETE' }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
  postFile: async (path: string, formData: FormData) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    return handleResponse(res);
  },
} as const;
