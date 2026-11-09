import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';

const TIPO_EMERGENCIA_LABELS: Record<string, string> = {
  incendio: '🔥 Incendio',
  sismo: '🌍 Sismo',
  evacuacion: '🚪 Evacuación',
  electrico: '⚡ Eléctrico',
  otro: '📋 Otro',
};

const TIPO_EMERGENCIA_OPTIONS = [
  { value: 'incendio', label: '🔥 Incendio' },
  { value: 'sismo', label: '🌍 Sismo' },
  { value: 'evacuacion', label: '🚪 Evacuación' },
  { value: 'electrico', label: '⚡ Eléctrico' },
  { value: 'otro', label: '📋 Otro' },
];

const DRILL_TIPO_LABELS: Record<string, string> = {
  programado: '📅 Programado',
  realizado: '✅ Realizado',
  cancelado: '❌ Cancelado',
};

const ESTADO_PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  1: { bg: '#dcfce7', text: '#166534' },
  0: { bg: '#f3f4f6', text: '#6b7280' },
};

const ESTADO_DRILL_COLORS: Record<string, { bg: string; text: string }> = {
  programado: { bg: '#eff6ff', text: '#1e40af' },
  realizado: { bg: '#dcfce7', text: '#166534' },
  cancelado: { bg: '#fef2f2', text: '#991b1b' },
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
      console.error('Error cargando datos:', err);
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
    setDrillForm({ ...initialDrillForm, ...d, emergency_plan_id: d.emergency_plan_id || '', participantes: d.participantes || 0 });
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

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#0f766e' }}>Plan de Emergencias y Simulacros</h1>
      </div>

      {message && (
        <div style={{ background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: message.type === 'success' ? '#065f46' : '#991b1b', padding: 10, borderRadius: 8, marginBottom: 14 }}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        {[
          { id: 'planes', label: '📋 Planes de Emergencia' },
          { id: 'simulacros', label: '🚨 Simulacros' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{ padding: '12px 20px', border: 'none', background: activeTab === tab.id ? '#fff' : 'transparent', color: activeTab === tab.id ? '#0f766e' : '#6b7280', fontWeight: activeTab === tab.id ? 'bold' : 'normal', fontSize: 13, cursor: 'pointer', borderBottom: `3px solid ${activeTab === tab.id ? '#0f766e' : 'transparent'}`, marginBottom: '-1px', transition: 'all 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PLANES DE EMERGENCIA */}
      {activeTab === 'planes' && (
        <>
          <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingPlan ? 'Editar Plan' : viewingPlan ? 'Ver Plan' : 'Nuevo Plan de Emergencias'}</h3>
            <form onSubmit={handlePlanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                <div>
                  <label htmlFor="plan-nombre" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Nombre del Plan *</label>
                  <input id="plan-nombre" value={planForm.nombre} onChange={e => setPlanForm({ ...planForm, nombre: e.target.value })} placeholder="Ej: Plan de Evacuación por Incendio - Planta 1" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                </div>
                <div>
                  <label htmlFor="plan-tipo" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Tipo de Emergencia *</label>
                  <select id="plan-tipo" value={planForm.tipo_emergencia} onChange={e => setPlanForm({ ...planForm, tipo_emergencia: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required>
                    {TIPO_EMERGENCIA_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="plan-contenido" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Contenido del Plan *</label>
                <textarea id="plan-contenido" value={planForm.contenido} onChange={e => setPlanForm({ ...planForm, contenido: e.target.value })} rows={8} placeholder="Describa:&#10;1. Objetivo del plan&#10;2. Ámbito de aplicación&#10;3. Organización y responsabilidades (brigadas, coordinadores)&#10;4. Medios de protección y equipos&#10;5. Procedimientos de actuación (alarma, evacuación, confinamiento)&#10;6. Puntos de encuentro y recuento&#10;7. Comunicaciones internas/externas&#10;8. Capacitación y simulacros&#10;9. Mantenimiento y actualización del plan" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical', fontSize: 13 }} required />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={planForm.vigente === 1} onChange={e => setPlanForm({ ...planForm, vigente: e.target.checked ? 1 : 0 })} />
                  <span>Plan vigente</span>
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={newPlan} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Guardando...' : editingPlan ? 'Actualizar' : 'Registrar Plan'}
                </button>
              </div>
            </form>
          </div>

          {/* Lista de planes */}
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Nombre</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha Creación</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Vigente</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Simulacros</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const drillCount = drills.filter(d => d.emergency_plan_id === p.id).length;
                  const estadoColor = ESTADO_PLAN_COLORS[p.vigente] || { bg: '#f3f4f6', text: '#374151' };
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 10, fontSize: 12, maxWidth: '300px' }}>{p.nombre}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{TIPO_EMERGENCIA_LABELS[p.tipo_emergencia] || p.tipo_emergencia}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{new Date(p.fecha_creacion).toLocaleDateString('es-CO')}</td>
                      <td style={{ padding: 10, textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{p.vigente ? 'Sí' : 'No'}</span>
                      </td>
                      <td style={{ padding: 10, textAlign: 'center', fontWeight: 500 }}>{drillCount}</td>
                      <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                        <button onClick={() => openPlan(p)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Ver</button>
                        <button onClick={() => editPlan(p)} style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => handleDeletePlan(p.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
                {plans.length === 0 && <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay planes de emergencias registrados</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Modal Ver Plan */}
          {viewingPlan && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, overflow: 'auto' }}>
              <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}>
                <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#0f766e' }}>{TIPO_EMERGENCIA_LABELS[viewingPlan.tipo_emergencia] || viewingPlan.tipo_emergencia} - {viewingPlan.nombre}</h3>
                  <button onClick={() => setViewingPlan(null)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕ Cerrar</button>
                </div>
                <div style={{ padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <div><strong>Fecha creación:</strong> {new Date(viewingPlan.fecha_creacion).toLocaleDateString('es-CO')}</div>
                    <div><strong>Vigente:</strong> <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: (ESTADO_PLAN_COLORS[viewingPlan.vigente] || { bg: '#f3f4f6' }).bg, color: (ESTADO_PLAN_COLORS[viewingPlan.vigente] || { text: '#374151' }).text }}>{viewingPlan.vigente ? 'Sí' : 'No'}</span></div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <strong>Contenido:</strong>
                    <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', background: '#f9fafb', padding: 16, borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, lineHeight: 1.6 }}>{viewingPlan.contenido || '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: SIMULACROS */}
      {activeTab === 'simulacros' && (
        <>
          <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingDrill ? 'Editar Simulacro' : 'Registrar Simulacro'}</h3>
            <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>Res. 0312/2019 E8: Simulacros semestrales obligatorios. Registrar fecha, tipo, participantes y observaciones.</p>
            <form onSubmit={handleDrillSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label htmlFor="drill-plan" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Plan de Emergencia *</label>
                  <select id="drill-plan" value={drillForm.emergency_plan_id} onChange={e => setDrillForm({ ...drillForm, emergency_plan_id: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required>
                    <option value="">— Seleccionar plan —</option>
                    {plans.filter(p => p.vigente).map((p) => (
                      <option key={p.id} value={p.id}>{TIPO_EMERGENCIA_LABELS[p.tipo_emergencia] || p.tipo_emergencia} - {p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="drill-fecha" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha *</label>
                  <input id="drill-fecha" type="date" value={drillForm.fecha} onChange={e => setDrillForm({ ...drillForm, fecha: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
                </div>
                <div>
                  <label htmlFor="drill-tipo" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Tipo de Simulacro</label>
                  <select id="drill-tipo" value={drillForm.tipo} onChange={e => setDrillForm({ ...drillForm, tipo: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="simulacro_parcial">Parcial (área/sector)</option>
                    <option value="simulacro_total">Total (edificio/sede completa)</option>
                    <option value="simulacro_mesa">De mesa (teórico)</option>
                    <option value="simulacro_nocturno">Nocturno</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="drill-participantes" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Participantes</label>
                  <input id="drill-participantes" type="number" min="0" value={drillForm.participantes} onChange={e => setDrillForm({ ...drillForm, participantes: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <div>
                <label htmlFor="drill-obs" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Observaciones / Hallazgos</label>
                <textarea id="drill-obs" value={drillForm.observaciones} onChange={e => setDrillForm({ ...drillForm, observaciones: e.target.value })} rows={4} placeholder="Tiempo de evacuación, incidencias, mejoras, coordinación brigadas, comunicación, punto de encuentro..." style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical', fontSize: 13 }} />
              </div>
              <div>
                <label htmlFor="drill-estado" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Estado</label>
                <select id="drill-estado" value={drillForm.estado} onChange={e => setDrillForm({ ...drillForm, estado: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                  <option value="programado">Programado</option>
                  <option value="realizado">Realizado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={newDrill} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Nuevo</button>
                <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Guardando...' : editingDrill ? 'Actualizar' : 'Registrar Simulacro'}
                </button>
              </div>
            </form>
          </div>

          {/* Lista de simulacros */}
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Plan de Emergencia</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Participantes</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Observaciones</th>
                  <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {drills.map((d) => {
                  const estadoColor = ESTADO_DRILL_COLORS[d.estado] || { bg: '#f3f4f6', text: '#374151' };
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 10, fontSize: 12 }}>{d.plan_nombre ? `${d.plan_tipo ? TIPO_EMERGENCIA_LABELS[d.plan_tipo] || d.plan_tipo : ''} - ${d.plan_nombre}` : 'Sin plan asociado'}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{new Date(d.fecha).toLocaleDateString('es-CO')}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{d.tipo.replace('simulacro_', '').replace('_', ' ')}</td>
                      <td style={{ padding: 10, textAlign: 'center', fontWeight: 500 }}>{d.participantes || 0}</td>
                      <td style={{ padding: 10, textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{DRILL_TIPO_LABELS[d.estado] || d.estado}</span>
                      </td>
                      <td style={{ padding: 10, fontSize: 11, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.observaciones || '—'}</td>
                      <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                        <button onClick={() => editDrill(d)} style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => handleDeleteDrill(d.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
                {drills.length === 0 && <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay simulacros registrados</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}