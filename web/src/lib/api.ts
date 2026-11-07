const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request(path: string, opts: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string,string> | undefined) ?? {} };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: 'include' });
  if (res.status === 401) throw new Error('No autenticado');
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/pdf')) return res.arrayBuffer();
  return res.json();
}

export const api = {
  get: (p: string) => request(p, { method: 'GET' }),
  post: (p: string, body?: any) => request(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (p: string, body?: any) => request(p, { method: 'PUT', body: JSON.stringify(body) }),
  del: (p: string) => request(p, { method: 'DELETE' }),
  delete: (p: string) => request(p, { method: 'DELETE' }),
  postFile: async (p: string, formData: FormData) => {
    const res = await fetch(`${API_BASE}${p}`, { method: 'POST', body: formData, credentials: 'include' });
    if (res.status === 401) throw new Error('No autenticado');
    return res.json();
  }
};
