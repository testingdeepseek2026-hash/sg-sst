import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';

interface Indicador {
  id: string;
  nombre: string;
  tipo: string;
  valor: number | null;
  meta: number | null;
  periodo: string;
}

const TIPO_LABELS: Record<string, string> = {
  estructura: 'Estructura',
  proceso: 'Proceso',
  resultado: 'Resultado',
};

const initialForm = {
  nombre: '',
  tipo: 'proceso',
  valor: '',
  meta: '',
};

export default function Indicadores() {
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [inds, setInds] = useState<Indicador[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadInds = useCallback(async (periodoSeleccionado: string) => {
    try {
      const data = await api.get(`/indicators?periodo=${periodoSeleccionado}`);
      setInds(data as Indicador[]);
    } catch {
      setInds([]);
    }
  }, []);

  useEffect(() => {
    loadInds(periodo);
  }, [periodo, loadInds]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await api.post('/indicators', {
        nombre: form.nombre,
        tipo: form.tipo,
        valor: form.valor === '' ? null : Number(form.valor),
        meta: form.meta === '' ? null : Number(form.meta),
        periodo,
      });
      setForm(initialForm);
      loadInds(periodo);
      setMessage({ type: 'success', text: 'Indicador registrado correctamente' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando el indicador' });
    } finally {
      setLoading(false);
    }
  };

  const kpis = [
    { label: 'Total indicadores', value: inds.length },
    { label: 'Estructura', value: inds.filter((i) => i.tipo === 'estructura').length },
    { label: 'Proceso', value: inds.filter((i) => i.tipo === 'proceso').length },
    { label: 'Resultado', value: inds.filter((i) => i.tipo === 'resultado').length },
  ];

  return (
    <div className="ui-page indicadores-page">
      <header className="ui-page-header indicadores-page-header">
        <div>
          <h1 className="ui-page-title">Indicadores del SG-SST</h1>
          <p className="ui-page-description">
            Estructura, proceso y resultado: frecuencia, severidad, mortalidad, ausentismo y
            cumplimiento del plan.
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

      <section aria-label="Resumen de indicadores" className="ui-kpi-grid">
        {kpis.map((k) => (
          <div className="ui-kpi" key={k.label}>
            <span className="ui-kpi-label">{k.label}</span>
            <span className="ui-kpi-value">{k.value}</span>
          </div>
        ))}
      </section>

      <section aria-label="Periodo de consulta" className="ui-surface indicadores-periodo">
        <div className="indicadores-periodo-field">
          <label className="ui-field-label" htmlFor="indicador-periodo">
            Periodo
          </label>
          <input
            id="indicador-periodo"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            type="month"
          />
        </div>
      </section>

      <section aria-labelledby="indicadores-form-title" className="ui-surface indicadores-form">
        <h2 id="indicadores-form-title" className="indicadores-form-title">
          Registrar indicador
        </h2>
        <form onSubmit={save}>
          <div className="ui-form-grid">
            <div>
              <label className="ui-field-label" htmlFor="indicador-nombre">
                Nombre del indicador *
              </label>
              <input
                id="indicador-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Frecuencia de accidentalidad"
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="indicador-tipo">
                Tipo *
              </label>
              <select
                id="indicador-tipo"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="estructura">Estructura</option>
                <option value="proceso">Proceso</option>
                <option value="resultado">Resultado</option>
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="indicador-valor">
                Valor
              </label>
              <input
                id="indicador-valor"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                type="number"
                placeholder="Valor medido"
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="indicador-meta">
                Meta
              </label>
              <input
                id="indicador-meta"
                value={form.meta}
                onChange={(e) => setForm({ ...form, meta: e.target.value })}
                type="number"
                placeholder="Meta del periodo"
              />
            </div>
          </div>
          <div className="ui-form-actions">
            <button type="submit" className="ui-primary-button" disabled={loading}>
              {loading ? 'Guardando...' : 'Registrar indicador'}
            </button>
          </div>
        </form>
      </section>

      <section aria-label="Indicadores registrados">
        <div className="ui-surface ui-table-wrap">
          <table className="ui-table indicadores-table">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Valor</th>
                <th scope="col">Meta</th>
                <th scope="col">Periodo</th>
              </tr>
            </thead>
            <tbody>
              {inds.map((x) => (
                <tr key={x.id}>
                  <td>{x.nombre}</td>
                  <td className="indicadores-tipo">{TIPO_LABELS[x.tipo] ?? x.tipo}</td>
                  <td>{x.valor ?? '—'}</td>
                  <td>{x.meta ?? '—'}</td>
                  <td>{x.periodo}</td>
                </tr>
              ))}
              {inds.length === 0 && (
                <tr>
                  <td colSpan={5} className="ui-empty">
                    No hay indicadores registrados para este periodo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ui-mobile-list">
          {inds.length === 0 && (
            <p className="ui-empty">No hay indicadores registrados para este periodo</p>
          )}
          {inds.map((x) => (
            <article className="ui-surface ui-mobile-card" key={x.id}>
              <header className="ui-mobile-card-header">
                <div>
                  <h2>{x.nombre}</h2>
                </div>
                <span className="ui-badge">{TIPO_LABELS[x.tipo] ?? x.tipo}</span>
              </header>
              <dl className="ui-mobile-details">
                <div>
                  <dt>Valor</dt>
                  <dd>{x.valor ?? '—'}</dd>
                </div>
                <div>
                  <dt>Meta</dt>
                  <dd>{x.meta ?? '—'}</dd>
                </div>
                <div>
                  <dt>Periodo</dt>
                  <dd>{x.periodo}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
