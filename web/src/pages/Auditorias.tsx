import { useCallback, useEffect, useState } from 'react';

import { BarChart3, ClipboardList, Download, Search } from 'lucide-react';

import { api } from '@/lib/api';

interface Audit {
  id: string;
  anio: number;
  tipo: 'interna' | 'direccion';
  fecha: string;
  auditor: string;
  alcance: string;
  hallazgos: string;
  conclusiones: string;
  compromisos: string;
  estado: 'programada' | 'realizada' | 'cerrada';
  creado_en: string;
}

interface Finding {
  id: string;
  audit_id: string;
  descripcion: string;
  tipo: 'no_conformidad' | 'observacion' | 'oportunidad_mejora' | 'fortaleza';
  requisito: string;
  evidencia: string;
  responsable: string;
  fecha_limite: string;
  estado: 'abierto' | 'en_proceso' | 'cerrado' | 'verificado';
  accion_correctiva: string;
  evidencia_cierre: string;
  fecha_cierre: string | null;
  creado_en: string;
}

interface FindingsSummary {
  total: number;
  abiertos: number;
  en_proceso: number;
  cerrados: number;
  verificados: number;
  vencidos: number;
}

const TIPO_AUDIT_LABELS: Record<string, string> = {
  interna: 'Auditoría Interna',
  direccion: 'Revisión por la Dirección',
};

const TIPO_FINDING_LABELS: Record<string, string> = {
  no_conformidad: 'No Conformidad',
  observacion: 'Observación',
  oportunidad_mejora: 'Oportunidad de Mejora',
  fortaleza: 'Fortaleza',
};

const ESTADO_AUDIT_LABELS: Record<string, string> = {
  programada: 'Programada',
  realizada: 'Realizada',
  cerrada: 'Cerrada',
};

const ESTADO_FINDING_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  en_proceso: 'En proceso',
  cerrado: 'Cerrado',
  verificado: 'Verificado',
};

const initialAuditForm = {
  anio: new Date().getFullYear(),
  tipo: 'interna' as 'interna' | 'direccion',
  fecha: new Date().toISOString().slice(0, 10),
  auditor: '',
  alcance: '',
  hallazgos: '',
  conclusiones: '',
  compromisos: '',
  estado: 'programada' as 'programada' | 'realizada' | 'cerrada',
};

const initialFindingForm = {
  audit_id: '',
  descripcion: '',
  tipo: 'observacion' as Finding['tipo'],
  requisito: '',
  evidencia: '',
  responsable: '',
  fecha_limite: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  estado: 'abierto' as Finding['estado'],
  accion_correctiva: '',
  evidencia_cierre: '',
};

export default function Auditorias() {
  const [activeTab, setActiveTab] = useState<'lista' | 'hallazgos' | 'seguimiento'>('lista');
  const [audits, setAudits] = useState<Audit[]>([]);
  const [auditForm, setAuditForm] = useState(initialAuditForm);
  const [editingAudit, setEditingAudit] = useState<Audit | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [findingForm, setFindingForm] = useState(initialFindingForm);
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);
  const [findingModalOpen, setFindingModalOpen] = useState(false);
  const [summary, setSummary] = useState<FindingsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAudits = useCallback(async () => {
    try {
      const data = await api.get('/audits');
      setAudits(data as Audit[]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error cargando auditorías' });
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.get('/audits/findings/summary');
      setSummary(data as FindingsSummary);
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    loadAudits();
    loadSummary();
  }, [loadAudits, loadSummary]);

  const loadFindings = async (auditId: string) => {
    try {
      const data = await api.get(`/audits/${auditId}/findings`);
      setFindings(data as Finding[]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error cargando hallazgos' });
    }
  };

  useEffect(() => {
    if (selectedAudit) {
      loadFindings(selectedAudit.id);
    }
  }, [selectedAudit]);

  const showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  const openAudit = (a: Audit) => {
    setSelectedAudit(a);
    setActiveTab('hallazgos');
  };

  const editAudit = (a: Audit) => {
    setEditingAudit(a);
    setAuditForm({ ...initialAuditForm, ...a });
    setActiveTab('lista');
  };

  const newAudit = () => {
    setEditingAudit(null);
    setSelectedAudit(null);
    setAuditForm(initialAuditForm);
    setActiveTab('lista');
  };

  const handleAuditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (editingAudit) {
        await api.put(`/audits/${editingAudit.id}`, auditForm);
        showToast('Auditoría actualizada correctamente');
      } else {
        await api.post('/audits', auditForm);
        showToast('Auditoría registrada correctamente');
      }
      newAudit();
      loadAudits();
    } catch (err: any) {
      showToast(err.message || 'Error guardando auditoría', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAudit = async (id: string) => {
    if (!confirm('Eliminar esta auditoría y sus hallazgos?')) return;
    try {
      await api.delete(`/audits/${id}`);
      showToast('Auditoría eliminada');
      loadAudits();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const openFinding = (f?: Finding) => {
    if (f) {
      setEditingFinding(f);
      setFindingForm({ ...initialFindingForm, ...f, audit_id: selectedAudit?.id || '' });
    } else {
      setEditingFinding(null);
      setFindingForm({
        ...initialFindingForm,
        audit_id: selectedAudit?.id || '',
        fecha_limite: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      });
    }
    setFindingModalOpen(true);
  };

  const handleFindingSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAudit) return;
    setLoading(true);
    setMessage(null);
    try {
      const payload = { ...findingForm, audit_id: selectedAudit.id };
      if (editingFinding) {
        await api.put(`/audits/${selectedAudit.id}/findings/${editingFinding.id}`, payload);
        showToast('Hallazgo actualizado correctamente');
      } else {
        await api.post(`/audits/${selectedAudit.id}/findings`, payload);
        showToast('Hallazgo registrado correctamente');
      }
      setFindingModalOpen(false);
      setEditingFinding(null);
      loadFindings(selectedAudit.id);
      loadSummary();
    } catch (err: any) {
      showToast(err.message || 'Error guardando hallazgo', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFinding = async (id: string) => {
    if (!confirm('Eliminar este hallazgo?')) return;
    if (!selectedAudit) return;
    try {
      await api.delete(`/audits/${selectedAudit.id}/findings/${id}`);
      showToast('Hallazgo eliminado');
      loadFindings(selectedAudit.id);
      loadSummary();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const handleFindingClose = async (id: string) => {
    if (!selectedAudit) return;
    try {
      await api.put(`/audits/${selectedAudit.id}/findings/${id}`, {
        estado: 'verificado',
        fecha_cierre: new Date().toISOString().slice(0, 10),
      });
      showToast('Hallazgo verificado y cerrado');
      loadFindings(selectedAudit.id);
      loadSummary();
    } catch (err: any) {
      showToast(err.message || 'Error cerrando hallazgo', true);
    }
  };

  const exportFindings = async () => {
    if (!selectedAudit) return;
    try {
      const blob = await api.get(`/audits/${selectedAudit.id}/findings/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hallazgos_auditoria_${selectedAudit.anio}_${selectedAudit.tipo}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Hallazgos exportados a Excel');
    } catch (err: any) {
      showToast(err.message || 'Error exportando', true);
    }
  };

  const isOverdue = (f: Finding) =>
    f.estado !== 'cerrado' &&
    f.estado !== 'verificado' &&
    f.fecha_limite < new Date().toISOString().slice(0, 10);

  const summaryKpis = [
    { label: 'Total hallazgos', value: summary?.total ?? 0, tone: 'brand' },
    { label: 'Abiertos', value: summary?.abiertos ?? 0, tone: 'danger' },
    { label: 'En proceso', value: summary?.en_proceso ?? 0, tone: 'warn' },
    { label: 'Vencidos', value: summary?.vencidos ?? 0, tone: 'danger' },
    { label: 'Verificados', value: summary?.verificados ?? 0, tone: 'ok' },
  ];

  return (
    <div className="ui-page auditorias-page">
      <header className="ui-page-header auditorias-page-header">
        <div>
          <h1 className="ui-page-title">Auditoría Interna y Revisión por la Dirección</h1>
          <p className="ui-page-description">
            Programación, hallazgos y seguimiento de acciones correctivas (Decreto 1072/2015, Res.
            0312/2019).
          </p>
        </div>
        <button className="ui-primary-button" onClick={newAudit} type="button">
          <ClipboardList aria-hidden="true" size={18} />
          Nueva auditoría
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

      <div aria-label="Secciones de auditoría" className="ui-tabs auditorias-tabs" role="tablist">
        {[
          { id: 'lista' as const, label: 'Auditorías', icon: ClipboardList },
          {
            id: 'hallazgos' as const,
            label: selectedAudit
              ? `Hallazgos - ${selectedAudit.anio} ${TIPO_AUDIT_LABELS[selectedAudit.tipo]}`
              : 'Hallazgos',
            icon: Search,
          },
          { id: 'seguimiento' as const, label: 'Seguimiento global', icon: BarChart3 },
        ].map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            aria-controls={activeTab === tab.id ? `auditorias-panel-${tab.id}` : undefined}
            className="ui-tab"
            disabled={tab.id === 'hallazgos' && !selectedAudit}
            id={`auditorias-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            <tab.icon aria-hidden="true" size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'lista' && (
        <section
          aria-labelledby="auditorias-tab-lista"
          className="auditorias-tab-panel"
          id="auditorias-panel-lista"
          role="tabpanel"
          tabIndex={0}
        >
          <section aria-labelledby="auditorias-form-title" className="ui-surface auditorias-form">
            <h2 id="auditorias-form-title" className="auditorias-form-title">
              {editingAudit ? 'Editar auditoría' : 'Nueva auditoría'}
            </h2>
            <form onSubmit={handleAuditSave}>
              <div className="ui-form-grid">
                <div>
                  <label className="ui-field-label" htmlFor="audit-anio">
                    Año *
                  </label>
                  <input
                    id="audit-anio"
                    type="number"
                    value={auditForm.anio}
                    onChange={(e) => setAuditForm({ ...auditForm, anio: Number(e.target.value) })}
                    min={2020}
                    max={2035}
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="audit-tipo">
                    Tipo *
                  </label>
                  <select
                    id="audit-tipo"
                    value={auditForm.tipo}
                    onChange={(e) =>
                      setAuditForm({ ...auditForm, tipo: e.target.value as Audit['tipo'] })
                    }
                    required
                  >
                    <option value="interna">Auditoría Interna</option>
                    <option value="direccion">Revisión por la Dirección</option>
                  </select>
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="audit-fecha">
                    Fecha *
                  </label>
                  <input
                    id="audit-fecha"
                    type="date"
                    value={auditForm.fecha}
                    onChange={(e) => setAuditForm({ ...auditForm, fecha: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="audit-auditor">
                    Auditor / responsable
                  </label>
                  <input
                    id="audit-auditor"
                    value={auditForm.auditor}
                    onChange={(e) => setAuditForm({ ...auditForm, auditor: e.target.value })}
                    placeholder="Nombre del auditor o responsable"
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="audit-estado">
                    Estado
                  </label>
                  <select
                    id="audit-estado"
                    value={auditForm.estado}
                    onChange={(e) =>
                      setAuditForm({ ...auditForm, estado: e.target.value as Audit['estado'] })
                    }
                  >
                    {Object.entries(ESTADO_AUDIT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="auditorias-field-full">
                <label className="ui-field-label" htmlFor="audit-alcance">
                  Alcance *
                </label>
                <textarea
                  id="audit-alcance"
                  value={auditForm.alcance}
                  onChange={(e) => setAuditForm({ ...auditForm, alcance: e.target.value })}
                  placeholder="Áreas, procesos y normas auditadas"
                  required
                />
              </div>
              <div className="auditorias-field-full">
                <label className="ui-field-label" htmlFor="audit-hallazgos">
                  Hallazgos preliminares
                </label>
                <textarea
                  id="audit-hallazgos"
                  value={auditForm.hallazgos}
                  onChange={(e) => setAuditForm({ ...auditForm, hallazgos: e.target.value })}
                  placeholder="Resumen de hallazgos identificados durante la auditoría"
                />
              </div>
              <div className="auditorias-field-full">
                <label className="ui-field-label" htmlFor="audit-conclusiones">
                  Conclusiones
                </label>
                <textarea
                  id="audit-conclusiones"
                  value={auditForm.conclusiones}
                  onChange={(e) => setAuditForm({ ...auditForm, conclusiones: e.target.value })}
                  placeholder="Conclusiones generales de la auditoría"
                />
              </div>
              <div className="auditorias-field-full">
                <label className="ui-field-label" htmlFor="audit-compromisos">
                  Compromisos / plan de acción
                </label>
                <textarea
                  id="audit-compromisos"
                  value={auditForm.compromisos}
                  onChange={(e) => setAuditForm({ ...auditForm, compromisos: e.target.value })}
                  placeholder="Compromisos adquiridos y acciones de mejora"
                />
              </div>
              <div className="ui-form-actions">
                <button type="button" className="ui-action-button" onClick={newAudit}>
                  Cancelar
                </button>
                <button type="submit" className="ui-primary-button" disabled={loading}>
                  {loading ? 'Guardando...' : editingAudit ? 'Actualizar' : 'Registrar auditoría'}
                </button>
              </div>
            </form>
          </section>

          <section aria-label="Auditorías registradas">
            <div className="ui-surface ui-table-wrap">
              <table className="ui-table auditorias-table">
                <thead>
                  <tr>
                    <th scope="col">Año</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Auditor</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Alcance</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((a) => (
                    <tr key={a.id}>
                      <td>{a.anio}</td>
                      <td>{TIPO_AUDIT_LABELS[a.tipo]}</td>
                      <td>{a.fecha}</td>
                      <td>{a.auditor || '—'}</td>
                      <td>
                        <span className="ui-badge">{ESTADO_AUDIT_LABELS[a.estado]}</span>
                      </td>
                      <td>{a.alcance || '—'}</td>
                      <td>
                        <div className="ui-row-actions">
                          <button
                            type="button"
                            className="ui-icon-button"
                            onClick={() => openAudit(a)}
                          >
                            Ver hallazgos
                          </button>
                          <button
                            type="button"
                            className="ui-icon-button ui-icon-button--edit"
                            onClick={() => editAudit(a)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="ui-icon-button ui-icon-button--delete"
                            onClick={() => handleDeleteAudit(a.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {audits.length === 0 && (
                    <tr>
                      <td colSpan={7} className="ui-empty">
                        No hay auditorías registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ui-mobile-list">
              {audits.length === 0 && <p className="ui-empty">No hay auditorías registradas</p>}
              {audits.map((a) => (
                <article className="ui-surface ui-mobile-card" key={a.id}>
                  <header className="ui-mobile-card-header">
                    <div>
                      <h2>
                        {TIPO_AUDIT_LABELS[a.tipo]} {a.anio}
                      </h2>
                      <p>{a.fecha}</p>
                    </div>
                    <span className="ui-badge">{ESTADO_AUDIT_LABELS[a.estado]}</span>
                  </header>
                  <dl className="ui-mobile-details">
                    <div>
                      <dt>Auditor</dt>
                      <dd>{a.auditor || '—'}</dd>
                    </div>
                    <div>
                      <dt>Alcance</dt>
                      <dd>{a.alcance || '—'}</dd>
                    </div>
                  </dl>
                  <div className="ui-mobile-actions">
                    <button type="button" className="ui-icon-button" onClick={() => openAudit(a)}>
                      Ver hallazgos
                    </button>
                    <button
                      type="button"
                      className="ui-icon-button ui-icon-button--edit"
                      onClick={() => editAudit(a)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ui-icon-button ui-icon-button--delete"
                      onClick={() => handleDeleteAudit(a.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === 'hallazgos' && selectedAudit && (
        <section
          aria-labelledby="auditorias-tab-hallazgos"
          className="auditorias-tab-panel"
          id="auditorias-panel-hallazgos"
          role="tabpanel"
          tabIndex={0}
        >
          <div className="auditorias-hallazgos-header">
            <div>
              <h2 className="auditorias-section-title">
                Hallazgos - {TIPO_AUDIT_LABELS[selectedAudit.tipo]} {selectedAudit.anio}
              </h2>
              <p className="ui-page-description">
                Registre hallazgos con su acción correctiva, responsable y fecha límite.
              </p>
            </div>
            <div className="ui-row-actions">
              <button type="button" className="ui-action-button" onClick={exportFindings}>
                <Download aria-hidden="true" size={16} />
                Exportar Excel
              </button>
              <button type="button" className="ui-primary-button" onClick={() => openFinding()}>
                Nuevo hallazgo
              </button>
            </div>
          </div>

          <section aria-label="Hallazgos de la auditoría">
            <div className="ui-surface ui-table-wrap">
              <table className="ui-table auditorias-table">
                <thead>
                  <tr>
                    <th scope="col">Tipo</th>
                    <th scope="col">Descripción</th>
                    <th scope="col">Requisito</th>
                    <th scope="col">Responsable</th>
                    <th scope="col">Límite</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acción correctiva</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className="ui-badge">{TIPO_FINDING_LABELS[f.tipo]}</span>
                      </td>
                      <td>{f.descripcion}</td>
                      <td>{f.requisito || '—'}</td>
                      <td>{f.responsable || '—'}</td>
                      <td className={isOverdue(f) ? 'auditorias-overdue' : undefined}>
                        {f.fecha_limite}
                      </td>
                      <td>
                        <span className="ui-badge">{ESTADO_FINDING_LABELS[f.estado]}</span>
                      </td>
                      <td>{f.accion_correctiva || '—'}</td>
                      <td>
                        <div className="ui-row-actions">
                          <button
                            type="button"
                            className="ui-icon-button ui-icon-button--edit"
                            onClick={() => openFinding(f)}
                          >
                            Editar
                          </button>
                          {f.estado !== 'verificado' && (
                            <button
                              type="button"
                              className="ui-icon-button ui-icon-button--check"
                              onClick={() => handleFindingClose(f.id)}
                            >
                              Verificar
                            </button>
                          )}
                          <button
                            type="button"
                            className="ui-icon-button ui-icon-button--delete"
                            onClick={() => handleDeleteFinding(f.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {findings.length === 0 && (
                    <tr>
                      <td colSpan={8} className="ui-empty">
                        No hay hallazgos registrados para esta auditoría
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ui-mobile-list">
              {findings.length === 0 && (
                <p className="ui-empty">No hay hallazgos registrados para esta auditoría</p>
              )}
              {findings.map((f) => (
                <article className="ui-surface ui-mobile-card" key={f.id}>
                  <header className="ui-mobile-card-header">
                    <div>
                      <h2>{TIPO_FINDING_LABELS[f.tipo]}</h2>
                      <p>{f.descripcion}</p>
                    </div>
                    <span className="ui-badge">{ESTADO_FINDING_LABELS[f.estado]}</span>
                  </header>
                  <dl className="ui-mobile-details">
                    <div>
                      <dt>Requisito</dt>
                      <dd>{f.requisito || '—'}</dd>
                    </div>
                    <div>
                      <dt>Responsable</dt>
                      <dd>{f.responsable || '—'}</dd>
                    </div>
                    <div>
                      <dt>Fecha límite</dt>
                      <dd className={isOverdue(f) ? 'auditorias-overdue' : undefined}>
                        {f.fecha_limite}
                      </dd>
                    </div>
                    <div>
                      <dt>Acción correctiva</dt>
                      <dd>{f.accion_correctiva || '—'}</dd>
                    </div>
                  </dl>
                  <div className="ui-mobile-actions">
                    <button
                      type="button"
                      className="ui-icon-button ui-icon-button--edit"
                      onClick={() => openFinding(f)}
                    >
                      Editar
                    </button>
                    {f.estado !== 'verificado' && (
                      <button
                        type="button"
                        className="ui-icon-button ui-icon-button--check"
                        onClick={() => handleFindingClose(f.id)}
                      >
                        Verificar
                      </button>
                    )}
                    <button
                      type="button"
                      className="ui-icon-button ui-icon-button--delete"
                      onClick={() => handleDeleteFinding(f.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === 'seguimiento' && (
        <section
          aria-labelledby="auditorias-tab-seguimiento"
          className="auditorias-tab-panel"
          id="auditorias-panel-seguimiento"
          role="tabpanel"
          tabIndex={0}
        >
          <h2 className="auditorias-section-title">Seguimiento global de hallazgos</h2>
          <p className="ui-page-description">
            Resumen consolidado de hallazgos abiertos, en proceso, vencidos y verificados en todas
            las auditorías.
          </p>

          {summary ? (
            <section aria-label="Resumen global de hallazgos" className="ui-kpi-grid">
              {summaryKpis.map((k) => (
                <div className={`ui-kpi ui-kpi--${k.tone}`} key={k.label}>
                  <span className="ui-kpi-label">{k.label}</span>
                  <span className="ui-kpi-value">{k.value}</span>
                </div>
              ))}
            </section>
          ) : (
            <p className="ui-empty">No hay hallazgos registrados en las auditorías.</p>
          )}
        </section>
      )}

      {findingModalOpen && (
        <div
          className="auditorias-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setFindingModalOpen(false);
              setEditingFinding(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setFindingModalOpen(false);
              setEditingFinding(null);
            }
          }}
          role="presentation"
        >
          <div
            className="auditorias-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auditorias-finding-title"
            tabIndex={-1}
          >
            <header className="auditorias-modal-header">
              <h3 id="auditorias-finding-title">
                {editingFinding ? 'Editar hallazgo' : 'Nuevo hallazgo'}
              </h3>
              <button
                type="button"
                className="ui-action-button"
                onClick={() => {
                  setFindingModalOpen(false);
                  setEditingFinding(null);
                }}
              >
                Cerrar
              </button>
            </header>
            <form className="auditorias-modal-body" onSubmit={handleFindingSave}>
              <div className="ui-form-grid">
                <div>
                  <label className="ui-field-label" htmlFor="finding-tipo">
                    Tipo *
                  </label>
                  <select
                    id="finding-tipo"
                    value={findingForm.tipo}
                    onChange={(e) =>
                      setFindingForm({ ...findingForm, tipo: e.target.value as Finding['tipo'] })
                    }
                    required
                  >
                    {Object.entries(TIPO_FINDING_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="finding-requisito">
                    Requisito / norma
                  </label>
                  <input
                    id="finding-requisito"
                    value={findingForm.requisito}
                    onChange={(e) => setFindingForm({ ...findingForm, requisito: e.target.value })}
                    placeholder="Ej: Res. 0312/2019 E13"
                  />
                </div>
              </div>
              <div className="auditorias-field-full">
                <label className="ui-field-label" htmlFor="finding-descripcion">
                  Descripción del hallazgo *
                </label>
                <textarea
                  id="finding-descripcion"
                  value={findingForm.descripcion}
                  onChange={(e) => setFindingForm({ ...findingForm, descripcion: e.target.value })}
                  placeholder="Describa el hallazgo de forma clara y objetiva"
                  required
                />
              </div>
              <div className="auditorias-field-full">
                <label className="ui-field-label" htmlFor="finding-evidencia">
                  Evidencia
                </label>
                <textarea
                  id="finding-evidencia"
                  value={findingForm.evidencia}
                  onChange={(e) => setFindingForm({ ...findingForm, evidencia: e.target.value })}
                  placeholder="Documentos, fotos o registros que soporten el hallazgo"
                />
              </div>
              <div className="ui-form-grid">
                <div>
                  <label className="ui-field-label" htmlFor="finding-responsable">
                    Responsable *
                  </label>
                  <input
                    id="finding-responsable"
                    value={findingForm.responsable}
                    onChange={(e) =>
                      setFindingForm({ ...findingForm, responsable: e.target.value })
                    }
                    placeholder="Responsable de la acción correctiva"
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="finding-fecha-limite">
                    Fecha límite *
                  </label>
                  <input
                    id="finding-fecha-limite"
                    type="date"
                    value={findingForm.fecha_limite}
                    onChange={(e) =>
                      setFindingForm({ ...findingForm, fecha_limite: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="finding-estado">
                    Estado
                  </label>
                  <select
                    id="finding-estado"
                    value={findingForm.estado}
                    onChange={(e) =>
                      setFindingForm({
                        ...findingForm,
                        estado: e.target.value as Finding['estado'],
                      })
                    }
                  >
                    {Object.entries(ESTADO_FINDING_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="auditorias-field-full">
                <label className="ui-field-label" htmlFor="finding-accion">
                  Acción correctiva / preventiva *
                </label>
                <textarea
                  id="finding-accion"
                  value={findingForm.accion_correctiva}
                  onChange={(e) =>
                    setFindingForm({ ...findingForm, accion_correctiva: e.target.value })
                  }
                  placeholder="Describa la acción a implementar para cerrar el hallazgo"
                  required
                />
              </div>
              {editingFinding && editingFinding.estado === 'verificado' && (
                <div className="auditorias-verificado">
                  <strong>Hallazgo verificado y cerrado el {editingFinding.fecha_cierre}</strong>
                  <label className="ui-field-label" htmlFor="finding-evidencia-cierre">
                    Evidencia de cierre
                  </label>
                  <textarea
                    id="finding-evidencia-cierre"
                    value={findingForm.evidencia_cierre}
                    onChange={(e) =>
                      setFindingForm({ ...findingForm, evidencia_cierre: e.target.value })
                    }
                    placeholder="Registros, fotos o documentos que demuestren el cierre efectivo"
                  />
                </div>
              )}
              <div className="ui-form-actions">
                <button
                  type="button"
                  className="ui-action-button"
                  onClick={() => {
                    setFindingModalOpen(false);
                    setEditingFinding(null);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="ui-primary-button" disabled={loading}>
                  {loading ? 'Guardando...' : editingFinding ? 'Actualizar' : 'Registrar hallazgo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
