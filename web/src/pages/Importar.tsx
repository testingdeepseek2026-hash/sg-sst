import { useState } from 'react';

import { api } from '@/lib/api';

const TIPOS = [
  { value: 'trabajadores', label: 'Trabajadores' },
  { value: 'riesgos', label: 'Matriz de peligros/riesgos' },
  { value: 'incidentes', label: 'Incidentes y accidentes' },
];

const MAPEO: Record<string, string[]> = {
  trabajadores: [
    'tipo_documento',
    'numero_documento',
    'nombres',
    'apellidos',
    'cargo',
    'fecha_ingreso',
    'estado',
    'eps',
    'arl',
  ],
  riesgos: ['cargo', 'area', 'peligro', 'tarea', 'valoracion', 'responsable'],
  incidentes: ['tipo', 'fecha_ocurrencia', 'descripcion', 'estado'],
};

export default function Importar() {
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState('trabajadores');
  const [res, setRes] = useState<{ importados: number; errores?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage({ type: 'error', text: 'Seleccione un archivo Excel' });
      return;
    }
    setLoading(true);
    setMessage(null);
    setRes(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api.postFile(`/import/${tipo}`, fd);
      setRes(r as { importados: number; errores?: number });
      setMessage({
        type: 'success',
        text: `Importación completada: ${r.importados} registros importados, ${r.errores ?? 0} errores.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al importar' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-page importar-page">
      <header className="ui-page-header importar-page-header">
        <div>
          <h1 className="ui-page-title">Importación inicial desde Excel</h1>
          <p className="ui-page-description">
            La primera fila del archivo debe contener los encabezados. Revise el mapeo sugerido de
            columnas antes de importar.
          </p>
        </div>
      </header>

      {message && (
        <div
          className={`ui-feedback ui-feedback--${message.type}`}
          role={message.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

      <section aria-labelledby="importar-form-title" className="ui-surface importar-form">
        <h2 id="importar-form-title" className="importar-form-title">
          Importar archivo
        </h2>
        <form onSubmit={upload}>
          <div className="importar-form-row">
            <div className="importar-tipo">
              <label className="ui-field-label" htmlFor="importar-tipo">
                Tipo de importación *
              </label>
              <select id="importar-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="importar-archivo">
                Archivo Excel *
              </label>
              <input
                id="importar-archivo"
                type="file"
                accept=".xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
          </div>
          <div className="ui-form-actions">
            <button type="submit" className="ui-primary-button" disabled={loading}>
              {loading ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="importar-mapeo-title" className="ui-surface importar-mapeo">
        <h2 id="importar-mapeo-title">Mapeo sugerido de columnas</h2>
        <ul>
          {Object.entries(MAPEO).map(([key, columnas]) => (
            <li key={key}>
              <strong>{TIPOS.find((t) => t.value === key)?.label}:</strong> {columnas.join(', ')}
            </li>
          ))}
        </ul>
      </section>

      {res && (
        <div className={`ui-feedback ui-feedback--success`} role="status" aria-live="polite">
          Resultado: {res.importados} importados · {res.errores ?? 0} errores
        </div>
      )}
    </div>
  );
}
