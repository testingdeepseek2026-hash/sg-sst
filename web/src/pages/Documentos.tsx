import { useCallback, useEffect, useState } from 'react';

import { Plus, X } from 'lucide-react';

import { api } from '@/lib/api';

interface Document {
  id: string;
  codigo: string;
  nombre: string;
  version: string;
  tipo: string;
  archivo_url: string;
  fecha_emision: string;
  fecha_revision: string | null;
  retencion_anos: number;
  responsable: string;
  estado: 'vigente' | 'obsoleto' | 'en_revision';
  creado_en: string;
}

interface DocumentForm {
  codigo: string;
  nombre: string;
  version: string;
  tipo: string;
  archivo_url: string;
  fecha_emision: string;
  fecha_revision: string;
  retencion_anos: number;
  responsable: string;
  estado: Document['estado'];
}

const TIPO_DOC_OPTIONS = [
  { value: 'formato', label: 'Formato' },
  { value: 'procedimiento', label: 'Procedimiento' },
  { value: 'instruccion', label: 'Instrucción' },
  { value: 'registro', label: 'Registro' },
  { value: 'manual', label: 'Manual' },
  { value: 'politica', label: 'Política' },
  { value: 'plan', label: 'Plan' },
  { value: 'informe', label: 'Informe' },
  { value: 'otro', label: 'Otro' },
];

const ESTADO_OPTIONS = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'obsoleto', label: 'Obsoleto' },
  { value: 'en_revision', label: 'En Revisión' },
];

const ESTADO_LABELS: Record<string, string> = {
  vigente: 'Vigente',
  obsoleto: 'Obsoleto',
  en_revision: 'En revisión',
};

const TIPO_LABELS: Record<string, string> = Object.fromEntries(
  TIPO_DOC_OPTIONS.map((t) => [t.value, t.label])
);

const RETENCION_SUGERIDA: Record<string, number> = {
  formato: 5,
  procedimiento: 5,
  instruccion: 5,
  registro: 10,
  manual: 10,
  politica: 10,
  plan: 5,
  informe: 5,
  registro_medico: 20,
  registro_exposicion: 20,
  otro: 5,
};

const initialForm: DocumentForm = {
  codigo: '',
  nombre: '',
  version: '1.0',
  tipo: 'formato',
  archivo_url: '',
  fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_revision: '',
  retencion_anos: 5,
  responsable: '',
  estado: 'vigente',
};

export default function Documentos() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [form, setForm] = useState<DocumentForm>(initialForm);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<Document[]>([]);

  const showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadDocs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/documents');
      setDocs(data as Document[]);
    } catch (err: any) {
      showToast(err.message || 'Error cargando documentos', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const loadVersionHistory = async (codigo: string) => {
    try {
      const data = await api.get(`/documents/history/${codigo}`);
      setVersionHistory(data as Document[]);
      setShowVersionHistory(codigo);
    } catch (err: any) {
      showToast(err.message || 'Error cargando historial de versiones', true);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onTipoChange = (tipo: string) => {
    setForm((prev) => ({
      ...prev,
      tipo,
      retencion_anos: RETENCION_SUGERIDA[tipo] ?? 5,
    }));
  };

  const openDoc = (d: Document) => {
    setViewingDoc(d);
  };

  const editDoc = (d: Document) => {
    setEditingDoc(d);
    setForm({
      ...initialForm,
      ...d,
      fecha_emision: d.fecha_emision?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      fecha_revision: d.fecha_revision?.slice(0, 10) || '',
      retencion_anos: d.retencion_anos ?? 5,
    });
  };

  const newDoc = () => {
    setEditingDoc(null);
    setViewingDoc(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (editingDoc) {
        await api.put(`/documents/${editingDoc.id}`, form);
        showToast('Documento actualizado correctamente');
      } else {
        await api.post('/documents', form);
        showToast('Documento registrado correctamente');
      }
      newDoc();
      loadDocs();
    } catch (err: any) {
      showToast(err.message || 'Error guardando documento', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este documento y su historial de versiones?')) return;
    try {
      await api.delete(`/documents/${id}`);
      showToast('Documento eliminado');
      loadDocs();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, archivo_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const createNewVersion = (doc: Document) => {
    const newVersion = (parseFloat(doc.version) + 0.1).toFixed(1);
    setEditingDoc(doc);
    setForm({
      ...initialForm,
      codigo: doc.codigo,
      nombre: doc.nombre,
      version: newVersion,
      tipo: doc.tipo,
      archivo_url: '',
      fecha_emision: new Date().toISOString().slice(0, 10),
      fecha_revision: '',
      retencion_anos: doc.retencion_anos,
      responsable: doc.responsable,
      estado: 'en_revision',
    });
    setViewingDoc(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredDocs = docs.filter((d) => {
    if (filterTipo !== 'all' && d.tipo !== filterTipo) return false;
    if (filterEstado !== 'all' && d.estado !== filterEstado) return false;
    return true;
  });

  const tipoStats: Record<string, number> = {};
  docs.forEach((d) => {
    tipoStats[d.tipo] = (tipoStats[d.tipo] || 0) + 1;
  });

  const kpis = [
    { label: 'Total documentos', value: docs.length, tone: 'brand' },
    { label: 'Vigentes', value: docs.filter((d) => d.estado === 'vigente').length, tone: 'ok' },
    {
      label: 'En revisión',
      value: docs.filter((d) => d.estado === 'en_revision').length,
      tone: 'warn',
    },
    {
      label: 'Obsoletos',
      value: docs.filter((d) => d.estado === 'obsoleto').length,
      tone: 'danger',
    },
  ] as const;

  const renderAcciones = (d: Document) => (
    <>
      <button type="button" className="documentos-mini-button" onClick={() => openDoc(d)}>
        Ver
      </button>
      <button
        type="button"
        className="documentos-mini-button documentos-mini-button--edit"
        onClick={() => editDoc(d)}
      >
        Editar
      </button>
      <button
        type="button"
        className="documentos-mini-button documentos-mini-button--version"
        onClick={() => createNewVersion(d)}
        aria-label={`Crear nueva versión de ${d.codigo}`}
      >
        Nueva versión
      </button>
      <button
        type="button"
        className="documentos-mini-button documentos-mini-button--history"
        onClick={() => loadVersionHistory(d.codigo)}
        aria-label={`Historial de versiones de ${d.codigo}`}
      >
        Historial
      </button>
      <button
        type="button"
        className="documentos-mini-button documentos-mini-button--delete"
        onClick={() => handleDelete(d.id)}
      >
        <span aria-hidden="true">
          <X size={14} />
        </span>
        <span className="documentos-sr-only">Eliminar</span>
      </button>
    </>
  );

  return (
    <div className="ui-page documentos-page">
      <header className="ui-page-header documentos-page-header">
        <div>
          <h1 className="ui-page-title">Gestión Documental y Retención Legal</h1>
          <p className="ui-page-description">
            Registros médicos y de exposición: hasta 20 años (Ley 1581/2012, Dec. 1072/2015).
            Control de versiones, listado maestro, estados y retención legal.
          </p>
        </div>
        <button className="ui-primary-button" onClick={newDoc} type="button">
          <Plus aria-hidden="true" size={18} />
          Nuevo documento
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

      <section aria-label="Resumen documental" className="documentos-kpis">
        {kpis.map((k) => (
          <div className={`documentos-kpi documentos-kpi--${k.tone}`} key={k.label}>
            <span className="documentos-kpi-label">{k.label}</span>
            <span className="documentos-kpi-value">{k.value}</span>
          </div>
        ))}
      </section>

      <div aria-label="Filtros de documentos" className="ui-surface documentos-filters">
        <div>
          <label className="ui-field-label" htmlFor="doc-filter-tipo">
            Tipo
          </label>
          <select
            id="doc-filter-tipo"
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
          >
            <option value="all">Todos los tipos</option>
            {TIPO_DOC_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="ui-field-label" htmlFor="doc-filter-estado">
            Estado
          </label>
          <select
            id="doc-filter-estado"
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="vigente">Vigente</option>
            <option value="en_revision">En revisión</option>
            <option value="obsoleto">Obsoleto</option>
          </select>
        </div>
        <div className="documentos-stats" aria-label="Documentos por tipo">
          {Object.entries(tipoStats).map(([tipo, count]) => (
            <span key={tipo} className="documentos-stat-pill">
              <strong>{count}</strong> {TIPO_LABELS[tipo] ?? tipo}
            </span>
          ))}
        </div>
      </div>

      <section aria-labelledby="documentos-form-title" className="ui-surface documentos-form">
        <h2 id="documentos-form-title" className="documentos-form-title">
          {editingDoc
            ? 'Editar documento'
            : viewingDoc
              ? 'Ver documento'
              : 'Nuevo documento / nueva versión'}
        </h2>
        <form onSubmit={handleSubmit} className="documentos-form-fields">
          <div className="documentos-field-grid">
            <div>
              <label className="ui-field-label" htmlFor="doc-codigo">
                Código *
              </label>
              <input
                id="doc-codigo"
                value={form.codigo}
                onChange={(e) => handleInputChange('codigo', e.target.value)}
                placeholder="Ej: PROC-SST-001"
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="doc-tipo">
                Tipo *
              </label>
              <select
                id="doc-tipo"
                value={form.tipo}
                onChange={(e) => {
                  handleInputChange('tipo', e.target.value);
                  onTipoChange(e.target.value);
                }}
                required
              >
                {TIPO_DOC_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="doc-version">
                Versión *
              </label>
              <input
                id="doc-version"
                value={form.version}
                onChange={(e) => handleInputChange('version', e.target.value)}
                placeholder="Ej: 1.0, 1.1, 2.0"
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="doc-estado">
                Estado
              </label>
              <select
                id="doc-estado"
                value={form.estado}
                onChange={(e) => handleInputChange('estado', e.target.value)}
              >
                {ESTADO_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="doc-retencion">
                Retención (años) *
              </label>
              <input
                id="doc-retencion"
                type="number"
                min={1}
                max={50}
                value={form.retencion_anos}
                onChange={(e) => handleInputChange('retencion_anos', parseInt(e.target.value) || 5)}
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="doc-responsable">
                Responsable
              </label>
              <input
                id="doc-responsable"
                value={form.responsable}
                onChange={(e) => handleInputChange('responsable', e.target.value)}
                placeholder="Nombre / Área responsable"
              />
            </div>
          </div>

          <div>
            <label className="ui-field-label" htmlFor="doc-nombre">
              Nombre del documento *
            </label>
            <input
              id="doc-nombre"
              value={form.nombre}
              onChange={(e) => handleInputChange('nombre', e.target.value)}
              placeholder="Ej: Procedimiento de Trabajo en Alturas"
              required
            />
          </div>

          <div className="documentos-field-grid">
            <div>
              <label className="ui-field-label" htmlFor="doc-fecha-emision">
                Fecha de emisión *
              </label>
              <input
                id="doc-fecha-emision"
                type="date"
                value={form.fecha_emision}
                onChange={(e) => handleInputChange('fecha_emision', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="doc-fecha-revision">
                Fecha de revisión
              </label>
              <input
                id="doc-fecha-revision"
                type="date"
                value={form.fecha_revision}
                onChange={(e) => handleInputChange('fecha_revision', e.target.value)}
              />
            </div>
          </div>

          <div className="documentos-archivo">
            <span id="doc-archivo-label" className="ui-field-label">
              Archivo del documento (PDF / Word / Excel)
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileChange}
              className="documentos-sr-only"
              id="doc-file-input"
              aria-labelledby="doc-archivo-label"
            />
            <button
              type="button"
              className="documentos-archivo-button"
              onClick={() => document.getElementById('doc-file-input')?.click()}
            >
              Adjuntar archivo
            </button>
            {form.archivo_url && (
              <div className="documentos-archivo-preview">
                <a href={form.archivo_url} target="_blank" rel="noopener noreferrer">
                  Ver archivo adjunto
                </a>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, archivo_url: '' }))}
                  className="documentos-mini-button documentos-mini-button--delete"
                >
                  Quitar
                </button>
              </div>
            )}
          </div>

          <div className="documentos-form-actions">
            <button type="button" className="ui-action-button" onClick={newDoc}>
              Cancelar
            </button>
            <button type="submit" className="ui-primary-button" disabled={loading}>
              {loading ? 'Guardando...' : editingDoc ? 'Actualizar' : 'Registrar documento'}
            </button>
          </div>
        </form>
      </section>

      <section aria-label="Listado maestro de documentos" className="documentos-lista">
        <div className="documentos-table-wrap ui-surface">
          <table className="documentos-table">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Versión</th>
                <th scope="col">Estado</th>
                <th scope="col">Responsable</th>
                <th scope="col">Emisión</th>
                <th scope="col">Revisión</th>
                <th scope="col">Retención</th>
                <th scope="col">Archivo</th>
                <th scope="col">Versiones</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((d) => {
                const versionCount = docs.filter((x) => x.codigo === d.codigo).length;
                return (
                  <tr key={d.id}>
                    <td>
                      <span className="documentos-codigo">{d.codigo}</span>
                    </td>
                    <td>
                      <span className="documentos-nombre">{d.nombre}</span>
                    </td>
                    <td>{TIPO_LABELS[d.tipo] ?? d.tipo}</td>
                    <td>
                      <span className="documentos-version">{d.version}</span>
                    </td>
                    <td>
                      <span className={`documentos-badge documentos-badge--${d.estado}`}>
                        {ESTADO_LABELS[d.estado] ?? d.estado}
                      </span>
                    </td>
                    <td>{d.responsable || '—'}</td>
                    <td>{d.fecha_emision?.slice(0, 10) || '—'}</td>
                    <td>{d.fecha_revision?.slice(0, 10) || '—'}</td>
                    <td>
                      <span
                        className={
                          d.retencion_anos >= 20 ? 'documentos-retencion-critica' : undefined
                        }
                      >
                        {d.retencion_anos} años
                      </span>
                    </td>
                    <td>{d.archivo_url ? 'Adjunto' : '—'}</td>
                    <td>
                      <span
                        className={
                          versionCount > 1
                            ? 'documentos-version-pill documentos-version-pill--multi'
                            : 'documentos-version-pill'
                        }
                      >
                        v{d.version} ({versionCount} total)
                      </span>
                    </td>
                    <td>
                      <div className="documentos-fila-acciones">{renderAcciones(d)}</div>
                    </td>
                  </tr>
                );
              })}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={12} className="documentos-empty">
                    No hay documentos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="documentos-mobile-list">
          {filteredDocs.length === 0 && (
            <p className="documentos-mobile-empty">No hay documentos registrados</p>
          )}
          {filteredDocs.map((d) => {
            const versionCount = docs.filter((x) => x.codigo === d.codigo).length;
            return (
              <article className="ui-surface documentos-mobile-card" key={d.id}>
                <header className="documentos-mobile-card-header">
                  <div>
                    <p className="documentos-codigo">{d.codigo}</p>
                    <h2>{d.nombre}</h2>
                  </div>
                  <span className={`documentos-badge documentos-badge--${d.estado}`}>
                    {ESTADO_LABELS[d.estado] ?? d.estado}
                  </span>
                </header>
                <dl className="documentos-mobile-details">
                  <div>
                    <dt>Tipo</dt>
                    <dd>{TIPO_LABELS[d.tipo] ?? d.tipo}</dd>
                  </div>
                  <div>
                    <dt>Versión</dt>
                    <dd>
                      v{d.version} ({versionCount} total)
                    </dd>
                  </div>
                  <div>
                    <dt>Responsable</dt>
                    <dd>{d.responsable || '—'}</dd>
                  </div>
                  <div>
                    <dt>Emisión</dt>
                    <dd>{d.fecha_emision?.slice(0, 10) || '—'}</dd>
                  </div>
                  <div>
                    <dt>Revisión</dt>
                    <dd>{d.fecha_revision?.slice(0, 10) || '—'}</dd>
                  </div>
                  <div>
                    <dt>Retención</dt>
                    <dd
                      className={
                        d.retencion_anos >= 20 ? 'documentos-retencion-critica' : undefined
                      }
                    >
                      {d.retencion_anos} años
                      {d.retencion_anos >= 20 ? ' (médicos / exposición)' : ''}
                    </dd>
                  </div>
                </dl>
                <div className="documentos-mobile-acciones">{renderAcciones(d)}</div>
              </article>
            );
          })}
        </div>
      </section>

      {viewingDoc && (
        <div
          className="documentos-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setViewingDoc(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setViewingDoc(null);
          }}
          role="presentation"
        >
          <div
            className="documentos-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="documentos-view-title"
            tabIndex={-1}
          >
            <header className="documentos-modal-header">
              <h3 id="documentos-view-title">
                {viewingDoc.codigo} — {viewingDoc.nombre}
              </h3>
              <button
                type="button"
                className="ui-action-button"
                onClick={() => setViewingDoc(null)}
              >
                Cerrar
              </button>
            </header>
            <div className="documentos-modal-body">
              <dl className="documentos-view-grid">
                <div>
                  <dt>Código</dt>
                  <dd>{viewingDoc.codigo}</dd>
                </div>
                <div>
                  <dt>Versión</dt>
                  <dd className="documentos-version">{viewingDoc.version}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{TIPO_LABELS[viewingDoc.tipo] ?? viewingDoc.tipo}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <span className={`documentos-badge documentos-badge--${viewingDoc.estado}`}>
                      {ESTADO_LABELS[viewingDoc.estado] ?? viewingDoc.estado}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Responsable</dt>
                  <dd>{viewingDoc.responsable || '—'}</dd>
                </div>
                <div>
                  <dt>Retención</dt>
                  <dd>
                    <span
                      className={
                        viewingDoc.retencion_anos >= 20 ? 'documentos-retencion-critica' : undefined
                      }
                    >
                      {viewingDoc.retencion_anos} años
                    </span>
                    {viewingDoc.retencion_anos >= 20 && (
                      <span className="documentos-retencion-nota">
                        20 años: médicos / exposición
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Emisión</dt>
                  <dd>{viewingDoc.fecha_emision?.slice(0, 10) || '—'}</dd>
                </div>
                <div>
                  <dt>Revisión</dt>
                  <dd>{viewingDoc.fecha_revision?.slice(0, 10) || '—'}</dd>
                </div>
              </dl>
              {viewingDoc.archivo_url && (
                <div>
                  <strong>Archivo:</strong>
                  <p>
                    <a href={viewingDoc.archivo_url} target="_blank" rel="noopener noreferrer">
                      Ver archivo adjunto
                    </a>
                  </p>
                </div>
              )}
              <div>
                <strong>Historial de versiones</strong>
                <div className="documentos-modal-acciones">
                  <button
                    type="button"
                    className="ui-action-button"
                    onClick={() => loadVersionHistory(viewingDoc.codigo)}
                  >
                    Cargar historial de este código
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVersionHistory && (
        <div
          className="documentos-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowVersionHistory(null);
              setVersionHistory([]);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowVersionHistory(null);
              setVersionHistory([]);
            }
          }}
          role="presentation"
        >
          <div
            className="documentos-modal documentos-modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="documentos-history-title"
            tabIndex={-1}
          >
            <header className="documentos-modal-header">
              <h3 id="documentos-history-title">
                Historial de versiones — Código: {showVersionHistory}
              </h3>
              <button
                type="button"
                className="ui-action-button"
                onClick={() => {
                  setShowVersionHistory(null);
                  setVersionHistory([]);
                }}
              >
                Cerrar
              </button>
            </header>
            <div className="documentos-modal-body">
              <div className="documentos-table-wrap">
                <table className="documentos-table documentos-table--history">
                  <thead>
                    <tr>
                      <th scope="col">Versión</th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Responsable</th>
                      <th scope="col">Emisión</th>
                      <th scope="col">Revisión</th>
                      <th scope="col">Retención</th>
                      <th scope="col">Archivo</th>
                      <th scope="col">Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionHistory.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <span className="documentos-version">{v.version}</span>
                        </td>
                        <td>
                          <span className="documentos-nombre">{v.nombre}</span>
                        </td>
                        <td>
                          <span className={`documentos-badge documentos-badge--${v.estado}`}>
                            {ESTADO_LABELS[v.estado] ?? v.estado}
                          </span>
                        </td>
                        <td>{v.responsable || '—'}</td>
                        <td>{v.fecha_emision?.slice(0, 10) || '—'}</td>
                        <td>{v.fecha_revision?.slice(0, 10) || '—'}</td>
                        <td>{v.retencion_anos} años</td>
                        <td>{v.archivo_url ? 'Adjunto' : '—'}</td>
                        <td>{new Date(v.creado_en).toLocaleDateString('es-CO')}</td>
                      </tr>
                    ))}
                    {versionHistory.length === 0 && (
                      <tr>
                        <td colSpan={9} className="documentos-empty">
                          No hay historial de versiones
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
