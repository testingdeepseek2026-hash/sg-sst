import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
  licencia_sst_numero: string | null;
  licencia_sst_vence: string | null;
  curso_50h: number;
  curso_50h_vence: string | null;
}

const initialForm = {
  nombre: '',
  descripcion: '',
  licencia_sst_numero: '',
  licencia_sst_vence: '',
  curso_50h_vence: '',
  curso_50h: false,
};

export default function Roles() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadRoles = () => {
    api
      .get('/roles')
      .then((data) => setRoles(data as Rol[]))
      .catch(() => setRoles([]));
  };

  useEffect(loadRoles, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await api.post('/roles', {
        ...form,
        curso_50h: form.curso_50h ? 1 : 0,
      });
      setForm(initialForm);
      loadRoles();
      setMessage({ type: 'success', text: 'Rol registrado correctamente' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error registrando el rol' });
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return '—';
    const [fechaCorta] = fecha.split('T');
    return fechaCorta;
  };

  return (
    <div className="ui-page roles-page">
      <header className="ui-page-header roles-page-header">
        <div>
          <h1 className="ui-page-title">Roles y Responsabilidades SST</h1>
          <p className="ui-page-description">
            Responsable SG-SST (licencia y curso de 50 horas), Vigía SST y Comité de Convivencia.
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

      <section aria-labelledby="roles-form-title" className="ui-surface roles-form">
        <h2 id="roles-form-title" className="roles-form-title">
          Registrar rol
        </h2>
        <form onSubmit={save}>
          <div className="ui-form-grid">
            <div>
              <label className="ui-field-label" htmlFor="rol-nombre">
                Nombre del rol *
              </label>
              <input
                id="rol-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Responsable SG-SST"
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="rol-descripcion">
                Descripción
              </label>
              <input
                id="rol-descripcion"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Funciones y responsabilidades"
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="rol-licencia">
                Nro. licencia SST
              </label>
              <input
                id="rol-licencia"
                value={form.licencia_sst_numero}
                onChange={(e) => setForm({ ...form, licencia_sst_numero: e.target.value })}
                placeholder="Número de licencia"
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="rol-licencia-vence">
                Licencia SST vence
              </label>
              <input
                id="rol-licencia-vence"
                type="date"
                value={form.licencia_sst_vence}
                onChange={(e) => setForm({ ...form, licencia_sst_vence: e.target.value })}
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="rol-curso-vence">
                Curso 50 h vence
              </label>
              <input
                id="rol-curso-vence"
                type="date"
                value={form.curso_50h_vence}
                onChange={(e) => setForm({ ...form, curso_50h_vence: e.target.value })}
              />
            </div>
            <div>
              <span className="ui-field-label">Formación</span>
              <label className="roles-check" htmlFor="rol-curso">
                <input
                  id="rol-curso"
                  type="checkbox"
                  checked={form.curso_50h}
                  onChange={(e) => setForm({ ...form, curso_50h: e.target.checked })}
                />
                Curso de 50 horas aprobado
              </label>
            </div>
          </div>
          <div className="ui-form-actions">
            <button type="submit" className="ui-primary-button" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar rol'}
            </button>
          </div>
        </form>
      </section>

      <section aria-label="Roles registrados">
        <div className="ui-surface ui-table-wrap">
          <table className="ui-table roles-table">
            <thead>
              <tr>
                <th scope="col">Rol</th>
                <th scope="col">Descripción</th>
                <th scope="col">Licencia SST vence</th>
                <th scope="col">Curso 50 h vence</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>{r.nombre}</td>
                  <td>{r.descripcion || '—'}</td>
                  <td>{formatFecha(r.licencia_sst_vence)}</td>
                  <td>{formatFecha(r.curso_50h_vence)}</td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={4} className="ui-empty">
                    No hay roles registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ui-mobile-list">
          {roles.length === 0 && <p className="ui-empty">No hay roles registrados</p>}
          {roles.map((r) => (
            <article className="ui-surface ui-mobile-card" key={r.id}>
              <header className="ui-mobile-card-header">
                <div>
                  <h2>{r.nombre}</h2>
                  {r.descripcion && <p>{r.descripcion}</p>}
                </div>
                {r.curso_50h ? <span className="ui-badge">Curso 50 h</span> : null}
              </header>
              <dl className="ui-mobile-details">
                <div>
                  <dt>Licencia SST vence</dt>
                  <dd>{formatFecha(r.licencia_sst_vence)}</dd>
                </div>
                <div>
                  <dt>Curso 50 h vence</dt>
                  <dd>{formatFecha(r.curso_50h_vence)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
