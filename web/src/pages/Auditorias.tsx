import { useEffect, useState } from 'react';

import { api } from '../lib/api';

export default function Auditorias() {
  const [audits, setAudits] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ tipo: 'interna', anio: new Date().getFullYear() });
  useEffect(() => {
    api.get('/audits').then(setAudits);
  }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/audits', form);
      setForm({ tipo: 'interna', anio: new Date().getFullYear() });
      api.get('/audits').then(setAudits);
    } catch (err: any) {
      alert(err.message || 'Error');
    }
  };
  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>
        Auditoría Interna y Revisión por la Dirección
      </h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>
        Auditoría anual y revisión por la dirección con registro de hallazgos y compromisos.
      </p>
      <form
        onSubmit={save}
        style={{
          background: '#fff',
          padding: 14,
          borderRadius: 10,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <input
          value={form.anio}
          onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })}
          type="number"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          required
        />
        <select
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        >
          <option>interna</option>
          <option>direccion</option>
        </select>
        <input
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          type="date"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          required
        />
        <input
          value={form.auditor}
          onChange={(e) => setForm({ ...form, auditor: e.target.value })}
          placeholder="Auditor"
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
        />
        <input
          value={form.estado}
          onChange={(e) => setForm({ ...form, estado: e.target.value })}
          placeholder="Estado"
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
          Registrar auditoría
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
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Año</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Auditor</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {audits.map((x) => (
            <tr key={x.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{x.anio}</td>
              <td style={{ padding: 10 }}>{x.tipo}</td>
              <td style={{ padding: 10 }}>{x.fecha}</td>
              <td style={{ padding: 10 }}>{x.auditor}</td>
              <td style={{ padding: 10 }}>{x.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
