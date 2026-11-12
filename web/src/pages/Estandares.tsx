import { useCallback, useEffect, useState } from 'react';

import { Check, ClipboardList, Paperclip, RotateCw, Save } from 'lucide-react';

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

const RISK_CHAPTER_MAP: Record<string, string[]> = {
  I: ['I'],
  II: ['I', 'II'],
  III: ['I', 'II', 'III'],
  IV: ['I', 'II', 'III'],
  V: ['I', 'II', 'III'],
};

const CAPITULO_WEIGHTS: Record<string, number> = {
  I: 1,
  II: 1.5,
  III: 2,
};

export default function Estandares() {
  const [setSel, setSetSel] = useState<string>('21');
  const [stds, setStds] = useState<Standard[]>([]);
  const [claseRiesgo, setClaseRiesgo] = useState<string>('III');
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
      // Filtrar estándares por clase de riesgo según Res. 0312/2019 y RISK_CHAPTER_MAP
      const allowedChapters = RISK_CHAPTER_MAP[claseRiesgo] || ['I', 'II', 'III'];
      const filteredStds = s.filter((s: Standard) => allowedChapters.includes(s.capitulo || ''));
      setStds(filteredStds as Standard[]);
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
  }, [claseRiesgo, setSel]);

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
    <div className="standards-page ui-page">
      <header className="ui-page-header standards-page-header">
        <div>
          <h1 className="ui-page-title">Autoevaluación Estándares Mínimos (Res. 0312/2019)</h1>
          <p className="ui-page-description">
            Seleccione el conjunto aplicable según clase de riesgo y tamaño. Cada estándar permite
            observaciones, evidencia y plan de mejora automático para incumplimientos.
          </p>
        </div>
        <div className="standards-score-chip">
          <span className="standards-score-label">Puntaje ponderado</span>
          <b className="standards-score-value" style={{ color: getScoreColor(calculateScore()) }}>
            {calculateScore()}%
          </b>
        </div>
      </header>

      {message && <div className={`ui-feedback ui-feedback--${message.type}`}>{message.text}</div>}

      <div className="standards-filters ui-surface">
        <div className="standards-filter-field">
          <label className="ui-field-label" htmlFor="estandar-set">
            Estándar aplicable:
          </label>
          <select
            id="estandar-set"
            className="standards-filter-select"
            value={setSel}
            onChange={(e) => setSetSel(e.target.value)}
            disabled={loading}
          >
            {setOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="standards-filter-field">
          <label className="ui-field-label" htmlFor="clase-riesgo">
            Clase riesgo:
          </label>
          <select
            id="clase-riesgo"
            className="standards-filter-select standards-filter-select--narrow"
            value={claseRiesgo}
            onChange={(e) => setClaseRiesgo(e.target.value)}
            disabled={loading}
          >
            <option value="I">I</option>
            <option value="II">II</option>
            <option value="III">III</option>
            <option value="IV">IV</option>
            <option value="V">V</option>
          </select>
        </div>
      </div>

      {cumplimiento && (
        <div className="standards-summary">
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

      <div className="standards-table-wrap ui-surface">
        <table className="ui-table standards-table">
          <thead>
            <tr>
              <th className="standards-col-codigo">Código</th>
              <th>Estándar</th>
              <th className="standards-col-cap">Cap.</th>
              <th className="standards-col-cumple">Cumple</th>
              <th>Observaciones</th>
              <th>Plan de Mejora</th>
              <th className="standards-col-evidencia">Evidencia</th>
            </tr>
          </thead>
          <tbody>
            {stds.length === 0 && (
              <tr>
                <td className="standards-empty" colSpan={7}>
                  No hay estándares para el conjunto y la clase de riesgo seleccionados.
                </td>
              </tr>
            )}
            {stds.map((s) => {
              const a = assess[s.id] || {
                cumple: false,
                observaciones: '',
                plan_mejora: '',
                evidencia_url: '',
              };
              const isIncumplido = !a.cumple;
              return (
                <tr key={s.id} className={isIncumplido ? 'standards-row--incumplido' : undefined}>
                  <td className="standards-codigo">{s.codigo}</td>
                  <td className="standards-nombre">
                    <div className="standards-nombre-titulo">{s.titulo}</div>
                    <div className="standards-nombre-desc">{s.descripcion}</div>
                  </td>
                  <td className="standards-cap">
                    <span className={`standards-cap-badge standards-cap-badge--${s.capitulo}`}>
                      {s.capitulo}
                    </span>
                  </td>
                  <td className="standards-cumple">
                    <label className="standards-check" htmlFor={`check-${s.id}`}>
                      <input
                        id={`check-${s.id}`}
                        type="checkbox"
                        checked={!!a.cumple}
                        onChange={() => toggle(s.id)}
                      />
                      <span className="ui-visually-hidden">
                        Marcar estándar {s.codigo} como cumplido
                      </span>
                    </label>
                  </td>
                  <td>
                    <textarea
                      value={a.observaciones || ''}
                      onChange={(e) => handleObservacionesChange(s.id, e.target.value)}
                      placeholder={
                        isIncumplido
                          ? 'Obligatorio para incumplimientos...'
                          : 'Observaciones opcionales'
                      }
                      rows={2}
                      className={`standards-textarea${isIncumplido ? ' standards-textarea--incumplido' : ''}`}
                      required={isIncumplido}
                    />
                  </td>
                  <td>
                    <textarea
                      value={a.plan_mejora || ''}
                      onChange={(e) => handlePlanMejoraChange(s.id, e.target.value)}
                      placeholder={
                        isIncumplido ? 'Se genera automático al guardar...' : 'No requerido'
                      }
                      rows={2}
                      className={`standards-textarea standards-textarea--plan${isIncumplido ? ' standards-textarea--incumplido' : ''}`}
                      readOnly={!isIncumplido}
                    />
                    {isIncumplido && a.plan_mejora && (
                      <div className="standards-plan-hint">
                        <Check aria-hidden="true" size={12} /> Plan generado (editable)
                      </div>
                    )}
                  </td>
                  <td className="standards-evidencia">
                    {a.evidencia_url ? (
                      <div className="standards-evidencia-subida">
                        <a
                          href={a.evidencia_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="standards-evidencia-link"
                        >
                          <Paperclip aria-hidden="true" size={12} /> Ver evidencia
                        </a>
                        <span className="standards-evidencia-estado">Subida</span>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(s.id, f);
                        }}
                        className="standards-evidencia-input"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="standards-actions">
        <button
          className="ui-primary-button"
          onClick={save}
          disabled={saving || loading}
          type="button"
        >
          <Save aria-hidden="true" size={16} />
          {saving ? 'Guardando...' : 'Guardar evaluación completa'}
        </button>
        <button className="ui-action-button" onClick={loadData} disabled={loading} type="button">
          <RotateCw aria-hidden="true" size={16} />
          Recargar
        </button>
      </div>

      <details className="standards-metodologia">
        <summary>
          <ClipboardList aria-hidden="true" size={14} /> Metodología de evaluación y ponderación
        </summary>
        <div className="standards-metodologia-body">
          <strong>Ponderación por Capítulo (GTC 45 / Res. 0312/2019):</strong>
          <ul>
            <li>Capítulo I (Estructura): peso 1.0 — Fundamentos y organización del SG-SST</li>
            <li>Capítulo II (Proceso): peso 1.5 — Implementación operativa</li>
            <li>Capítulo III (Resultado): peso 2.0 — Desempeño y resultados</li>
          </ul>
          <strong>Reglas de negocio:</strong>
          <ul>
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
