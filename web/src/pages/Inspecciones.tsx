import { useCallback, useEffect, useState } from 'react';

import {
  Camera,
  Check,
  CircleCheck,
  ClipboardList,
  Clock,
  PenLine,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { SignaturePad } from '@/components/SignaturePad';
import { api } from '@/lib/api';

// Checklists específicos por tipo de inspección
const INSPECTION_CHECKLISTS: Record<string, { id: string; label: string; descripcion?: string }[]> =
  {
    herramientas: [
      {
        id: 'h1',
        label: 'Estado general de herramientas manuales',
        descripcion: 'Sin grietas, mangos firmes, sin óxido',
      },
      {
        id: 'h2',
        label: 'Herramientas eléctricas: cableado y aislamiento',
        descripcion: 'Sin cables pelados, conectores en buen estado',
      },
      {
        id: 'h3',
        label: 'Protecciones y guardas en sierras/radiales',
        descripcion: 'Guardas fijas y móviles funcionando',
      },
      {
        id: 'h4',
        label: 'Taladros/atornilladores: embrague y mandril',
        descripcion: 'Embrague regulado, mandril sin holgura',
      },
      {
        id: 'h5',
        label: 'Extintores portátiles cerca del área de trabajo',
        descripcion: 'Accesibles, con carga vigente, señalizados',
      },
      {
        id: 'h6',
        label: 'Orden y limpieza en taller/baúl de herramientas',
        descripcion: 'Sin aceites derramados, pasillos libres',
      },
    ],
    epp: [
      {
        id: 'e1',
        label: 'Casco de seguridad: sin grietas, suspensión completa',
        descripcion: 'Vencimiento < 5 años, barbijo funcional',
      },
      {
        id: 'e2',
        label: 'Protección ocular: lentes/gafas sin rayones',
        descripcion: 'Certificación ANSI Z87.1 o equivalente',
      },
      {
        id: 'e3',
        label: 'Protección auditiva: tapones/orejeras limpios',
        descripcion: 'SNR adecuado al nivel de ruido',
      },
      {
        id: 'e4',
        label: 'Guantes: según riesgo (corte, dieléctricos, químicos)',
        descripcion: 'Talla correcta, sin roturas, certificados',
      },
      {
        id: 'e5',
        label: 'Calzado de seguridad: puntera y suela antideslizante',
        descripcion: 'Certificación SRC, sin suelas desgastadas',
      },
      {
        id: 'e6',
        label: 'Protección facial/careta para esmeril/soldadura',
        descripcion: 'Pantalla IR/UV, estado óptico bueno',
      },
      {
        id: 'e7',
        label: 'Arnés de cuerpo completo: costuras, hebillas, etiqueta',
        descripcion: 'Certificado, vida útil < 5 años, sin daños',
      },
      {
        id: 'e8',
        label: 'Línea de vida y dispositivo anticaídas',
        descripcion: 'Cable/cinta sin cortes, absorbedor de energía',
      },
      {
        id: 'e9',
        label: 'Ropa de trabajo: manga larga, reflectiva si vial',
        descripcion: 'Sin desgarros, alta visibilidad clase 2/3',
      },
      {
        id: 'e10',
        label: 'Respirador: filtro correcto, ajuste facial (fit test)',
        descripcion: 'Filtro vigente, pieza facial limpia',
      },
    ],
    escaleras: [
      {
        id: 'es1',
        label: 'Escalera tipo tijera: bisagras, topes, peldaños',
        descripcion: 'Sin peldaños doblados, topes antideslizantes',
      },
      {
        id: 'es2',
        label: 'Escalera de apoyo: patas antideslizantes, ganchos',
        descripcion: 'Ángulo 75° (regla 1:4), apoyo firme',
      },
      {
        id: 'es3',
        label: 'Escalera de fibra de vidrio (dieléctrica) si cerca de eléctrico',
        descripcion: 'Sin grietas, certificación dieléctrica vigente',
      },
      {
        id: 'es4',
        label: 'Altura máxima de trabajo según tipo de escalera',
        descripcion: 'No pararse en últimos 2 peldaños (mano) / plataforma (tijera)',
      },
      {
        id: 'es5',
        label: 'Inspección visual mensual registrada',
        descripcion: 'Etiqueta de inspección vigente',
      },
      {
        id: 'es6',
        label: 'Escalera asegurada (amarre superior) o vigía',
        descripcion: 'Prevención de deslizamiento lateral',
      },
    ],
    arneses: [
      {
        id: 'a1',
        label: 'Arnés: costuras, argollas D, hebillas, etiqueta',
        descripcion: 'Certificado EN 361, vida útil < 5 años',
      },
      {
        id: 'a2',
        label: 'Línea de vida/restricción: cable/cinta, absorbedor',
        descripcion: 'Sin cortes, quemaduras, deformaciones EN 354/355',
      },
      {
        id: 'a3',
        label: 'Dispositivo anticaídas retráctil/deslizante',
        descripcion: 'Funcionamiento suave, freno probado, certificado EN 360',
      },
      {
        id: 'a4',
        label: 'Anclajes certificados (>15 kN) y accesibles',
        descripcion: 'Etiqueta/registro de certificación',
      },
      {
        id: 'a5',
        label: 'Plan de rescate disponible y conocido',
        descripcion: 'Equipo de rescate, personal capacitado',
      },
      {
        id: 'a6',
        label: 'Certificación trabajo en alturas vigente (3 años)',
        descripcion: 'Res. 4272/2021, carné vigente',
      },
    ],
    vehiculo: [
      {
        id: 'v1',
        label: 'Frenos: pedal, freno de mano, líquido',
        descripcion: 'Frenado parejo, sin ruidos, nivel OK',
      },
      {
        id: 'v2',
        label: 'Neumáticos: presión, banda de rodadura (>1.6mm), rueda de auxilio',
        descripcion: 'Desgaste uniforme, sin cortes/burbujas',
      },
      {
        id: 'v3',
        label: 'Luces: delanteras, traseras, intermitentes, freno, reversa',
        descripcion: 'Todas funcionando, lentes limpios',
      },
      {
        id: 'v4',
        label: 'Espejos: retrovisor, laterales, sin grietas',
        descripcion: 'Bien ajustados, visión clara',
      },
      {
        id: 'v5',
        label: 'Cinturones de seguridad: anclajes, retractor, hebillas',
        descripcion: 'Todos los puestos, funcionando',
      },
      {
        id: 'v6',
        label: 'Extintor: carga vigente, accesible, señalizado',
        descripcion: 'Peso/presión OK, soporte fijo',
      },
      {
        id: 'v7',
        label: 'Botiquín de primeros auxilios completo',
        descripcion: 'Según Res. 0312/2019, vencimientos OK',
      },
      {
        id: 'v8',
        label: 'Carga asegurada: redes, cinchas, separador cabina',
        descripcion: 'Sin objetos sueltos en cabina',
      },
      {
        id: 'v9',
        label: 'Documentación: SOAT, tecnomecánica, licencia conductor',
        descripcion: 'Vigentes, originales en vehículo',
      },
      {
        id: 'v10',
        label: 'Limpieza interior/exterior, parabrisas sin grietas',
        descripcion: 'Visibilidad 360°, limpiaparabrisas OK',
      },
    ],
    botiquin: [
      {
        id: 'b1',
        label: 'Botiquín accesible, señalizado, limpio y ordenado',
        descripcion: 'Visible, sin obstáculos, lista de contenido',
      },
      {
        id: 'b2',
        label: 'Material de curación: gasas, algodón, esparadrapo, tijeras',
        descripcion: 'Estériles, vencimientos vigentes',
      },
      {
        id: 'b3',
        label: 'Antisépticos: povidona yodada, alcohol, suero fisiológico',
        descripcion: 'Frascos cerrados, fecha vigente',
      },
      {
        id: 'b4',
        label: 'Medicamentos básicos: analgésicos, antihistamínicos',
        descripcion: 'Según protocolo médico, vencimientos OK',
      },
      {
        id: 'b5',
        label: 'Elementos de inmovilización: férulas, collarín, tabla',
        descripcion: 'Completos, en buen estado',
      },
      {
        id: 'b6',
        label: 'EPP para atención: guantes, mascarillas, gafas',
        descripcion: 'Desechables, stock suficiente',
      },
      {
        id: 'b7',
        label: 'Registro de usos y reposiciones actualizado',
        descripcion: 'Firmado por responsable, mensual',
      },
      {
        id: 'b8',
        label: 'Capacitado en primeros auxilios designado y vigente',
        descripcion: 'Carné/certificado vigente (2 años)',
      },
    ],
    extintores: [
      {
        id: 'ex1',
        label: 'Ubicación: visible, accesible, ≤ 15 m de riesgo',
        descripcion: 'Señalización fotoluminiscente, soporte',
      },
      {
        id: 'ex2',
        label: 'Tipo correcto: ABC (general), CO2 (eléctrico), K (cocinas)',
        descripcion: 'Según riesgo de la zona',
      },
      {
        id: 'ex3',
        label: 'Presión/manómetro en zona verde (carga vigente)',
        descripcion: 'Peso según etiqueta, sin fugas',
      },
      {
        id: 'ex4',
        label: 'Manguera/boquilla: sin obstrucciones, gatillo funcional',
        descripcion: 'Boquilla correcta según tipo',
      },
      {
        id: 'ex5',
        label: 'Etiqueta de recarga/revisión anual vigente',
        descripcion: 'Empresa certificada, fecha < 1 año',
      },
      {
        id: 'ex6',
        label: 'Instrucciones de uso visibles (pictograma PASS)',
        descripcion: 'En español, legibles',
      },
      {
        id: 'ex7',
        label: 'Capacitación brigada/uso extintores vigente',
        descripcion: 'Práctica anual, registro firmado',
      },
    ],
    puesto_trabajo: [
      {
        id: 'pt1',
        label: 'Orden y limpieza: 5S aplicados',
        descripcion: 'Solo lo necesario, lugar para cada cosa',
      },
      {
        id: 'pt2',
        label: 'Iluminación: ≥ 300 lux (oficina), ≥ 500 lux (tareas finas)',
        descripcion: 'Sin deslumbramiento, luz natural/artificial',
      },
      {
        id: 'pt3',
        label: 'Ergonomía: silla ajustable, monitor a altura ojos, teclado/mouse',
        descripcion: 'Apoyo lumbar, brazos 90°, pausa activa',
      },
      {
        id: 'pt4',
        label: 'Ventilación/climatización: confort térmico 21-24°C',
        descripcion: 'Renovación aire, sin corrientes frías',
      },
      {
        id: 'pt5',
        label: 'Rutas de evacuación: libres, señalizadas, puertas antipánico',
        descripcion: 'Plano visible, simulacro semestral',
      },
      {
        id: 'pt6',
        label: 'Extintor y botiquín accesibles ≤ 15 m',
        descripcion: 'Señalizados, revisados',
      },
      {
        id: 'pt7',
        label: 'Conexiones eléctricas: sin regletas en cadena, tomas a tierra',
        descripcion: 'Canaletas, sin cables sueltos',
      },
      {
        id: 'pt8',
        label: 'Señalización de seguridad: prohibición, obligación, advertencia',
        descripcion: 'Según riesgo identificado',
      },
    ],
    obra: [
      {
        id: 'o1',
        label: 'Perímetro: cerramiento, señalización, acceso controlado',
        descripcion: 'Cartel obra, PPE obligatorio, visitantes registrados',
      },
      {
        id: 'o2',
        label: 'Andamios/plataformas: armado certificado, tarima completa, barandas',
        descripcion: 'Inspección diaria, etiqueta verde, acceso seguro',
      },
      {
        id: 'o3',
        label: 'Trabajo en alturas: permiso, ATS, arnés, línea de vida, vigía, rescate',
        descripcion: 'Res. 4272/2021, certificación 3 años',
      },
      {
        id: 'o4',
        label: 'Riesgo eléctrico: LOTO, tableros cerrados, cableado protegido, PAT',
        descripcion: 'RETIE, NFPA 70E, multímetro CAT III/IV',
      },
      {
        id: 'o5',
        label: 'Herramientas: inspección previa, EPP según tarea, cables/extensiones',
        descripcion: 'Sin improvisaciones, mantenimiento preventivo',
      },
      {
        id: 'o6',
        label: 'Excavaciones/zanjas: apuntalamiento, escalera salida cada 25m, señalización',
        descripcion: '>1.5m: protección lateral, atmósfera si confinado',
      },
      {
        id: 'o7',
        label: 'Espacios confinados: permiso, gasímetro, ventilación, vigía, rescate',
        descripcion: 'O2 19.5-23.5%, LEL <10%, H2S <10ppm',
      },
      {
        id: 'o8',
        label: 'Maquinaria/vehículos: inspección diaria, operador certificado, bocina/luces',
        descripcion: 'Cinturón, retrovisores, freno estacionamiento',
      },
      {
        id: 'o9',
        label: 'Manejo de residuos: segregación, contenedores, disposición autorizada',
        descripcion: 'Peligrosos: contenedor homologado, ficha MSDS',
      },
      {
        id: 'o10',
        label: 'Plan de emergencias: rutas, puntos encuentro, botiquín, brigada, simulacro',
        descripcion: 'Actualizado, conocido por todos, semestral',
      },
      {
        id: 'o11',
        label: 'Señalización vial si obra en vía pública: conos, balizas, bandereros',
        descripcion: 'Plan de manejo de tráfico aprobado',
      },
      {
        id: 'o12',
        label: 'Condiciones climáticas: trabajo suspendido si viento >40km/h, lluvia, tormenta',
        descripcion: 'Plan de contingencia, refugios seguros',
      },
    ],
  };

const TIPO_LABELS: Record<string, string> = {
  herramientas: 'Herramientas',
  epp: 'EPP / Dotación',
  escaleras: 'Escaleras',
  arneses: 'Arnés / Alturas',
  vehiculo: 'Vehículo',
  botiquin: 'Botiquín',
  extintores: 'Extintores',
  puesto_trabajo: 'Puesto de Trabajo',
  obra: 'Obra / Instalación',
};

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: '#fef3c7', text: '#92400e' },
  aprobada: { bg: '#dcfce7', text: '#166534' },
  observaciones: { bg: '#fef2f2', text: '#991b1b' },
  rechazada: { bg: '#fee2e2', text: '#dc2626' },
};

interface Inspection {
  id: string;
  tipo: string;
  fecha: string;
  lugar?: string;
  responsable?: string;
  estado: string;
  resultado_json?: string;
  observaciones?: string;
  firmado_por?: string;
  firma_url?: string;
  archivo_fotos?: string;
  creado_en: string;
  actualizado_en: string;
}

interface InspectionForm {
  tipo: string;
  fecha: string;
  lugar: string;
  responsable: string;
  estado: string;
  checklist: Record<string, boolean>;
  observaciones: string;
  fotos: string[]; // base64
  firmado_por: string;
  firma_url: string;
}

const initialForm: InspectionForm = {
  tipo: 'puesto_trabajo',
  fecha: new Date().toISOString().slice(0, 10),
  lugar: '',
  responsable: '',
  estado: 'pendiente',
  checklist: {},
  observaciones: '',
  fotos: [],
  firmado_por: '',
  firma_url: '',
};

export default function Inspecciones() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [form, setForm] = useState<InspectionForm>(initialForm);
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
  const [viewingInspection, setViewingInspection] = useState<Inspection | null>(null);
  const [signingInspection, setSigningInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadInspections = useCallback(async () => {
    try {
      const data = await api.get('/inspections');
      setInspections(data as Inspection[]);
    } catch (err: any) {
      console.error('Error cargando inspecciones:', err);
    }
  }, []);

  useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  const getChecklist = (tipo: string) => INSPECTION_CHECKLISTS[tipo] || [];

  const handleInputChange = (field: string, value: any) => {
    if (field === 'checklist') {
      setForm((prev) => ({ ...prev, checklist: { ...prev.checklist, ...value } }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handlePhotoCapture = async (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: string[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const base64 = await handlePhotoCapture(file);
        newPhotos.push(base64);
      }
    }
    setForm((prev) => ({ ...prev, fotos: [...prev.fotos, ...newPhotos] }));
  };

  const removePhoto = (index: number) => {
    setForm((prev) => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== index) }));
  };

  const openInspection = (insp: Inspection) => {
    setViewingInspection(insp);
    if (insp.resultado_json) {
      try {
        const checklist = JSON.parse(insp.resultado_json);
        setForm({
          ...initialForm,
          ...insp,
          checklist,
          fotos: insp.archivo_fotos ? JSON.parse(insp.archivo_fotos) : [],
        });
      } catch {
        setForm({ ...initialForm, ...insp });
      }
    } else {
      setForm({ ...initialForm, ...insp });
    }
  };

  const editInspection = (insp: Inspection) => {
    setEditingInspection(insp);
    if (insp.resultado_json) {
      try {
        const checklist = JSON.parse(insp.resultado_json);
        setForm({
          ...initialForm,
          ...insp,
          checklist,
          fotos: insp.archivo_fotos ? JSON.parse(insp.archivo_fotos) : [],
        });
      } catch {
        setForm({ ...initialForm, ...insp });
      }
    } else {
      setForm({ ...initialForm, ...insp });
    }
  };

  const newInspection = () => {
    setEditingInspection(null);
    setViewingInspection(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = {
        ...form,
        resultado_json: JSON.stringify(form.checklist),
        archivo_fotos: JSON.stringify(form.fotos),
      };
      if (editingInspection) {
        await api.put(`/inspections/${editingInspection.id}`, payload);
        setMessage({ type: 'success', text: 'Inspección actualizada correctamente' });
      } else {
        await api.post('/inspections', payload);
        setMessage({ type: 'success', text: 'Inspección registrada correctamente' });
      }
      newInspection();
      loadInspections();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando inspección' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta inspección?')) return;
    try {
      await api.delete(`/inspections/${id}`);
      setMessage({ type: 'success', text: 'Inspección eliminada' });
      loadInspections();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error eliminando' });
    }
  };

  const handleSign = (insp: Inspection) => {
    setSigningInspection(insp);
  };

  const handleSaveSignature = async (dataUrl: string) => {
    if (!signingInspection) return;
    try {
      await api.put(`/inspections/${signingInspection.id}`, {
        firma_url: dataUrl,
        firmado_por: form.firmado_por || 'Responsable',
      });
      setMessage({ type: 'success', text: 'Firma guardada' });
      loadInspections();
      setSigningInspection(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error guardando firma' });
    }
  };

  const _showToast = (msg: string, isError = false) => {
    setMessage({ type: isError ? 'error' : 'success', text: msg });
    setTimeout(() => setMessage(null), 4000);
  };

  const checklist = getChecklist(form.tipo);
  const completedItems = Object.values(form.checklist).filter(Boolean).length;
  const totalItems = checklist.length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="ui-page inspections-page">
      <div className="ui-page-header inspections-page-header">
        <h1 className="ui-page-title">Inspecciones en Obra y Puestos de Trabajo</h1>
        <button className="ui-primary-button" onClick={newInspection} type="button">
          <Plus aria-hidden="true" size={16} /> Nueva Inspección
        </button>
      </div>

      {message && (
        <div
          className={`ui-feedback ui-feedback--${message.type}`}
          role={message.type === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </div>
      )}

      {/* Formulario */}
      <div className="ui-surface inspections-form">
        <h3 className="inspections-form-title">
          {editingInspection
            ? 'Editar Inspección'
            : viewingInspection
              ? 'Ver Inspección'
              : 'Nueva Inspección'}
        </h3>
        <form onSubmit={handleSubmit} className="inspections-form-fields">
          {/* Datos generales */}
          <div className="inspections-form-grid">
            <div>
              <label className="ui-field-label" htmlFor="insp-tipo">
                Tipo *
              </label>
              <select
                id="insp-tipo"
                value={form.tipo}
                onChange={(e) => handleInputChange('tipo', e.target.value)}
                required
              >
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="insp-fecha">
                Fecha *
              </label>
              <input
                id="insp-fecha"
                type="date"
                value={form.fecha}
                onChange={(e) => handleInputChange('fecha', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="insp-lugar">
                Lugar / Obra
              </label>
              <input
                id="insp-lugar"
                value={form.lugar}
                onChange={(e) => handleInputChange('lugar', e.target.value)}
                placeholder="Ej: Planta 2, Fachada norte, Vehículo placa XXX"
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="insp-responsable">
                Responsable
              </label>
              <input
                id="insp-responsable"
                value={form.responsable}
                onChange={(e) => handleInputChange('responsable', e.target.value)}
                placeholder="Nombre del inspector"
              />
            </div>
            <div>
              <label className="ui-field-label" htmlFor="insp-estado">
                Estado
              </label>
              <select
                id="insp-estado"
                value={form.estado}
                onChange={(e) => handleInputChange('estado', e.target.value)}
              >
                <option value="pendiente">Pendiente</option>
                <option value="aprobada">Aprobada</option>
                <option value="observaciones">Con observaciones</option>
                <option value="rechazada">Rechazada</option>
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="insp-firmado">
                Firmado por
              </label>
              <input
                id="insp-firmado"
                value={form.firmado_por}
                onChange={(e) => handleInputChange('firmado_por', e.target.value)}
                placeholder="Nombre quien firma"
              />
            </div>
          </div>

          {/* Progreso del checklist */}
          {totalItems > 0 && (
            <div className="inspections-progress">
              <div className="inspections-progress-header">
                <span className="inspections-progress-label">
                  Progreso: {completedItems} / {totalItems} items ({progress}%)
                </span>
                <span
                  className={`inspections-progress-estado${progress === 100 ? ' inspections-progress-estado--completo' : ''}`}
                >
                  {progress === 100 ? (
                    <>
                      <CircleCheck aria-hidden="true" size={14} /> Completo
                    </>
                  ) : (
                    <>
                      <Clock aria-hidden="true" size={14} /> Pendiente
                    </>
                  )}
                </span>
              </div>
              <div className="inspections-progress-bar">
                <div
                  className={`inspections-progress-fill${progress === 100 ? ' inspections-progress-fill--completo' : ''}`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Checklist específico */}
          {checklist.length > 0 && (
            <details className="inspections-checklist-details">
              <summary className="inspections-checklist-summary">
                <ClipboardList aria-hidden="true" size={14} /> Checklist: {TIPO_LABELS[form.tipo]} (
                {completedItems}/{totalItems})
              </summary>
              <div className="inspections-checklist-list">
                {checklist.map((item) => (
                  <label key={item.id} className="inspections-checklist-item">
                    <input
                      type="checkbox"
                      checked={!!form.checklist[item.id]}
                      onChange={(e) =>
                        handleInputChange('checklist', { [item.id]: e.target.checked })
                      }
                    />
                    <div>
                      <div className="inspections-checklist-label">{item.label}</div>
                      {item.descripcion && (
                        <div className="inspections-checklist-desc">{item.descripcion}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </details>
          )}

          {/* Observaciones */}
          <div>
            <label className="ui-field-label" htmlFor="insp-obs">
              Observaciones
            </label>
            <textarea
              id="insp-obs"
              value={form.observaciones}
              onChange={(e) => handleInputChange('observaciones', e.target.value)}
              rows={3}
              placeholder="Hallazgos, recomendaciones, acciones correctivas..."
              className="inspections-observaciones"
            />
          </div>

          {/* Captura de fotos */}
          <div>
            <label className="ui-field-label" htmlFor="photo-input">
              Evidencia fotográfica
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="photo-input"
            />
            <button
              type="button"
              className="inspections-photo-button"
              onClick={() => document.getElementById('photo-input')?.click()}
            >
              <Camera aria-hidden="true" size={14} /> Agregar fotos
            </button>
            {form.fotos.length > 0 && (
              <div className="inspections-fotos-list">
                {form.fotos.map((photo, idx) => (
                  <div key={idx} className="inspections-foto-thumb">
                    <img src={photo} alt={`Foto ${idx + 1}`} />
                    <button
                      type="button"
                      className="inspections-foto-remove"
                      aria-label={`Eliminar foto ${idx + 1}`}
                      onClick={() => removePhoto(idx)}
                    >
                      <X aria-hidden="true" size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Firma digital */}
          <div>
            <label className="ui-field-label" htmlFor="inspection-signature">
              Firma digital del responsable
            </label>
            {form.firma_url ? (
              <div className="inspections-firma-row">
                <img src={form.firma_url} alt="Firma" className="inspections-firma-img" />
                <button
                  type="button"
                  className="ui-action-button"
                  onClick={() => handleInputChange('firma_url', '')}
                >
                  Eliminar firma
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="inspections-firma-button"
                onClick={() => handleSign({ id: 'new' } as Inspection)}
              >
                <PenLine aria-hidden="true" size={14} /> Firmar en pantalla
              </button>
            )}
          </div>

          {/* Botones */}
          <div className="inspections-form-actions">
            <button className="ui-action-button" type="button" onClick={newInspection}>
              Cancelar
            </button>
            <button className="ui-primary-button" type="submit" disabled={loading}>
              {loading ? 'Guardando...' : editingInspection ? 'Actualizar' : 'Registrar Inspección'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de inspecciones */}
      <div className="ui-surface inspections-table-wrap">
        <table className="ui-table inspections-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Lugar</th>
              <th>Responsable</th>
              <th>Estado</th>
              <th>Checklist</th>
              <th>Fotos</th>
              <th>Firma</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {inspections.map((x) => {
              const estadoColor = ESTADO_COLORS[x.estado] || { bg: '#f3f4f6', text: '#374151' };
              const checklistData = x.resultado_json ? JSON.parse(x.resultado_json) : {};
              const completed = Object.values(checklistData).filter(Boolean).length;
              const total = INSPECTION_CHECKLISTS[x.tipo]?.length || 0;
              const hasFotos = x.archivo_fotos && JSON.parse(x.archivo_fotos).length > 0;
              const hasFirma = !!x.firma_url;
              return (
                <tr key={x.id}>
                  <td>{TIPO_LABELS[x.tipo] || x.tipo}</td>
                  <td>{x.fecha}</td>
                  <td>{x.lugar || '—'}</td>
                  <td>{x.responsable || '—'}</td>
                  <td>
                    <span
                      className="inspections-estado-badge"
                      style={{ background: estadoColor.bg, color: estadoColor.text }}
                    >
                      {x.estado}
                    </span>
                  </td>
                  <td>{total > 0 ? `${completed}/${total}` : '—'}</td>
                  <td className="inspections-cell-icon">
                    {hasFotos ? <Camera aria-label="Con fotos" size={14} /> : '—'}
                  </td>
                  <td className="inspections-cell-icon">
                    {hasFirma ? <PenLine aria-label="Con firma" size={14} /> : '—'}
                  </td>
                  <td>
                    <div className="inspections-fila-acciones">
                      <button className="inspections-button-ver" onClick={() => openInspection(x)}>
                        Ver
                      </button>
                      <button
                        className="inspections-button-editar"
                        onClick={() => editInspection(x)}
                      >
                        Editar
                      </button>
                      <button
                        className="inspections-button-eliminar"
                        aria-label={`Eliminar inspección ${x.id}`}
                        onClick={() => handleDelete(x.id)}
                      >
                        <Trash2 aria-hidden="true" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {inspections.length === 0 && (
              <tr>
                <td className="inspections-empty" colSpan={9}>
                  No hay inspecciones registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Ver Inspección */}
      {viewingInspection && (
        <div className="inspections-modal-backdrop">
          <div className="inspections-modal">
            <div className="inspections-modal-header">
              <h3>
                {TIPO_LABELS[viewingInspection.tipo] || viewingInspection.tipo} -{' '}
                {viewingInspection.fecha}
              </h3>
              <button className="ui-action-button" onClick={() => setViewingInspection(null)}>
                <X aria-hidden="true" size={14} /> Cerrar
              </button>
            </div>
            <div className="inspections-modal-body">
              <div className="inspections-view-grid">
                <div>
                  <strong>Lugar:</strong> {viewingInspection.lugar || '—'}
                </div>
                <div>
                  <strong>Responsable:</strong> {viewingInspection.responsable || '—'}
                </div>
                <div>
                  <strong>Estado:</strong>{' '}
                  <span
                    className="inspections-estado-badge"
                    style={{
                      background: (ESTADO_COLORS[viewingInspection.estado] || { bg: '#f3f4f6' }).bg,
                      color: (ESTADO_COLORS[viewingInspection.estado] || { text: '#374151' }).text,
                    }}
                  >
                    {viewingInspection.estado}
                  </span>
                </div>
                <div>
                  <strong>Firmado por:</strong> {viewingInspection.firmado_por || '—'}
                </div>
              </div>
              {viewingInspection.observaciones && (
                <div>
                  <strong>Observaciones:</strong>
                  <p className="inspections-view-observaciones">
                    {viewingInspection.observaciones}
                  </p>
                </div>
              )}
              {viewingInspection.resultado_json && (
                <details>
                  <summary className="inspections-checklist-summary">
                    <ClipboardList aria-hidden="true" size={14} /> Checklist completado
                  </summary>
                  <div className="inspections-view-checklist">
                    {(() => {
                      try {
                        const data = JSON.parse(viewingInspection.resultado_json!);
                        const items = INSPECTION_CHECKLISTS[viewingInspection.tipo] || [];
                        return items.map((item) => (
                          <div
                            key={item.id}
                            className={`inspections-view-item${data[item.id] ? ' inspections-view-item--ok' : ''}`}
                          >
                            <span className="inspections-view-item-dot">
                              {data[item.id] ? (
                                <Check aria-hidden="true" size={12} />
                              ) : (
                                <X aria-hidden="true" size={12} />
                              )}
                            </span>
                            <span>{item.label}</span>
                          </div>
                        ));
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                </details>
              )}
              {viewingInspection.archivo_fotos && (
                <details>
                  <summary className="inspections-checklist-summary">
                    <Camera aria-hidden="true" size={14} /> Fotos (
                    {JSON.parse(viewingInspection.archivo_fotos).length})
                  </summary>
                  <div className="inspections-view-fotos">
                    {JSON.parse(viewingInspection.archivo_fotos).map(
                      (photo: string, idx: number) => (
                        <img key={idx} src={photo} alt={`Foto ${idx + 1}`} />
                      )
                    )}
                  </div>
                </details>
              )}
              {viewingInspection.firma_url && (
                <div>
                  <strong>Firma:</strong>
                  <div className="inspections-firma-row">
                    <img
                      src={viewingInspection.firma_url}
                      alt="Firma"
                      className="inspections-firma-img inspections-firma-img--grande"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Firma */}
      {signingInspection && (
        <div className="inspections-modal-backdrop">
          <div className="inspections-modal inspections-modal--firma">
            <h3 className="inspections-modal-title">
              Firma digital - {TIPO_LABELS[form.tipo] || form.tipo}
            </h3>
            <SignaturePad
              onSave={handleSaveSignature}
              onCancel={() => setSigningInspection(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
