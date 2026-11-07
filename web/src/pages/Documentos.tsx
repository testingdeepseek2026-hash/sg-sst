import { useEffect, useState } from 'react';

import { api } from '../lib/api';

export default function Documentos() {
  const [docs, setDocs] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ version: '1.0', retencion_anos: 5, estado: 'vigente' });
  useEffect(() => { api.get('/documents').then(setDocs); }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/documents', form); setForm({ version: '1.0', retencion_anos: 5, estado: 'vigente' }); api.get('/documents').then(setDocs); } catch (err: any) { alert(err.message || 'Error'); }
  };
  return (
    <div style={{ padding: 20, maxWidth: 950 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>Gestión Documental y Retención Legal</h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>Registros médicos y de exposición: hasta 20 años. Control de versiones y listado maestro.</p>
      <form onSubmit={save} style={{ background: '#fff', padding: 14, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Código" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del documento" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="Tipo (formato/procedimiento)" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} placeholder="Responsable" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.retencion_anos} onChange={(e) => setForm({ ...form, retencion_anos: Number(e.target.value) })} type="number" placeholder="Años retención" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <button type="submit" style={{ padding: '8px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Registrar documento</button>
      </form>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <thead><tr style={{ background: '#f3f4f6', textAlign: 'left' }}><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Código</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Nombre</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Versión</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Retención (años)</th></tr></thead>
        <tbody>
          {docs.map((x) => (
            <tr key={x.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{x.codigo}</td>
              <td style={{ padding: 10 }}>{x.nombre}</td>
              <td style={{ padding: 10 }}>{x.version}</td>
              <td style={{ padding: 10 }}>{x.estado}</td>
              <td style={{ padding: 10 }}>{x.retencion_anos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

