import { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';

interface Standard {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  set_aplicable: string;
  capitulo: string;
  modo_verificacion: string;
}

interface Assessment {
  id?: string;
  standard_id: string;
  cumple: boolean;
  observaciones?: string;
  plan_mejora?: string;
  evidencia_url?: string;
  fecha?: string;
  usuario_id?: string;
}

interface Cumplimiento {
  total: number;
  cumplidos: number;
  incumplidos: number;
  porcentaje: number;
}

const setOptions = [
  { value: '7', label: '7 estándares (≤10 trab., riesgo I-III — Cap. I)' },
  {
    value: '21',
    label: '21 estándares (11-50 trab. riesgo I-III, o ≤10 trab. riesgo IV-V — Cap. I+II)',
  },
  { value: '32', label: '32 estándares (>50 trab. o riesgo IV-V — Cap. I+II+III)' },
];

const CAPITULO_WEIGHTS: Record<string, number> = {
  I: 1,
  II: 1.5,
  III: 2,
};

export default function Estandares() {
  const [setSel, setSetSel] = useState<string>('21');
  const [stds, setStds] = useState<Standard[]>([]);
  const [assess, setAssess] = useState<Record<string, Assessment>>({});
  const [cumplimiento, setCumplimiento] = useState<Cumplimiento | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [s, c] = await Promise.all([
        api.get(`/standards?set=${setSel}`),
        api.get('/standards/cumplimiento'),
      ]);
      setStds(s as Standard[]);
      setCumplimiento(c as Cumplimiento);
      // Cargar evaluaciones existentes
      const existing = await api.get('/standards/assessments');
      const assessMap: Record<string, Assessment> = {};
      (existing as Assessment[]).forEach((a: Assessment) => {
        assessMap[a.standard_id] = a;
      });
      setAssess(assessMap);
    } catch (err: any) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }, [setSel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggle = (id: string) => {
    setAssess((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        standard_id: id,
        cumple: !prev[id]?.cumple,
      },
    }));
  };

  const handleObservacionesChange = (id: string, value: string) => {
    setAssess((prev) => ({
      ...prev,
      [id]: { ...prev[id], standard_id: id, observaciones: value },
    }));
  };

  const handlePlanMejoraChange = (id: string, value: string) => {
    setAssess((prev) => ({
      ...prev,
      [id]: { ...prev[id], standard_id: id, plan_mejora: value },
    }));
  };

  const handleFileUpload = async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('standard_id', id);
      const result = await api.postFile('/standards/assessments/evidencia', formData);
      setAssess((prev) => ({
        ...prev,
        [id]: { ...prev[id], standard_id: id, evidencia_url: result.url },
      }));
      showMessage('success', 'Evidencia subida correctamente');
    } catch (err: any) {
      showMessage('error', err.message || 'Error subiendo evidencia');
    }
  };

  const calculateScore = () => {
    if (stds.length === 0) return 0;
    let totalWeight = 0;
    let earnedWeight = 0;
    stds.forEach((s) => {
      const weight = CAPITULO_WEIGHTS[s.capitulo] || 1;
      totalWeight += weight;
      if (assess[s.id]?.cumple) earnedWeight += weight;
    });
    return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  };

  const generatePlanMejora = (standard: Standard, assessment: Assessment): string => {
    if (assessment.cumple) return '';
    const base = `Incumplimiento: ${standard.codigo} - ${standard.titulo}. `;
    const obs = assessment.observaciones ? `Observaciones: ${assessment.observaciones}. ` : '';
    const sugerido = standard.modo_verificacion
      ? `Acción sugerida: ${standard.modo_verificacion}. `
      : '';
    const plazo = 'Plazo sugerido: 30 días hábiles. Responsable: Responsable SG-SST.';
    return base + obs + sugerido + plazo;
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updates: Promise<any>[] = [];
      for (const s of stds) {
        const a = assess[s.id];
        if (!a) continue;
        const payload = {
          standard_id: s.id,
          cumple: a.cumple,
          observaciones: a.observaciones || '',
          plan_mejora: a.plan_mejora || (a.cumple ? '' : generatePlanMejora(s, a)),
          evidencia_url: a.evidencia_url || '',
        };
        updates.push(api.post('/standards/assessments', payload));
      }
      await Promise.all(updates);
      await loadData();
      showMessage('success', 'Evaluación guardada correctamente');
    } catch (err: any) {
      showMessage('error', err.message || 'Error guardando evaluación');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#f59e0b';
    return '#dc2626';
  };

  const incumplidosConPlan = stds.filter(
    (s) => !assess[s.id]?.cumple && assess[s.id]?.plan_mejora
  ).length;

  return (
    <div style={{ padding: 20, maxWidth: 1000 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0, color: '#0f766e' }}>
          Autoevaluación Estándares Mínimos (Res. 0312/2019)
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#374151' }}>
            Puntaje ponderado:{' '}
            <b style={{ color: getScoreColor(calculateScore()) }}>{calculateScore()}%</b>
          </span>
        </div>
      </div>

      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>
        Seleccione el conjunto aplicable según clase de riesgo y tamaño. Cada estándar permite
        observaciones, evidencia y plan de mejora automático para incumplimientos.
      </p>

      {message && (
        <div
          style={{
            background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            padding: 10,
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          {message.text}
        </div>
      )}

      <div
        style={{
          marginBottom: 14,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <label htmlFor="estandar-set" style={{ fontSize: 13, color: '#374151' }}>
          Estándar aplicable:
        </label>
        <select
          id="estandar-set"
          value={setSel}
          onChange={(e) => setSetSel(e.target.value)}
          disabled={loading}
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
            padding: 12,
            borderRadius: 8,
            marginBottom: 14,
            fontSize: 13,
            color: '#065f46',
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div>
            Cumplimiento simple: <b>{cumplimiento.porcentaje}%</b> ({cumplimiento.cumplidos}/
            {cumplimiento.total})
          </div>
          <div>
            Incumplidos: <b>{cumplimiento.incumplidos}</b>
          </div>
          <div>
            Con plan de mejora: <b>{incumplidosConPlan}</b>
          </div>
          <div>
            Puntaje ponderado:{' '}
            <b style={{ color: getScoreColor(calculateScore()) }}>{calculateScore()}%</b>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
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
              <th style={{ padding: 10, fontSize: 12, color: '#374151', width: '60px' }}>Código</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estándar</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151', width: '80px' }}>Cap.</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151', width: '80px' }}>Cumple</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Observaciones</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Plan de Mejora</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151', width: '120px' }}>
                Evidencia
              </th>
            </tr>
          </thead>
          <tbody>
            {stds.map((s) => {
              const a = assess[s.id] || {
                cumple: false,
                observaciones: '',
                plan_mejora: '',
                evidencia_url: '',
              };
              const isIncumplido = !a.cumple;
              return (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: isIncumplido ? '#fef2f2' : '',
                  }}
                >
                  <td
                    style={{
                      padding: 10,
                      fontSize: 12,
                      fontWeight: 600,
                      color: isIncumplido ? '#dc2626' : '#111827',
                    }}
                  >
                    {s.codigo}
                  </td>
                  <td style={{ padding: 10, fontSize: 12, maxWidth: '300px' }}>
                    <div style={{ fontWeight: 500 }}>{s.titulo}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {s.descripcion}
                    </div>
                  </td>
                  <td style={{ padding: 10, fontSize: 12, textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: 'bold',
                        background:
                          s.capitulo === 'I'
                            ? '#dbeafe'
                            : s.capitulo === 'II'
                              ? '#fef3c7'
                              : '#fce7f3',
                        color:
                          s.capitulo === 'I'
                            ? '#1e40af'
                            : s.capitulo === 'II'
                              ? '#92400e'
                              : '#9d174d',
                      }}
                    >
                      {s.capitulo}
                    </span>
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    <label
                      htmlFor={`check-${s.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        margin: 0,
                      }}
                    >
                      <input
                        id={`check-${s.id}`}
                        type="checkbox"
                        checked={!!a.cumple}
                        onChange={() => toggle(s.id)}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          width: 1,
                          height: 1,
                          padding: 0,
                          margin: -1,
                          overflow: 'hidden',
                          clip: 'rect(0,0,0,0)',
                          whiteSpace: 'nowrap',
                          border: 0,
                        }}
                      >
                        Marcar estándar {s.codigo} como cumplido
                      </span>
                    </label>
                  </td>
                  <td style={{ padding: 8 }}>
                    <textarea
                      value={a.observaciones || ''}
                      onChange={(e) => handleObservacionesChange(s.id, e.target.value)}
                      placeholder={
                        isIncumplido
                          ? 'Obligatorio para incumplimientos...'
                          : 'Observaciones opcionales'
                      }
                      rows={2}
                      style={{
                        width: '100%',
                        padding: 6,
                        border: isIncumplido ? '1px solid #fca5a5' : '1px solid #d1d5db',
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        background: isIncumplido ? '#fef2f2' : '#fff',
                      }}
                      required={isIncumplido}
                    />
                  </td>
                  <td style={{ padding: 8 }}>
                    <textarea
                      value={a.plan_mejora || ''}
                      onChange={(e) => handlePlanMejoraChange(s.id, e.target.value)}
                      placeholder={
                        isIncumplido ? 'Se genera automático al guardar...' : 'No requerido'
                      }
                      rows={2}
                      style={{
                        width: '100%',
                        padding: 6,
                        border: isIncumplido ? '1px solid #fca5a5' : '1px solid #d1d5db',
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        background: isIncumplido ? '#fef2f2' : '#f9fafb',
                      }}
                      readOnly={!isIncumplido}
                    />
                    {isIncumplido && a.plan_mejora && (
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                        ✓ Plan generado (editable)
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    {a.evidencia_url ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          alignItems: 'center',
                        }}
                      >
                        <a
                          href={a.evidencia_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '4px 8px',
                            background: '#dbeafe',
                            color: '#1e40af',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500,
                            textDecoration: 'none',
                          }}
                        >
                          📎 Ver evidencia
                        </a>
                        <span style={{ fontSize: 10, color: '#6b7280' }}>Subida</span>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(s.id, f);
                        }}
                        style={{
                          fontSize: 11,
                          padding: 4,
                        }}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={save}
          disabled={saving || loading}
          style={{
            padding: '10px 18px',
            background: saving || loading ? '#94a3b8' : '#0f766e',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            fontSize: 13,
            cursor: saving || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Guardando...' : '💾 Guardar evaluación completa'}
        </button>
        <button
          onClick={loadData}
          disabled={loading}
          style={{
            padding: '10px 18px',
            background: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: 6,
            fontWeight: 'bold',
            fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          🔄 Recargar
        </button>
      </div>

      <details style={{ marginTop: 24, fontSize: 12, color: '#6b7280' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
          📋 Metodología de evaluación y ponderación
        </summary>
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: '#f9fafb',
            borderRadius: 6,
            lineHeight: 1.7,
          }}
        >
          <strong>Ponderación por Capítulo (GTC 45 / Res. 0312/2019):</strong>
          <ul style={{ margin: '8px 0 0 20px' }}>
            <li>Capítulo I (Estructura): peso 1.0 — Fundamentos y organización del SG-SST</li>
            <li>Capítulo II (Proceso): peso 1.5 — Implementación operativa</li>
            <li>Capítulo III (Resultado): peso 2.0 — Desempeño y resultados</li>
          </ul>
          <strong>Reglas de negocio:</strong>
          <ul style={{ margin: '8px 0 0 20px' }}>
            <li>
              Incumplimientos <strong>requieren</strong> observaciones y generan plan de mejora
              automático
            </li>
            <li>El plan de mejora es editable tras generarse</li>
            <li>Evidencias: imagen (jpg/png/webp), PDF, Word (máx. 5MB)</li>
            <li>
              Puntaje ponderado = Σ(peso_capítulo × cumplidos) / Σ(peso_capítulo × total) × 100
            </li>
          </ul>
        </div>
      </details>
    </div>
  );
}
