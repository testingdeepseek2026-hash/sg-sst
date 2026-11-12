import { useEffect, useState } from 'react';

import { X } from 'lucide-react';

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

  const getPolicyBadgeClass = (estado: PolicyStatus) => {
    switch (estado) {
      case 'vigente':
        return 'ui-badge--ok';
      case 'borrador':
        return 'ui-badge--warn';
      case 'archivada':
        return '';
      default:
        return '';
    }
  };

  const getTipoLabel = (tipo: ObjectiveType) => {
    const labels: Record<ObjectiveType, string> = {
      estructura: 'Estructura',
      proceso: 'Proceso',
      resultado: 'Resultado',
    };
    return labels[tipo] || tipo;
  };

  const getObjectiveBadgeClass = (estado: string) => {
    switch (estado) {
      case 'cumplido':
        return 'ui-badge--ok';
      case 'en_proceso':
        return 'ui-badge--info';
      case 'incumplido':
        return 'ui-badge--danger';
      default:
        return '';
    }
  };

  if (loading) return <div className="policy-loading">Cargando Política SST…</div>;

  return (
    <div className="ui-page policy-page">
      <header className="ui-page-header policy-page-header">
        <h1 className="ui-page-title">Política SST y Objetivos</h1>
        <div className="policy-page-header-actions">
          <button className="ui-primary-button" onClick={handleNewDraft} type="button">
            Nueva versión (borrador)
          </button>
          <button className="ui-action-button" onClick={handleExportPDF} type="button">
            Exportar PDF
          </button>
        </div>
      </header>

      {success && <div className="ui-feedback ui-feedback--success">{success}</div>}
      {error && <div className="ui-feedback ui-feedback--error">{error}</div>}

      {/* Lista de versiones */}
      <section className="policy-table-section policy-section">
        <h2 className="policy-section-title">Histórico de Versiones</h2>
        <table className="policy-table">
          <thead>
            <tr>
              <th>Versión</th>
              <th>Título</th>
              <th>Estado</th>
              <th>Firmado por</th>
              <th>Fecha Firma</th>
              <th>Fecha Divulgación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id}>
                <td className="policy-cell-destacado">{p.version}</td>
                <td>{p.titulo}</td>
                <td>
                  <span className={`ui-badge ${getPolicyBadgeClass(p.estado)}`}>
                    {p.estado.toUpperCase()}
                  </span>
                </td>
                <td>{p.firmado_por || '-'}</td>
                <td>{p.fecha_firma ? p.fecha_firma.slice(0, 10) : '-'}</td>
                <td>{p.fecha_divulgacion ? p.fecha_divulgacion.slice(0, 10) : '-'}</td>
                <td>
                  <div className="policy-row-actions">
                    {p.estado === 'borrador' && (
                      <>
                        <button
                          className="policy-row-button policy-row-button--brand"
                          onClick={() => handleEditDraft(p)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="policy-row-button policy-row-button--ok"
                          onClick={() => handleFirmar(p)}
                          type="button"
                        >
                          Firmar y vigentizar
                        </button>
                        <button
                          className="policy-row-button policy-row-button--danger"
                          onClick={() => handleDelete(p)}
                          type="button"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                    {p.estado === 'vigente' && (
                      <>
                        <button
                          className="policy-row-button policy-row-button--info"
                          disabled={!!p.fecha_divulgacion}
                          onClick={() => handleDivulgar(p)}
                          type="button"
                        >
                          {p.fecha_divulgacion ? 'Divulgada' : 'Divulgar'}
                        </button>
                        <button
                          className="policy-row-button policy-row-button--warn"
                          onClick={() => handleArchivar(p)}
                          type="button"
                        >
                          Archivar
                        </button>
                      </>
                    )}
                    {p.estado === 'archivada' && <span className="ui-badge">Archivada</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Editor de Política */}
      {editorOpen && (
        <div className="policy-modal-backdrop">
          <div className="policy-modal policy-modal--editor">
            <div className="policy-modal-header">
              <h2 className="policy-modal-title">
                {editingPolicy ? 'Editar Política' : 'Nueva Política (Borrador)'}
              </h2>
              <button
                aria-label="Cerrar editor"
                className="ui-icon-button"
                onClick={() => setEditorOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <div className="policy-modal-body">
              <div className="policy-editor-field">
                <label className="ui-field-label" htmlFor="policy-title">
                  Título
                </label>
                <input
                  id="policy-title"
                  value={editorTitulo}
                  onChange={(e) => setEditorTitulo(e.target.value)}
                />
              </div>
              <label className="ui-field-label" htmlFor="policy-content">
                Contenido
              </label>
              <textarea
                id="policy-content"
                className="policy-editor-textarea"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                spellCheck={true}
              />
            </div>
            <div className="policy-modal-footer">
              <button
                className="ui-action-button"
                onClick={() => setEditorOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button className="ui-primary-button" onClick={handleSaveEditor} type="button">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Objetivos de la Política Vigente */}
      <section className="policy-table-section">
        <div className="policy-section-header">
          <h2 className="policy-section-title">
            Objetivos SST -{' '}
            {activePolicy
              ? `v${activePolicy.version} (${activePolicy.estado})`
              : 'Sin política vigente'}
          </h2>
          {activePolicy && activePolicy.estado === 'vigente' && (
            <button className="ui-primary-button" onClick={() => openObjModal()} type="button">
              Nuevo Objetivo
            </button>
          )}
        </div>

        {activePolicy && activePolicy.estado === 'vigente' && (
          <table className="policy-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Meta</th>
                <th>Responsable</th>
                <th>Fecha Límite</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {objectives.map((obj) => (
                <tr key={obj.id}>
                  <td>{obj.descripcion}</td>
                  <td>{getTipoLabel(obj.tipo)}</td>
                  <td>{obj.meta || '-'}</td>
                  <td>{obj.responsable || '-'}</td>
                  <td>{obj.fecha_limite ? obj.fecha_limite.slice(0, 10) : '-'}</td>
                  <td>
                    <span className={`ui-badge ${getObjectiveBadgeClass(obj.estado)}`}>
                      {obj.estado.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div className="policy-row-actions">
                      <button
                        className="policy-row-button policy-row-button--brand"
                        onClick={() => openObjModal(obj)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="policy-row-button policy-row-button--danger"
                        onClick={() => handleDeleteObjective(obj.id)}
                        type="button"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {objectives.length === 0 && (
                <tr>
                  <td className="policy-empty-cell" colSpan={7}>
                    No hay objetivos definidos para la política vigente. Cree uno nuevo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {!activePolicy || activePolicy.estado !== 'vigente' ? (
          <div className="policy-warning">
            <strong>No hay política vigente.</strong> Cree una nueva versión, edítela y use
            &quot;Firmar y vigentizar&quot; para activarla. Luego podrá agregar objetivos.
          </div>
        ) : null}
      </section>

      {/* Modal Objetivo */}
      {objModalOpen && (
        <div className="policy-modal-backdrop">
          <div className="policy-modal policy-modal--objetivo">
            <h2 className="policy-modal-title">
              {editingObjective ? 'Editar Objetivo' : 'Nuevo Objetivo'}
            </h2>
            <div className="policy-modal-fields">
              <div>
                <label className="ui-field-label" htmlFor="objective-description">
                  Descripción *
                </label>
                <textarea
                  id="objective-description"
                  value={objForm.descripcion}
                  onChange={(e) => setObjForm({ ...objForm, descripcion: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="ui-field-label" htmlFor="objective-type">
                  Tipo *
                </label>
                <select
                  id="objective-type"
                  value={objForm.tipo}
                  onChange={(e) =>
                    setObjForm({ ...objForm, tipo: e.target.value as ObjectiveType })
                  }
                >
                  <option value="estructura">Estructura</option>
                  <option value="proceso">Proceso</option>
                  <option value="resultado">Resultado</option>
                </select>
              </div>
              <div>
                <label className="ui-field-label" htmlFor="objective-goal">
                  Meta
                </label>
                <input
                  id="objective-goal"
                  value={objForm.meta}
                  onChange={(e) => setObjForm({ ...objForm, meta: e.target.value })}
                  placeholder="Ej: 0 accidentes, 100% capacitación"
                />
              </div>
              <div>
                <label className="ui-field-label" htmlFor="objective-owner">
                  Responsable
                </label>
                <input
                  id="objective-owner"
                  value={objForm.responsable}
                  onChange={(e) => setObjForm({ ...objForm, responsable: e.target.value })}
                  placeholder="Nombre o cargo"
                />
              </div>
              <div>
                <label className="ui-field-label" htmlFor="objective-due-date">
                  Fecha Límite
                </label>
                <input
                  id="objective-due-date"
                  type="date"
                  value={objForm.fecha_limite}
                  onChange={(e) => setObjForm({ ...objForm, fecha_limite: e.target.value })}
                />
              </div>
              <div>
                <label className="ui-field-label" htmlFor="objective-status">
                  Estado
                </label>
                <select
                  id="objective-status"
                  value={objForm.estado}
                  onChange={(e) =>
                    setObjForm({ ...objForm, estado: e.target.value as ObjectiveStatus })
                  }
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="cumplido">Cumplido</option>
                  <option value="incumplido">Incumplido</option>
                </select>
              </div>
            </div>
            <div className="policy-modal-footer">
              <button
                className="ui-action-button"
                onClick={() => setObjModalOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button className="ui-primary-button" onClick={handleSaveObjective} type="button">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
