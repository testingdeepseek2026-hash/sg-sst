import { useEffect, useState } from 'react';

import { api } from '../lib/api';

export default function Empresa() {
  const [c, setC] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/companies').then(setC).catch(() => setC(null));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/companies', form);
      setMsg('Empresa guardada');
      api.get('/companies').then(setC);
    } catch (err: any) { setMsg(err.message || 'Error'); }
  };

  if (!c) return <div style={{ padding: 20 }}>Cargando configuración...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 700 }}>
      <h1 style={{ marginBottom: 16, color: '#0f766e' }}>Configuración de la Empresa</h1>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>Clase de riesgo en ARL: <b>{c.clase_riesgo}</b> → Estándares aplicables: <b>{c.estandar_set}</b> ítems (7 / 21 / 32)</p>
      <form onSubmit={handleSave} style={{ background: '#fff', padding: 18, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Razón social</label>
          <input value={form.razon_social ?? c.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>NIT</label>
          <input value={form.nit ?? c.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Dirección</label>
          <input value={form.direccion ?? c.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Teléfono</label>
          <input value={form.telefono ?? c.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Correo</label>
          <input value={form.email ?? c.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Clase de riesgo (ARL)</label>
          <select value={form.clase_riesgo ?? c.clase_riesgo} onChange={(e) => setForm({ ...form, clase_riesgo: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
            <option value="I">I - mínimo</option><option value="II">II - bajo</option><option value="III">III - medio</option><option value="IV">IV - alto</option><option value="V">V - máximo</option>
          </select>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Sector / actividad económica</label>
          <input value={form.actividad_economica ?? c.actividad_economica} onChange={(e) => setForm({ ...form, actividad_economica: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Número de trabajadores</label>
          <input value={form.numero_trabajadores ?? c.numero_trabajadores} onChange={(e) => setForm({ ...form, numero_trabajadores: Number(e.target.value) })} type="number" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Órganos SST</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><input type="checkbox" checked={!!form.tiene_vigia_sst} onChange={(e) => setForm({ ...form, tiene_vigia_sst: e.target.checked })} /> Vigía SST</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><input type="checkbox" checked={!!form.tiene_comite_convivencia} onChange={(e) => setForm({ ...form, tiene_comite_convivencia: e.target.checked })} /> Comité Convivencia</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><input type="checkbox" checked={!!form.tiene_brigada} onChange={(e) => setForm({ ...form, tiene_brigada: e.target.checked })} /> Brigada emergencias</label>
          </div>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Canal de alertas</label>
          <select value={form.canal_alertas ?? c.canal_alertas} onChange={(e) => setForm({ ...form, canal_alertas: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
            <option value="email">Correo electrónico</option><option value="whatsapp">Correo + WhatsApp</option><option value="app">Solo en la app</option>
          </select>
        </div>
        <button type="submit" style={{ gridColumn: 'span 2', padding: 10, background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Guardar configuración</button>
        {msg && <div style={{ gridColumn: 'span 2', marginTop: 8, color: '#10b981', fontSize: 13 }}>{msg}</div>}
      </form>
      <p style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>Con clase de riesgo IV o V se aplican los 32 estándares del Capítulo III (Res. 0312/2019).</p>
    </div>
  );
}
