import { useEffect, useState } from 'react';

import { api } from '../lib/api';

export default function Estandares() {
  const [setSel, setSetSel] = useState<string>('21');
  const [stds, setStds] = useState<any[]>([]);
  const [assess, setAssess] = useState<Record<string, boolean>>({});
  const [cumplimiento, setCumplimiento] = useState<any>(null);

  useEffect(() => {
    api.get('/standards?set=' + setSel).then(setStds);
    api.get('/standards/cumplimiento').then(setCumplimiento);
  }, [setSel]);

  const toggle = (id: string) => {
    setAssess({ ...assess, [id]: !assess[id] });
  };
  const save = async () => {
    for (const s of stds) {
      await api.post('/standards/assessments', { standard_id: s.id, cumple: !!assess[s.id] });
    }
    api.get('/standards/cumplimiento').then(setCumplimiento);
    alert('Evaluación guardada');
  };

  const setOptions = [
    { value: '7', label: '7 estándares (≤10 trab., riesgo I-III — Cap. I)' },
    { value: '21', label: '21 estándares (11-50 trab. riesgo I-III, o ≤10 trab. riesgo IV-V — Cap. I+II)' },
    { value: '32', label: '32 estándares (>50 trab. o riesgo IV-V — Cap. I+II+III)' },
  ];

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1 style={{ marginBottom: 8, color: '#0f766e' }}>
        Autoevaluación Estándares Mínimos (Res. 0312/2019)
      </h1>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>
        Seleccione el conjunto aplicable según clase de riesgo y tamaño.
      </p>
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="estandar-set" style={{ marginRight: 10, fontSize: 13, color: '#374151' }}>
          Estándar aplicable:
        </label>
        <select
          id="estandar-set"
          value={setSel}
          onChange={(e) => setSetSel(e.target.value)}
          style={{ padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }}
        >
          {setOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {cumplimiento && (
        <div
          style={{
            background: '#ecfdf5',
            padding: 10,
            borderRadius: 8,
            marginBottom: 14,
            fontSize: 13,
            color: '#065f46',
          }}
        >
          Cumplimiento: <b>{cumplimiento.porcentaje}%</b> ({cumplimiento.cumplidos}/
          {cumplimiento.total}) · Incumplidos: {cumplimiento.incumplidos}
        </div>
      )}
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
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Código</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estándar</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Capítulo</th>
            <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Cumple</th>
          </tr>
        </thead>
        <tbody>
          {stds.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10, fontSize: 12 }}>{s.codigo}</td>
              <td style={{ padding: 10, fontSize: 12 }}>{s.titulo}</td>
              <td style={{ padding: 10, fontSize: 12 }}>{s.capitulo}</td>
              <td style={{ padding: 10 }}>
                <label
                  htmlFor={`check-${s.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    margin: 0,
                  }}
                >
                  <input id={`check-${s.id}`} type="checkbox" checked={!!assess[s.id]} onChange={() => toggle(s.id)} />
                  <span style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
                    Marcar estándar {s.codigo} como cumplido
                  </span>
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <button
          onClick={save}
          style={{
            padding: '10px 18px',
            background: '#0f766e',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          💾 Guardar evaluación
        </button>
      </div>
    </div>
  );
}