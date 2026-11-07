import { useEffect, useState } from 'react';

import { api } from '../lib/api';

const PLANTILLA_POLITICA = `POLÍTICA DE SEGURIDAD Y SALUD EN EL TRABAJO (SST)

Micro Instalaciones Electrónicas SAS

NIT: 900.123.456-7

1. COMPROMISO DE LA ALTA DIRECCIÓN
La alta dirección de Micro Instalaciones Electrónicas SAS, en cumplimiento del Decreto 1072 de 2015 (Capítulo 6, Título 4, Libro 2) y la Resolución 0312 de 2019, declara su compromiso inequívoco con la Seguridad y Salud en el Trabajo (SST) como parte fundamental de la gestión empresarial.

2. OBJETIVO GENERAL
Prevenir el deterioro de la salud de los trabajadores, contratistas, visitantes y público en general, mediante la identificación de peligros, evaluación y valoración de riesgos, y la implementación de controles efectivos en todas nuestras actividades de instalación de sistemas electrónicos de seguridad (CCTV, alarmas, control de acceso, cableado estructurado).

3. PRINCIPIOS FUNDAMENTALES
3.1. Prevención del deterioro de la salud: La prevención es prioritaria sobre la corrección. Se identificarán, evaluarán y controlarán los riesgos en su origen.
3.2. Cumplimiento de requisitos legales y otros: Cumpliremos con la normatividad colombiana aplicable (Decreto 1072/2015, Res. 0312/2019, Res. 4272/2021, RETIE, Ley 1581/2012) y demás requisitos que la organización suscriba.
3.3. Mejora continua del SG-SST: Estableceremos objetivos medibles, indicadores de estructura, proceso y resultado, y revisaremos periódicamente el desempeño para mejorar continuamente.
3.4. Participación de los trabajadores: Garantizaremos la consulta y participación de los trabajadores y sus representantes (Vigía SST) en la identificación de peligros, evaluación de riesgos, investigación de incidentes y toma de decisiones en SST.
3.5. Revisión periódica: La alta dirección revisará el SG-SST al menos una vez al año para evaluar su idoneidad, adecuación y eficacia.

4. ALCANCE
Esta política aplica a todas las actividades, procesos, instalaciones y personal (propio y contratistas) de Micro Instalaciones Electrónicas SAS, incluyendo trabajos en obra, instalaciones en alturas, riesgo eléctrico, espacios confinados y conducción de vehículos.

5. RESPONSABILIDADES
- Representante Legal: Aprobar, firmar y divulgar la política; asignar recursos necesarios.
- Responsable SG-SST: Diseñar, implementar, mantener y mejorar el SG-SST; reportar a la alta dirección.
- Vigía SST: Velar por el cumplimiento, participar en inspecciones e investigaciones, recibir quejas y sugerencias.
- Trabajadores: Cumplir normas de SST, usar EPP, reportar condiciones inseguras y participar en capacitaciones.

6. COMUNICACIÓN Y DIVULGACIÓN
Esta política será comunicada a todos los trabajadores mediante inducción, reinducción, carteleras, medios digitales y reuniones. Se mantendrá disponible en lugar visible y accesible.

7. REVISIÓN Y ACTUALIZACIÓN
La política se revisará anualmente en la Revisión por la Dirección o cuando ocurran cambios significativos en la organización, normatividad o resultados del SG-SST.

FIRMAS

__________________________________________
Representante Legal
Fecha: _______________

__________________________________________
Responsable SG-SST
Fecha: _______________

Fecha de divulgación: _______________

Versión: 1`;

type PolicyStatus = 'borrador' | 'vigente' | 'archivada';
type ObjectiveType = 'estructura' | 'proceso' | 'resultado';
type ObjectiveStatus = 'pendiente' | 'cumplido' | 'en_proceso' | 'incumplido';

interface Objective {
  id: string;
  policy_id: string;
  descripcion: string;
  tipo: ObjectiveType;
  meta: string | null;
  responsable: string | null;
  fecha_limite: string | null;
  estado: ObjectiveStatus;
}

interface Policy {
  id: string;
  version: number;
  titulo: string;
  contenido: string;
  firmado_por: string | null;
  fecha_firma: string | null;
  fecha_divulgacion: string | null;
  estado: PolicyStatus;
  objectives?: Objective[];
}

interface ObjectiveForm {
  descripcion: string;
  tipo: ObjectiveType;
  meta: string;
  responsable: string;
  fecha_limite: string;
  estado: ObjectiveStatus;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function Politica() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [activePolicy, setActivePolicy] = useState<Policy | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorTitulo, setEditorTitulo] = useState('');
  const [objModalOpen, setObjModalOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [objForm, setObjForm] = useState<ObjectiveForm>({
    descripcion: '',
    tipo: 'proceso' as 'estructura' | 'proceso' | 'resultado',
    meta: '',
    responsable: '',
    fecha_limite: '',
    estado: 'pendiente' as 'pendiente' | 'cumplido' | 'en_proceso' | 'incumplido',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const pols: Policy[] = await api.get('/policies');
      const active = pols.find((policy) => policy.estado === 'vigente') || null;
      setPolicies(pols);
      setActivePolicy(active);
      setObjectives(active?.objectives || []);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Error cargando datos'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 4000);
  };

  const handleNewDraft = () => {
    setEditorTitulo('Política SST');
    setEditorContent(PLANTILLA_POLITICA);
    setEditingPolicy(null);
    setEditorOpen(true);
  };

  const handleEditDraft = (policy: Policy) => {
    if (policy.estado !== 'borrador') {
      showToast('Solo se pueden editar políticas en estado borrador', true);
      return;
    }
    setEditorTitulo(policy.titulo);
    setEditorContent(policy.contenido);
    setEditingPolicy(policy);
    setEditorOpen(true);
  };

  const handleSaveEditor = async () => {
    try {
      if (editingPolicy) {
        await api.put(`/policies/${editingPolicy.id}`, {
          titulo: editorTitulo,
          contenido: editorContent,
        });
        showToast('Política actualizada (nueva versión creada si estaba vigente)');
      } else {
        await api.post('/policies', {
          titulo: editorTitulo,
          contenido: editorContent,
          estado: 'borrador',
        });
        showToast('Política creada como borrador');
      }
      setEditorOpen(false);
      loadData();
    } catch (err: unknown) {
      showToast(errorMessage(err, 'Error guardando'), true);
    }
  };

  const handleFirmar = async (policy: Policy) => {
    const firmadoPor = prompt('Nombre de quien firma (Representante Legal / Responsable SG-SST):');
    if (!firmadoPor) return;
    try {
      await api.post(`/policies/${policy.id}/firmar`, { firmado_por: firmadoPor });
      showToast('Política firmada y puesta en vigente');
      loadData();
    } catch (err: unknown) {
      showToast(errorMessage(err, 'Error firmando'), true);
    }
  };

  const handleDivulgar = async (policy: Policy) => {
    if (!confirm('Registrar fecha de divulgación hoy?')) return;
    try {
      await api.post(`/policies/${policy.id}/divulgar`);
      showToast('Fecha de divulgación registrada');
      loadData();
    } catch (err: unknown) {
      showToast(errorMessage(err, 'Error divulgando'), true);
    }
  };

  const handleArchivar = async (policy: Policy) => {
    if (!confirm('Archivar esta política?')) return;
    try {
      await api.post(`/policies/${policy.id}/archivar`);
      showToast('Política archivada');
      loadData();
    } catch (err: unknown) {
      showToast(errorMessage(err, 'Error archivando'), true);
    }
  };

  const handleDelete = async (policy: Policy) => {
    if (!confirm('Eliminar política borrador? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/policies/${policy.id}`);
      showToast('Política eliminada');
      loadData();
    } catch (err: unknown) {
      showToast(errorMessage(err, 'Error eliminando'), true);
    }
  };

  const handleExportPDF = () => {
    window.location.href = '/api/export/politica';
  };

  // Objetivos
  const openObjModal = (obj?: Objective) => {
    if (obj) {
      setEditingObjective(obj);
      setObjForm({
        descripcion: obj.descripcion,
        tipo: obj.tipo,
        meta: obj.meta || '',
        responsable: obj.responsable || '',
        fecha_limite: obj.fecha_limite || '',
        estado: obj.estado,
      });
    } else {
      setEditingObjective(null);
      setObjForm({
        descripcion: '',
        tipo: 'proceso',
        meta: '',
        responsable: '',
        fecha_limite: '',
        estado: 'pendiente',
      });
    }
    setObjModalOpen(true);
  };

  const handleSaveObjective = async () => {
    if (!activePolicy) return;
    try {
      if (editingObjective) {
        await api.put(`/objectives/${editingObjective.id}`, objForm);
        showToast('Objetivo actualizado');
      } else {
        await api.post(`/policies/${activePolicy.id}/objectives`, objForm);
        showToast('Objetivo creado');
      }
      setObjModalOpen(false);
      loadData();
    } catch (err: unknown) {
      showToast(errorMessage(err, 'Error guardando objetivo'), true);
    }
  };

  const handleDeleteObjective = async (id: string) => {
    if (!confirm('Eliminar objetivo?')) return;
    try {
      await api.delete(`/objectives/${id}`);
      showToast('Objetivo eliminado');
      loadData();
    } catch (err: unknown) {
      showToast(errorMessage(err, 'Error eliminando'), true);
    }
  };

  const getEstadoColor = (estado: PolicyStatus) => {
    switch (estado) {
      case 'vigente':
        return '#0f766e';
      case 'borrador':
        return '#f59e0b';
      case 'archivada':
        return '#6b7280';
      default:
        return '#374151';
    }
  };

  const getTipoLabel = (tipo: ObjectiveType) => {
    const labels: Record<ObjectiveType, string> = {
      estructura: '🏗️ Estructura',
      proceso: '⚙️ Proceso',
      resultado: '📊 Resultado',
    };
    return labels[tipo] || tipo;
  };

  if (loading)
    return <div style={{ padding: 20, textAlign: 'center' }}>Cargando Política SST…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0, color: '#0f766e' }}>Política SST y Objetivos</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleNewDraft}
            style={{
              padding: '8px 14px',
              background: '#0f766e',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 'bold',
            }}
          >
            Nueva versión (borrador)
          </button>
          <button
            onClick={handleExportPDF}
            style={{
              padding: '8px 14px',
              background: '#e5e7eb',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {success && (
        <div
          style={{
            background: '#ecfdf5',
            color: '#065f46',
            padding: 10,
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          {success}
        </div>
      )}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#991b1b',
            padding: 10,
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Lista de versiones */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#0f766e', marginBottom: 12 }}>Histórico de Versiones</h2>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: '#fff',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          <thead>
            <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Versión</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Título</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Estado</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Firmado por</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha Firma</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Fecha Divulgación</th>
              <th style={{ padding: 10, fontSize: 12, color: '#374151' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 10, fontWeight: 'bold' }}>{p.version}</td>
                <td style={{ padding: 10 }}>{p.titulo}</td>
                <td style={{ padding: 10 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 'bold',
                      background: getEstadoColor(p.estado) + '20',
                      color: getEstadoColor(p.estado),
                    }}
                  >
                    {p.estado.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: 10, fontSize: 12 }}>{p.firmado_por || '-'}</td>
                <td style={{ padding: 10, fontSize: 12 }}>
                  {p.fecha_firma ? p.fecha_firma.slice(0, 10) : '-'}
                </td>
                <td style={{ padding: 10, fontSize: 12 }}>
                  {p.fecha_divulgacion ? p.fecha_divulgacion.slice(0, 10) : '-'}
                </td>
                <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                  {p.estado === 'borrador' && (
                    <>
                      <button
                        onClick={() => handleEditDraft(p)}
                        style={{
                          padding: '4px 8px',
                          background: '#0f766e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleFirmar(p)}
                        style={{
                          padding: '4px 8px',
                          background: '#16a34a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Firmar y vigentizar
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        style={{
                          padding: '4px 8px',
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                  {p.estado === 'vigente' && (
                    <>
                      <button
                        onClick={() => handleDivulgar(p)}
                        disabled={!!p.fecha_divulgacion}
                        style={{
                          padding: '4px 8px',
                          background: p.fecha_divulgacion ? '#9ca3af' : '#2563eb',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: p.fecha_divulgacion ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {p.fecha_divulgacion ? 'Divulgada' : 'Divulgar'}
                      </button>
                      <button
                        onClick={() => handleArchivar(p)}
                        style={{
                          padding: '4px 8px',
                          background: '#f59e0b',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Archivar
                      </button>
                    </>
                  )}
                  {p.estado === 'archivada' && (
                    <span
                      style={{
                        padding: '4px 8px',
                        background: '#f3f4f6',
                        color: '#6b7280',
                        borderRadius: 4,
                        fontSize: 11,
                      }}
                    >
                      Archivada
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Editor de Política */}
      {editorOpen && (
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
          }}
        >
          <div
            style={{
              background: '#fff',
              width: '90%',
              maxWidth: 900,
              maxHeight: '90vh',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ margin: 0, color: '#0f766e' }}>
                {editingPolicy ? 'Editar Política' : 'Nueva Política (Borrador)'}
              </h2>
              <button
                onClick={() => setEditorOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 16, flex: 1, overflow: 'auto' }}>
              <div style={{ marginBottom: 12 }}>
                <label
                  htmlFor="policy-title"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Título
                </label>
                <input
                  id="policy-title"
                  value={editorTitulo}
                  onChange={(e) => setEditorTitulo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                />
              </div>
              <label
                htmlFor="policy-content"
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontSize: 13,
                  fontWeight: 'bold',
                  color: '#374151',
                }}
              >
                Contenido
              </label>
              <textarea
                id="policy-content"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 400,
                  padding: 12,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  lineHeight: 1.6,
                  resize: 'vertical',
                }}
                spellCheck={true}
              />
            </div>
            <div
              style={{
                padding: 16,
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                onClick={() => setEditorOpen(false)}
                style={{
                  padding: '8px 16px',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEditor}
                style={{
                  padding: '8px 16px',
                  background: '#0f766e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 'bold',
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Objetivos de la Política Vigente */}
      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ color: '#0f766e', margin: 0 }}>
            Objetivos SST -{' '}
            {activePolicy
              ? `v${activePolicy.version} (${activePolicy.estado})`
              : 'Sin política vigente'}
          </h2>
          {activePolicy && activePolicy.estado === 'vigente' && (
            <button
              onClick={() => openObjModal()}
              style={{
                padding: '8px 14px',
                background: '#0f766e',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 'bold',
              }}
            >
              Nuevo Objetivo
            </button>
          )}
        </div>

        {activePolicy && activePolicy.estado === 'vigente' && (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: '#fff',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}
          >
            <thead>
              <tr style={{ background: '#ecfdf5', textAlign: 'left' }}>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Descripción</th>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Tipo</th>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Meta</th>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Responsable</th>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Fecha Límite</th>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Estado</th>
                <th style={{ padding: 10, fontSize: 12, color: '#065f46' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {objectives.map((obj) => (
                <tr key={obj.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 10 }}>{obj.descripcion}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{ fontSize: 12 }}>{getTipoLabel(obj.tipo)}</span>
                  </td>
                  <td style={{ padding: 10, fontSize: 12 }}>{obj.meta || '-'}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>{obj.responsable || '-'}</td>
                  <td style={{ padding: 10, fontSize: 12 }}>
                    {obj.fecha_limite ? obj.fecha_limite.slice(0, 10) : '-'}
                  </td>
                  <td style={{ padding: 10 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 'bold',
                        background:
                          obj.estado === 'cumplido'
                            ? '#dcfce7'
                            : obj.estado === 'en_proceso'
                              ? '#dbeafe'
                              : obj.estado === 'incumplido'
                                ? '#fee2e2'
                                : '#f3f4f6',
                        color:
                          obj.estado === 'cumplido'
                            ? '#166534'
                            : obj.estado === 'en_proceso'
                              ? '#1e40af'
                              : obj.estado === 'incumplido'
                                ? '#991b1b'
                                : '#374151',
                      }}
                    >
                      {obj.estado.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: 10, display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => openObjModal(obj)}
                      style={{
                        padding: '4px 8px',
                        background: '#0f766e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteObjective(obj.id)}
                      style={{
                        padding: '4px 8px',
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {objectives.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}
                  >
                    No hay objetivos definidos para la política vigente. Cree uno nuevo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {!activePolicy || activePolicy.estado !== 'vigente' ? (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              padding: 16,
              borderRadius: 8,
              color: '#92400e',
            }}
          >
            <strong>No hay política vigente.</strong> Cree una nueva versión, edítela y use
            &quot;Firmar y vigentizar&quot; para activarla. Luego podrá agregar objetivos.
          </div>
        ) : null}
      </section>

      {/* Modal Objetivo */}
      {objModalOpen && (
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
          }}
        >
          <div
            style={{
              background: '#fff',
              width: '90%',
              maxWidth: 500,
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ margin: '0 0 16px', color: '#0f766e' }}>
              {editingObjective ? 'Editar Objetivo' : 'Nuevo Objetivo'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label
                  htmlFor="objective-description"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Descripción *
                </label>
                <textarea
                  id="objective-description"
                  value={objForm.descripcion}
                  onChange={(e) => setObjForm({ ...objForm, descripcion: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="objective-type"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Tipo *
                </label>
                <select
                  id="objective-type"
                  value={objForm.tipo}
                  onChange={(e) =>
                    setObjForm({ ...objForm, tipo: e.target.value as ObjectiveType })
                  }
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <option value="estructura">Estructura</option>
                  <option value="proceso">Proceso</option>
                  <option value="resultado">Resultado</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="objective-goal"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Meta
                </label>
                <input
                  id="objective-goal"
                  value={objForm.meta}
                  onChange={(e) => setObjForm({ ...objForm, meta: e.target.value })}
                  placeholder="Ej: 0 accidentes, 100% capacitación"
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="objective-owner"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Responsable
                </label>
                <input
                  id="objective-owner"
                  value={objForm.responsable}
                  onChange={(e) => setObjForm({ ...objForm, responsable: e.target.value })}
                  placeholder="Nombre o cargo"
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="objective-due-date"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Fecha Límite
                </label>
                <input
                  id="objective-due-date"
                  type="date"
                  value={objForm.fecha_limite}
                  onChange={(e) => setObjForm({ ...objForm, fecha_limite: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="objective-status"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 'bold',
                    color: '#374151',
                  }}
                >
                  Estado
                </label>
                <select
                  id="objective-status"
                  value={objForm.estado}
                  onChange={(e) =>
                    setObjForm({ ...objForm, estado: e.target.value as ObjectiveStatus })
                  }
                  style={{
                    width: '100%',
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="cumplido">Cumplido</option>
                  <option value="incumplido">Incumplido</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setObjModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveObjective}
                style={{
                  padding: '8px 16px',
                  background: '#0f766e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 'bold',
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
