import { useEffect, useState } from 'react';

import { api } from '../lib/api';

export default function Roles() {
  const [roles, setRoles] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  useEffect(() => { api.get('/roles').then(setRoles); }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/roles', form); setForm({}); api.get('/roles').then(setRoles); } catch (err: any) { alert(err.message || 'Error'); }
  };
  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>Roles y Responsabilidades SST</h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>Responsable SG-SST (licencia + curso 50 h), Vigía SST, Comité de Convivencia.</p>
      <form onSubmit={save} style={{ background: '#fff', padding: 14, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del rol" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.licencia_sst_numero} onChange={(e) => setForm({ ...form, licencia_sst_numero: e.target.value })} placeholder="Nro. licencia SST" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.licencia_sst_vence} onChange={(e) => setForm({ ...form, licencia_sst_vence: e.target.value })} type="date" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.curso_50h_vence} onChange={(e) => setForm({ ...form, curso_50h_vence: e.target.value })} type="date" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={!!form.curso_50h} onChange={(e) => setForm({ ...form, curso_50h: e.target.checked })} /> Curso 50 h</label>
        <button type="submit" style={{ padding: '8px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Guardar rol</button>
      </form>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <thead><tr style={{ background: '#f3f4f6', textAlign: 'left' }}><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Rol</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Licencia SST vence</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Curso 50 h vence</th></tr></thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{r.nombre}</td>
              <td style={{ padding: 10 }}>{r.licencia_sst_vence ?? '-'}</td>
              <td style={{ padding: 10 }}>{r.curso_50h_vence ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

