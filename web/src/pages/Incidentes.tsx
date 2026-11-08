import { useEffect, useState } from 'react';

import { api } from '../lib/api';

export default function Incidentes() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    tipo: 'incidente',
    fecha_ocurrencia: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    api.get('/incidents').then(setIncidents);
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/incidents', form);
      setForm({ tipo: 'incidente', fecha_ocurrencia: new Date().toISOString().slice(0, 10) });
      api.get('/incidents').then(setIncidents);
    } catch (err: any) {
      alert(err.message || 'Error');
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 950 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>
        Reporte e Investigación de Incidentes y Accidentes
      </h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>
        Plazo legal: reporte a ARL y EPS dentro de los 2 días hábiles siguientes al evento.
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
        <select
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        >
          <option value="incidente">Incidente</option>
          <option value="accidente">Accidente</option>
          <option value="enfermedad_laboral">Enfermedad laboral</option>
        </select>
        <input
          value={form.fecha_ocurrencia}
          onChange={(e) => setForm({ ...form, fecha_ocurrencia: e.target.value })}
          type="date"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          required
        />
        <input
          value={form.lugar}
          onChange={(e) => setForm({ ...form, lugar: e.target.value })}
          placeholder="Lugar"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        />
        <input
          value={form.trabajador_id}
          onChange={(e) => setForm({ ...form, trabajador_id: e.target.value })}
          placeholder="ID trabajador"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        />
        <textarea
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          placeholder="Descripción del suceso"
          rows={2}
          style={{ gridColumn: 'span 2', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          required
        />
        <textarea
          value={form.causa_raiz}
          onChange={(e) => setForm({ ...form, causa_raiz: e.target.value })}
          placeholder="Análisis de causa raíz"
          rows={2}
          style={{ gridColumn: 'span 2', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        />
        <textarea
          value={form.acciones_correctivas}
          onChange={(e) => setForm({ ...form, acciones_correctivas: e.target.value })}
          placeholder="Acciones correctivas"
          rows={2}
          style={{ gridColumn: 'span 2', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={!!form.reporte_arl}
            onChange={(e) => setForm({ ...form, reporte_arl: e.target.checked })}
          />{' '}
          Reporte ARL (2 días hábiles)
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={!!form.reporte_eps}
            onChange={(e) => setForm({ ...form, reporte_eps: e.target.checked })}
          />{' '}
          Reporte EPS
        </div>
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
          Registrar incidente
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
          <tr style={{ background: '#fef2f2', textAlign: 'left' }}>
            <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Fecha</th>
            <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Tipo</th>
            <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Descripción</th>
            <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>Estado</th>
            <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>ARL</th>
            <th style={{ padding: 10, fontSize: 12, color: '#991b1b' }}>EPS</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((x) => (
            <tr key={x.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{x.fecha_ocurrencia}</td>
              <td style={{ padding: 10 }}>{x.tipo}</td>
              <td style={{ padding: 10 }}>{x.descripcion}</td>
              <td style={{ padding: 10 }}>{x.estado}</td>
              <td style={{ padding: 10 }}>{x.reporte_arl ? '✓' : '-'}</td>
              <td style={{ padding: 10 }}>{x.reporte_eps ? '✓' : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
