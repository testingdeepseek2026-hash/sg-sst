import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Usuarios() {
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ rol: 'trabajador' });
  useEffect(() => { api.get('/users').then(setUsers); }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/users/register', form); setForm({ rol: 'trabajador' }); api.get('/users').then(setUsers); } catch (err: any) { alert(err.message || 'Error'); }
  };
  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>Usuarios del Sistema</h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>Roles: administrador (responsable SST) y trabajador (consulta, firma, reporta).</p>
      <form onSubmit={save} style={{ background: '#fff', padding: 14, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" placeholder="Contraseña" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}><option>administrador</option><option>trabajador</option></select>
        <button type="submit" style={{ padding: '8px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Registrar usuario</button>
      </form>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <thead><tr style={{ background: '#f3f4f6', textAlign: 'left' }}><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Correo</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Nombre</th><th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Rol</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{u.email}</td>
              <td style={{ padding: 10 }}>{u.nombre}</td>
              <td style={{ padding: 10 }}>{u.rol}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

