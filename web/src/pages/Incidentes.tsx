import { useCallback, useEffect, useState } from 'react';

import { BarChart3, Check, ClipboardList, FileText, Search, X } from 'lucide-react';

import { api } from '@/lib/api';

interface Incident {
  id: string;
  tipo: 'incidente' | 'accidente' | 'enfermedad_laboral';
  codigo: string;
  fecha_ocurrencia: string;
  fecha_reporte: string | null;
  trabajador_id: string | null;
  lugar: string | null;
  descripcion: string;
  lesiones: string | null;
  causa_raiz: string | null;
  acciones_correctivas: string | null;
  reporte_arl: boolean;
  reporte_eps: boolean;
  reporte_mintrabajo: boolean;
  dias_perdidos: number;
  estado: 'abierto' | 'investigando' | 'cerrado';
  investigador: string | null;
  fecha_cierre: string | null;
  creado_en: string;
}

interface CorrectiveAction {
  id: string;
  incident_id: string;
  descripcion: string;
  responsable: string;
  fecha_limite: string;
  estado: 'pendiente' | 'en_proceso' | 'completada' | 'vencida';
  evidencia_url: string | null;
  creado_en: string;
  completada_en: string | null;
}

interface Worker {
  id: string;
  nombres: string;
  apellidos: string;
  numero_documento: string;
  estado: 'activo' | 'inactivo' | 'retirado';
}

const TIPO_LABELS: Record<string, string> = {
  incidente: 'Incidente',
  accidente: 'Accidente de trabajo',
  enfermedad_laboral: 'Enfermedad laboral',
};

const ESTADO_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  investigando: 'En investigación',
  cerrado: 'Cerrado',
};

const ACCION_ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completada: 'Completada',
  vencida: 'Vencida',
};

const addBusinessDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      added++;
    }
  }
  return result;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO');
};

const getDeadlineStatus = (deadlineStr: string | null, completed: boolean) => {
  if (!deadlineStr || completed)
    return { label: completed ? 'Completada' : 'Sin fecha', color: '#6b7280', bg: '#f3f4f6' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineStr);
  deadline.setHours(0, 0, 0, 0);
  const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0)
    return { label: `Vencida (${Math.abs(diff)} días)`, color: '#dc2626', bg: '#fee2e2' };
  if (diff === 0) return { label: 'Vence hoy', color: '#f59e0b', bg: '#fef3c7' };
  if (diff <= 3) return { label: `Por vencer (${diff} días)`, color: '#f59e0b', bg: '#fef3c7' };
  return { label: `${diff} días`, color: '#16a34a', bg: '#dcfce7' };
};

const getArlDeadline = (fechaOcurrencia: string) => {
  const fecha = new Date(fechaOcurrencia);
  return addBusinessDays(fecha, 2).toISOString().slice(0, 10);
};

const INITIAL_FORM = {
  tipo: 'incidente' as const,
  fecha_ocurrencia: new Date().toISOString().slice(0, 10),
  lugar: '',
  trabajador_id: '',
  descripcion: '',
  lesiones: '',
  causa_raiz: '',
  acciones_correctivas: '',
  reporte_arl: false,
  reporte_eps: false,
  reporte_mintrabajo: false,
  dias_perdidos: 0,
  estado: 'abierto' as const,
  investigador: '',
};

const INITIAL_ACTION = {
  incident_id: '',
  descripcion: '',
  responsable: '',
  fecha_limite: '',
  estado: 'pendiente' as CorrectiveAction['estado'],
  evidencia_url: null as string | null,
};

export default function Incidentes() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [activeTab, setActiveTab] = useState<
    'registro' | 'investigacion' | 'acciones' | 'seguimiento'
  >('registro');
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [actionForm, setActionForm] = useState(INITIAL_ACTION);
  const [editingAction, setEditingAction] = useState<CorrectiveAction | null>(null);
  const [creatingAction, setCreatingAction] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadIncidents();
    loadWorkers();
  }, []);

  const loadIncidents = async () => {
    try {
      const data = await api.get('/incidents');
      setIncidents(data as Incident[]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error cargando incidentes' });
    }
  };

  const loadWorkers = async () => {
    try {
      const data = await api.get('/workers');
      setWorkers((data as Worker[]).filter((w) => w.estado === 'activo'));
    } catch {
      setWorkers([]);
    }
  };

  const loadIncidentDetails = useCallback(async (incidentId: string) => {
    try {
      const [inc, acts] = await Promise.all([
        api.get(`/incidents/${incidentId}`),
        api.get(`/incidents/${incidentId}/actions`),
      ]);
      setSelectedIncident(inc as Incident);
      setActions(acts as CorrectiveAction[]);
      setForm({
        ...INITIAL_FORM,
        ...inc,
        reporte_arl: !!inc.reporte_arl,
        reporte_eps: !!inc.reporte_eps,
        reporte_mintrabajo: !!inc.reporte_mintrabajo,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error cargando el detalle del incidente' });
    }
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      // Sin trabajador seleccionado se debe enviar null: la columna tiene clave foránea a workers.
      const payload = { ...form, trabajador_id: form.trabajador_id || null };
      if (selectedIncident) {
        await api.put(`/incidents/${selectedIncident.id}`, payload);
        _showMessage('success', 'Incidente actualizado correctamente');
      } else {
        await api.post('/incidents', payload);
        _showMessage('success', 'Incidente registrado correctamente');
        setForm(INITIAL_FORM);
      }
      loadIncidents();
    } catch (err: any) {
      _showMessage('error', err.message || 'Error guardando incidente');
    } finally {
      setLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = { ...actionForm, incident_id: selectedIncident!.id };
      if (editingAction) {
        await (api.put as (path: string, body?: any) => Promise<any>)(
          `/incidents/${selectedIncident!.id}/actions/${editingAction.id}`,
          payload
        );
        _showMessage('success', 'Acción actualizada correctamente');
      } else {
        await (api.post as (path: string, body?: any) => Promise<any>)(
          `/incidents/${selectedIncident!.id}/actions`,
          payload
        );
        _showMessage('success', 'Acción registrada correctamente');
      }
      setActionForm(INITIAL_ACTION);
      setEditingAction(null);
      setCreatingAction(false);
      loadIncidentDetails(selectedIncident!.id);
    } catch (err: any) {
      _showMessage('error', err.message || 'Error guardando acción');
    } finally {
      setLoading(false);
    }
  };

  const handleActionComplete = async (actionId: string) => {
    try {
      await (api.put as (path: string, body?: any) => Promise<any>)(
        `/incidents/${selectedIncident!.id}/actions/${actionId}`,
        { estado: 'completada', completada_en: new Date().toISOString() }
      );
      loadIncidentDetails(selectedIncident!.id);
    } catch (err: any) {
      _showMessage('error', err.message || 'Error completando acción');
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('Eliminar esta acción correctiva?')) return;
    try {
      await (api.del as (path: string) => Promise<any>)(
        `/incidents/${selectedIncident!.id}/actions/${actionId}`
      );
      loadIncidentDetails(selectedIncident!.id);
    } catch (err: any) {
      _showMessage('error', err.message || 'Error eliminando acción');
    }
  };

  const openIncident = (inc: Incident) => {
    setActiveTab('investigacion');
    loadIncidentDetails(inc.id);
  };

  const newIncident = () => {
    setSelectedIncident(null);
    setForm(INITIAL_FORM);
    setActiveTab('registro');
  };

  const getArlDeadlineDisplay = (inc: Incident) => {
    if (!inc.fecha_ocurrencia) return null;
    const deadline = getArlDeadline(inc.fecha_ocurrencia);
    const completed = !!inc.reporte_arl;
    const status = getDeadlineStatus(deadline, completed);
    return { deadline, status };
  };

  const _showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const kpis = [
    { label: 'Total incidentes', value: incidents.length },
    {
      label: 'En investigación',
      value: incidents.filter((i) => i.estado === 'investigando').length,
    },
    { label: 'Cerrados', value: incidents.filter((i) => i.estado === 'cerrado').length },
    { label: 'Abiertos', value: incidents.filter((i) => i.estado === 'abierto').length },
  ];

  const reportado = (valor: boolean) =>
    valor ? (
      <span className="incidentes-reportado">
        <Check aria-hidden="true" size={16} />
        Reportado
      </span>
    ) : (
      <span className="incidentes-pendiente">
        <X aria-hidden="true" size={16} />
        Pendiente
      </span>
    );

  return (
    <div className="ui-page incidentes-page">
      <header className="ui-page-header incidentes-page-header">
        <div>
          <h1 className="ui-page-title">
            Reporte e Investigación de Incidentes y Accidentes de Trabajo
          </h1>
          <p className="ui-page-description">
            Registro, investigación de causas, acciones correctivas y seguimiento de los plazos de
            reporte a ARL, EPS y MinTrabajo.
          </p>
        </div>
        <button className="ui-primary-button" onClick={newIncident} type="button">
          <FileText aria-hidden="true" size={18} />
          Nuevo reporte
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

      <div aria-label="Secciones de incidentes" className="ui-tabs incidentes-tabs" role="tablist">
        {[
          { id: 'registro' as const, label: 'Registro', icon: FileText },
          { id: 'investigacion' as const, label: 'Investigación', icon: Search },
          { id: 'acciones' as const, label: 'Acciones correctivas', icon: ClipboardList },
          { id: 'seguimiento' as const, label: 'Seguimiento', icon: BarChart3 },
        ].map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            aria-controls={activeTab === tab.id ? `incidentes-panel-${tab.id}` : undefined}
            className="ui-tab"
            disabled={tab.id === 'investigacion' && !selectedIncident}
            id={`incidentes-tab-${tab.id}`}
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

      {activeTab === 'registro' && (
        <section
          aria-labelledby="incidentes-tab-registro"
          className="incidentes-tab-panel"
          id="incidentes-panel-registro"
          role="tabpanel"
          tabIndex={0}
        >
          <section aria-labelledby="incidentes-form-title" className="ui-surface incidentes-form">
            <h2 id="incidentes-form-title" className="incidentes-form-title">
              Nuevo reporte de incidente o accidente
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="ui-form-grid">
                <div>
                  <label className="ui-field-label" htmlFor="inc-tipo">
                    Tipo *
                  </label>
                  <select
                    id="inc-tipo"
                    value={form.tipo}
                    onChange={(e) => handleInputChange('tipo', e.target.value)}
                    required
                  >
                    <option value="incidente">Incidente (sin lesión)</option>
                    <option value="accidente">Accidente de trabajo (con lesión)</option>
                    <option value="enfermedad_laboral">Enfermedad laboral</option>
                  </select>
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="inc-fecha">
                    Fecha de ocurrencia *
                  </label>
                  <input
                    id="inc-fecha"
                    type="date"
                    value={form.fecha_ocurrencia}
                    onChange={(e) => handleInputChange('fecha_ocurrencia', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="inc-lugar">
                    Lugar
                  </label>
                  <input
                    id="inc-lugar"
                    value={form.lugar}
                    onChange={(e) => handleInputChange('lugar', e.target.value)}
                    placeholder="Ej: Planta 2, fachada norte, vehículo placa XXX"
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="inc-trabajador">
                    Trabajador afectado
                  </label>
                  <select
                    id="inc-trabajador"
                    value={form.trabajador_id}
                    onChange={(e) => handleInputChange('trabajador_id', e.target.value)}
                  >
                    <option value="">— Seleccionar —</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nombres} {w.apellidos} ({w.numero_documento})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="inc-dias">
                    Días perdidos / incapacidad
                  </label>
                  <input
                    id="inc-dias"
                    type="number"
                    min="0"
                    value={form.dias_perdidos}
                    onChange={(e) =>
                      handleInputChange('dias_perdidos', parseInt(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className="ui-field-label" htmlFor="inc-investigador">
                    Investigador responsable
                  </label>
                  <input
                    id="inc-investigador"
                    value={form.investigador}
                    onChange={(e) => handleInputChange('investigador', e.target.value)}
                    placeholder="Nombre del responsable de la investigación"
                  />
                </div>
                <div className="incidentes-span-2">
                  <label className="ui-field-label" htmlFor="inc-desc">
                    Descripción del suceso *
                  </label>
                  <textarea
                    id="inc-desc"
                    value={form.descripcion}
                    onChange={(e) => handleInputChange('descripcion', e.target.value)}
                    placeholder="Describa qué ocurrió, cómo ocurrió y las condiciones del entorno"
                    required
                  />
                </div>
                <div className="incidentes-span-2">
                  <label className="ui-field-label" htmlFor="inc-lesiones">
                    Lesiones / afectación a la salud
                  </label>
                  <textarea
                    id="inc-lesiones"
                    value={form.lesiones}
                    onChange={(e) => handleInputChange('lesiones', e.target.value)}
                    placeholder="Describa lesiones, parte del cuerpo afectada y gravedad"
                  />
                </div>
                <div className="incidentes-span-2">
                  <label className="ui-field-label" htmlFor="inc-causa">
                    Análisis de causa raíz (5 porqués, árbol de causas, etc.)
                  </label>
                  <textarea
                    id="inc-causa"
                    value={form.causa_raiz}
                    onChange={(e) => handleInputChange('causa_raiz', e.target.value)}
                    placeholder="Describa el análisis de causa raíz realizado"
                  />
                </div>
                <div className="incidentes-span-2">
                  <label className="ui-field-label" htmlFor="inc-acciones">
                    Acciones correctivas inmediatas tomadas
                  </label>
                  <textarea
                    id="inc-acciones"
                    value={form.acciones_correctivas}
                    onChange={(e) => handleInputChange('acciones_correctivas', e.target.value)}
                    placeholder="Describa las medidas inmediatas para evitar recurrencia"
                  />
                </div>
                <div className="incidentes-span-2">
                  <span className="ui-field-label">Reportes legales</span>
                  <div className="incidentes-checks">
                    <label className="incidentes-check" htmlFor="inc-reporte-arl">
                      <input
                        id="inc-reporte-arl"
                        type="checkbox"
                        checked={form.reporte_arl}
                        onChange={(e) => handleInputChange('reporte_arl', e.target.checked)}
                      />
                      Reporte a ARL (plazo: 2 días hábiles, Decreto 1072/2015 Art. 2.2.4.6.22)
                    </label>
                    <label className="incidentes-check" htmlFor="inc-reporte-eps">
                      <input
                        id="inc-reporte-eps"
                        type="checkbox"
                        checked={form.reporte_eps}
                        onChange={(e) => handleInputChange('reporte_eps', e.target.checked)}
                      />
                      Reporte a EPS (atención médica inmediata)
                    </label>
                    <label className="incidentes-check" htmlFor="inc-reporte-mintrabajo">
                      <input
                        id="inc-reporte-mintrabajo"
                        type="checkbox"
                        checked={form.reporte_mintrabajo}
                        onChange={(e) => handleInputChange('reporte_mintrabajo', e.target.checked)}
                      />
                      Reporte a MinTrabajo (accidentes graves o mortales, Art. 2.2.4.6.23)
                    </label>
                  </div>
                </div>
              </div>
              <div className="ui-form-actions">
                <button type="button" className="ui-action-button" onClick={newIncident}>
                  Limpiar
                </button>
                <button type="submit" className="ui-primary-button" disabled={loading}>
                  {loading ? 'Guardando...' : 'Registrar incidente'}
                </button>
              </div>
            </form>
          </section>

          <details className="incidentes-plazos">
            <summary>Plazos legales de reporte (Colombia)</summary>
            <div className="incidentes-plazos-body">
              <strong>Decreto 1072/2015 (Art. 2.2.4.6.22 y 2.2.4.6.23) - Res. 0312/2019:</strong>
              <ul>
                <li>
                  <strong>ARL:</strong> reporte dentro de los <strong>2 días hábiles</strong>{' '}
                  siguientes al accidente (Art. 2.2.4.6.22).
                </li>
                <li>
                  <strong>EPS:</strong> atención médica inmediata y reporte simultáneo.
                </li>
                <li>
                  <strong>Ministerio del Trabajo:</strong> accidentes graves y mortales dentro de
                  las <strong>24 horas</strong> (Art. 2.2.4.6.23).
                </li>
                <li>
                  <strong>Enfermedades laborales:</strong> reporte a ARL y EPS dentro de{' '}
                  <strong>2 días hábiles</strong> tras el diagnóstico.
                </li>
              </ul>
              <p>
                Los días hábiles excluyen sábados, domingos y festivos. El plazo inicia al día
                siguiente de la ocurrencia.
              </p>
            </div>
          </details>
        </section>
      )}

      {activeTab === 'investigacion' && (
        <section
          aria-labelledby="incidentes-tab-investigacion"
          className="incidentes-tab-panel"
          id="incidentes-panel-investigacion"
          role="tabpanel"
          tabIndex={0}
        >
          {!selectedIncident ? (
            <p className="ui-empty">
              Seleccione un incidente en la pestaña Seguimiento o cree uno nuevo en Registro para
              iniciar la investigación.
            </p>
          ) : (
            <>
              <div className="incidentes-detalle-header">
                <div>
                  <h2 className="incidentes-section-title">
                    {TIPO_LABELS[selectedIncident.tipo]} -{' '}
                    {selectedIncident.codigo || selectedIncident.id.slice(0, 8)}
                  </h2>
                  <p className="ui-page-description">
                    Fecha de ocurrencia: {formatDate(selectedIncident.fecha_ocurrencia)}
                  </p>
                </div>
                <span className="ui-badge">{ESTADO_LABELS[selectedIncident.estado]}</span>
              </div>

              <section
                aria-labelledby="incidentes-detalle-title"
                className="ui-surface incidentes-form"
              >
                <h3 id="incidentes-detalle-title" className="incidentes-form-title">
                  Detalle del incidente
                </h3>
                <form onSubmit={handleSubmit}>
                  <div className="ui-form-grid">
                    <div>
                      <label className="ui-field-label" htmlFor="inc-tipo">
                        Tipo
                      </label>
                      <select
                        id="inc-tipo"
                        value={form.tipo}
                        onChange={(e) => handleInputChange('tipo', e.target.value)}
                      >
                        <option value="incidente">Incidente</option>
                        <option value="accidente">Accidente</option>
                        <option value="enfermedad_laboral">Enfermedad laboral</option>
                      </select>
                    </div>
                    <div>
                      <label className="ui-field-label" htmlFor="inc-fecha">
                        Fecha de ocurrencia
                      </label>
                      <input
                        id="inc-fecha"
                        type="date"
                        value={form.fecha_ocurrencia}
                        onChange={(e) => handleInputChange('fecha_ocurrencia', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="ui-field-label" htmlFor="inc-lugar">
                        Lugar
                      </label>
                      <input
                        id="inc-lugar"
                        value={form.lugar}
                        onChange={(e) => handleInputChange('lugar', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ui-field-label" htmlFor="inc-estado">
                        Estado
                      </label>
                      <select
                        id="inc-estado"
                        value={form.estado}
                        onChange={(e) => handleInputChange('estado', e.target.value)}
                      >
                        {Object.entries(ESTADO_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="ui-field-label" htmlFor="inc-investigador">
                        Investigador
                      </label>
                      <input
                        id="inc-investigador"
                        value={form.investigador}
                        onChange={(e) => handleInputChange('investigador', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="ui-field-label" htmlFor="inc-dias">
                        Días perdidos
                      </label>
                      <input
                        id="inc-dias"
                        type="number"
                        min="0"
                        value={form.dias_perdidos}
                        onChange={(e) =>
                          handleInputChange('dias_perdidos', parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="incidentes-span-2">
                      <label className="ui-field-label" htmlFor="inc-descripcion">
                        Descripción
                      </label>
                      <textarea
                        id="inc-descripcion"
                        value={form.descripcion}
                        onChange={(e) => handleInputChange('descripcion', e.target.value)}
                        required
                      />
                    </div>
                    <div className="incidentes-span-2">
                      <label className="ui-field-label" htmlFor="inc-lesiones">
                        Lesiones
                      </label>
                      <textarea
                        id="inc-lesiones"
                        value={form.lesiones}
                        onChange={(e) => handleInputChange('lesiones', e.target.value)}
                      />
                    </div>
                    <div className="incidentes-span-2">
                      <label className="ui-field-label" htmlFor="inc-causa">
                        Análisis de causa raíz
                      </label>
                      <textarea
                        id="inc-causa"
                        value={form.causa_raiz}
                        onChange={(e) => handleInputChange('causa_raiz', e.target.value)}
                      />
                    </div>
                    <div className="incidentes-span-2">
                      <label className="ui-field-label" htmlFor="inc-acciones">
                        Acciones correctivas
                      </label>
                      <textarea
                        id="inc-acciones"
                        value={form.acciones_correctivas}
                        onChange={(e) => handleInputChange('acciones_correctivas', e.target.value)}
                      />
                    </div>
                    <div className="incidentes-span-2">
                      <span className="ui-field-label">Reportes legales</span>
                      <div className="incidentes-checks">
                        <label className="incidentes-check" htmlFor="inc-reporte-arl">
                          <input
                            id="inc-reporte-arl"
                            type="checkbox"
                            checked={form.reporte_arl}
                            onChange={(e) => handleInputChange('reporte_arl', e.target.checked)}
                          />
                          Reporte ARL (2 días hábiles)
                        </label>
                        <label className="incidentes-check" htmlFor="inc-reporte-eps">
                          <input
                            id="inc-reporte-eps"
                            type="checkbox"
                            checked={form.reporte_eps}
                            onChange={(e) => handleInputChange('reporte_eps', e.target.checked)}
                          />
                          Reporte EPS
                        </label>
                        <label className="incidentes-check" htmlFor="inc-reporte-mintrabajo">
                          <input
                            id="inc-reporte-mintrabajo"
                            type="checkbox"
                            checked={form.reporte_mintrabajo}
                            onChange={(e) =>
                              handleInputChange('reporte_mintrabajo', e.target.checked)
                            }
                          />
                          Reporte MinTrabajo (graves o mortales)
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="ui-form-actions">
                    <button type="submit" className="ui-primary-button" disabled={loading}>
                      {loading ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </form>
              </section>

              {selectedIncident.fecha_ocurrencia && (
                <section
                  aria-labelledby="incidentes-plazos-title"
                  className="ui-surface incidentes-plazos-card"
                >
                  <h3 id="incidentes-plazos-title" className="incidentes-form-title">
                    Plazos legales de reporte
                  </h3>
                  <div className="incidentes-plazos-grid">
                    <div className="incidentes-plazo incidentes-plazo--arl">
                      <span className="incidentes-plazo-title">
                        Reporte ARL (Decreto 1072/2015 Art. 2.2.4.6.22)
                      </span>
                      <strong>
                        {getArlDeadlineDisplay(selectedIncident)?.deadline
                          ? formatDate(getArlDeadlineDisplay(selectedIncident)!.deadline)
                          : '—'}
                      </strong>
                      <span
                        style={{ color: getArlDeadlineDisplay(selectedIncident)?.status.color }}
                      >
                        {getArlDeadlineDisplay(selectedIncident)?.status.label}
                      </span>
                      <span className="incidentes-plazo-nota">
                        Plazo: 2 días hábiles desde la ocurrencia (
                        {formatDate(selectedIncident.fecha_ocurrencia)})
                      </span>
                      <label className="incidentes-check" htmlFor="marca-arl">
                        <input
                          id="marca-arl"
                          type="checkbox"
                          checked={selectedIncident.reporte_arl}
                          onChange={() =>
                            handleInputChange('reporte_arl', !selectedIncident.reporte_arl)
                          }
                        />
                        Marcar como reportado
                      </label>
                    </div>
                    <div className="incidentes-plazo incidentes-plazo--eps">
                      <span className="incidentes-plazo-title">
                        Reporte EPS (atención médica inmediata)
                      </span>
                      <strong>Inmediato / día de ocurrencia</strong>
                      <span className="incidentes-plazo-nota">
                        El trabajador debe ser remitido a la EPS de inmediato para atención médica.
                      </span>
                      <label className="incidentes-check" htmlFor="marca-eps">
                        <input
                          id="marca-eps"
                          type="checkbox"
                          checked={selectedIncident.reporte_eps}
                          onChange={() =>
                            handleInputChange('reporte_eps', !selectedIncident.reporte_eps)
                          }
                        />
                        Marcar como reportado
                      </label>
                    </div>
                    <div className="incidentes-plazo incidentes-plazo--mintrabajo">
                      <span className="incidentes-plazo-title">
                        Reporte MinTrabajo (Decreto 1072/2015 Art. 2.2.4.6.23)
                      </span>
                      <strong>24 horas (accidentes graves o mortales)</strong>
                      <span className="incidentes-plazo-nota">
                        Solo para accidentes graves (hospitalización &gt;24 h, amputación, pérdida
                        de conciencia, etc.) o mortales.
                      </span>
                      <label className="incidentes-check" htmlFor="marca-mintrabajo">
                        <input
                          id="marca-mintrabajo"
                          type="checkbox"
                          checked={selectedIncident.reporte_mintrabajo}
                          onChange={() =>
                            handleInputChange(
                              'reporte_mintrabajo',
                              !selectedIncident.reporte_mintrabajo
                            )
                          }
                        />
                        Marcar como reportado
                      </label>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'acciones' && (
        <section
          aria-labelledby="incidentes-tab-acciones"
          className="incidentes-tab-panel"
          id="incidentes-panel-acciones"
          role="tabpanel"
          tabIndex={0}
        >
          {!selectedIncident ? (
            <p className="ui-empty">
              Seleccione un incidente en la pestaña Seguimiento para gestionar sus acciones
              correctivas.
            </p>
          ) : (
            <>
              <div className="incidentes-detalle-header">
                <h2 className="incidentes-section-title">
                  Acciones correctivas y preventivas - {TIPO_LABELS[selectedIncident.tipo]}
                </h2>
                <button
                  className="ui-primary-button"
                  onClick={() => {
                    setEditingAction(null);
                    setCreatingAction(true);
                    setActionForm({
                      ...INITIAL_ACTION,
                      incident_id: selectedIncident!.id,
                      fecha_limite: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                    });
                  }}
                  type="button"
                >
                  <ClipboardList aria-hidden="true" size={18} />
                  Nueva acción
                </button>
              </div>

              {(editingAction || creatingAction) && (
                <section
                  aria-labelledby="incidentes-action-form-title"
                  className="ui-surface incidentes-form"
                >
                  <h3 id="incidentes-action-form-title" className="incidentes-form-title">
                    {editingAction ? 'Editar acción correctiva' : 'Nueva acción correctiva'}
                  </h3>
                  <form onSubmit={handleActionSubmit}>
                    <div className="ui-form-grid">
                      <div>
                        <label className="ui-field-label" htmlFor="action-responsable">
                          Responsable *
                        </label>
                        <input
                          id="action-responsable"
                          value={actionForm.responsable}
                          onChange={(e) =>
                            setActionForm({ ...actionForm, responsable: e.target.value })
                          }
                          placeholder="Nombre del responsable"
                          required
                        />
                      </div>
                      <div>
                        <label className="ui-field-label" htmlFor="action-fecha">
                          Fecha límite *
                        </label>
                        <input
                          id="action-fecha"
                          type="date"
                          value={actionForm.fecha_limite}
                          onChange={(e) =>
                            setActionForm({ ...actionForm, fecha_limite: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="ui-field-label" htmlFor="action-estado">
                          Estado
                        </label>
                        <select
                          id="action-estado"
                          value={actionForm.estado}
                          onChange={(e) =>
                            setActionForm({
                              ...actionForm,
                              estado: e.target.value as CorrectiveAction['estado'],
                            })
                          }
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="en_proceso">En proceso</option>
                          <option value="completada">Completada</option>
                        </select>
                      </div>
                      <div>
                        <label className="ui-field-label" htmlFor="action-evidencia">
                          Evidencia (URL)
                        </label>
                        <input
                          id="action-evidencia"
                          value={actionForm.evidencia_url || ''}
                          onChange={(e) =>
                            setActionForm({ ...actionForm, evidencia_url: e.target.value })
                          }
                          placeholder="URL de evidencia (foto, documento, etc.)"
                        />
                      </div>
                      <div className="incidentes-span-2">
                        <label className="ui-field-label" htmlFor="action-descripcion">
                          Descripción de la acción *
                        </label>
                        <textarea
                          id="action-descripcion"
                          value={actionForm.descripcion}
                          onChange={(e) =>
                            setActionForm({ ...actionForm, descripcion: e.target.value })
                          }
                          placeholder="Describa la acción correctiva o preventiva a implementar"
                          required
                        />
                      </div>
                    </div>
                    <div className="ui-form-actions">
                      <button
                        type="button"
                        className="ui-action-button"
                        onClick={() => {
                          setEditingAction(null);
                          setCreatingAction(false);
                          setActionForm(INITIAL_ACTION);
                        }}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="ui-primary-button" disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar acción'}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              <section aria-label="Acciones correctivas del incidente">
                <div className="ui-surface ui-table-wrap">
                  <table className="ui-table incidentes-table">
                    <thead>
                      <tr>
                        <th scope="col">Acción</th>
                        <th scope="col">Responsable</th>
                        <th scope="col">Fecha límite</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Evidencia</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="ui-empty">
                            No hay acciones correctivas registradas. Use el botón Nueva acción para
                            agregar la primera.
                          </td>
                        </tr>
                      ) : (
                        actions.map((a) => {
                          const completed = a.estado === 'completada';
                          const deadlineStatus = getDeadlineStatus(a.fecha_limite, completed);
                          return (
                            <tr key={a.id}>
                              <td>
                                <strong>{a.descripcion}</strong>
                                {a.evidencia_url && (
                                  <div>
                                    <a
                                      href={a.evidencia_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Ver evidencia
                                    </a>
                                  </div>
                                )}
                              </td>
                              <td>{a.responsable}</td>
                              <td>
                                <div>{formatDate(a.fecha_limite)}</div>
                                <span
                                  className="incidentes-deadline"
                                  style={{ color: deadlineStatus.color }}
                                >
                                  {deadlineStatus.label}
                                </span>
                              </td>
                              <td>
                                <span className="ui-badge">{ACCION_ESTADO_LABELS[a.estado]}</span>
                              </td>
                              <td>
                                {a.evidencia_url ? (
                                  <a
                                    className="ui-action-button"
                                    href={a.evidencia_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Ver
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>
                                <div className="ui-row-actions">
                                  {!completed && (
                                    <button
                                      type="button"
                                      className="ui-icon-button ui-icon-button--check"
                                      onClick={() => handleActionComplete(a.id)}
                                    >
                                      Completar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="ui-icon-button ui-icon-button--edit"
                                    onClick={() => {
                                      setEditingAction(a);
                                      setCreatingAction(false);
                                      setActionForm({ ...INITIAL_ACTION, ...a });
                                    }}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="ui-icon-button ui-icon-button--delete"
                                    onClick={() => handleDeleteAction(a.id)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="ui-mobile-list">
                  {actions.length === 0 && (
                    <p className="ui-empty">No hay acciones correctivas registradas.</p>
                  )}
                  {actions.map((a) => {
                    const completed = a.estado === 'completada';
                    const deadlineStatus = getDeadlineStatus(a.fecha_limite, completed);
                    return (
                      <article className="ui-surface ui-mobile-card" key={a.id}>
                        <header className="ui-mobile-card-header">
                          <div>
                            <h2>{a.descripcion}</h2>
                          </div>
                          <span className="ui-badge">{ACCION_ESTADO_LABELS[a.estado]}</span>
                        </header>
                        <dl className="ui-mobile-details">
                          <div>
                            <dt>Responsable</dt>
                            <dd>{a.responsable}</dd>
                          </div>
                          <div>
                            <dt>Fecha límite</dt>
                            <dd>{formatDate(a.fecha_limite)}</dd>
                          </div>
                          <div>
                            <dt>Estado del plazo</dt>
                            <dd style={{ color: deadlineStatus.color }}>{deadlineStatus.label}</dd>
                          </div>
                          <div>
                            <dt>Evidencia</dt>
                            <dd>{a.evidencia_url ? 'Disponible' : '—'}</dd>
                          </div>
                        </dl>
                        <div className="ui-mobile-actions">
                          {!completed && (
                            <button
                              type="button"
                              className="ui-icon-button ui-icon-button--check"
                              onClick={() => handleActionComplete(a.id)}
                            >
                              Completar
                            </button>
                          )}
                          <button
                            type="button"
                            className="ui-icon-button ui-icon-button--edit"
                            onClick={() => {
                              setEditingAction(a);
                              setActionForm({ ...INITIAL_ACTION, ...a });
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="ui-icon-button ui-icon-button--delete"
                            onClick={() => handleDeleteAction(a.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </section>
      )}

      {activeTab === 'seguimiento' && (
        <section
          aria-labelledby="incidentes-tab-seguimiento"
          className="incidentes-tab-panel"
          id="incidentes-panel-seguimiento"
          role="tabpanel"
          tabIndex={0}
        >
          <section aria-label="Resumen de incidentes" className="ui-kpi-grid">
            {kpis.map((k) => (
              <div className="ui-kpi" key={k.label}>
                <span className="ui-kpi-label">{k.label}</span>
                <span className="ui-kpi-value">{k.value}</span>
              </div>
            ))}
          </section>

          <section aria-label="Incidentes registrados">
            <div className="ui-surface ui-table-wrap">
              <table className="ui-table incidentes-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Descripción</th>
                    <th scope="col">Estado</th>
                    <th scope="col">ARL</th>
                    <th scope="col">EPS</th>
                    <th scope="col">MinTrabajo</th>
                    <th scope="col">Días perdidos</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((x) => (
                    <tr key={x.id}>
                      <td>{formatDate(x.fecha_ocurrencia)}</td>
                      <td>{TIPO_LABELS[x.tipo]}</td>
                      <td className="incidentes-descripcion">{x.descripcion}</td>
                      <td>
                        <span className="ui-badge">{ESTADO_LABELS[x.estado]}</span>
                      </td>
                      <td>{reportado(x.reporte_arl)}</td>
                      <td>{reportado(x.reporte_eps)}</td>
                      <td>{reportado(x.reporte_mintrabajo)}</td>
                      <td>{x.dias_perdidos}</td>
                      <td>
                        <button
                          type="button"
                          className="ui-icon-button"
                          onClick={() => openIncident(x)}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                  {incidents.length === 0 && (
                    <tr>
                      <td colSpan={9} className="ui-empty">
                        No hay incidentes registrados. Use la pestaña Registro para crear el
                        primero.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ui-mobile-list">
              {incidents.length === 0 && <p className="ui-empty">No hay incidentes registrados.</p>}
              {incidents.map((x) => (
                <article className="ui-surface ui-mobile-card" key={x.id}>
                  <header className="ui-mobile-card-header">
                    <div>
                      <h2>{TIPO_LABELS[x.tipo]}</h2>
                      <p>{formatDate(x.fecha_ocurrencia)}</p>
                    </div>
                    <span className="ui-badge">{ESTADO_LABELS[x.estado]}</span>
                  </header>
                  <p className="incidentes-card-descripcion">{x.descripcion}</p>
                  <dl className="ui-mobile-details">
                    <div>
                      <dt>Reporte ARL</dt>
                      <dd>{reportado(x.reporte_arl)}</dd>
                    </div>
                    <div>
                      <dt>Reporte EPS</dt>
                      <dd>{reportado(x.reporte_eps)}</dd>
                    </div>
                    <div>
                      <dt>Reporte MinTrabajo</dt>
                      <dd>{reportado(x.reporte_mintrabajo)}</dd>
                    </div>
                    <div>
                      <dt>Días perdidos</dt>
                      <dd>{x.dias_perdidos}</dd>
                    </div>
                  </dl>
                  <div className="ui-mobile-actions">
                    <button
                      type="button"
                      className="ui-icon-button"
                      onClick={() => openIncident(x)}
                    >
                      Ver detalle
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
