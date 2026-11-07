import { useEffect, useState } from 'react';

import { api } from '../lib/api';

export default function Planes() {
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ anio: new Date().getFullYear() });

  useEffect(() => { api.get('/plans/annual').then(setPlans); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/plans/annual', form);
      setForm({ anio: new Date().getFullYear() });
      api.get('/plans/annual').then(setPlans);
    } catch (err: any) { alert(err.message || 'Error'); }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>Plan Anual de Trabajo y Cronograma de Capacitación</h1>
      <form onSubmit={save} style={{ background: '#fff', padding: 14, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        <input value={form.anio} onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })} type="number" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="Objetivo" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
        <input value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} placeholder="Meta" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} placeholder="Responsable" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} type="date" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} type="date" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <input value={form.presupuesto ?? 0} onChange={(e) => setForm({ ...form, presupuesto: Number(e.target.value) || 0 })} type="number" placeholder="Presupuesto" style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
        <button type="submit" style={{ padding: '8px 14px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Agregar actividad</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <thead><tr style={{ background: '#ecfdf5', textAlign: 'left' }}><th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Año</th><th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Objetivo</th><th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Responsable</th><th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Inicio</th><th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Fin</th><th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Estado</th></tr></thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{p.anio}</td>
              <td style={{ padding: 10 }}>{p.objetivo}</td>
              <td style={{ padding: 10 }}>{p.responsable}</td>
              <td style={{ padding: 10 }}>{p.fecha_inicio}</td>
              <td style={{ padding: 10 }}>{p.fecha_fin}</td>
              <td style={{ padding: 10 }}>{p.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>El cronograma de capacitación se gestiona desde Trabajadores (certificados) y esta sección.</p>
    </div>
  );
}

