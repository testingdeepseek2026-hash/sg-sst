import { useState } from 'react';

import { api } from '../lib/api';

export default function Importar() {
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState('trabajadores');
  const [res, setRes] = useState<any>(null);
  const tipos = {
    trabajadores: 'Trabajadores',
    riesgos: 'Matriz de peligros/riesgos',
    incidentes: 'Incidentes y accidentes',
  };
  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Seleccione un archivo Excel');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.postFile(`/import/${tipo}`, fd);
      setRes(r);
    } catch (err: any) {
      alert(err.message || 'Error al importar');
    }
  };
  return (
    <div style={{ padding: 20, maxWidth: 700 }}>
      <h1 style={{ marginBottom: 12, color: '#0f766e' }}>Importación inicial desde Excel</h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>
        Plantilla: primera fila = encabezados. Columnas por tipo de importación.
      </p>
      <form
        onSubmit={upload}
        style={{
          background: '#fff',
          padding: 16,
          borderRadius: 10,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 10,
          alignItems: 'end',
        }}
      >
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 6 }}
        >
          {Object.entries(tipos).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          required
        />
        <button
          type="submit"
          style={{
            padding: '10px 18px',
            background: '#0f766e',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
          }}
        >
          Importar
        </button>
      </form>
      <div style={{ marginTop: 14 }}>
        <h3 style={{ fontSize: 13, color: '#0f766e', marginBottom: 6 }}>
          Mapeo sugerido de columnas
        </h3>
        <ul style={{ color: '#4b5563', fontSize: 12, paddingLeft: 18 }}>
          <li>
            Trabajadores: tipo_documento, numero_documento, nombres, apellidos, cargo,
            fecha_ingreso, estado, eps, arl
          </li>
          <li>Riesgos: cargo, area, peligro, tarea, valoracion, responsable</li>
          <li>Incidentes: tipo, fecha_ocurrencia, descripcion, estado</li>
        </ul>
      </div>
      {res && (
        <div
          style={{
            marginTop: 14,
            background: '#ecfdf5',
            padding: 10,
            borderRadius: 8,
            color: '#065f46',
            fontSize: 13,
          }}
        >
          Importados: <b>{res.importados}</b> · Errores: <b>{res.errores ?? 0}</b>
        </div>
      )}
    </div>
  );
}
