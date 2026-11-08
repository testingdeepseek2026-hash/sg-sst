import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

interface LayoutProps {
  user: { nombre: string; rol: string };
  onLogout: () => void;
  children: ReactNode;
}

export default function Layout({ user, onLogout, children }: LayoutProps) {
  const [open, setOpen] = useState(true);

  const menu = [
    { to: '/dashboard', label: 'Tablero', icon: '📊' },
    { to: '/empresa', label: 'Empresa', icon: '🏢' },
    { to: '/usuarios', label: 'Usuarios', icon: '👥' },
    { to: '/roles', label: 'Roles SST', icon: '🛡️' },
    { to: '/trabajadores', label: 'Trabajadores', icon: '👷' },
    { to: '/riesgos', label: 'Matriz Riesgos', icon: '⚠️' },
    { to: '/estandar', label: 'Estándares Mínimos', icon: '✅' },
    { to: '/politica', label: 'Política SST', icon: '📋' },
    { to: '/planes', label: 'Plan Anual', icon: '📅' },
    { to: '/indicadores', label: 'Indicadores', icon: '📈' },
    { to: '/incidentes', label: 'Incidentes', icon: '🚨' },
    { to: '/inspecciones', label: 'Inspecciones', icon: '🔍' },
    { to: '/altura', label: 'Trabajo Alturas', icon: '🧗' },
    { to: '/documentos', label: 'Documentos', icon: '📄' },
    { to: '/acciones', label: 'Acciones Corr.', icon: '✏️' },
    { to: '/auditorias', label: 'Auditorías', icon: '🔎' },
    { to: '/alertas', label: 'Alertas', icon: '🔔' },
    { to: '/importar', label: 'Importar Excel', icon: '📥' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside
        style={{
          width: open ? 240 : 64,
          background: '#0f766e',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          padding: 12,
          gap: 8,
          transition: 'width 0.2s',
        }}
      >
        <div
          style={{
            fontWeight: 'bold',
            fontSize: 18,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 40,
          }}
        >
          SG-SST
        </div>
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            textAlign: 'left',
            width: '100%',
            padding: 8,
            cursor: 'pointer',
          }}
        >
          {open ? '◀' : '▶'}
        </button>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.to === '/dashboard'}
              className={({ isActive }) => (isActive ? 'active' : '')}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: open ? 10 : 0,
                padding: open ? 10 : 14,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.9)',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                borderRadius: 6,
                border: 'none',
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                fontSize: 14,
                justifyContent: open ? 'flex-start' : 'center',
                textDecoration: 'none',
              })}
            >
              <span
                style={{
                  fontSize: 18,
                  minWidth: open ? 24 : 0,
                  textAlign: open ? 'left' : 'center',
                }}
              >
                {m.icon}
              </span>
              {open && <span>{m.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.3)',
            fontSize: 12,
            opacity: 0.8,
          }}
        >
          {user.nombre} ({user.rol})
        </div>
        <button
          onClick={onLogout}
          style={{
            marginTop: 8,
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: '#fff',
            padding: 8,
            borderRadius: 6,
            width: '100%',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Cerrar sesión
        </button>
      </aside>
      <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>{children}</main>
    </div>
  );
}
