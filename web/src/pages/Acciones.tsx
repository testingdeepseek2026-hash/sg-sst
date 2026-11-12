import { useCallback, useEffect, useState } from 'react';

import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';

import { SignaturePad } from '@/components/SignaturePad';
import { api } from '@/lib/api';

const ORIGEN_LABELS: Record<string, string> = {
  auditoria: 'Auditoría',
  inspeccion: 'Inspección',
  incidente: 'Incidente',
  estandar: 'Estándar',
  revision_direccion: 'Revisión Dirección',
  otro: 'Otro',
};

const ORIGEN_OPTIONS = [
  { value: 'auditoria', label: 'Auditoría' },
  { value: 'inspeccion', label: 'Inspección' },
  { value: 'incidente', label: 'Incidente' },
  { value: 'estandar', label: 'Estándar' },
  { value: 'revision_direccion', label: 'Revisión Dirección' },
  { value: 'otro', label: 'Otro' },
];

const ORIGEN_ICONS = {
  auditoria: ClipboardCheck,
  inspeccion: Search,
  incidente: AlertTriangle,
  estandar: ClipboardCheck,
  revision_direccion: UsersRound,
  otro: FileText,
};

const PRIORIDAD_LABELS: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En Proceso',
  completada: 'Completada',
  vencida: 'Vencida',
};

interface Action {
  id: string;
  origen: string;
  origen_detalle: string;
  origen_id: string;
  descripcion: string;
  responsable: string;
  fecha_limite: string;
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'vencida';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  evidencia_url: string;
  creado_en: string;
  actualizado_en: string;
  completada_en: string | null;
  firmado_por: string | null;
  firma_url: string | null;
}

interface ActionForm {
  origen: string;
  origen_detalle: string;
  origen_id: string;
  descripcion: string;
  responsable: string;
  fecha_limite: string;
  estado: Action['estado'];
  prioridad: Action['prioridad'];
  evidencia_url: string;
}

const initialForm: ActionForm = {
  origen: 'auditoria',
  origen_detalle: '',
  origen_id: '',
  descripcion: '',
  responsable: '',
  fecha_limite: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  estado: 'pendiente',
  prioridad: 'media',
  evidencia_url: '',
};

export default function Acciones() {
  const [actions, setActions] = useState<Action[]>([]);
  const [form, setForm] = useState<ActionForm>(initialForm);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [viewingAction, setViewingAction] = useState<Action | null>(null);
  const [signingAction, setSigningAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterOrigen, setFilterOrigen] = useState<string>('all');
  const [filterEstado, setFilterEstado] = useState<string>('all');

  const loadActions = useCallback(async () => {
    try {
      const data = await api.get('/actions');
      setActions(data as Action[]);
    } catch (err: any) {
      console.error('Error cargando acciones:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No fue posible cargar las acciones.',
      });
    }
  }, []);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleInputChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openAction = (a: Action) => {
    setViewingAction(a);
  };

  const editAction = (a: Action) => {
    setEditingAction(a);
    setForm({
      ...initialForm,
      ...a,
      origen_detalle: a.origen_detalle || '',
      origen_id: a.origen_id || '',
    });
  };

  const newAction = () => {
    setEditingAction(null);
    setViewingAction(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (editingAction) {
        await api.put(`/actions/${editingAction.id}`, form);
        showToast('Acción actualizada correctamente');
      } else {
        await api.post('/actions', form);
        showToast('Acción registrada correctamente');
      }
      newAction();
      loadActions();
    } catch (err: any) {
      showToast(err.message || 'Error guardando acción', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta acción?')) return;
    try {
      await api.delete(`/actions/${id}`);
      showToast('Acción eliminada');
      loadActions();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const handleSign = (action: Action) => {
    setSigningAction(action);
  };

  const handleSaveSignature = async (dataUrl: string) => {
    if (!signingAction) return;
    try {
      await api.put(`/actions/${signingAction.id}`, {
        firma_url: dataUrl,
        firmado_por: form.responsable || 'Responsable',
        estado: 'completada',
        completada_en: new Date().toISOString(),
      });
      showToast('Firma guardada y acción completada');
      loadActions();
      setSigningAction(null);
    } catch (err: any) {
      showToast(err.message || 'Error guardando firma', true);
    }
  };

  const _handleSetEstado = async (id: string, estado: string) => {
    try {
      await api.put(`/actions/${id}`, { estado });
      showToast(`Estado actualizado a ${ESTADO_LABELS[estado]}`);
      loadActions();
    } catch (err: any) {
      showToast(err.message || 'Error actualizando estado', true);
    }
  };

  const handleEvidenciaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, evidencia_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const filteredActions = actions.filter((a) => {
    if (filterOrigen !== 'all' && a.origen !== filterOrigen) return false;
    if (filterEstado !== 'all' && a.estado !== filterEstado) return false;
    return true;
  });

  const isOverdue = (action: Action) => {
    return (
      action.fecha_limite < new Date().toISOString().slice(0, 10) && action.estado !== 'completada'
    );
  };

  const renderActionControls = (action: Action) => (
    <>
      <button
        className="actions-icon-button"
        aria-label={`Ver acción: ${action.descripcion}`}
        onClick={() => openAction(action)}
        type="button"
      >
        Ver
      </button>
      <button
        className="actions-icon-button actions-icon-button--edit"
        aria-label={`Editar acción: ${action.descripcion}`}
        onClick={() => editAction(action)}
        type="button"
      >
        <Pencil aria-hidden="true" size={16} />
        <span>Editar</span>
      </button>
      {!action.firma_url && action.estado === 'completada' && (
        <button
          className="actions-icon-button actions-icon-button--sign"
          onClick={() => handleSign(action)}
          type="button"
        >
          Firmar
        </button>
      )}
      <button
        className="actions-icon-button actions-icon-button--delete"
        aria-label={`Eliminar acción: ${action.descripcion}`}
        onClick={() => handleDelete(action.id)}
        type="button"
      >
        <Trash2 aria-hidden="true" size={16} />
        <span>Eliminar</span>
      </button>
    </>
  );

  return (
    <div className="ui-page actions-page">
      <header className="ui-page-header actions-page-header">
        <div>
          <h1 className="ui-page-title">Acciones Correctivas, Preventivas y de Mejora</h1>
          <p className="ui-page-description">
            Seguimiento de responsables, fechas límite y evidencias.
          </p>
        </div>
        <button className="ui-primary-button" onClick={newAction} type="button">
          <Plus aria-hidden="true" size={18} />
          Nueva acción
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

      <div aria-label="Filtros de acciones" className="ui-surface actions-filters">
        <label className="actions-filter-field">
          <span className="ui-field-label">Origen</span>
          <select value={filterOrigen} onChange={(e) => setFilterOrigen(e.target.value)}>
            <option value="all">Todos los orígenes</option>
            {ORIGEN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="actions-filter-field">
          <span className="ui-field-label">Estado</span>
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En Proceso</option>
            <option value="completada">Completada</option>
            <option value="vencida">Vencida</option>
          </select>
        </label>
      </div>

      <section aria-labelledby="actions-form-title" className="ui-surface actions-form">
        <h2 className="actions-section-title" id="actions-form-title">
          {editingAction ? 'Editar acción' : viewingAction ? 'Ver acción' : 'Nueva acción'}
        </h2>
        <form onSubmit={handleSubmit} className="actions-form-fields">
          <div className="actions-field-grid">
            <div>
              <label className="ui-field-label" htmlFor="action-origen">
                Origen *
              </label>
              <select
                id="action-origen"
                value={form.origen}
                onChange={(e) => handleInputChange('origen', e.target.value)}
                required
              >
                {ORIGEN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="action-origen-detalle">
                Detalle del origen
              </label>
              <input
                id="action-origen-detalle"
                value={form.origen_detalle}
                onChange={(e) => handleInputChange('origen_detalle', e.target.value)}
                placeholder="Ej: Aud. Interna 2024, Inspección Obra Norte, Inc. #INC-001"
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="action-origen-id">
                ID de referencia
              </label>
              <input
                id="action-origen-id"
                value={form.origen_id}
                onChange={(e) => handleInputChange('origen_id', e.target.value)}
                placeholder="ID de la auditoría, inspección, incidente..."
              />
            </div>
          </div>
          <div>
            <label className="ui-field-label" htmlFor="action-descripcion">
              Descripción *
            </label>
            <textarea
              id="action-descripcion"
              value={form.descripcion}
              onChange={(e) => handleInputChange('descripcion', e.target.value)}
              rows={3}
              placeholder="Describa la acción a implementar..."
              required
            />
          </div>
          <div className="actions-field-grid">
            <div>
              <label className="ui-field-label" htmlFor="action-responsable">
                Responsable *
              </label>
              <input
                id="action-responsable"
                value={form.responsable}
                onChange={(e) => handleInputChange('responsable', e.target.value)}
                placeholder="Nombre del responsable"
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="action-fecha-limite">
                Fecha límite *
              </label>
              <input
                id="action-fecha-limite"
                type="date"
                value={form.fecha_limite}
                onChange={(e) => handleInputChange('fecha_limite', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="action-prioridad">
                Prioridad
              </label>
              <select
                id="action-prioridad"
                value={form.prioridad}
                onChange={(e) => handleInputChange('prioridad', e.target.value as any)}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="action-estado">
                Estado
              </label>
              <select
                id="action-estado"
                value={form.estado}
                onChange={(e) => handleInputChange('estado', e.target.value as any)}
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En Proceso</option>
                <option value="completada">Completada</option>
                <option value="vencida">Vencida</option>
              </select>
            </div>
          </div>
          <div>
            <label className="ui-field-label" htmlFor="action-evidencia-input">
              Evidencia (archivo o imagen)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleEvidenciaChange}
              className="ui-visually-hidden"
              id="action-evidencia-input"
            />
            <button
              className="ui-action-button actions-upload-button"
              type="button"
              onClick={() => document.getElementById('action-evidencia-input')?.click()}
            >
              <Paperclip aria-hidden="true" size={16} />
              Adjuntar evidencia
            </button>
            {form.evidencia_url && (
              <div className="actions-evidence-preview">
                <a href={form.evidencia_url} target="_blank" rel="noopener noreferrer">
                  Ver evidencia adjunta
                </a>
                <button
                  className="actions-icon-button actions-icon-button--delete"
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, evidencia_url: '' }))}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
          <div className="actions-form-actions">
            <button className="ui-action-button" onClick={newAction} type="button">
              Cancelar
            </button>
            <button className="ui-primary-button" type="submit" disabled={loading}>
              {loading ? 'Guardando...' : editingAction ? 'Actualizar' : 'Registrar Acción'}
            </button>
          </div>
        </form>
      </section>

      <div aria-label="Acciones registradas" className="ui-surface actions-table-wrap">
        <table className="actions-table">
          <thead>
            <tr>
              <th>Origen</th>
              <th>Descripción</th>
              <th>Responsable</th>
              <th>Límite</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Evidencia</th>
              <th>Firma</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredActions.map((a) => {
              const overdue = isOverdue(a);
              const hasEvidencia = !!a.evidencia_url;
              const hasFirma = !!a.firma_url;
              return (
                <tr className={overdue ? 'actions-row-overdue' : undefined} key={a.id}>
                  <td>
                    {ORIGEN_LABELS[a.origen] || a.origen}{' '}
                    {a.origen_detalle && (
                      <span className="actions-origin-note">({a.origen_detalle})</span>
                    )}
                  </td>
                  <td className="actions-cell-descripcion">{a.descripcion}</td>
                  <td>{a.responsable}</td>
                  <td className={overdue ? 'actions-overdue' : undefined}>
                    {a.fecha_limite} {overdue && <span aria-label="Vencida">· Vencida</span>}
                  </td>
                  <td className="actions-cell-center">
                    <span className={`actions-badge actions-badge--${a.prioridad}`}>
                      {PRIORIDAD_LABELS[a.prioridad]}
                    </span>
                  </td>
                  <td className="actions-cell-center">
                    <span className={`actions-badge actions-badge--${a.estado}`}>
                      {ESTADO_LABELS[a.estado]}
                    </span>
                  </td>
                  <td className="actions-cell-center">
                    {hasEvidencia ? <Paperclip aria-label="Con evidencia" size={16} /> : '—'}
                  </td>
                  <td className="actions-cell-center">
                    {hasFirma ? 'Firmada' : a.estado === 'completada' ? 'Pendiente de firma' : '—'}
                  </td>
                  <td>
                    <div className="actions-table-controls">{renderActionControls(a)}</div>
                  </td>
                </tr>
              );
            })}
            {filteredActions.length === 0 && (
              <tr>
                <td className="actions-empty" colSpan={9}>
                  No hay acciones que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div aria-label="Acciones registradas" className="actions-mobile-list">
        {filteredActions.map((action) => {
          const OriginIcon = ORIGEN_ICONS[action.origen as keyof typeof ORIGEN_ICONS] || FileText;
          const overdue = isOverdue(action);
          const hasEvidence = Boolean(action.evidencia_url);
          const hasSignature = Boolean(action.firma_url);
          return (
            <article className="actions-mobile-card" key={action.id}>
              <div className="actions-mobile-card-header">
                <span className="actions-origin">
                  <OriginIcon aria-hidden="true" size={16} />
                  {ORIGEN_LABELS[action.origen] || action.origen}
                </span>
                <span className={`actions-badge actions-badge--${action.prioridad}`}>
                  {PRIORIDAD_LABELS[action.prioridad]}
                </span>
              </div>
              {action.origen_detalle && (
                <p className="actions-origin-detail">{action.origen_detalle}</p>
              )}
              <h3>{action.descripcion}</h3>
              <dl className="actions-mobile-details">
                <div>
                  <dt>Responsable</dt>
                  <dd>{action.responsable}</dd>
                </div>
                <div>
                  <dt>Fecha límite</dt>
                  <dd className={overdue ? 'actions-overdue' : undefined}>
                    {action.fecha_limite}
                    {overdue ? ' · Vencida' : ''}
                  </dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <span className={`actions-badge actions-badge--${action.estado}`}>
                      {ESTADO_LABELS[action.estado]}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Evidencia y firma</dt>
                  <dd>
                    {hasEvidence ? 'Con evidencia' : 'Sin evidencia'} ·{' '}
                    {hasSignature
                      ? 'Firmada'
                      : action.estado === 'completada'
                        ? 'Firma pendiente'
                        : 'Sin firma'}
                  </dd>
                </div>
              </dl>
              <div className="actions-mobile-controls">{renderActionControls(action)}</div>
            </article>
          );
        })}
        {filteredActions.length === 0 && (
          <p className="ui-surface actions-empty">No hay acciones que coincidan con los filtros.</p>
        )}
      </div>

      {/* Modal Ver Acción */}
      {viewingAction && (
        <div className="actions-modal-backdrop">
          <div className="actions-modal actions-modal--ver">
            <div className="actions-modal-header">
              <h3 className="actions-modal-title">
                Acción - {ORIGEN_LABELS[viewingAction.origen] || viewingAction.origen}
              </h3>
              <button
                className="ui-action-button"
                onClick={() => setViewingAction(null)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
                Cerrar
              </button>
            </div>
            <div className="actions-modal-body">
              <div className="actions-view-grid">
                <div>
                  <strong>Origen:</strong>{' '}
                  {ORIGEN_LABELS[viewingAction.origen] || viewingAction.origen}
                </div>
                <div>
                  <strong>Detalle:</strong> {viewingAction.origen_detalle || '—'}
                </div>
                <div>
                  <strong>ID Referencia:</strong> {viewingAction.origen_id || '—'}
                </div>
                <div>
                  <strong>Responsable:</strong> {viewingAction.responsable}
                </div>
                <div>
                  <strong>Fecha Límite:</strong> {viewingAction.fecha_limite}
                </div>
                <div>
                  <strong>Prioridad:</strong>{' '}
                  <span className={`actions-badge actions-badge--${viewingAction.prioridad}`}>
                    {PRIORIDAD_LABELS[viewingAction.prioridad]}
                  </span>
                </div>
                <div>
                  <strong>Estado:</strong>{' '}
                  <span className={`actions-badge actions-badge--${viewingAction.estado}`}>
                    {ESTADO_LABELS[viewingAction.estado]}
                  </span>
                </div>
                <div>
                  <strong>Creada:</strong>{' '}
                  {new Date(viewingAction.creado_en).toLocaleString('es-CO')}
                </div>
                {viewingAction.actualizado_en && (
                  <div>
                    <strong>Actualizada:</strong>{' '}
                    {new Date(viewingAction.actualizado_en).toLocaleString('es-CO')}
                  </div>
                )}
                {viewingAction.completada_en && (
                  <div>
                    <strong>Completada:</strong>{' '}
                    {new Date(viewingAction.completada_en).toLocaleString('es-CO')}
                  </div>
                )}
              </div>
              <div className="actions-view-block">
                <strong>Descripción:</strong>
                <p className="actions-view-descripcion">{viewingAction.descripcion}</p>
              </div>
              {viewingAction.evidencia_url && (
                <div className="actions-view-block">
                  <strong>Evidencia:</strong>
                  <div>
                    <a
                      className="actions-view-link"
                      href={viewingAction.evidencia_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver evidencia
                    </a>
                  </div>
                </div>
              )}
              {viewingAction.firma_url && (
                <div className="actions-view-block">
                  <strong>Firma:</strong>
                  <div>
                    <img
                      className="actions-view-firma-img"
                      src={viewingAction.firma_url}
                      alt="Firma"
                    />
                  </div>
                </div>
              )}
              {viewingAction.firmado_por && (
                <div>
                  <strong>Firmado por:</strong> {viewingAction.firmado_por} el{' '}
                  {viewingAction.completada_en
                    ? new Date(viewingAction.completada_en).toLocaleString('es-CO')
                    : '—'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Firma */}
      {signingAction && (
        <div className="actions-modal-backdrop">
          <div className="actions-modal actions-modal--firma">
            <h3 className="actions-modal-title">Firma digital - {signingAction.responsable}</h3>
            <SignaturePad onSave={handleSaveSignature} onCancel={() => setSigningAction(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
