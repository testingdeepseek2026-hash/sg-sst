import { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';

interface AuditLog {
  id: string;
  usuario_id: string | null;
  usuario_email: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  valores_anteriores: string | null;
  valores_nuevos: string | null;
  ip: string | null;
  creado_en: string;
}

interface AuditStats {
  total: number;
  porEntidad: { entidad: string; c: number }[];
  porAccion: { accion: string; c: number }[];
  porUsuario: { usuario_email: string; c: number }[];
}

export default function Bitacora() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    entidad: '',
    accion: '',
    usuario_id: '',
    desde: '',
    hasta: '',
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });
      if (filters.entidad) params.append('entidad', filters.entidad);
      if (filters.accion) params.append('accion', filters.accion);
      if (filters.usuario_id) params.append('usuario_id', filters.usuario_id);
      if (filters.desde) params.append('desde', filters.desde);
      if (filters.hasta) params.append('hasta', filters.hasta);

      const res = await api.get(`/audit-logs?${params.toString()}`);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Error cargando bitácora:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters, limit]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/audit-logs/stats');
      setStats(res);
    } catch (err) {
      console.error('Error cargando stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({ entidad: '', accion: '', usuario_id: '', desde: '', hasta: '' });
    setPage(0);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getAccionColor = (accion: string) => {
    switch (accion) {
      case 'crear': return '#10b981';
      case 'editar': return '#3b82f6';
      case 'eliminar': return '#ef4444';
      case 'firmar': return '#8b5cf6';
      case 'importar': return '#f59e0b';
      case 'exportar': return '#06b6d4';
      case 'login': return '#64748b';
      case 'logout': return '#64748b';
      default: return '#6b7280';
    }
  };

  const parseJsonSafe = (str: string | null) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams({
        limit: '10000',
        offset: '0',
      });
      if (filters.entidad) params.append('entidad', filters.entidad);
      if (filters.accion) params.append('accion', filters.accion);
      if (filters.usuario_id) params.append('usuario_id', filters.usuario_id);
      if (filters.desde) params.append('desde', filters.desde);
      if (filters.hasta) params.append('hasta', filters.hasta);

      const res = await api.get(`/audit-logs?${params.toString()}`);
      
      // Crear CSV
      const headers = ['ID', 'Fecha', 'Usuario', 'Email', 'Acción', 'Entidad', 'Entidad ID', 'IP'];
      const rows = res.logs.map((log: AuditLog) => [
        log.id,
        formatDate(log.creado_en),
        log.usuario_id || '—',
        log.usuario_email || '—',
        log.accion,
        log.entidad,
        log.entidad_id || '—',
        log.ip || '—',
      ]);
      
      const csv = [headers.join(','), ...rows.map((r: string[]) => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `bitacora_auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Error exportando:', err);
      alert('Error al exportar la bitácora');
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: '#1f2937' }}>📋 Bitácora de Auditoría (Trazabilidad)</h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
          Registro inmutable de cambios: quién, qué, cuándo. Protección de datos sensibles bajo Ley 1581/2012.
        </p>
      </header>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Total registros</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1f2937' }}>{stats.total.toLocaleString()}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Entidades afectadas</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1f2937' }}>{stats.porEntidad.length}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Tipos de acción</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1f2937' }}>{stats.porAccion.length}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Usuarios activos</div>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1f2937' }}>{stats.porUsuario.length}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="filter-entidad" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Entidad</label>
            <select
              id="filter-entidad"
              value={filters.entidad}
              onChange={(e) => handleFilterChange('entidad', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
            >
              <option value="">Todas</option>
              {stats?.porEntidad.map((e) => (
                <option key={e.entidad} value={e.entidad}>
                  {e.entidad} ({e.c})
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="filter-accion" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Acción</label>
            <select
              id="filter-accion"
              value={filters.accion}
              onChange={(e) => handleFilterChange('accion', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
            >
              <option value="">Todas</option>
              {stats?.porAccion.map((a) => (
                <option key={a.accion} value={a.accion}>
                  {a.accion} ({a.c})
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="filter-usuario" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Usuario (ID)</label>
            <select
              id="filter-usuario"
              value={filters.usuario_id}
              onChange={(e) => handleFilterChange('usuario_id', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
            >
              <option value="">Todos</option>
              {stats?.porUsuario.map((u) => (
                <option key={u.usuario_email} value={u.usuario_email}>
                  {u.usuario_email} ({u.c})
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor="filter-desde" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Desde</label>
            <input
              id="filter-desde"
              type="date"
              value={filters.desde}
              onChange={(e) => handleFilterChange('desde', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor="filter-hasta" style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Hasta</label>
            <input
              id="filter-hasta"
              type="date"
              value={filters.hasta}
              onChange={(e) => handleFilterChange('hasta', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={clearFilters}
              style={{ padding: '10px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}
            >
              Limpiar
            </button>
            <button
              onClick={exportLogs}
              style={{ padding: '10px 16px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              📥 Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Cargando bitácora...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No hay registros de auditoría con los filtros actuales</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Fecha</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Usuario</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Acción</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Entidad</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>ID Entidad</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>IP</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                          background: expandedId === log.id ? '#f0fdfa' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formatDate(log.creado_en)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 500 }}>{log.usuario_id || 'Sistema'}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{log.usuario_email || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              background: `${getAccionColor(log.accion)}20`,
                              color: getAccionColor(log.accion),
                              textTransform: 'capitalize',
                            }}
                          >
                            {log.accion}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{log.entidad}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                          {log.entidad_id || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                          {log.ip || '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#0f766e',
                              cursor: 'pointer',
                              fontSize: 13,
                              padding: 0,
                              textDecoration: 'underline',
                            }}
                          >
                            {expandedId === log.id ? '▼ Ocultar' : '▶ Ver cambios'}
                          </button>
                        </td>
                      </tr>
                      {expandedId === log.id ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <div style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>Valores anteriores</div>
                                  <pre
                                    style={{
                                      background: '#fff',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: 6,
                                      padding: 12,
                                      fontSize: 11,
                                      maxHeight: 300,
                                      overflow: 'auto',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {JSON.stringify(parseJsonSafe(log.valores_anteriores), null, 2) || '—'}
                                  </pre>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>Valores nuevos</div>
                                  <pre
                                    style={{
                                      background: '#fff',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: 6,
                                      padding: 12,
                                      fontSize: 11,
                                      maxHeight: 300,
                                      overflow: 'auto',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {JSON.stringify(parseJsonSafe(log.valores_nuevos), null, 2) || '—'}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#6b7280', fontSize: 14 }}>
                  Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, total)} de {total} registros
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.5 : 1 }}
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * limit >= total}
                    style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: (page + 1) * limit >= total ? 'not-allowed' : 'pointer', opacity: (page + 1) * limit >= total ? 0.5 : 1 }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info legal */}
      <div style={{ marginTop: 24, padding: 16, background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, fontSize: 13, color: '#713f12' }}>
        <strong>⚖️ Ley 1581/2012 - Protección de Datos Personales:</strong> Esta bitácora registra trazabilidad operativa. Los campos sensibles (datos médicos, restricciones, diagnósticos, archivos) se enmascaran automáticamente como <code>[DATO SENSIBLE - PROTEGIDO LEY 1581/2012]</code> en los valores anteriores/nuevos. Solo el administrador puede acceder a esta vista.
      </div>
    </div>
  );
}