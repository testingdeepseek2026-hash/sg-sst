import { useCallback, useEffect, useState } from 'react';

import { ShieldCheck, Siren } from 'lucide-react';

import { api } from '@/lib/api';

const TIPO_EMERGENCIA_LABELS: Record<string, string> = {
  incendio: 'Incendio',
  sismo: 'Sismo',
  evacuacion: 'Evacuación',
  electrico: 'Eléctrico',
  otro: 'Otro',
};

const TIPO_EMERGENCIA_OPTIONS = [
  { value: 'incendio', label: 'Incendio' },
  { value: 'sismo', label: 'Sismo' },
  { value: 'evacuacion', label: 'Evacuación' },
  { value: 'electrico', label: 'Eléctrico' },
  { value: 'otro', label: 'Otro' },
];

const SIMULACRO_TIPO_LABELS: Record<string, string> = {
  simulacro_parcial: 'Parcial',
  simulacro_total: 'Total',
  simulacro_mesa: 'De mesa',
  simulacro_nocturno: 'Nocturno',
};

const ESTADO_LABELS: Record<string, string> = {
  programado: 'Programado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
};

interface EmergencyPlan {
  id: string;
  nombre: string;
  tipo_emergencia: string;
  contenido?: string;
  fecha_creacion: string;
  vigente: number;
}

interface Drill {
  id: string;
  emergency_plan_id?: string;
  fecha: string;
  tipo: string;
  participantes?: number;
  observaciones?: string;
  estado: string;
  plan_nombre?: string;
  plan_tipo?: string;
}

interface PlanForm {
  nombre: string;
  tipo_emergencia: string;
  contenido: string;
  vigente: number;
}

interface DrillForm {
  emergency_plan_id: string;
  fecha: string;
  tipo: string;
  participantes: number;
  observaciones: string;
  estado: string;
}

const initialPlanForm: PlanForm = {
  nombre: '',
  tipo_emergencia: 'incendio',
  contenido: '',
  vigente: 1,
};

const initialDrillForm: DrillForm = {
  emergency_plan_id: '',
  fecha: new Date().toISOString().slice(0, 10),
  tipo: 'simulacro_parcial',
  participantes: 0,
  observaciones: '',
  estado: 'realizado',
};

export default function Emergencias() {
  const [activeTab, setActiveTab] = useState<'planes' | 'simulacros'>('planes');
  const [plans, setPlans] = useState<EmergencyPlan[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [planForm, setPlanForm] = useState<PlanForm>(initialPlanForm);
  const [drillForm, setDrillForm] = useState<DrillForm>(initialDrillForm);
  const [editingPlan, setEditingPlan] = useState<EmergencyPlan | null>(null);
  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);
  const [viewingPlan, setViewingPlan] = useState<EmergencyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [plansData, drillsData] = await Promise.all([
        api.get('/emergency-plans'),
        api.get('/drills'),
      ]);
      setPlans(plansData as EmergencyPlan[]);
      setDrills(drillsData as Drill[]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error cargando los datos' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  const openPlan = (p: EmergencyPlan) => {
    setViewingPlan(p);
    setPlanForm({ ...initialPlanForm, ...p, vigente: p.vigente });
  };

  const editPlan = (p: EmergencyPlan) => {
    setEditingPlan(p);
    setActiveTab('planes');
    setPlanForm({ ...initialPlanForm, ...p, vigente: p.vigente });
  };

  const newPlan = () => {
    setEditingPlan(null);
    setViewingPlan(null);
    setPlanForm(initialPlanForm);
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (editingPlan) {
        await api.put(`/emergency-plans/${editingPlan.id}`, planForm);
        showToast('Plan actualizado correctamente');
      } else {
        await api.post('/emergency-plans', planForm);
        showToast('Plan registrado correctamente');
      }
      newPlan();
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error guardando plan', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Eliminar este plan de emergencias y sus simulacros asociados?')) return;
    try {
      await api.delete(`/emergency-plans/${id}`);
      showToast('Plan eliminado');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const editDrill = (d: Drill) => {
    setEditingDrill(d);
    setActiveTab('simulacros');
    setDrillForm({
      ...initialDrillForm,
      ...d,
      emergency_plan_id: d.emergency_plan_id || '',
      participantes: d.participantes || 0,
    });
  };

  const newDrill = () => {
    setEditingDrill(null);
    setDrillForm(initialDrillForm);
  };

  const handleDrillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drillForm.emergency_plan_id) {
      showToast('Debe seleccionar un plan de emergencias', true);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      if (editingDrill) {
        await api.put(`/drills/${editingDrill.id}`, drillForm);
        showToast('Simulacro actualizado correctamente');
      } else {
        await api.post('/drills', drillForm);
        showToast('Simulacro registrado correctamente');
      }
      newDrill();
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error guardando simulacro', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDrill = async (id: string) => {
    if (!confirm('Eliminar este simulacro?')) return;
    try {
      await api.delete(`/drills/${id}`);
      showToast('Simulacro eliminado');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error eliminando', true);
    }
  };

  const kpis = [
    { label: 'Planes vigentes', value: plans.filter((p) => p.vigente).length },
    { label: 'Total planes', value: plans.length },
    {
      label: 'Simulacros realizados',
      value: drills.filter((d) => d.estado === 'realizado').length,
    },
    {
      label: 'Simulacros programados',
      value: drills.filter((d) => d.estado === 'programado').length,
    },
  ];

  const nombrePlan = (d: Drill) =>
    d.plan_nombre
      ? `${d.plan_tipo ? TIPO_EMERGENCIA_LABELS[d.plan_tipo] || d.plan_tipo : ''} - ${d.plan_nombre}`.trim()
      : 'Sin plan asociado';

  return (
    <div className="ui-page emergencias-page">
      <header className="ui-page-header emergencias-page-header">
        <div>
          <h1 className="ui-page-title">Plan de Emergencias y Simulacros</h1>
          <p className="ui-page-description">
            Planes de prevención, preparación y respuesta, y registro de simulacros semestrales
            (Res. 0312/2019 E8).
          </p>
        </div>
        <button
          className="ui-primary-button"
          onClick={() => {
            newPlan();
            setActiveTab('planes');
          }}
          type="button"
        >
          <ShieldCheck aria-hidden="true" size={18} />
          Nuevo plan
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

      <div
        aria-label="Secciones de emergencias"
        className="ui-tabs emergencias-tabs"
        role="tablist"
      >
        {[
          { id: 'planes' as const, label: 'Planes de emergencia', icon: ShieldCheck },
          { id: 'simulacros' as const, label: 'Simulacros', icon: Siren },
        ].map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            aria-controls={activeTab === tab.id ? `emergencias-panel-${tab.id}` : undefined}
            className="ui-tab"
            id={`emergencias-tab-${tab.id}`}
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

      <section aria-label="Resumen de emergencias" className="ui-kpi-grid">
        {kpis.map((k) => (
          <div className="ui-kpi" key={k.label}>
            <span className="ui-kpi-label">{k.label}</span>
            <span className="ui-kpi-value">{k.value}</span>
          </div>
        ))}
      </section>

      {activeTab === 'planes' && (
        <section
          aria-labelledby="emergencias-tab-planes"
          className="emergencias-tab-panel"
          id="emergencias-panel-planes"
          role="tabpanel"
          tabIndex={0}
        >
          <section
            aria-labelledby="emergencias-plan-form-title"
            className="ui-surface emergencias-form"
          >
            <h2 id="emergencias-plan-form-title" className="emergencias-form-title">
              {editingPlan ? 'Editar plan' : viewingPlan ? 'Ver plan' : 'Nuevo plan de emergencias'}
            </h2>
            <form onSubmit={handlePlanSubmit}>
              <div className="ui-form-grid">
                <div>
                  <label className="ui-field-label" htmlFor="plan-nombre">
                    Nombre del plan *
                  </label>
                  <input
                    id="plan-nombre"
                    value={planForm.nombre}
                    onChange={(e) => setPlanForm({ ...planForm, nombre: e.target.value })}
                    placeholder="Ej: Plan de evacuación por incendio"
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="plan-tipo">
                    Tipo de emergencia *
                  </label>
                  <select
                    id="plan-tipo"
                    value={planForm.tipo_emergencia}
                    onChange={(e) => setPlanForm({ ...planForm, tipo_emergencia: e.target.value })}
                    required
                  >
                    {TIPO_EMERGENCIA_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="emergencias-field-full">
                <label className="ui-field-label" htmlFor="plan-contenido">
                  Contenido del plan *
                </label>
                <textarea
                  id="plan-contenido"
                  value={planForm.contenido}
                  onChange={(e) => setPlanForm({ ...planForm, contenido: e.target.value })}
                  placeholder="Objetivo, alcance, brigadas, medios de protección, procedimientos de actuación, puntos de encuentro y comunicación."
                  required
                />
              </div>
              <div className="emergencias-field-full">
                <label className="emergencias-check" htmlFor="plan-vigente">
                  <input
                    id="plan-vigente"
                    type="checkbox"
                    checked={planForm.vigente === 1}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, vigente: e.target.checked ? 1 : 0 })
                    }
                  />
                  Plan vigente
                </label>
              </div>
              <div className="ui-form-actions">
                <button type="button" className="ui-action-button" onClick={newPlan}>
                  Cancelar
                </button>
                <button type="submit" className="ui-primary-button" disabled={loading}>
                  {loading ? 'Guardando...' : editingPlan ? 'Actualizar' : 'Registrar plan'}
                </button>
              </div>
            </form>
          </section>

          <section aria-label="Planes de emergencia registrados">
            <div className="ui-surface ui-table-wrap">
              <table className="ui-table emergencias-table">
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Fecha de creación</th>
                    <th scope="col">Vigente</th>
                    <th scope="col">Simulacros</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>{TIPO_EMERGENCIA_LABELS[p.tipo_emergencia] || p.tipo_emergencia}</td>
                      <td>{new Date(p.fecha_creacion).toLocaleDateString('es-CO')}</td>
                      <td>
                        <span className="ui-badge">{p.vigente ? 'Sí' : 'No'}</span>
                      </td>
                      <td>{drills.filter((d) => d.emergency_plan_id === p.id).length}</td>
                      <td>
                        <div className="ui-row-actions">
                          <button
                            type="button"
                            className="ui-icon-button"
                            onClick={() => openPlan(p)}
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            className="ui-icon-button ui-icon-button--edit"
                            onClick={() => editPlan(p)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="ui-icon-button ui-icon-button--delete"
                            onClick={() => handleDeletePlan(p.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {plans.length === 0 && (
                    <tr>
                      <td colSpan={6} className="ui-empty">
                        No hay planes de emergencias registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ui-mobile-list">
              {plans.length === 0 && (
                <p className="ui-empty">No hay planes de emergencias registrados</p>
              )}
              {plans.map((p) => (
                <article className="ui-surface ui-mobile-card" key={p.id}>
                  <header className="ui-mobile-card-header">
                    <div>
                      <h2>{p.nombre}</h2>
                      <p>{TIPO_EMERGENCIA_LABELS[p.tipo_emergencia] || p.tipo_emergencia}</p>
                    </div>
                    <span className="ui-badge">{p.vigente ? 'Vigente' : 'No vigente'}</span>
                  </header>
                  <dl className="ui-mobile-details">
                    <div>
                      <dt>Fecha de creación</dt>
                      <dd>{new Date(p.fecha_creacion).toLocaleDateString('es-CO')}</dd>
                    </div>
                    <div>
                      <dt>Simulacros</dt>
                      <dd>{drills.filter((d) => d.emergency_plan_id === p.id).length}</dd>
                    </div>
                  </dl>
                  <div className="ui-mobile-actions">
                    <button type="button" className="ui-icon-button" onClick={() => openPlan(p)}>
                      Ver
                    </button>
                    <button
                      type="button"
                      className="ui-icon-button ui-icon-button--edit"
                      onClick={() => editPlan(p)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ui-icon-button ui-icon-button--delete"
                      onClick={() => handleDeletePlan(p.id)}
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

      {activeTab === 'simulacros' && (
        <section
          aria-labelledby="emergencias-tab-simulacros"
          className="emergencias-tab-panel"
          id="emergencias-panel-simulacros"
          role="tabpanel"
          tabIndex={0}
        >
          <section
            aria-labelledby="emergencias-drill-form-title"
            className="ui-surface emergencias-form"
          >
            <h2 id="emergencias-drill-form-title" className="emergencias-form-title">
              {editingDrill ? 'Editar simulacro' : 'Registrar simulacro'}
            </h2>
            <form onSubmit={handleDrillSubmit}>
              <div className="ui-form-grid">
                <div>
                  <label className="ui-field-label" htmlFor="drill-plan">
                    Plan de emergencia *
                  </label>
                  <select
                    id="drill-plan"
                    value={drillForm.emergency_plan_id}
                    onChange={(e) =>
                      setDrillForm({ ...drillForm, emergency_plan_id: e.target.value })
                    }
                    required
                  >
                    <option value="">— Seleccionar plan —</option>
                    {plans
                      .filter((p) => p.vigente)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {TIPO_EMERGENCIA_LABELS[p.tipo_emergencia] || p.tipo_emergencia} -{' '}
                          {p.nombre}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="drill-fecha">
                    Fecha *
                  </label>
                  <input
                    id="drill-fecha"
                    type="date"
                    value={drillForm.fecha}
                    onChange={(e) => setDrillForm({ ...drillForm, fecha: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="drill-tipo">
                    Tipo de simulacro
                  </label>
                  <select
                    id="drill-tipo"
                    value={drillForm.tipo}
                    onChange={(e) => setDrillForm({ ...drillForm, tipo: e.target.value })}
                  >
                    {Object.entries(SIMULACRO_TIPO_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="drill-participantes">
                    Participantes
                  </label>
                  <input
                    id="drill-participantes"
                    type="number"
                    min={0}
                    value={drillForm.participantes}
                    onChange={(e) =>
                      setDrillForm({ ...drillForm, participantes: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="drill-estado">
                    Estado
                  </label>
                  <select
                    id="drill-estado"
                    value={drillForm.estado}
                    onChange={(e) => setDrillForm({ ...drillForm, estado: e.target.value })}
                  >
                    {Object.entries(ESTADO_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="emergencias-field-full">
                <label className="ui-field-label" htmlFor="drill-obs">
                  Observaciones / hallazgos
                </label>
                <textarea
                  id="drill-obs"
                  value={drillForm.observaciones}
                  onChange={(e) => setDrillForm({ ...drillForm, observaciones: e.target.value })}
                  placeholder="Tiempo de evacuación, incidencias, mejoras, coordinación de brigadas, comunicación, punto de encuentro..."
                />
              </div>
              <div className="ui-form-actions">
                <button type="button" className="ui-action-button" onClick={newDrill}>
                  Nuevo
                </button>
                <button type="submit" className="ui-primary-button" disabled={loading}>
                  {loading ? 'Guardando...' : editingDrill ? 'Actualizar' : 'Registrar simulacro'}
                </button>
              </div>
            </form>
          </section>

          <section aria-label="Simulacros registrados">
            <div className="ui-surface ui-table-wrap">
              <table className="ui-table emergencias-table">
                <thead>
                  <tr>
                    <th scope="col">Plan de emergencia</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Participantes</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Observaciones</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {drills.map((d) => (
                    <tr key={d.id}>
                      <td>{nombrePlan(d)}</td>
                      <td>{new Date(d.fecha).toLocaleDateString('es-CO')}</td>
                      <td>{SIMULACRO_TIPO_LABELS[d.tipo] || d.tipo}</td>
                      <td>{d.participantes || 0}</td>
                      <td>
                        <span className="ui-badge">{ESTADO_LABELS[d.estado] || d.estado}</span>
                      </td>
                      <td>{d.observaciones || '—'}</td>
                      <td>
                        <div className="ui-row-actions">
                          <button
                            type="button"
                            className="ui-icon-button ui-icon-button--edit"
                            onClick={() => editDrill(d)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="ui-icon-button ui-icon-button--delete"
                            onClick={() => handleDeleteDrill(d.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {drills.length === 0 && (
                    <tr>
                      <td colSpan={7} className="ui-empty">
                        No hay simulacros registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ui-mobile-list">
              {drills.length === 0 && <p className="ui-empty">No hay simulacros registrados</p>}
              {drills.map((d) => (
                <article className="ui-surface ui-mobile-card" key={d.id}>
                  <header className="ui-mobile-card-header">
                    <div>
                      <h2>{nombrePlan(d)}</h2>
                      <p>{SIMULACRO_TIPO_LABELS[d.tipo] || d.tipo}</p>
                    </div>
                    <span className="ui-badge">{ESTADO_LABELS[d.estado] || d.estado}</span>
                  </header>
                  <dl className="ui-mobile-details">
                    <div>
                      <dt>Fecha</dt>
                      <dd>{new Date(d.fecha).toLocaleDateString('es-CO')}</dd>
                    </div>
                    <div>
                      <dt>Participantes</dt>
                      <dd>{d.participantes || 0}</dd>
                    </div>
                    <div>
                      <dt>Observaciones</dt>
                      <dd>{d.observaciones || '—'}</dd>
                    </div>
                  </dl>
                  <div className="ui-mobile-actions">
                    <button
                      type="button"
                      className="ui-icon-button ui-icon-button--edit"
                      onClick={() => editDrill(d)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ui-icon-button ui-icon-button--delete"
                      onClick={() => handleDeleteDrill(d.id)}
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

      {viewingPlan && (
        <div
          className="emergencias-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setViewingPlan(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setViewingPlan(null);
          }}
          role="presentation"
        >
          <div
            className="emergencias-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergencias-view-title"
            tabIndex={-1}
          >
            <header className="emergencias-modal-header">
              <h3 id="emergencias-view-title">
                {TIPO_EMERGENCIA_LABELS[viewingPlan.tipo_emergencia] || viewingPlan.tipo_emergencia}{' '}
                - {viewingPlan.nombre}
              </h3>
              <button
                type="button"
                className="ui-action-button"
                onClick={() => setViewingPlan(null)}
              >
                Cerrar
              </button>
            </header>
            <div className="emergencias-modal-body">
              <dl className="emergencias-view-grid">
                <div>
                  <dt>Fecha de creación</dt>
                  <dd>{new Date(viewingPlan.fecha_creacion).toLocaleDateString('es-CO')}</dd>
                </div>
                <div>
                  <dt>Vigente</dt>
                  <dd>
                    <span className="ui-badge">{viewingPlan.vigente ? 'Sí' : 'No'}</span>
                  </dd>
                </div>
              </dl>
              <div>
                <strong>Contenido</strong>
                <p className="emergencias-notas">{viewingPlan.contenido || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
