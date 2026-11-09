import { useCallback, useEffect, useState } from 'react';

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';

import { api } from '@/lib/api';

interface Contractor {
  id: string;
  nombre: string;
  nit?: string;
  servicio: string;
  arl?: string;
  examen_medico: number;
  capacitacion_sst: number;
  epp: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha_evaluacion?: string;
  notas?: string;
  creado_en: string;
  actualizado_en: string;
}

interface ContractorForm {
  nombre: string;
  nit: string;
  servicio: string;
  arl: string;
  examen_medico: number;
  capacitacion_sst: number;
  epp: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fecha_evaluacion: string;
  notas: string;
}

const ESTADO_LABELS: Record<Contractor['estado'], string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

const initialForm: ContractorForm = {
  nombre: '',
  nit: '',
  servicio: '',
  arl: '',
  examen_medico: 0,
  capacitacion_sst: 0,
  epp: 0,
  estado: 'pendiente',
  fecha_evaluacion: new Date().toISOString().slice(0, 10),
  notas: '',
};

export default function Contratistas() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [form, setForm] = useState<ContractorForm>(initialForm);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [viewingContractor, setViewingContractor] = useState<Contractor | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadContractors = useCallback(async () => {
    try {
      const data = await api.get('/contractors');
      setContractors(data as Contractor[]);
    } catch (err: any) {
      showToast(err.message || 'Error cargando contratistas', true);
    }
  }, []);

  useEffect(() => {
    loadContractors();
  }, [loadContractors]);

  const openContractor = (c: Contractor) => {
    setViewingContractor(c);
    setForm({ ...initialForm, ...c, examen_medico: c.examen_medico, capacitacion_sst: c.capacitacion_sst, epp: c.epp });
  };

  const editContractor = (c: Contractor) => {
    setEditingContractor(c);
    setViewingContractor(null);
    setForm({ ...initialForm, ...c, examen_medico: c.examen_medico, capacitacion_sst: c.capacitacion_sst, epp: c.epp });
  };

  const newContractor = () => {
    setEditingContractor(null);
    setViewingContractor(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (editingContractor) {
        await api.put(`/contractors/${editingContractor.id}`, form);
        showToast('Contratista actualizado correctamente');
      } else {
        await api.post('/contractors', form);
        showToast('Contratista registrado correctamente');
      }
      newContractor();
      loadContractors();
    } catch (err: any) {
      showToast(err.message || 'Error guardando contratista', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este contratista?')) return;
    try {
      await api.delete(`/contractors/${id}`);
      showToast('Contratista eliminado');
      loadContractors();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const getRequisitosCumplidos = (c: Contractor) => {
    const items = [c.examen_medico, c.capacitacion_sst, c.epp].filter(Boolean).length;
    return `${items}/3`;
  };

  const isApto = (c: Contractor) => c.examen_medico && c.capacitacion_sst && c.epp;

  const requisitos = [
    { key: 'examen_medico', label: 'Examen médico ocupacional vigente (ingreso/periódico)', checked: form.examen_medico === 1 },
    { key: 'capacitacion_sst', label: 'Capacitación SST / Inducción / Trabajo seguro', checked: form.capacitacion_sst === 1 },
    { key: 'epp', label: 'EPP entregado según riesgo de la actividad', checked: form.epp === 1 },
  ] as const;

  const renderAcciones = (c: Contractor) => (
    <>
      <button type="button" className="contratistas-icon-button" onClick={() => openContractor(c)}>
        Ver
      </button>
      <button type="button" className="contratistas-icon-button contratistas-icon-button--edit" onClick={() => editContractor(c)}>
        Editar
      </button>
      <button type="button" className="contratistas-icon-button contratistas-icon-button--delete" onClick={() => handleDelete(c.id)}>
        <Trash2 aria-hidden="true" size={16} />
        <span>Eliminar</span>
      </button>
    </>
  );

  return (
    <div className="ui-page contratistas-page">
      <header className="ui-page-header contratistas-page-header">
        <div>
          <h1 className="ui-page-title">Gestión de Contratistas y Proveedores</h1>
          <p className="ui-page-description">
            Evaluación de requisitos SST para contratistas (Res. 0312/2019 E14, E15, E19): examen médico vigente,
            capacitación SST y EPP entregado.
          </p>
        </div>
        <button className="ui-primary-button" onClick={newContractor} type="button">
          <Plus aria-hidden="true" size={18} />
          Nuevo contratista
        </button>
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

      <section aria-labelledby="contratistas-form-title" className="ui-surface contratistas-form">
        <h2 id="contratistas-form-title" className="contratistas-form-title">
          {editingContractor ? 'Editar contratista' : viewingContractor ? 'Ver contratista' : 'Nuevo contratista'}
        </h2>
        <form onSubmit={handleSubmit} className="contratistas-form-fields">
          <div className="contratistas-field-grid">
            <div>
              <label className="ui-field-label" htmlFor="cont-nombre">
                Nombre / Razón Social *
              </label>
              <input
                id="cont-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Instalaciones Eléctricas SAS"
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="cont-nit">
                NIT
              </label>
              <input
                id="cont-nit"
                value={form.nit}
                onChange={(e) => setForm({ ...form, nit: e.target.value })}
                placeholder="900.123.456-7"
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="cont-servicio">
                Servicio / Actividad *
              </label>
              <input
                id="cont-servicio"
                value={form.servicio}
                onChange={(e) => setForm({ ...form, servicio: e.target.value })}
                placeholder="Ej: Instalación tableros, tendido cableado, mantenimiento UPS"
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="cont-arl">
                ARL
              </label>
              <input
                id="cont-arl"
                value={form.arl}
                onChange={(e) => setForm({ ...form, arl: e.target.value })}
                placeholder="Ej: Positiva, Sura, Colmena"
              />
            </div>
          </div>

          <div className="contratistas-requisitos">
            <strong className="contratistas-requisitos-title">Requisitos SST (Res. 0312/2019 E14, E15, E19)</strong>
            <div className="contratistas-requisitos-grid">
              {requisitos.map((r) => (
                <label className="contratistas-requisito" key={r.key}>
                  <input
                    type="checkbox"
                    checked={r.checked}
                    onChange={(e) => setForm({ ...form, [r.key]: e.target.checked ? 1 : 0 })}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
              <label className="contratistas-requisito">
                <select
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value as ContractorForm['estado'] })}
                  aria-label="Estado de evaluación"
                >
                  <option value="pendiente">Pendiente de evaluación</option>
                  <option value="aprobado">Aprobado - Cumple todos los requisitos</option>
                  <option value="rechazado">Rechazado - No cumple requisitos</option>
                </select>
                <span>Estado de evaluación</span>
              </label>
            </div>
          </div>

          <div className="contratistas-field-grid">
            <div>
              <label className="ui-field-label" htmlFor="cont-fecha-eval">
                Fecha de evaluación
              </label>
              <input
                id="cont-fecha-eval"
                type="date"
                value={form.fecha_evaluacion}
                onChange={(e) => setForm({ ...form, fecha_evaluacion: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="ui-field-label" htmlFor="cont-notas">
              Observaciones / Condiciones
            </label>
            <textarea
              id="cont-notas"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              rows={3}
              placeholder="Restricciones de acceso, áreas permitidas, vigencia de aprobación, contactos de emergencia..."
            />
          </div>

          <div className="contratistas-form-actions">
            <button type="button" className="ui-action-button" onClick={newContractor}>
              Cancelar
            </button>
            <button type="submit" className="ui-primary-button" disabled={loading}>
              {loading ? 'Guardando...' : editingContractor ? 'Actualizar' : 'Registrar contratista'}
            </button>
          </div>
        </form>
      </section>

      <section aria-label="Listado de contratistas">
        <div className="contratistas-table-wrap ui-surface">
          <table className="contratistas-table">
            <thead>
              <tr>
                <th scope="col">Contratista</th>
                <th scope="col">Servicio</th>
                <th scope="col">ARL</th>
                <th scope="col">Requisitos</th>
                <th scope="col">Estado</th>
                <th scope="col">Fecha eval.</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contractors.map((c) => {
                const apto = isApto(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="contratistas-nombre">{c.nombre}</div>
                      <div className="contratistas-sub">{c.nit || 'NIT no registrado'}</div>
                    </td>
                    <td>{c.servicio}</td>
                    <td>{c.arl || '—'}</td>
                    <td>
                      <div className="contratistas-requisitos-badges">
                        <span className={`contratistas-requisito-badge${c.examen_medico ? ' contratistas-requisito-badge--ok' : ''}`}>
                          Examen médico
                        </span>
                        <span
                          className={`contratistas-requisito-badge${c.capacitacion_sst ? ' contratistas-requisito-badge--ok' : ''}`}
                        >
                          Capacitación SST
                        </span>
                        <span className={`contratistas-requisito-badge${c.epp ? ' contratistas-requisito-badge--ok' : ''}`}>
                          EPP entregado
                        </span>
                      </div>
                      <div className="contratistas-sub">
                        {getRequisitosCumplidos(c)}
                        {apto ? ' — Apto' : ' — Por completar'}
                      </div>
                    </td>
                    <td>
                      <span className={`contratistas-badge contratistas-badge--${c.estado}`}>{ESTADO_LABELS[c.estado]}</span>
                    </td>
                    <td>{c.fecha_evaluacion ? new Date(c.fecha_evaluacion).toLocaleDateString('es-CO') : '—'}</td>
                    <td>
                      <div className="contratistas-fila-acciones">{renderAcciones(c)}</div>
                    </td>
                  </tr>
                );
              })}
              {contractors.length === 0 && (
                <tr>
                  <td colSpan={7} className="contratistas-empty">
                    No hay contratistas registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="contratistas-mobile-list">
          {contractors.length === 0 && (
            <p className="contratistas-mobile-empty">No hay contratistas registrados</p>
          )}
          {contractors.map((c) => {
            const apto = isApto(c);
            return (
              <article className="contratistas-mobile-card" key={c.id}>
                <header className="contratistas-mobile-card-header">
                  <div>
                    <h2>{c.nombre}</h2>
                    <p>{c.servicio}</p>
                  </div>
                  <span className={`contratistas-badge contratistas-badge--${c.estado}`}>{ESTADO_LABELS[c.estado]}</span>
                </header>
                <dl className="contratistas-mobile-details">
                  <div>
                    <dt>NIT</dt>
                    <dd>{c.nit || '—'}</dd>
                  </div>
                  <div>
                    <dt>ARL</dt>
                    <dd>{c.arl || '—'}</dd>
                  </div>
                  <div>
                    <dt>Fecha de evaluación</dt>
                    <dd>{c.fecha_evaluacion ? new Date(c.fecha_evaluacion).toLocaleDateString('es-CO') : '—'}</dd>
                  </div>
                  <div>
                    <dt>Requisitos</dt>
                    <dd>
                      {getRequisitosCumplidos(c)}
                      {apto ? ' — Apto' : ' — Por completar'}
                    </dd>
                  </div>
                </dl>
                <div className="contratistas-mobile-acciones">{renderAcciones(c)}</div>
              </article>
            );
          })}
        </div>
      </section>

      {viewingContractor && (
        <div className="contratistas-modal-backdrop" onClick={() => setViewingContractor(null)}>
          <div
            className="contratistas-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contratistas-view-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="contratistas-modal-header">
              <h3 id="contratistas-view-title">{viewingContractor.nombre}</h3>
              <button type="button" className="ui-action-button" onClick={() => setViewingContractor(null)}>
                <X aria-hidden="true" size={16} />
                Cerrar
              </button>
            </header>
            <div className="contratistas-modal-body">
              <dl className="contratistas-view-grid">
                <div>
                  <dt>NIT</dt>
                  <dd>{viewingContractor.nit || '—'}</dd>
                </div>
                <div>
                  <dt>Servicio</dt>
                  <dd>{viewingContractor.servicio}</dd>
                </div>
                <div>
                  <dt>ARL</dt>
                  <dd>{viewingContractor.arl || '—'}</dd>
                </div>
                <div>
                  <dt>Fecha evaluación</dt>
                  <dd>
                    {viewingContractor.fecha_evaluacion
                      ? new Date(viewingContractor.fecha_evaluacion).toLocaleDateString('es-CO')
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <span className={`contratistas-badge contratistas-badge--${viewingContractor.estado}`}>
                      {ESTADO_LABELS[viewingContractor.estado]}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Requisitos</dt>
                  <dd>
                    {getRequisitosCumplidos(viewingContractor)}
                    {isApto(viewingContractor) ? ' — Apto' : ' — Por completar'}
                  </dd>
                </div>
              </dl>
              <div className="contratistas-requisitos">
                <strong className="contratistas-requisitos-title">Detalle de requisitos</strong>
                <div className="contratistas-view-requisitos">
                  {[
                    { label: 'Examen médico', ok: viewingContractor.examen_medico },
                    { label: 'Capacitación SST', ok: viewingContractor.capacitacion_sst },
                    { label: 'EPP entregado', ok: viewingContractor.epp },
                  ].map((r) => (
                    <span
                      className={`contratistas-view-requisito contratistas-view-requisito--${r.ok ? 'ok' : 'no'}`}
                      key={r.label}
                    >
                      <Check aria-hidden="true" size={16} />
                      <X aria-hidden="true" size={16} />
                      {r.label}
                    </span>
                  ))}
                </div>
              </div>
              {viewingContractor.notas && (
                <div>
                  <strong>Observaciones:</strong>
                  <p className="contratistas-notas">{viewingContractor.notas}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
