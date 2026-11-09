import { useCallback, useEffect, useState } from 'react';

import { SignaturePad } from '@/components/SignaturePad';
import { api } from '@/lib/api';

// Checklists específicos por tipo de inspección
const INSPECTION_CHECKLISTS: Record<string, { id: string; label: string; descripcion?: string }[]> = {
  herramientas: [
    { id: 'h1', label: 'Estado general de herramientas manuales', descripcion: 'Sin grietas, mangos firmes, sin óxido' },
    { id: 'h2', label: 'Herramientas eléctricas: cableado y aislamiento', descripcion: 'Sin cables pelados, conectores en buen estado' },
    { id: 'h3', label: 'Protecciones y guardas en sierras/radiales', descripcion: 'Guardas fijas y móviles funcionando' },
    { id: 'h4', label: 'Taladros/atornilladores: embrague y mandril', descripcion: 'Embrague regulado, mandril sin holgura' },
    { id: 'h5', label: 'Extintores portátiles cerca del área de trabajo', descripcion: 'Accesibles, con carga vigente, señalizados' },
    { id: 'h6', label: 'Orden y limpieza en taller/baúl de herramientas', descripcion: 'Sin aceites derramados, pasillos libres' },
  ],
  epp: [
    { id: 'e1', label: 'Casco de seguridad: sin grietas, suspensión completa', descripcion: 'Vencimiento < 5 años, barbijo funcional' },
    { id: 'e2', label: 'Protección ocular: lentes/gafas sin rayones', descripcion: 'Certificación ANSI Z87.1 o equivalente' },
    { id: 'e3', label: 'Protección auditiva: tapones/orejeras limpios', descripcion: 'SNR adecuado al nivel de ruido' },
    { id: 'e4', label: 'Guantes: según riesgo (corte, dieléctricos, químicos)', descripcion: 'Talla correcta, sin roturas, certificados' },
    { id: 'e5', label: 'Calzado de seguridad: puntera y suela antideslizante', descripcion: 'Certificación SRC, sin suelas desgastadas' },
    { id: 'e6', label: 'Protección facial/careta para esmeril/soldadura', descripcion: 'Pantalla IR/UV, estado óptico bueno' },
    { id: 'e7', label: 'Arnés de cuerpo completo: costuras, hebillas, etiqueta', descripcion: 'Certificado, vida útil < 5 años, sin daños' },
    { id: 'e8', label: 'Línea de vida y dispositivo anticaídas', descripcion: 'Cable/cinta sin cortes, absorbedor de energía' },
    { id: 'e9', label: 'Ropa de trabajo: manga larga, reflectiva si vial', descripcion: 'Sin desgarros, alta visibilidad clase 2/3' },
    { id: 'e10', label: 'Respirador: filtro correcto, ajuste facial (fit test)', descripcion: 'Filtro vigente, pieza facial limpia' },
  ],
  escaleras: [
    { id: 'es1', label: 'Escalera tipo tijera: bisagras, topes, peldaños', descripcion: 'Sin peldaños doblados, topes antideslizantes' },
    { id: 'es2', label: 'Escalera de apoyo: patas antideslizantes, ganchos', descripcion: 'Ángulo 75° (regla 1:4), apoyo firme' },
    { id: 'es3', label: 'Escalera de fibra de vidrio (dieléctrica) si cerca de eléctrico', descripcion: 'Sin grietas, certificación dieléctrica vigente' },
    { id: 'es4', label: 'Altura máxima de trabajo según tipo de escalera', descripcion: 'No pararse en últimos 2 peldaños (mano) / plataforma (tijera)' },
    { id: 'es5', label: 'Inspección visual mensual registrada', descripcion: 'Etiqueta de inspección vigente' },
    { id: 'es6', label: 'Escalera asegurada (amarre superior) o vigía', descripcion: 'Prevención de deslizamiento lateral' },
  ],
  arneses: [
    { id: 'a1', label: 'Arnés: costuras, argollas D, hebillas, etiqueta', descripcion: 'Certificado EN 361, vida útil < 5 años' },
    { id: 'a2', label: 'Línea de vida/restricción: cable/cinta, absorbedor', descripcion: 'Sin cortes, quemaduras, deformaciones EN 354/355' },
    { id: 'a3', label: 'Dispositivo anticaídas retráctil/deslizante', descripcion: 'Funcionamiento suave, freno probado, certificado EN 360' },
    { id: 'a4', label: 'Anclajes certificados (>15 kN) y accesibles', descripcion: 'Etiqueta/registro de certificación' },
    { id: 'a5', label: 'Plan de rescate disponible y conocido', descripcion: 'Equipo de rescate, personal capacitado' },
    { id: 'a6', label: 'Certificación trabajo en alturas vigente (3 años)', descripcion: 'Res. 4272/2021, carné vigente' },
  ],
  vehiculo: [
    { id: 'v1', label: 'Frenos: pedal, freno de mano, líquido', descripcion: 'Frenado parejo, sin ruidos, nivel OK' },
    { id: 'v2', label: 'Neumáticos: presión, banda de rodadura (>1.6mm), rueda de auxilio', descripcion: 'Desgaste uniforme, sin cortes/burbujas' },
    { id: 'v3', label: 'Luces: delanteras, traseras, intermitentes, freno, reversa', descripcion: 'Todas funcionando, lentes limpios' },
    { id: 'v4', label: 'Espejos: retrovisor, laterales, sin grietas', descripcion: 'Bien ajustados, visión clara' },
    { id: 'v5', label: 'Cinturones de seguridad: anclajes, retractor, hebillas', descripcion: 'Todos los puestos, funcionando' },
    { id: 'v6', label: 'Extintor: carga vigente, accesible, señalizado', descripcion: 'Peso/presión OK, soporte fijo' },
    { id: 'v7', label: 'Botiquín de primeros auxilios completo', descripcion: 'Según Res. 0312/2019, vencimientos OK' },
    { id: 'v8', label: 'Carga asegurada: redes, cinchas, separador cabina', descripcion: 'Sin objetos sueltos en cabina' },
    { id: 'v9', label: 'Documentación: SOAT, tecnomecánica, licencia conductor', descripcion: 'Vigentes, originales en vehículo' },
    { id: 'v10', label: 'Limpieza interior/exterior, parabrisas sin grietas', descripcion: 'Visibilidad 360°, limpiaparabrisas OK' },
  ],
  botiquin: [
    { id: 'b1', label: 'Botiquín accesible, señalizado, limpio y ordenado', descripcion: 'Visible, sin obstáculos, lista de contenido' },
    { id: 'b2', label: 'Material de curación: gasas, algodón, esparadrapo, tijeras', descripcion: 'Estériles, vencimientos vigentes' },
    { id: 'b3', label: 'Antisépticos: povidona yodada, alcohol, suero fisiológico', descripcion: 'Frascos cerrados, fecha vigente' },
    { id: 'b4', label: 'Medicamentos básicos: analgésicos, antihistamínicos', descripcion: 'Según protocolo médico, vencimientos OK' },
    { id: 'b5', label: 'Elementos de inmovilización: férulas, collarín, tabla', descripcion: 'Completos, en buen estado' },
    { id: 'b6', label: 'EPP para atención: guantes, mascarillas, gafas', descripcion: 'Desechables, stock suficiente' },
    { id: 'b7', label: 'Registro de usos y reposiciones actualizado', descripcion: 'Firmado por responsable, mensual' },
    { id: 'b8', label: 'Capacitado en primeros auxilios designado y vigente', descripcion: 'Carné/certificado vigente (2 años)' },
  ],
  extintores: [
    { id: 'ex1', label: 'Ubicación: visible, accesible, ≤ 15 m de riesgo', descripcion: 'Señalización fotoluminiscente, soporte' },
    { id: 'ex2', label: 'Tipo correcto: ABC (general), CO2 (eléctrico), K (cocinas)', descripcion: 'Según riesgo de la zona' },
    { id: 'ex3', label: 'Presión/manómetro en zona verde (carga vigente)', descripcion: 'Peso según etiqueta, sin fugas' },
    { id: 'ex4', label: 'Manguera/boquilla: sin obstrucciones, gatillo funcional', descripcion: 'Boquilla correcta según tipo' },
    { id: 'ex5', label: 'Etiqueta de recarga/revisión anual vigente', descripcion: 'Empresa certificada, fecha < 1 año' },
    { id: 'ex6', label: 'Instrucciones de uso visibles (pictograma PASS)', descripcion: 'En español, legibles' },
    { id: 'ex7', label: 'Capacitación brigada/uso extintores vigente', descripcion: 'Práctica anual, registro firmado' },
  ],
  puesto_trabajo: [
    { id: 'pt1', label: 'Orden y limpieza: 5S aplicados', descripcion: 'Solo lo necesario, lugar para cada cosa' },
    { id: 'pt2', label: 'Iluminación: ≥ 300 lux (oficina), ≥ 500 lux (tareas finas)', descripcion: 'Sin deslumbramiento, luz natural/artificial' },
    { id: 'pt3', label: 'Ergonomía: silla ajustable, monitor a altura ojos, teclado/mouse', descripcion: 'Apoyo lumbar, brazos 90°, pausa activa' },
    { id: 'pt4', label: 'Ventilación/climatización: confort térmico 21-24°C', descripcion: 'Renovación aire, sin corrientes frías' },
    { id: 'pt5', label: 'Rutas de evacuación: libres, señalizadas, puertas antipánico', descripcion: 'Plano visible, simulacro semestral' },
    { id: 'pt6', label: 'Extintor y botiquín accesibles ≤ 15 m', descripcion: 'Señalizados, revisados' },
    { id: 'pt7', label: 'Conexiones eléctricas: sin regletas en cadena, tomas a tierra', descripcion: 'Canaletas, sin cables sueltos' },
    { id: 'pt8', label: 'Señalización de seguridad: prohibición, obligación, advertencia', descripcion: 'Según riesgo identificado' },
  ],
  obra: [
    { id: 'o1', label: 'Perímetro: cerramiento, señalización, acceso controlado', descripcion: 'Cartel obra, PPE obligatorio, visitantes registrados' },
    { id: 'o2', label: 'Andamios/plataformas: armado certificado, tarima completa, barandas', descripcion: 'Inspección diaria, etiqueta verde, acceso seguro' },
    { id: 'o3', label: 'Trabajo en alturas: permiso, ATS, arnés, línea de vida, vigía, rescate', descripcion: 'Res. 4272/2021, certificación 3 años' },
    { id: 'o4', label: 'Riesgo eléctrico: LOTO, tableros cerrados, cableado protegido, PAT', descripcion: 'RETIE, NFPA 70E, multímetro CAT III/IV' },
    { id: 'o5', label: 'Herramientas: inspección previa, EPP según tarea, cables/extensiones', descripcion: 'Sin improvisaciones, mantenimiento preventivo' },
    { id: 'o6', label: 'Excavaciones/zanjas: apuntalamiento, escalera salida cada 25m, señalización', descripcion: '>1.5m: protección lateral, atmósfera si confinado' },
    { id: 'o7', label: 'Espacios confinados: permiso, gasímetro, ventilación, vigía, rescate', descripcion: 'O2 19.5-23.5%, LEL <10%, H2S <10ppm' },
    { id: 'o8', label: 'Maquinaria/vehículos: inspección diaria, operador certificado, bocina/luces', descripcion: 'Cinturón, retrovisores, freno estacionamiento' },
    { id: 'o9', label: 'Manejo de residuos: segregación, contenedores, disposición autorizada', descripcion: 'Peligrosos: contenedor homologado, ficha MSDS' },
    { id: 'o10', label: 'Plan de emergencias: rutas, puntos encuentro, botiquín, brigada, simulacro', descripcion: 'Actualizado, conocido por todos, semestral' },
    { id: 'o11', label: 'Señalización vial si obra en vía pública: conos, balizas, bandereros', descripcion: 'Plan de manejo de tráfico aprobado' },
    { id: 'o12', label: 'Condiciones climáticas: trabajo suspendido si viento >40km/h, lluvia, tormenta', descripcion: 'Plan de contingencia, refugios seguros' },
  ],
};

const TIPO_LABELS: Record<string, string> = {
  herramientas: '🔧 Herramientas',
  epp: '🛡️ EPP / Dotación',
  escaleras: '🪜 Escaleras',
  arneses: '🪢 Arnés / Alturas',
  vehiculo: '🚗 Vehículo',
  botiquin: '🩹 Botiquín',
  extintores: '🧯 Extintores',
  puesto_trabajo: '🪑 Puesto de Trabajo',
  obra: '🏗️ Obra / Instalación',
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
      setForm(prev => ({ ...prev, checklist: { ...prev.checklist, ...value } }));
    } else {
      setForm(prev => ({ ...prev, [field]: value }));
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
    setForm(prev => ({ ...prev, fotos: [...prev.fotos, ...newPhotos] }));
  };

  const removePhoto = (index: number) => {
    setForm(prev => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== index) }));
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
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#0f766e' }}>Inspecciones en Obra y Puestos de Trabajo</h1>
        <button onClick={newInspection} style={{ padding: '10px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
          + Nueva Inspección
        </button>
      </div>

      {message && (
        <div style={{ background: message.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: message.type === 'success' ? '#065f46' : '#991b1b', padding: 10, borderRadius: 8, marginBottom: 14 }}>
          {message.text}
        </div>
      )}

      {/* Formulario */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>{editingInspection ? 'Editar Inspección' : viewingInspection ? 'Ver Inspección' : 'Nueva Inspección'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Datos generales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label htmlFor="insp-tipo" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Tipo *</label>
              <select id="insp-tipo" value={form.tipo} onChange={e => handleInputChange('tipo', e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="insp-fecha" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fecha *</label>
              <input id="insp-fecha" type="date" value={form.fecha} onChange={e => handleInputChange('fecha', e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} required />
            </div>
            <div>
              <label htmlFor="insp-lugar" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Lugar / Obra</label>
              <input id="insp-lugar" value={form.lugar} onChange={e => handleInputChange('lugar', e.target.value)} placeholder="Ej: Planta 2, Fachada norte, Vehículo placa XXX" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
            <div>
              <label htmlFor="insp-responsable" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Responsable</label>
              <input id="insp-responsable" value={form.responsable} onChange={e => handleInputChange('responsable', e.target.value)} placeholder="Nombre del inspector" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
            <div>
              <label htmlFor="insp-estado" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Estado</label>
              <select id="insp-estado" value={form.estado} onChange={e => handleInputChange('estado', e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}>
                <option value="pendiente">Pendiente</option>
                <option value="aprobada">Aprobada</option>
                <option value="observaciones">Con observaciones</option>
                <option value="rechazada">Rechazada</option>
              </select>
            </div>
            <div>
              <label htmlFor="insp-firmado" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Firmado por</label>
              <input id="insp-firmado" value={form.firmado_por} onChange={e => handleInputChange('firmado_por', e.target.value)} placeholder="Nombre quien firma" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
            </div>
          </div>

          {/* Progreso del checklist */}
          {totalItems > 0 && (
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: '#166534' }}>Progreso: {completedItems} / {totalItems} items ({progress}%)</span>
                <span style={{ color: progress === 100 ? '#16a34a' : '#f59e0b' }}>{progress === 100 ? '✅ Completo' : '⏳ Pendiente'}</span>
              </div>
              <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#16a34a' : '#f59e0b', transition: 'width 0.3s' }}></div>
              </div>
            </div>
          )}

          {/* Checklist específico */}
          {checklist.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0f766e', fontSize: 14 }}>📋 Checklist: {TIPO_LABELS[form.tipo]} ({completedItems}/{totalItems})</summary>
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {checklist.map((item) => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 10, background: '#f9fafb', borderRadius: 6, cursor: 'pointer', border: '1px solid #e5e7eb' }}>
                    <input
                      type="checkbox"
                      checked={!!form.checklist[item.id]}
                      onChange={e => handleInputChange('checklist', { [item.id]: e.target.checked })}
                      style={{ marginTop: 2, width: 18, height: 18, accentColor: '#0f766e' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{item.label}</div>
                      {item.descripcion && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.descripcion}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </details>
          )}

          {/* Observaciones */}
          <div>
            <label htmlFor="insp-obs" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Observaciones</label>
            <textarea id="insp-obs" value={form.observaciones} onChange={e => handleInputChange('observaciones', e.target.value)} rows={3} placeholder="Hallazgos, recomendaciones, acciones correctivas..." style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          {/* Captura de fotos */}
          <div>
            <label htmlFor="photo-input" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>📷 Evidencia fotográfica</label>
            <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} id="photo-input" />
            <button type="button" onClick={() => document.getElementById('photo-input')?.click()} style={{ padding: '8px 16px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 8 }}>
              📷 Agregar fotos
            </button>
            {form.fotos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {form.fotos.map((photo, idx) => (
                  <div key={idx} style={{ position: 'relative', width: 100, height: 100, borderRadius: 6, overflow: 'hidden', border: '1px solid #d1d5db' }}>
                    <img src={photo} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button type="button" onClick={() => removePhoto(idx)} style={{ position: 'absolute', top: 2, right: 2, padding: '2px 6px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Firma digital */}
          <div>
            <label htmlFor="inspection-signature" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>✍️ Firma digital del responsable</label>
            {form.firma_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={form.firma_url} alt="Firma" style={{ maxHeight: 60, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff' }} />
                <button type="button" onClick={() => handleInputChange('firma_url', '')} style={{ padding: '6px 12px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Eliminar firma</button>
              </div>
            ) : (
              <button type="button" onClick={() => handleSign({ id: 'new' } as Inspection)} style={{ padding: '8px 16px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                ✍️ Firmar en pantalla
              </button>
            )}
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={newInspection} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ padding: '10px 16px', background: loading ? '#94a3b8' : '#0f766e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Guardando...' : editingInspection ? 'Actualizar' : 'Registrar Inspección'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de inspecciones */}
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Tipo</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Lugar</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Responsable</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Checklist</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fotos</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Firma</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
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
                <tr key={x.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 10, fontSize: 12 }}>{TIPO_LABELS[x.tipo] || x.tipo}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{x.fecha}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{x.lugar || '—'}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{x.responsable || '—'}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: estadoColor.bg, color: estadoColor.text }}>{x.estado}</span>
                  </td>
                  <td style={{ padding: 10, fontSize: 12 }}>{total > 0 ? `${completed}/${total}` : '—'}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>{hasFotos ? '📷' : '—'}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>{hasFirma ? '✅' : '—'}</td>
                  <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                    <button onClick={() => openInspection(x)} style={{ padding: '4px 8px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Ver</button>
                    <button onClick={() => editInspection(x)} style={{ padding: '4px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => handleDelete(x.id)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              );
            })}
            {inspections.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>No hay inspecciones registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Ver Inspección */}
      {viewingInspection && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, overflow: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f766e' }}>{TIPO_LABELS[viewingInspection.tipo] || viewingInspection.tipo} - {viewingInspection.fecha}</h3>
              <button onClick={() => setViewingInspection(null)} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕ Cerrar</button>
            </div>
            <div style={{ padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div><strong>Lugar:</strong> {viewingInspection.lugar || '—'}</div>
                <div><strong>Responsable:</strong> {viewingInspection.responsable || '—'}</div>
                <div><strong>Estado:</strong> <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: (ESTADO_COLORS[viewingInspection.estado] || { bg: '#f3f4f6' }).bg, color: (ESTADO_COLORS[viewingInspection.estado] || { text: '#374151' }).text }}>{viewingInspection.estado}</span></div>
                <div><strong>Firmado por:</strong> {viewingInspection.firmado_por || '—'}</div>
              </div>
              {viewingInspection.observaciones && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Observaciones:</strong>
                  <p style={{ marginTop: 4, whiteSpace: 'pre-wrap', background: '#f9fafb', padding: 12, borderRadius: 6 }}>{viewingInspection.observaciones}</p>
                </div>
              )}
              {viewingInspection.resultado_json && (
                <details style={{ marginBottom: 16 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0f766e' }}>📋 Checklist completado</summary>
                  <div style={{ marginTop: 12 }}>
                    {(() => {
                      try {
                        const data = JSON.parse(viewingInspection.resultado_json!);
                        const items = INSPECTION_CHECKLISTS[viewingInspection.tipo] || [];
                        return items.map(item => (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: data[item.id] ? '#dcfce7' : '#fee2e2', borderRadius: 4, marginBottom: 4 }}>
                            <span style={{ width: 20, height: 20, borderRadius: '50%', background: data[item.id] ? '#16a34a' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>{data[item.id] ? '✓' : '✗'}</span>
                            <span style={{ fontSize: 13 }}>{item.label}</span>
                          </div>
                        ));
                      } catch { return null; }
                    })()}
                  </div>
                </details>
              )}
              {viewingInspection.archivo_fotos && (
                <details style={{ marginBottom: 16 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0f766e' }}>📷 Fotos ({JSON.parse(viewingInspection.archivo_fotos).length})</summary>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {JSON.parse(viewingInspection.archivo_fotos).map((photo: string, idx: number) => (
                      <img key={idx} src={photo} alt={`Foto ${idx + 1}`} style={{ maxWidth: 200, maxHeight: 150, borderRadius: 6, border: '1px solid #d1d5db' }} />
                    ))}
                  </div>
                </details>
              )}
              {viewingInspection.firma_url && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Firma:</strong>
                  <div style={{ marginTop: 8 }}>
                    <img src={viewingInspection.firma_url} alt="Firma" style={{ maxHeight: 80, border: '1px solid #d1d5db', borderRadius: 4 }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Firma */}
      {signingInspection && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', color: '#0f766e' }}>Firma digital - {TIPO_LABELS[form.tipo] || form.tipo}</h3>
            <SignaturePad onSave={handleSaveSignature} onCancel={() => setSigningInspection(null)} />
          </div>
        </div>
      )}
    </div>
  );
}