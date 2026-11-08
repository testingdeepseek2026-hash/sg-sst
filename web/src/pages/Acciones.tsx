import { useEffect, useState } from 'react';

import { api } from '../lib/api';

export default function Acciones() {
  const [actions, setActions] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ prioridad: 'media', estado: 'pendiente' });
  useEffect(() => {
    api.get('/actions').then(setActions);
  }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/actions', form);
      setForm({ prioridad: 'media', estado: 'pendiente' });
      api.get('/actions').then(setActions);
    } catch (err: any) {
      alert(err.message || 'Error');
    }
  };
  const setEstado = async (id: string, estado: string) => {
    await api.put(`/actions/${id}`, { estado });
    api.get('/actions').then(setActions);
  };
  return (
    <div style={{ padding: 20, maxWidth: 950 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>
        Acciones Correctivas, Preventivas y de Mejora
      </h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>
        Trazabilidad: quién, qué, cuándo. Generadas de estándares incumplidos, auditorías e
        incidentes.
      </p>
      <form
        onSubmit={save}
        style={{
          background: '#fff',
          padding: 14,
          borderRadius: 10,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <input
          value={form.origen}
          onChange={(e) => setForm({ ...form, origen: e.target.value })}
          placeholder="Origen"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          required
        />
        <input
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          placeholder="Descripción"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          required
        />
        <input
          value={form.responsable}
          onChange={(e) => setForm({ ...form, responsable: e.target.value })}
          placeholder="Responsable"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          required
        />
        <input
          value={form.fecha_limite}
          onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })}
          type="date"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          required
        />
        <select
          value={form.prioridad}
          onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        >
          <option>baja</option>
          <option>media</option>
          <option>alta</option>
          <option>critica</option>
        </select>
        <button
          type="submit"
          style={{
            padding: '8px 14px',
            background: '#0f766e',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
          }}
        >
          Crear acción
        </button>
      </form>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        }}
      >
        <thead>
          <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Origen</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Descripción</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Responsable</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Límite</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Cambiar</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((x) => (
            <tr key={x.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{x.origen}</td>
              <td style={{ padding: 10 }}>{x.descripcion}</td>
              <td style={{ padding: 10 }}>{x.responsable}</td>
              <td style={{ padding: 10 }}>{x.fecha_limite}</td>
              <td style={{ padding: 10 }}>{x.estado}</td>
              <td style={{ padding: 10 }}>
                <select
                  value={x.estado}
                  onChange={(e) => setEstado(x.id, e.target.value)}
                  style={{ padding: 4, borderRadius: 4, border: '1px solid #d1d5db' }}
                >
                  <option>pendiente</option>
                  <option>en_proceso</option>
                  <option>completada</option>
                  <option>vencida</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
