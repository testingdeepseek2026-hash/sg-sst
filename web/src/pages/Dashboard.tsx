import { useEffect, useState } from 'react';

import { api } from '../lib/api';

function card(title: string, value: React.ReactNode, sub?: string) {
  return (
    <div
      style={{
        background: '#fff',
        padding: 16,
        borderRadius: 10,
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 26, fontWeight: 'bold', color: '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [std, setStd] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, w, a, i] = await Promise.all([
          api.get('/standards/cumplimiento'),
          api.get('/workers'),
          api.get('/actions'),
          api.get('/incidents'),
        ]);
        setStd(s);
        setWorkers(w);
        setActions(a);
        setIncidents(i);
      } catch (err: any) {
        console.error('Error cargando datos del dashboard:', err);
        setError(err.message || 'Error cargando datos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 20, color: '#6b7280' }}>Cargando tablero...</div>;

  if (error)
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            padding: 20,
            borderRadius: 10,
            color: '#991b1b',
            maxWidth: 600,
            margin: '0 auto',
          }}
        >
          <h3 style={{ marginTop: 0 }}>⚠️ Error al cargar los datos</h3>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              background: '#0f766e',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Intentar recargar
          </button>
        </div>
      </div>
    );

  // Si no hay datos, mostrar estado vacío
  if (!std && !workers.length && !actions.length && !incidents.length) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <h2 style={{ color: '#0f766e', marginBottom: 16 }}>📊 Bienvenido al Tablero SG-SST</h2>
        <p style={{ color: '#6b7280', marginBottom: 20 }}>
          Aún no hay datos registrados. Comienza cargando información en los módulos
          correspondientes.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            maxWidth: 600,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 16,
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}
          >
            <h4 style={{ margin: '0 0 8px', color: '#0f766e' }}>🔐 Registro Usuario</h4>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
              Crea un usuario administrador desde la base de datos o semilla
            </p>
          </div>
          <div
            style={{
              background: '#fff',
              padding: 16,
              borderRadius: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}
          >
            <h4 style={{ margin: '0 0 8px', color: '#0f766e' }}>📋 Trabajadores</h4>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
              Registra trabajadores, exámenes médicos y certificaciones
            </p>
          </div>
        </div>
      </div>
    );
  }

  const vencidos = (actions || []).filter(
    (x: any) => x.estado === 'pendiente' || x.estado === 'en_proceso'
  ).length;
  const abiertos = (incidents || []).filter((x: any) => x.estado !== 'cerrado').length;
  const pct = std?.porcentaje ?? 0;
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ marginBottom: 20, color: '#0f766e' }}>Tablero de Control SG-SST</h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        {card(
          'Cumplimiento Estándares Mínimos',
          <span style={{ color }}>{pct}%</span>,
          'Estado general del SG-SST'
        )}
        {card('Trabajadores registrados', workers?.length ?? 0, 'Fichas activas')}
        {card('Acciones pendientes', vencidos, 'Correctivas / preventivas')}
        {card('Incidentes abiertos', abiertos, 'Sin cerrar')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div
          style={{
            background: '#fff',
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          <h3 style={{ marginBottom: 10, fontSize: 15, color: '#0f766e' }}>Acciones recientes</h3>
          <ul style={{ paddingLeft: 18, color: '#4b5563' }}>
            {(actions || []).slice(0, 5).map((x: any) => (
              <li key={x.id} style={{ marginBottom: 6 }}>
                {x.descripcion}{' '}
                <span style={{ color: '#6b7280', fontSize: 12 }}>
                  ({x.estado}, vence {x.fecha_limite})
                </span>
              </li>
            ))}
            {!actions?.length && <li style={{ color: '#9ca3af' }}>Sin acciones registradas</li>}
          </ul>
        </div>
        <div
          style={{
            background: '#fff',
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          <h3 style={{ marginBottom: 10, fontSize: 15, color: '#0f766e' }}>Últimos incidentes</h3>
          <ul style={{ paddingLeft: 18, color: '#4b5563' }}>
            {(incidents || []).slice(0, 5).map((x: any) => (
              <li key={x.id} style={{ marginBottom: 6 }}>
                {x.tipo} - {x.descripcion}{' '}
                <span style={{ color: '#6b7280', fontSize: 12 }}>({x.estado})</span>
              </li>
            ))}
            {!incidents?.length && <li style={{ color: '#9ca3af' }}>Sin incidentes registrados</li>}
          </ul>
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          background: '#fff',
          padding: 16,
          borderRadius: 10,
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        }}
      >
        <h3 style={{ marginBottom: 10, fontSize: 15, color: '#0f766e' }}>
          Resumen de cumplimiento
        </h3>
        <p>
          Estándares evaluados: <b>{std?.total ?? 0}</b> | Cumplidos:{' '}
          <b style={{ color: '#10b981' }}>{std?.cumplidos ?? 0}</b> | Incumplidos:{' '}
          <b style={{ color: '#ef4444' }}>{std?.incumplidos ?? 0}</b>
        </p>
      </div>
    </div>
  );
}
