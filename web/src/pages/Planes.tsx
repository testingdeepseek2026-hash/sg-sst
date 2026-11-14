import { useCallback, useEffect, useState } from 'react';

import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  GraduationCap,
  ListChecks,
  Paperclip,
  PenLine,
  RefreshCw,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { SignaturePad } from '@/components/SignaturePad';

import { api } from '../lib/api';

interface AnnualActivity {
  id?: string;
  anio: number;
  objetivo: string;
  meta?: string;
  responsable?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  presupuesto?: number;
  estado: 'pendiente' | 'en_proceso' | 'cumplido' | 'incumplido';
  programa?: string | null;
  evidencia_esperada?: string | null;
  meses?: number[] | null;
  creado_en?: string;
  actualizado_en?: string;
}

interface PlanEvidence {
  id: string;
  plan_id: string;
  url: string;
  nombre_original: string;
  mime?: string | null;
  tamano?: number | null;
  subido_por?: string | null;
  creado_en: string;
}

const MESES_ABREVIATURA = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

/** El backend guarda el cronograma mensual como JSON (texto); en pantalla es number[]. */
function parseMeses(valor: unknown): number[] {
  if (Array.isArray(valor)) return valor.map(Number);
  if (typeof valor === 'string' && valor.trim()) {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function agruparEvidencias(lista: PlanEvidence[]): Record<string, PlanEvidence[]> {
  const grupos: Record<string, PlanEvidence[]> = {};
  for (const evidencia of lista) {
    (grupos[evidencia.plan_id] ??= []).push(evidencia);
  }
  return grupos;
}

interface TrainingSchedule {
  id?: string;
  nombre: string;
  tipo: string;
  fecha: string;
  duracion_horas?: number;
  responsable?: string;
  objetivo?: string;
  estado: 'programada' | 'realizada' | 'cancelada';
  creado_en?: string;
}

export default function Planes() {
  const [activeTab, setActiveTab] = useState<'planes' | 'capacitacion' | 'ejecucion'>('planes');
  const [plans, setPlans] = useState<AnnualActivity[]>([]);
  const [evidencias, setEvidencias] = useState<Record<string, PlanEvidence[]>>({});

  // Estado de importación masiva desde Excel
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importConfirmando, setImportConfirmando] = useState(false);
  const [trainings, setTrainings] = useState<TrainingSchedule[]>([]);
  const [executions, setExecutions] = useState<TrainingExecution[]>([]);
  const [workers, setWorkers] = useState<WorkerSimple[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state - includes id for edit mode
  const [planForm, setPlanForm] = useState<AnnualActivity>({
    id: '',
    anio: new Date().getFullYear(),
    objetivo: '',
    meta: '',
    responsable: '',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: '',
    presupuesto: 0,
    estado: 'pendiente',
    programa: '',
    evidencia_esperada: '',
    meses: [],
    creado_en: undefined,
    actualizado_en: undefined,
  });

  const [trainingForm, setTrainingForm] = useState<TrainingSchedule>({
    id: '',
    nombre: '',
    tipo: 'capacitacion',
    fecha: new Date().toISOString().slice(0, 10),
    duracion_horas: 1,
    responsable: '',
    objetivo: '',
    estado: 'programada',
    creado_en: undefined,
  });

  const [executionForm, setExecutionForm] = useState<TrainingExecution>({
    id: '',
    schedule_id: '',
    nombre: '',
    fecha: new Date().toISOString().slice(0, 10),
    instructor: '',
    archivo_evidencia: '',
    estado: 'programada',
    creado_en: undefined,
  });

  const [selectedExecution, setSelectedExecution] = useState<TrainingExecution | null>(null);
  const [attendance, setAttendance] = useState<TrainingAttendance[]>([]);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<TrainingAttendance | null>(null);

  // Filters
  const [planFilterEstado, setPlanFilterEstado] = useState<string>('all');
  const [trainingFilterEstado, setTrainingFilterEstado] = useState<string>('all');
  const [planFilterFecha, setPlanFilterFecha] = useState<string>('');

  // Types
  interface TrainingExecution {
    id?: string;
    schedule_id?: string;
    nombre: string;
    fecha: string;
    instructor?: string;
    archivo_evidencia?: string;
    estado: 'programada' | 'realizada' | 'cancelada';
    creado_en?: string;
    schedule_nombre?: string;
    schedule_tipo?: string;
  }

  interface TrainingAttendance {
    id: string;
    training_id: string;
    worker_id: string;
    firmado: number;
    firma_url?: string;
    nombres: string;
    apellidos: string;
    numero_documento: string;
    cargo: string;
  }

  interface WorkerSimple {
    id: string;
    nombres: string;
    apellidos: string;
    numero_documento: string;
    cargo: string;
    estado: string;
  }

  const recargarEvidencias = useCallback(async () => {
    const lista = (await api.get('/plans/annual/evidencias')) as PlanEvidence[];
    setEvidencias(agruparEvidencias(lista));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [plansData, trainingData, executionsData, workersData] = await Promise.all([
        api.get('/plans/annual'),
        api.get('/plans/training'),
        api.get('/plans/trainings'),
        api.get('/workers'),
      ]);
      setPlans((plansData as AnnualActivity[]).map((p) => ({ ...p, meses: parseMeses(p.meses) })));
      setTrainings(trainingData as TrainingSchedule[]);
      setExecutions(executionsData as TrainingExecution[]);
      setWorkers((workersData as WorkerSimple[]).filter((w) => w.estado === 'activo'));
      await recargarEvidencias();
    } catch (err: any) {
      console.error('Error cargando datos:', err);
      setMessage({ type: 'error', text: err.message || 'Error cargando datos' });
    } finally {
      setLoading(false);
    }
  }, [recargarEvidencias]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Plan handlers
  const handlePlanSave = async () => {
    if (!planForm.objetivo.trim()) {
      setMessage({ type: 'error', text: 'El objetivo es requerido' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      if (planForm.id) {
        // Editar plan existente
        await api.put(`/plans/annual/${planForm.id}`, {
          objetivo: planForm.objetivo,
          meta: planForm.meta,
          responsable: planForm.responsable,
          fecha_inicio: planForm.fecha_inicio,
          fecha_fin: planForm.fecha_fin,
          presupuesto: planForm.presupuesto,
          estado: planForm.estado,
          programa: planForm.programa,
          evidencia_esperada: planForm.evidencia_esperada,
          meses: planForm.meses,
        });
        setMessage({ type: 'success', text: 'Plan actualizado correctamente' });
      } else {
        // Crear nuevo plan
        await api.post('/plans/annual', planForm);
        setMessage({ type: 'success', text: 'Actividad agregada correctamente' });
      }

      setPlanForm({
        anio: new Date().getFullYear(),
        objetivo: '',
        meta: '',
        responsable: '',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: '',
        presupuesto: 0,
        estado: 'pendiente',
        programa: '',
        evidencia_esperada: '',
        meses: [],
      });

      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando plan' });
    } finally {
      setLoading(false);
    }
  };

  const handlePlanDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta actividad?')) return;
    try {
      setLoading(true);
      await api.del(`/plans/annual/${id}`);
      setMessage({ type: 'success', text: 'Actividad eliminada' });
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error eliminando plan' });
    } finally {
      setLoading(false);
    }
  };

  const openPlanEdit = (plan?: AnnualActivity) => {
    if (plan) {
      setPlanForm({
        id: plan.id,
        anio: plan.anio,
        objetivo: plan.objetivo,
        meta: plan.meta || '',
        responsable: plan.responsable || '',
        fecha_inicio: plan.fecha_inicio || '',
        fecha_fin: plan.fecha_fin || '',
        presupuesto: plan.presupuesto || 0,
        estado: plan.estado,
        programa: plan.programa || '',
        evidencia_esperada: plan.evidencia_esperada || '',
        meses: parseMeses(plan.meses),
      });
      setActiveTab('planes');
    } else {
      setPlanForm({
        anio: new Date().getFullYear(),
        objetivo: '',
        meta: '',
        responsable: '',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: '',
        presupuesto: 0,
        estado: 'pendiente',
        programa: '',
        evidencia_esperada: '',
        meses: [],
      });
    }
  };

  const handleEvidenciaUpload = async (planId: string, archivo: File | null) => {
    if (!archivo) return;
    try {
      setLoading(true);
      setMessage(null);
      const formData = new FormData();
      formData.append('file', archivo);
      await api.postFile(`/plans/annual/${planId}/evidencias`, formData);
      setMessage({ type: 'success', text: 'Evidencia adjuntada correctamente' });
      await recargarEvidencias();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error adjuntando evidencia' });
    } finally {
      setLoading(false);
    }
  };

  const handleEvidenciaDelete = async (planId: string, evidId: string) => {
    if (!confirm('¿Eliminar esta evidencia?')) return;
    try {
      await api.del(`/plans/annual/evidencias/${evidId}`);
      setMessage({ type: 'success', text: 'Evidencia eliminada' });
      await recargarEvidencias();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error eliminando evidencia' });
    }
  };

  // ===== IMPORTACIÓN MASIVA DESDE EXCEL =====

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0] ?? null;
    setImportFile(archivo);
    if (archivo) setImportPreview(null);
  };

  const handlePreviewImport = async () => {
    if (!importFile) return;
    try {
      setImportLoading(true);
      setMessage(null);
      const formData = new FormData();
      formData.append('file', importFile);
      const resultado = await api.postFile('/plans/annual/import/preview', formData);
      setImportPreview(resultado);
      setMessage({
        type: 'success',
        text: `Preview listo: ${resultado.validas} actividades válidas, ${resultado.conErrores} con errores`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al previsualizar' });
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview?.filasValidas?.length) return;
    if (!confirm('¿Confirmar importación de las actividades válidas?')) return;
    try {
      setImportConfirmando(true);
      setMessage(null);
      const resultado = await api.post('/plans/annual/import/confirm', {
        filas: importPreview.filasValidas,
      });
      setMessage({
        type: 'success',
        text: `Importación completada: ${resultado.importados} actividades importadas`,
      });
      setImportPreview(null);
      setImportFile(null);
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al importar' });
    } finally {
      setImportConfirmando(false);
    }
  };

  // Training handlers
  const handleTrainingSave = async () => {
    if (!trainingForm.nombre.trim()) {
      setMessage({ type: 'error', text: 'El nombre es requerido' });
      return;
    }
    if (!trainingForm.responsable) {
      setMessage({ type: 'error', text: 'El responsable es requerido' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      await api.post('/plans/training', trainingForm);
      setMessage({ type: 'success', text: 'Capacitación agregada correctamente' });

      setTrainingForm({
        nombre: '',
        tipo: 'capacitacion',
        fecha: new Date().toISOString().slice(0, 10),
        duracion_horas: 1,
        responsable: '',
        objetivo: '',
        estado: 'programada',
      });

      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando capacitación' });
    } finally {
      setLoading(false);
    }
  };

  const handleTrainingDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta capacitación?')) return;
    try {
      setLoading(true);
      await api.del(`/plans/training/${id}`);
      setMessage({ type: 'success', text: 'Capacitación eliminada' });
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error eliminando capacitación' });
    } finally {
      setLoading(false);
    }
  };

  // Execution handlers
  const handleExecutionSave = async () => {
    if (!executionForm.nombre.trim()) {
      setMessage({ type: 'error', text: 'El nombre es requerido' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      if (executionForm.id) {
        await api.put(`/plans/trainings/${executionForm.id}`, {
          schedule_id: executionForm.schedule_id || null,
          nombre: executionForm.nombre,
          fecha: executionForm.fecha,
          instructor: executionForm.instructor,
          archivo_evidencia: executionForm.archivo_evidencia,
          estado: executionForm.estado,
        });
        setMessage({ type: 'success', text: 'Ejecución actualizada correctamente' });
      } else {
        await api.post('/plans/trainings', executionForm);
        setMessage({ type: 'success', text: 'Ejecución agregada correctamente' });
      }

      setExecutionForm({
        id: '',
        schedule_id: '',
        nombre: '',
        fecha: new Date().toISOString().slice(0, 10),
        instructor: '',
        archivo_evidencia: '',
        estado: 'programada',
      });

      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando ejecución' });
    } finally {
      setLoading(false);
    }
  };

  const handleExecutionDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta ejecución?')) return;
    try {
      setLoading(true);
      await api.del(`/plans/trainings/${id}`);
      setMessage({ type: 'success', text: 'Ejecución eliminada' });
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error eliminando ejecución' });
    } finally {
      setLoading(false);
    }
  };

  const openExecutionEdit = (exec: TrainingExecution) => {
    setExecutionForm({
      id: exec.id || '',
      schedule_id: exec.schedule_id || '',
      nombre: exec.nombre,
      fecha: exec.fecha,
      instructor: exec.instructor || '',
      archivo_evidencia: exec.archivo_evidencia || '',
      estado: exec.estado,
    });
    setActiveTab('ejecucion');
  };

  // Attendance handlers
  const loadAttendance = async (trainingId: string) => {
    try {
      const data = await api.get(`/plans/trainings/${trainingId}/attendance`);
      setAttendance(data as TrainingAttendance[]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error cargando asistencia' });
    }
  };

  const openAttendanceModal = (exec: TrainingExecution) => {
    if (!exec.id) return;
    setSelectedExecution(exec);
    loadAttendance(exec.id);
    setAttendanceModalOpen(true);
  };

  const bulkAddAttendance = async (trainingId: string) => {
    try {
      const workerIds = workers.map((w) => w.id);
      await api.post(`/plans/trainings/${trainingId}/attendance/bulk`, { worker_ids: workerIds });
      setMessage({
        type: 'success',
        text: `${workerIds.length} trabajadores agregados a la asistencia`,
      });
      loadAttendance(trainingId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error agregando asistencia masiva' });
    }
  };

  const handleSaveSignature = async (dataUrl: string) => {
    if (!editingAttendance) return;
    try {
      await api.put(`/plans/trainings/attendance/${editingAttendance.id}`, {
        firmado: 1,
        firma_url: dataUrl,
      });
      setMessage({ type: 'success', text: 'Firma guardada' });
      if (selectedExecution?.id) {
        loadAttendance(selectedExecution.id);
      }
      setEditingAttendance(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando firma' });
    }
  };

  const openSignaturePad = (att: TrainingAttendance) => {
    setEditingAttendance(att);
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!confirm('Eliminar este asistente?')) return;
    try {
      await api.del(`/plans/trainings/attendance/${id}`);
      setMessage({ type: 'success', text: 'Asistente eliminado' });
      if (selectedExecution?.id) {
        loadAttendance(selectedExecution.id);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error eliminando asistente' });
    }
  };

  // KPI calculations
  const getPlanKPIs = () => {
    const total = plans.length;
    const porEstado = plans.reduce(
      (acc, p) => {
        acc[p.estado] = (acc[p.estado] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byYear = plans.reduce(
      (acc, p) => {
        acc[p.anio] = (acc[p.anio] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );

    // Alertas por vencer (30 días)
    const today = new Date();
    const alertadas = plans.filter((p) => {
      if (!p.fecha_fin) return false;
      const fechaFin = new Date(p.fecha_fin);
      const diffDias = Math.ceil((fechaFin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDias <= 30 && diffDias >= 0;
    }).length;

    const vencidas = plans.filter((p) => {
      if (!p.fecha_fin) return false;
      const fechaFin = new Date(p.fecha_fin);
      return fechaFin < today && p.estado !== 'cumplido';
    }).length;

    // Porcentaje de cumplimiento (igual que la columna del Excel real):
    // actividades cumplidas / total de actividades.
    const cumplidas = plans.filter((p) => p.estado === 'cumplido').length;
    const porcentaje = total ? Math.round((cumplidas / total) * 100) : 0;

    return { total, porEstado, byYear, alertadas, vencidas, porcentaje, cumplidas };
  };

  const getTrainingKPIs = () => {
    const total = trainings.length;
    const porEstado = trainings.reduce(
      (acc, t) => {
        acc[t.estado] = (acc[t.estado] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byTipo = trainings.reduce(
      (acc, t) => {
        acc[t.tipo] = (acc[t.tipo] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const programadas = trainings.filter((t) => t.estado === 'programada').length;
    const realizadas = trainings.filter((t) => t.estado === 'realizada').length;

    const alertasCapacitacion = trainings.filter((t) => {
      const fecha = new Date(t.fecha);
      const diffDias = Math.ceil((fecha.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDias <= 30 && diffDias >= 0;
    }).length;

    return { total, porEstado, byTipo, programadas, realizadas, alertasCapacitacion };
  };

  const today = new Date();

  // Filtered data
  const filteredPlans = plans.filter((p) => {
    if (planFilterEstado !== 'all' && p.estado !== planFilterEstado) return false;
    if (planFilterFecha && p.anio !== parseInt(planFilterFecha)) return false;
    return true;
  });

  const filteredTrainings = trainings.filter((t) => {
    if (trainingFilterEstado !== 'all' && t.estado !== trainingFilterEstado) return false;
    return true;
  });

  // Plan state colors
  const ESTADO_PLAN_COLORS: Record<string, { bg: string; text: string }> = {
    pendiente: { bg: '#e7f4fa', text: '#0f766e' },
    en_proceso: { bg: '#fff7ed', text: '#ea580c' },
    cumplido: { bg: '#dcfce7', text: '#166534' },
    incumplido: { bg: '#fee2e2', text: '#dc2626' },
  };

  // Training state colors
  const ESTADO_TRAINING_COLORS: Record<string, { bg: string; text: string }> = {
    programada: { bg: '#eff6ff', text: '#0f766e' },
    realizada: { bg: '#f0fdf4', text: '#166534' },
    cancelada: { bg: '#f3f4f6', text: '#6b7280' },
  };

  const TIPO_CAPACITACION = [
    { value: 'induccion', label: 'Inducción' },
    { value: 'reinduccion', label: 'Reinducción' },
    { value: 'capacitacion', label: 'Capacitación general' },
    { value: 'alturas', label: 'Alturas' },
    { value: 'electrico', label: 'Electricidad' },
    { value: 'emergencia', label: 'Emergencia/Botiquín' },
    { value: 'brigada', label: 'Brigada de emergencia' },
    { value: 'ergonomia', label: 'Ergonomía' },
    { value: 'otr_o', label: 'Otro' },
  ];

  return (
    <div className="ui-page plans-page">
      <header className="plans-page-heading">
        <h1 className="ui-page-title">Plan Anual de Trabajo y Cronograma de Capacitación</h1>
        <p className="ui-page-description">
          Gestión de actividades anuales y capacitaciones SST conforme a Resoluciones 0312/2019,
          1581/2012, 4272/2021.
        </p>
      </header>

      {/* Tabs */}
      <div aria-label="Secciones del plan anual" className="ui-tabs plans-tabs" role="tablist">
        {[
          { id: 'planes' as const, label: 'Plan anual', icon: CalendarDays },
          { id: 'capacitacion' as const, label: 'Capacitaciones', icon: GraduationCap },
          { id: 'ejecucion' as const, label: 'Ejecución', icon: ListChecks },
        ].map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            aria-controls={activeTab === tab.id ? `plans-panel-${tab.id}` : undefined}
            className="ui-tab"
            id={`plans-tab-${tab.id}`}
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

      {/* Plan Anual Tab */}
      {activeTab === 'planes' && (
        <section
          aria-labelledby="plans-tab-planes"
          className="plans-tab-panel"
          id="plans-panel-planes"
          role="tabpanel"
          tabIndex={0}
        >
          {/* KPIs */}
          <div className="plans-kpi-grid plans-kpi-grid--annual">
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Total Actividades</div>
              <div className="plans-kpi-card-value" style={{ color: '#0f766e' }}>
                {getPlanKPIs().total}
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Cumplidas</div>
              <div className="plans-kpi-card-value" style={{ color: '#16a34a' }}>
                {getPlanKPIs().porEstado.cumplido || 0}
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">En Proceso</div>
              <div className="plans-kpi-card-value" style={{ color: '#ea580c' }}>
                {getPlanKPIs().porEstado.en_proceso || 0}
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">% de cumplimiento</div>
              <div className="plans-kpi-card-value" style={{ color: '#0f766e' }}>
                {getPlanKPIs().porcentaje}%
              </div>
              <div
                aria-label={`Porcentaje de cumplimiento: ${getPlanKPIs().porcentaje}%`}
                role="progressbar"
                aria-valuenow={getPlanKPIs().porcentaje}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ height: 6, background: '#e5e7eb', borderRadius: 4, marginTop: 6 }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${getPlanKPIs().porcentaje}%`,
                    background: '#0f766e',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Vencidas</div>
              <div className="plans-kpi-card-value" style={{ color: '#dc2626' }}>
                {getPlanKPIs().vencidas}
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Alertas (30 días)</div>
              <div className="plans-kpi-card-value" style={{ color: '#f59e0b' }}>
                {getPlanKPIs().alertadas}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <select
              value={planFilterEstado}
              onChange={(e) => setPlanFilterEstado(e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
            >
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="cumplido">Cumplido</option>
              <option value="incumplido">Incumplido</option>
            </select>
            <input
              type="number"
              value={planFilterFecha}
              onChange={(e) => setPlanFilterFecha(e.target.value)}
              placeholder="Filtrar por año"
              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db', width: 120 }}
            />
            {planFilterEstado !== 'all' && (
              <button
                className="ui-icon-button"
                onClick={() => setPlanFilterEstado('all')}
                style={{
                  padding: '8px 12px',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <X aria-hidden="true" size={14} /> Quitar filtro
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                onClick={() =>
                  (window.location.href = `/api/export/plan-anual${
                    planFilterFecha ? `?anio=${planFilterFecha}` : ''
                  }`)
                }
                style={{
                  padding: '8px 12px',
                  background: '#0f766e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Exportar PDF
              </button>
              <button
                onClick={() =>
                  (window.location.href = `/api/export/plan-anual/excel${
                    planFilterFecha ? `?anio=${planFilterFecha}` : ''
                  }`)
                }
                style={{
                  padding: '8px 12px',
                  background: '#0f766e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Exportar Excel
              </button>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              style={{
                background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                color: message.type === 'success' ? '#065f46' : '#991b1b',
                padding: 10,
                borderRadius: 8,
                marginBottom: 14,
              }}
            >
              {message.text}
            </div>
          )}

          {/* Form */}
          <div
            style={{
              background: '#fff',
              padding: 16,
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: '0 0 12px', color: '#0f766e' }}>
              {planForm.id ? 'Editar Actividad' : 'Nueva Actividad'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePlanSave();
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label
                  htmlFor="plan-anio"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Año *
                </label>
                <input
                  id="plan-anio"
                  type="number"
                  value={planForm.anio}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, anio: parseInt(e.target.value) || 0 })
                  }
                  min="2020"
                  max="2030"
                  required
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="plan-objetivo"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Objetivo *
                </label>
                <input
                  id="plan-objetivo"
                  type="text"
                  value={planForm.objetivo}
                  onChange={(e) => setPlanForm({ ...planForm, objetivo: e.target.value })}
                  placeholder="Actividad o medida a implementar"
                  required
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="plan-responsable"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Responsable
                </label>
                <input
                  id="plan-responsable"
                  type="text"
                  value={planForm.responsable}
                  onChange={(e) => setPlanForm({ ...planForm, responsable: e.target.value })}
                  placeholder="Nombre/Área responsable"
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="plan-estado"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Estado
                </label>
                <select
                  id="plan-estado"
                  value={planForm.estado}
                  onChange={(e) => setPlanForm({ ...planForm, estado: e.target.value as any })}
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="cumplido">Cumplido</option>
                  <option value="incumplido">Incumplido</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="plan-fecha-inicio"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Fecha inicio
                </label>
                <input
                  id="plan-fecha-inicio"
                  type="date"
                  value={planForm.fecha_inicio}
                  onChange={(e) => setPlanForm({ ...planForm, fecha_inicio: e.target.value })}
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="plan-fecha-fin"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Fecha fin
                </label>
                <input
                  id="plan-fecha-fin"
                  type="date"
                  value={planForm.fecha_fin}
                  onChange={(e) => setPlanForm({ ...planForm, fecha_fin: e.target.value })}
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="plan-presupuesto"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Presupuesto ($)
                </label>
                <input
                  id="plan-presupuesto"
                  type="number"
                  value={planForm.presupuesto}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, presupuesto: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0"
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="plan-programa"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Programa (grupo del plan)
                </label>
                <input
                  id="plan-programa"
                  type="text"
                  value={planForm.programa || ''}
                  onChange={(e) => setPlanForm({ ...planForm, programa: e.target.value })}
                  placeholder="Ej.: Política del sistema de gestión, Capacitación…"
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="plan-evidencia-esperada"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Evidencia esperada
                </label>
                <input
                  id="plan-evidencia-esperada"
                  type="text"
                  value={planForm.evidencia_esperada || ''}
                  onChange={(e) => setPlanForm({ ...planForm, evidencia_esperada: e.target.value })}
                  placeholder="Ej.: Acta de reunión, lista de asistencia, procedimiento creado…"
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Cronograma mensual (meses en que está programada la actividad)
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {MESES_ABREVIATURA.map((mes, indice) => {
                    const seleccionado = (planForm.meses ?? []).includes(indice + 1);
                    return (
                      <label
                        key={mes}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: `1px solid ${seleccionado ? '#0f766e' : '#d1d5db'}`,
                          background: seleccionado ? '#ccfbf1' : '#fff',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-micro)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={seleccionado}
                          onChange={(e) => {
                            const actuales = planForm.meses ?? [];
                            const meses = e.target.checked
                              ? [...actuales, indice + 1].sort((a, b) => a - b)
                              : actuales.filter((m) => m !== indice + 1);
                            setPlanForm({ ...planForm, meses });
                          }}
                          style={{ margin: 0 }}
                        />
                        {mes}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="plan-meta"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Meta
                </label>
                <input
                  id="plan-meta"
                  type="text"
                  value={planForm.meta}
                  onChange={(e) => setPlanForm({ ...planForm, meta: e.target.value })}
                  placeholder="Objetivo específico de la actividad"
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '10px 16px',
                    background: loading ? '#94a3b8' : '#0f766e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {planForm.id ? 'Actualizar' : 'Agregar Actividad'}
                </button>
                {planForm.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setPlanForm({
                        anio: new Date().getFullYear(),
                        objetivo: '',
                        meta: '',
                        responsable: '',
                        fecha_inicio: new Date().toISOString().slice(0, 10),
                        fecha_fin: '',
                        presupuesto: 0,
                        estado: 'pendiente',
                        programa: '',
                        evidencia_esperada: '',
                        meses: [],
                      })
                    }
                    style={{
                      padding: '10px 16px',
                      background: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    Nuevo
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Plans Table */}
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th
                    style={{
                      padding: 10,
                      fontSize: 'var(--font-size-caption)',
                      color: '#374151',
                      textAlign: 'left',
                    }}
                  >
                    Objetivo
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Año
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Responsable
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Fechas
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Cronograma
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Estado
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Presupuesto
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Evidencias
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                      {loading ? 'Cargando...' : 'No hay actividades registradas'}
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((p) => {
                    const estadoColor = ESTADO_PLAN_COLORS[p.estado];
                    const todayDate = new Date();
                    const fechaFin = p.fecha_fin ? new Date(p.fecha_fin) : null;
                    const isVencida = fechaFin && fechaFin < todayDate && p.estado !== 'cumplido';
                    const isVenciendo =
                      fechaFin &&
                      fechaFin.getTime() - todayDate.getTime() < 30 * 86400000 &&
                      fechaFin.getTime() - todayDate.getTime() > 0;

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td
                          style={{
                            padding: 10,
                            fontSize: 'var(--font-size-caption)',
                            maxWidth: '250px',
                          }}
                        >
                          {p.programa ? (
                            <div
                              style={{
                                fontSize: 'var(--font-size-micro)',
                                color: '#0f766e',
                                fontWeight: 'bold',
                                marginBottom: 2,
                              }}
                            >
                              {p.programa}
                            </div>
                          ) : null}
                          {p.objetivo}
                          {p.evidencia_esperada ? (
                            <div
                              style={{
                                fontSize: 'var(--font-size-micro)',
                                color: '#6b7280',
                                marginTop: 2,
                              }}
                            >
                              Evidencia: {p.evidencia_esperada}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: 10, fontSize: 'var(--font-size-caption)' }}>
                          {p.anio}
                        </td>
                        <td style={{ padding: 10, fontSize: 'var(--font-size-caption)' }}>
                          {p.responsable || '—'}
                        </td>
                        <td style={{ padding: 10, fontSize: 'var(--font-size-caption)' }}>
                          {p.fecha_inicio} {p.fecha_fin ? `→ ${p.fecha_fin}` : ''}
                        </td>
                        <td style={{ padding: 10 }}>
                          {(p.meses ?? []).length ? (
                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                              {(p.meses ?? []).map((mes) => (
                                <span
                                  key={mes}
                                  title={MESES_ABREVIATURA[mes - 1]}
                                  style={{
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    background: '#ccfbf1',
                                    color: '#0f766e',
                                    fontSize: 'var(--font-size-micro)',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {MESES_ABREVIATURA[mes - 1]}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: 10 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 'var(--font-size-micro)',
                              fontWeight: 'bold',
                              background: isVencida ? '#fee2e2' : estadoColor.bg,
                              color: isVencida ? '#dc2626' : estadoColor.text,
                            }}
                          >
                            {p.estado}
                            {isVencida && (
                              <>
                                <AlertTriangle aria-hidden="true" size={14} />
                                <span className="ui-visually-hidden">Vencida</span>
                              </>
                            )}
                            {isVenciendo && (
                              <>
                                <Bell aria-hidden="true" size={14} />
                                <span className="ui-visually-hidden">Próxima a vencer</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: 10,
                            fontSize: 'var(--font-size-caption)',
                            fontWeight: 500,
                          }}
                        >
                          ${p.presupuesto ? p.presupuesto.toLocaleString() : '0'}
                        </td>
                        <td style={{ padding: 10, maxWidth: '220px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                background: '#0f766e',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 'var(--font-size-micro)',
                                cursor: 'pointer',
                              }}
                            >
                              <Paperclip aria-hidden="true" size={12} />
                              Adjuntar
                              <input
                                type="file"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const archivo = e.target.files?.[0];
                                  e.target.value = '';
                                  if (p.id) void handleEvidenciaUpload(p.id, archivo ?? null);
                                }}
                              />
                            </label>
                            {(evidencias[p.id ?? ''] ?? []).map((ev) => (
                              <div
                                key={ev.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 'var(--font-size-micro)',
                                }}
                              >
                                <a
                                  href={ev.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={ev.nombre_original}
                                  style={{
                                    color: '#1d4ed8',
                                    textDecoration: 'underline',
                                    maxWidth: 140,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block',
                                  }}
                                >
                                  {ev.nombre_original}
                                </a>
                                <button
                                  onClick={() => p.id && handleEvidenciaDelete(p.id, ev.id)}
                                  aria-label={`Eliminar evidencia ${ev.nombre_original}`}
                                  style={{
                                    padding: '1px 5px',
                                    background: '#dc2626',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <X aria-hidden="true" size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => openPlanEdit(p)}
                              style={{
                                padding: '4px 8px',
                                background: '#0f766e',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 'var(--font-size-micro)',
                                cursor: 'pointer',
                              }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => p.id && handlePlanDelete(p.id)}
                              aria-label={`Eliminar actividad ${p.objetivo}`}
                              className="ui-icon-button"
                              style={{
                                padding: '4px 8px',
                                background: '#dc2626',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 'var(--font-size-micro)',
                                cursor: 'pointer',
                              }}
                            >
                              <X aria-hidden="true" size={14} />
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
        </section>
      )}

      {/* Importación masiva desde Excel */}
      {activeTab === 'planes' && (
        <section aria-labelledby="plans-tab-importar" id="plans-panel-importar">
          <h3 style={{ margin: '0 0 12px', color: '#0f766e' }}>Importar plan anual desde Excel</h3>
          <p style={{ fontSize: 'var(--font-size-caption)', color: '#6b7280', marginBottom: 14 }}>
            Sube tu archivo Excel con el plan anual (columnas: programa, objetivo, meta, actividad,
            evidencia, responsable, estado, cronograma mensual). Se mostrará una vista previa antes
            de confirmar. Ningún dato se guarda hasta que hagas clic en &quot;Importar&quot;.
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportFileChange}
              disabled={importLoading}
              style={{
                padding: 8,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: importLoading ? '#e5e7eb' : '#fff',
              }}
            />
            {importFile && (
              <span style={{ fontSize: 'var(--font-size-micro)', color: '#0f766e' }}>
                {importFile.name}
              </span>
            )}
            <button
              onClick={handlePreviewImport}
              disabled={!importFile || importLoading}
              style={{
                padding: '8px 16px',
                background: !importFile || importLoading ? '#94a3b8' : '#0f766e',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: !importFile || importLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {importLoading ? 'Procesando...' : 'Previsualizar'}
            </button>
          </div>

          {importPreview && (
            <div
              style={{
                background: '#fff',
                borderRadius: 10,
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                overflow: 'hidden',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  padding: 12,
                  background: '#f3f4f6',
                  fontWeight: 'bold',
                  fontSize: 'var(--font-size-caption)',
                  color: '#374151',
                }}
              >
                Resumen: {importPreview.validas} válidas · {importPreview.conErrores} con errores ·
                de {importPreview.totalFilas} filas
                {importPreview.anioDetectado && ` · Año detectado: ${importPreview.anioDetectado}`}
              </div>
              <div style={{ padding: 12, overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 'var(--font-size-micro)',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: 6, textAlign: 'left' }}>Fila</th>
                      <th style={{ padding: 6, textAlign: 'left' }}>Objetivo / Actividad</th>
                      <th style={{ padding: 6, textAlign: 'left' }}>Responsable</th>
                      <th style={{ padding: 6, textAlign: 'left' }}>Estado</th>
                      <th style={{ padding: 6, textAlign: 'left' }}>Meses</th>
                      <th style={{ padding: 6, textAlign: 'left' }}>Errores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...importPreview.filasValidas, ...importPreview.filasConErrores].map(
                      (f: any) => (
                        <tr key={f.fila} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: 6 }}>{f.fila}</td>
                          <td
                            style={{
                              padding: 6,
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {f.objetivo}
                          </td>
                          <td style={{ padding: 6 }}>{f.responsable || '—'}</td>
                          <td style={{ padding: 6 }}>{f.estado}</td>
                          <td style={{ padding: 6 }}>{(f.meses ?? []).join(', ') || '—'}</td>
                          <td
                            style={{ padding: 6, color: f.errores.length ? '#dc2626' : '#16a34a' }}
                          >
                            {f.errores.length ? f.errores.join('; ') : 'Válida'}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
              {importPreview.conErrores > 0 && (
                <div
                  style={{
                    padding: 12,
                    background: '#fef2f2',
                    color: '#991b1b',
                    fontSize: 'var(--font-size-micro)',
                  }}
                >
                  ⚠️ Las filas con errores no se importarán hasta que se corrijan en el archivo
                  original.
                </div>
              )}
              {importPreview.validas > 0 && (
                <div style={{ padding: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleConfirmImport}
                    disabled={importConfirmando}
                    style={{
                      padding: '8px 16px',
                      background: importConfirmando ? '#94a3b8' : '#0f766e',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: importConfirmando ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {importConfirmando ? 'Importando...' : 'Importar actividades válidas'}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {activeTab === 'capacitacion' && (
        <section
          aria-labelledby="plans-tab-capacitacion"
          className="plans-tab-panel"
          id="plans-panel-capacitacion"
          role="tabpanel"
          tabIndex={0}
        >
          {/* Training KPIs */}
          <div className="plans-kpi-grid">
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Total Capacitaciones</div>
              <div className="plans-kpi-card-value" style={{ color: '#0f766e' }}>
                {getTrainingKPIs().total}
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Programadas</div>
              <div className="plans-kpi-card-value" style={{ color: '#3b82f6' }}>
                {getTrainingKPIs().programadas}
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Realizadas</div>
              <div className="plans-kpi-card-value" style={{ color: '#16a34a' }}>
                {getTrainingKPIs().realizadas}
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Alertas (30 días)</div>
              <div className="plans-kpi-card-value" style={{ color: '#f59e0b' }}>
                {getTrainingKPIs().alertasCapacitacion}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <select
              value={trainingFilterEstado}
              onChange={(e) => setTrainingFilterEstado(e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
            >
              <option value="all">Todas las capacitaciones</option>
              <option value="programada">Programadas</option>
              <option value="realizada">Realizadas</option>
              <option value="cancelada">Canceladas</option>
            </select>
            {trainingFilterEstado !== 'all' && (
              <button
                className="ui-icon-button"
                onClick={() => setTrainingFilterEstado('all')}
                style={{
                  padding: '8px 12px',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <X aria-hidden="true" size={14} /> Quitar filtro
              </button>
            )}
          </div>

          {/* Message */}
          {message && (
            <div
              style={{
                background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                color: message.type === 'success' ? '#065f46' : '#991b1b',
                padding: 10,
                borderRadius: 8,
                marginBottom: 14,
              }}
            >
              {message.text}
            </div>
          )}

          {/* Form */}
          <div
            style={{
              background: '#fff',
              padding: 16,
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: '0 0 12px', color: '#0f766e' }}>Nueva Capacitación</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTrainingSave();
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label
                  htmlFor="training-nombre"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Nombre *
                </label>
                <input
                  id="training-nombre"
                  type="text"
                  value={trainingForm.nombre}
                  onChange={(e) => setTrainingForm({ ...trainingForm, nombre: e.target.value })}
                  placeholder="Capacitación en seguridad"
                  required
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="training-tipo"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Tipo *
                </label>
                <select
                  id="training-tipo"
                  value={trainingForm.tipo}
                  onChange={(e) => setTrainingForm({ ...trainingForm, tipo: e.target.value })}
                  required
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                >
                  {TIPO_CAPACITACION.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="training-fecha"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Fecha *
                </label>
                <input
                  id="training-fecha"
                  type="date"
                  value={trainingForm.fecha}
                  onChange={(e) => setTrainingForm({ ...trainingForm, fecha: e.target.value })}
                  required
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="training-duracion"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Duración (horas)
                </label>
                <input
                  id="training-duracion"
                  type="number"
                  value={trainingForm.duracion_horas}
                  onChange={(e) =>
                    setTrainingForm({
                      ...trainingForm,
                      duracion_horas: parseFloat(e.target.value) || 1,
                    })
                  }
                  min="0.5"
                  step="0.5"
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="training-responsable"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Responsable *
                </label>
                <input
                  id="training-responsable"
                  type="text"
                  value={trainingForm.responsable}
                  onChange={(e) =>
                    setTrainingForm({ ...trainingForm, responsable: e.target.value })
                  }
                  placeholder="Nombre del instructor"
                  required
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="training-estado"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Estado
                </label>
                <select
                  id="training-estado"
                  value={trainingForm.estado}
                  onChange={(e) =>
                    setTrainingForm({ ...trainingForm, estado: e.target.value as any })
                  }
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                >
                  <option value="programada">Programada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="training-objetivo"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Objetivo
                </label>
                <input
                  id="training-objetivo"
                  type="text"
                  value={trainingForm.objetivo}
                  onChange={(e) => setTrainingForm({ ...trainingForm, objetivo: e.target.value })}
                  placeholder="Objetivo de la capacitación"
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '10px 16px',
                    background: loading ? '#94a3b8' : '#0f766e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Agregar Capacitación
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTrainingForm({
                      nombre: '',
                      tipo: 'capacitacion',
                      fecha: new Date().toISOString().slice(0, 10),
                      duracion_horas: 1,
                      responsable: '',
                      objetivo: '',
                      estado: 'programada',
                    })
                  }
                  style={{
                    padding: '10px 16px',
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  Nuevo
                </button>
              </div>
            </form>
          </div>

          {/* Trainings Table */}
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th
                    style={{
                      padding: 10,
                      fontSize: 'var(--font-size-caption)',
                      color: '#374151',
                      textAlign: 'left',
                    }}
                  >
                    Nombre
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Tipo
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Fecha
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Duración
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Responsable
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Estado
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTrainings.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                      {loading ? 'Cargando...' : 'No hay capacitaciones registradas'}
                    </td>
                  </tr>
                ) : (
                  filteredTrainings.map((t) => {
                    const estadoColor = ESTADO_TRAINING_COLORS[t.estado];
                    const fecha = new Date(t.fecha);
                    const diffDias = Math.ceil(
                      (fecha.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                    );
                    const isVenciendo = diffDias > 0 && diffDias <= 7;

                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td
                          style={{
                            padding: 10,
                            fontSize: 'var(--font-size-caption)',
                            maxWidth: '200px',
                          }}
                        >
                          {t.nombre}
                        </td>
                        <td style={{ padding: 10, fontSize: 'var(--font-size-caption)' }}>
                          {t.tipo}
                        </td>
                        <td style={{ padding: 10, fontSize: 'var(--font-size-caption)' }}>
                          {fecha.toLocaleDateString('es-CO')}
                        </td>
                        <td style={{ padding: 10, fontSize: 'var(--font-size-caption)' }}>
                          {t.duracion_horas || 1}h
                        </td>
                        <td style={{ padding: 10, fontSize: 'var(--font-size-caption)' }}>
                          {t.responsable || '—'}
                        </td>
                        <td style={{ padding: 10 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 'var(--font-size-micro)',
                              fontWeight: 'bold',
                              background: isVenciendo ? '#fef3c7' : estadoColor.bg,
                              color: isVenciendo ? '#92400e' : estadoColor.text,
                            }}
                          >
                            {t.estado}
                            {isVenciendo && (
                              <>
                                <Bell aria-hidden="true" size={14} />
                                <span className="ui-visually-hidden">Próxima a vencer</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: 10 }}>
                          <button
                            onClick={() => t.id && handleTrainingDelete(t.id)}
                            className="ui-icon-button"
                            style={{
                              padding: '4px 8px',
                              background: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              fontSize: 'var(--font-size-micro)',
                              cursor: 'pointer',
                            }}
                          >
                            <X aria-hidden="true" size={14} /> Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* By Type Breakdown */}
          <div style={{ marginTop: 16, padding: 16, background: '#f9fafb', borderRadius: 10 }}>
            <h4 style={{ margin: '0 0 12px', color: '#0f766e' }}>Capacitaciones por tipo</h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12,
              }}
            >
              {Object.entries(getTrainingKPIs().byTipo).map(([tipo, count]) => {
                const label = TIPO_CAPACITACION.find((t) => t.value === tipo)?.label || tipo;
                return (
                  <div
                    key={tipo}
                    style={{
                      background: '#fff',
                      padding: 12,
                      borderRadius: 8,
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 'var(--font-size-heading)',
                        fontWeight: 'bold',
                        color: '#0f766e',
                      }}
                    >
                      {count}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-micro)', color: '#6b7280' }}>
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: EJECUCIÓN DE CAPACITACIONES */}
      {activeTab === 'ejecucion' && (
        <section
          aria-labelledby="plans-tab-ejecucion"
          className="plans-tab-panel"
          id="plans-panel-ejecucion"
          role="tabpanel"
          tabIndex={0}
        >
          {/* KPIs */}
          <div className="plans-kpi-grid">
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Total Ejecuciones</div>
              <div className="plans-kpi-card-value" style={{ color: '#0f766e' }}>
                {executions.length}
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Realizadas</div>
              <div className="plans-kpi-card-value" style={{ color: '#16a34a' }}>
                {executions.filter((e) => e.estado === 'realizada').length}
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Programadas</div>
              <div className="plans-kpi-card-value" style={{ color: '#3b82f6' }}>
                {executions.filter((e) => e.estado === 'programada').length}
              </div>
            </div>
            <div className="ui-surface plans-kpi-card">
              <div className="plans-kpi-card-label">Con Evidencia</div>
              <div className="plans-kpi-card-value" style={{ color: '#f59e0b' }}>
                {executions.filter((e) => e.archivo_evidencia).length}
              </div>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              style={{
                background: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                color: message.type === 'success' ? '#065f46' : '#991b1b',
                padding: 10,
                borderRadius: 8,
                marginBottom: 14,
              }}
            >
              {message.text}
            </div>
          )}

          {/* Form */}
          <div
            style={{
              background: '#fff',
              padding: 16,
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: '0 0 12px', color: '#0f766e' }}>
              {executionForm.id ? 'Editar Ejecución' : 'Nueva Ejecución de Capacitación'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecutionSave();
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label
                  htmlFor="exec-schedule"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Cronograma (opcional)
                </label>
                <select
                  id="exec-schedule"
                  value={executionForm.schedule_id}
                  onChange={(e) =>
                    setExecutionForm({ ...executionForm, schedule_id: e.target.value })
                  }
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                >
                  <option value="">— Sin vincular a cronograma —</option>
                  {trainings.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({t.tipo}) - {new Date(t.fecha).toLocaleDateString('es-CO')}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="exec-nombre"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Nombre *
                </label>
                <input
                  id="exec-nombre"
                  type="text"
                  value={executionForm.nombre}
                  onChange={(e) => setExecutionForm({ ...executionForm, nombre: e.target.value })}
                  placeholder="Capacitación en trabajo en alturas"
                  required
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="exec-fecha"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Fecha *
                </label>
                <input
                  id="exec-fecha"
                  type="date"
                  value={executionForm.fecha}
                  onChange={(e) => setExecutionForm({ ...executionForm, fecha: e.target.value })}
                  required
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="exec-instructor"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Instructor
                </label>
                <input
                  id="exec-instructor"
                  type="text"
                  value={executionForm.instructor || ''}
                  onChange={(e) =>
                    setExecutionForm({ ...executionForm, instructor: e.target.value })
                  }
                  placeholder="Nombre del instructor"
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="exec-estado"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  Estado
                </label>
                <select
                  id="exec-estado"
                  value={executionForm.estado}
                  onChange={(e) =>
                    setExecutionForm({ ...executionForm, estado: e.target.value as any })
                  }
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                >
                  <option value="programada">Programada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  htmlFor="exec-evidencia"
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  URL Evidencia (PDF/Foto/Base64)
                </label>
                <input
                  id="exec-evidencia"
                  type="text"
                  value={executionForm.archivo_evidencia || ''}
                  onChange={(e) =>
                    setExecutionForm({ ...executionForm, archivo_evidencia: e.target.value })
                  }
                  placeholder="https://... o data:image/... (base64)"
                  style={{
                    padding: 8,
                    width: '100%',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '10px 16px',
                    background: loading ? '#94a3b8' : '#0f766e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {executionForm.id ? 'Actualizar' : 'Agregar Ejecución'}
                </button>
                {executionForm.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setExecutionForm({
                        id: '',
                        schedule_id: '',
                        nombre: '',
                        fecha: new Date().toISOString().slice(0, 10),
                        instructor: '',
                        archivo_evidencia: '',
                        estado: 'programada',
                      })
                    }
                    style={{
                      padding: '10px 16px',
                      background: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    Nuevo
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Executions Table */}
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th
                    style={{
                      padding: 10,
                      fontSize: 'var(--font-size-caption)',
                      color: '#374151',
                      textAlign: 'left',
                    }}
                  >
                    Nombre
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Cronograma
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Fecha
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Instructor
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Estado
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Evidencia
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Asistencia
                  </th>
                  <th
                    style={{ padding: 10, fontSize: 'var(--font-size-caption)', color: '#374151' }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {executions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                      {loading ? 'Cargando...' : 'No hay ejecuciones registradas'}
                    </td>
                  </tr>
                ) : (
                  executions.map((e) => {
                    const estadoColor = ESTADO_TRAINING_COLORS[e.estado];
                    const hasEvidencia = !!e.archivo_evidencia;
                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td
                          style={{
                            padding: 10,
                            fontSize: 'var(--font-size-caption)',
                            maxWidth: '200px',
                          }}
                        >
                          {e.nombre}
                        </td>
                        <td style={{ padding: 10, fontSize: 'var(--font-size-caption)' }}>
                          {e.schedule_nombre || '—'}
                        </td>
                        <td style={{ padding: 10, fontSize: 'var(--font-size-caption)' }}>
                          {new Date(e.fecha).toLocaleDateString('es-CO')}
                        </td>
                        <td style={{ padding: 10, fontSize: 'var(--font-size-caption)' }}>
                          {e.instructor || '—'}
                        </td>
                        <td style={{ padding: 10 }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 'var(--font-size-micro)',
                              fontWeight: 'bold',
                              background: estadoColor.bg,
                              color: estadoColor.text,
                            }}
                          >
                            {e.estado}
                          </span>
                        </td>
                        <td style={{ padding: 10, textAlign: 'center' }}>
                          {hasEvidencia ? (
                            <Check
                              aria-label="Evidencia registrada"
                              role="img"
                              size={16}
                              style={{ color: '#16a34a' }}
                            />
                          ) : (
                            <Paperclip
                              aria-label="Sin evidencia"
                              role="img"
                              size={16}
                              style={{ color: '#f59e0b' }}
                            />
                          )}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center' }}>
                          <button
                            onClick={() => openAttendanceModal(e)}
                            className="ui-icon-button"
                            style={{
                              padding: '4px 8px',
                              background: '#0f766e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              fontSize: 'var(--font-size-micro)',
                              cursor: 'pointer',
                            }}
                          >
                            <Users aria-hidden="true" size={14} /> Gestionar
                          </button>
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => openExecutionEdit(e)}
                              style={{
                                padding: '4px 8px',
                                background: '#0f766e',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 'var(--font-size-micro)',
                                cursor: 'pointer',
                              }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => e.id && handleExecutionDelete(e.id)}
                              aria-label={`Eliminar ejecución ${e.nombre}`}
                              className="ui-icon-button"
                              style={{
                                padding: '4px 8px',
                                background: '#dc2626',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 'var(--font-size-micro)',
                                cursor: 'pointer',
                              }}
                            >
                              <X aria-hidden="true" size={14} />
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

          {/* Attendance Modal */}
          {attendanceModalOpen && selectedExecution && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 20,
                overflow: 'auto',
              }}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  width: '100%',
                  maxWidth: 800,
                  maxHeight: '90vh',
                  overflow: 'auto',
                }}
              >
                <div
                  style={{
                    padding: 20,
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <h3 style={{ margin: 0, color: '#0f766e' }}>
                    Asistencia - {selectedExecution.nombre}
                  </h3>
                  <button
                    onClick={() => {
                      setAttendanceModalOpen(false);
                      setSelectedExecution(null);
                      setAttendance([]);
                    }}
                    className="ui-icon-button"
                    style={{
                      padding: '8px 12px',
                      background: '#e5e7eb',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <X aria-hidden="true" size={14} /> Cerrar
                  </button>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => loadAttendance(selectedExecution!.id!)}
                      className="ui-icon-button"
                      style={{
                        padding: '8px 16px',
                        background: '#0f766e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      <RefreshCw aria-hidden="true" size={16} /> Recargar
                    </button>
                    <button
                      onClick={() => bulkAddAttendance(selectedExecution!.id!)}
                      className="ui-icon-button"
                      style={{
                        padding: '8px 16px',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      <UserPlus aria-hidden="true" size={16} /> Agregar todos los trabajadores
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                          <th
                            style={{
                              padding: 10,
                              fontSize: 'var(--font-size-caption)',
                              color: '#374151',
                            }}
                          >
                            Trabajador
                          </th>
                          <th
                            style={{
                              padding: 10,
                              fontSize: 'var(--font-size-caption)',
                              color: '#374151',
                            }}
                          >
                            Documento
                          </th>
                          <th
                            style={{
                              padding: 10,
                              fontSize: 'var(--font-size-caption)',
                              color: '#374151',
                            }}
                          >
                            Cargo
                          </th>
                          <th
                            style={{
                              padding: 10,
                              fontSize: 'var(--font-size-caption)',
                              color: '#374151',
                              textAlign: 'center',
                            }}
                          >
                            Firmado
                          </th>
                          <th
                            style={{
                              padding: 10,
                              fontSize: 'var(--font-size-caption)',
                              color: '#374151',
                              textAlign: 'center',
                            }}
                          >
                            Firma
                          </th>
                          <th
                            style={{
                              padding: 10,
                              fontSize: 'var(--font-size-caption)',
                              color: '#374151',
                            }}
                          >
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}
                            >
                              No hay asistentes registrados
                            </td>
                          </tr>
                        ) : (
                          attendance.map((a) => (
                            <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: 10 }}>
                                {a.nombres} {a.apellidos}
                              </td>
                              <td style={{ padding: 10 }}>{a.numero_documento}</td>
                              <td style={{ padding: 10 }}>{a.cargo}</td>
                              <td style={{ padding: 10, textAlign: 'center' }}>
                                {a.firmado ? (
                                  <Check
                                    aria-label="Asistencia firmada"
                                    role="img"
                                    size={16}
                                    style={{ color: '#16a34a' }}
                                  />
                                ) : (
                                  <Clock
                                    aria-label="Firma pendiente"
                                    role="img"
                                    size={16}
                                    style={{ color: '#f59e0b' }}
                                  />
                                )}
                              </td>
                              <td style={{ padding: 10, textAlign: 'center' }}>
                                {a.firma_url ? (
                                  <button
                                    onClick={() => window.open(a.firma_url!, '_blank')}
                                    style={{
                                      padding: '4px 8px',
                                      background: '#dcfce7',
                                      color: '#166534',
                                      border: 'none',
                                      borderRadius: 4,
                                      fontSize: 'var(--font-size-micro)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Ver firma
                                  </button>
                                ) : (
                                  <span
                                    style={{ color: '#9ca3af', fontSize: 'var(--font-size-micro)' }}
                                  >
                                    —
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                                {!a.firmado && (
                                  <button
                                    onClick={() => openSignaturePad(a)}
                                    className="ui-icon-button"
                                    style={{
                                      padding: '4px 8px',
                                      background: '#f59e0b',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: 4,
                                      fontSize: 'var(--font-size-micro)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <PenLine aria-hidden="true" size={14} /> Firmar
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteAttendance(a.id)}
                                  aria-label={`Eliminar asistencia de ${a.nombres} ${a.apellidos}`}
                                  className="ui-icon-button"
                                  style={{
                                    padding: '4px 8px',
                                    background: '#dc2626',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    fontSize: 'var(--font-size-micro)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <X aria-hidden="true" size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Signature Pad Modal */}
          {editingAttendance && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001,
                padding: 20,
              }}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  width: '100%',
                  maxWidth: 500,
                  padding: 20,
                }}
              >
                <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>
                  Firma de {editingAttendance.nombres} {editingAttendance.apellidos}
                </h3>
                <SignaturePad
                  onSave={handleSaveSignature}
                  onCancel={() => setEditingAttendance(null)}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Legal Note */}
      <details style={{ marginTop: 24, fontSize: 'var(--font-size-caption)', color: '#6b7280' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
          <ClipboardList aria-hidden="true" size={16} /> Normativa coligada
        </summary>
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: '#f9fafb',
            borderRadius: 6,
            lineHeight: 1.7,
          }}
        >
          <strong>Decretos y Resoluciones relevantes:</strong>
          <ul style={{ margin: '8px 0 0 20px' }}>
            <li>Res. 0312/2019: Estándares mínimos SST para seguridad y salud en el trabajo</li>
            <li>Decreto 1072/2015: Normas para seguridad y salud en el trabajo</li>
            <li>Res. 4272/2021: Permisos de trabajo en alturas y ATS</li>
            <li>Ley 1581/2012: Consentimiento tratamiento de datos sensibles</li>
          </ul>
          <p style={{ marginTop: 8, fontSize: 'var(--font-size-micro)', color: '#6b7280' }}>
            Plazos legales: Reporte ARL (2 días hábiles), Reporte MinTrabajo accidentes
            graves/mortales (24 horas).
          </p>
        </div>
      </details>
    </div>
  );
}
