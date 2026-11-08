import { useEffect, useState } from 'react';

import { api } from '../lib/api';

export default function Inspecciones() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    tipo: 'puesto_trabajo',
    fecha: new Date().toISOString().slice(0, 10),
  });
  useEffect(() => {
    api.get('/inspections').then(setInspections);
  }, []);
  const tipos = [
    'herramientas',
    'epp',
    'escaleras',
    'arneses',
    'vehiculo',
    'botiquin',
    'extintores',
    'puesto_trabajo',
    'obra',
  ];
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inspections', form);
      setForm({ tipo: 'puesto_trabajo', fecha: new Date().toISOString().slice(0, 10) });
      api.get('/inspections').then(setInspections);
    } catch (err: any) {
      alert(err.message || 'Error');
    }
  };
  return (
    <div style={{ padding: 20, maxWidth: 950 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>
        Inspecciones en Obra y Puestos de Trabajo
      </h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>
        Formatos digitales aptos para celular. Captura fotos y firma en pantalla.
      </p>
      <form
        onSubmit={save}
        style={{
          background: '#fff',
          padding: 14,
          borderRadius: 10,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <select
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        >
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <input
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          type="date"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          required
        />
        <input
          value={form.lugar}
          onChange={(e) => setForm({ ...form, lugar: e.target.value })}
          placeholder="Lugar / obra"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        />
        <input
          value={form.responsable}
          onChange={(e) => setForm({ ...form, responsable: e.target.value })}
          placeholder="Responsable"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        />
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
          Registrar inspección
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
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Lugar</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {inspections.map((x) => (
            <tr key={x.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{x.tipo}</td>
              <td style={{ padding: 10 }}>{x.fecha}</td>
              <td style={{ padding: 10 }}>{x.lugar}</td>
              <td style={{ padding: 10 }}>{x.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
