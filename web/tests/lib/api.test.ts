import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../../src/lib/api.ts';

describe('API Client (lib/api)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debe hacer GET request', async () => {
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: 'test' }),
    });

    const result = await api.get('/test');

    expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'GET',
      credentials: 'include',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
    expect(result).toEqual({ data: 'test' });
  });

  it('debe hacer POST request con body', async () => {
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ id: 'new-id', name: 'Test' }),
    });

    const result = await api.post('/test', { name: 'Test' });

    expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
      credentials: 'include',
    }));
    expect(result).toEqual({ id: 'new-id', name: 'Test' });
  });

  it('debe hacer PUT request', async () => {
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ id: '1', name: 'Updated' }),
    });

    const result = await api.put('/test/1', { name: 'Updated' });

    expect(global.fetch).toHaveBeenCalledWith('/api/test/1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    }));
    expect(result).toEqual({ id: '1', name: 'Updated' });
  });

  it('debe hacer DELETE request', async () => {
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await api.del('/test/1');

    expect(global.fetch).toHaveBeenCalledWith('/api/test/1', expect.objectContaining({
      method: 'DELETE',
    }));
    expect(result).toBeNull();
  });

  it('debe manejar 401 - no autenticado', async () => {
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(api.get('/test')).rejects.toThrow('No autenticado');
  });

  it('debe manejar respuesta PDF', async () => {
    const pdfBuffer = new ArrayBuffer(100);
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/pdf' },
      arrayBuffer: () => Promise.resolve(pdfBuffer),
    });

    const result = await api.get('/report/pdf');

    expect(result).toBe(pdfBuffer);
  });

  it('debe usar API_BASE de variable de entorno', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.example.com/v1');
    
    // Re-import para que tome la nueva variable
    vi.resetModules();
    const { api: apiWithEnv } = await import('../../src/lib/api.ts');
    
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({}),
    });

    await apiWithEnv.get('/test');

    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/v1/test', expect.any(Object));
  });

  it('debe hacer postFile con FormData', async () => {
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ fileId: 'f1' }),
    });

    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.pdf');

    const result = await api.postFile('/upload', formData);

    expect(global.fetch).toHaveBeenCalledWith('/api/upload', expect.objectContaining({
      method: 'POST',
      body: formData,
      // No Content-Type header para FormData (browser lo setea con boundary)
    }));
    expect(result).toEqual({ fileId: 'f1' });
  });

  it('debe incluir credentials include en todas las requests', async () => {
    (global.fetch as vi.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({}),
    });

    await api.get('/test');
    await api.post('/test', {});
    await api.put('/test', {});
    await api.del('/test');

    const calls = (global.fetch as vi.Mock).mock.calls;
    for (const call of calls) {
      expect(call[1]?.credentials).toBe('include');
    }
  });
});