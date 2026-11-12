import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';

import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Folder,
  Handshake,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Mountain,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Shield,
  Siren,
  TriangleAlert,
  Upload,
  Users,
  X,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

interface LayoutProps {
  user: { nombre: string; rol: string };
  onLogout: () => void;
  children: ReactNode;
}

const menuGroups: Array<{
  label: string;
  items: Array<{ to: string; label: string; icon: LucideIcon }>;
}> = [
  {
    label: 'Inicio',
    items: [{ to: '/dashboard', label: 'Tablero', icon: LayoutDashboard }],
  },
  {
    label: 'Planear',
    items: [
      { to: '/trabajadores', label: 'Trabajadores', icon: HardHat },
      { to: '/riesgos', label: 'Matriz de riesgos', icon: TriangleAlert },
      { to: '/estandar', label: 'Estándares mínimos', icon: ClipboardCheck },
      { to: '/politica', label: 'Política SST', icon: FileText },
      { to: '/planes', label: 'Plan anual', icon: CalendarDays },
      { to: '/indicadores', label: 'Indicadores', icon: BarChart3 },
    ],
  },
  {
    label: 'Ejecutar',
    items: [
      { to: '/incidentes', label: 'Incidentes', icon: Siren },
      { to: '/inspecciones', label: 'Inspecciones', icon: Search },
      { to: '/altura', label: 'Trabajo en alturas', icon: Mountain },
      { to: '/emergencias', label: 'Emergencias', icon: TriangleAlert },
      { to: '/contratistas', label: 'Contratistas', icon: Handshake },
    ],
  },
  {
    label: 'Verificar',
    items: [
      { to: '/acciones', label: 'Acciones correctivas', icon: ClipboardList },
      { to: '/auditorias', label: 'Auditorías', icon: Search },
      { to: '/bitacora', label: 'Bitácora de auditoría', icon: Folder },
      { to: '/alertas', label: 'Alertas', icon: Bell },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/empresa', label: 'Empresa', icon: Building2 },
      { to: '/usuarios', label: 'Usuarios', icon: Users },
      { to: '/roles', label: 'Roles SST', icon: Shield },
      { to: '/documentos', label: 'Documentos', icon: FileText },
      { to: '/importar', label: 'Importar Excel', icon: Upload },
    ],
  },
];

const getMenuGroupsForRole = (rol: string) =>
  menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.to !== '/usuarios' || rol === 'administrador'),
    }))
    .filter((group) => group.items.length > 0);

export default function Layout({ user, onLogout, children }: LayoutProps) {
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const visibleMenuGroups = getMenuGroupsForRole(user.rol);

  const closeMobileMenu = () => {
    setMobileOpen(false);
    mobileMenuButton.current?.focus();
  };

  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileMenu();
        return;
      }

      if (event.key === 'Tab') {
        const focusable = Array.from(
          sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []
        ).filter((element) => !element.classList.contains('app-sidebar-toggle'));
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.querySelector<HTMLElement>('.app-sidebar a')?.focus();

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };

    desktop.addEventListener('change', handleBreakpointChange);
    return () => desktop.removeEventListener('change', handleBreakpointChange);
  }, []);

  return (
    <div className={`app-shell${expanded ? '' : ' app-shell--collapsed'}`}>
      {mobileOpen && (
        <button
          aria-label="Cerrar navegación"
          className="app-sidebar-backdrop"
          onClick={closeMobileMenu}
          tabIndex={-1}
          type="button"
        />
      )}

      <aside
        aria-label="Navegación de SG-SST"
        className={`app-sidebar${mobileOpen ? ' app-sidebar--mobile-open' : ''}`}
        id="app-navigation"
        ref={sidebar}
      >
        <div className="app-sidebar-header">
          <div className="app-brand">
            <span aria-hidden="true" className="app-brand-mark">
              S
            </span>
            <span className="app-sidebar-label">SG-SST</span>
          </div>
          <button
            aria-expanded={expanded}
            aria-label={expanded ? 'Contraer menú' : 'Expandir menú'}
            className="app-sidebar-toggle"
            onClick={() => setExpanded((value) => !value)}
            title={expanded ? 'Contraer menú' : 'Expandir menú'}
            type="button"
          >
            {expanded ? (
              <PanelLeftClose aria-hidden="true" />
            ) : (
              <PanelLeftOpen aria-hidden="true" />
            )}
          </button>
          <button
            aria-label="Cerrar menú de navegación"
            className="app-sidebar-mobile-close"
            onClick={closeMobileMenu}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Navegación principal" className="app-navigation">
          {visibleMenuGroups.map((group) => (
            <section aria-label={group.label} className="app-navigation-group" key={group.label}>
              <h2 className="app-navigation-heading">{group.label}</h2>
              <div className="app-navigation-items">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    aria-label={label}
                    className={({ isActive }) =>
                      `app-navigation-link${isActive ? ' app-navigation-link--active' : ''}`
                    }
                    end={to === '/dashboard'}
                    key={to}
                    onClick={() => {
                      if (mobileOpen) closeMobileMenu();
                    }}
                    title={!expanded ? label : undefined}
                    to={to}
                  >
                    <Icon aria-hidden="true" className="app-navigation-icon" />
                    <span className="app-sidebar-label">{label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-user-summary" title={`${user.nombre} (${user.rol})`}>
            <span aria-hidden="true" className="app-user-avatar">
              {user.nombre.trim().charAt(0).toUpperCase()}
            </span>
            <span className="app-user-details app-sidebar-label">
              <span className="app-user-name">{user.nombre}</span>
              <span className="app-user-role">{user.rol}</span>
            </span>
          </div>
          <button className="app-logout-button" onClick={onLogout} type="button">
            <LogOut aria-hidden="true" className="app-navigation-icon" />
            <span className="app-sidebar-label">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-mobile-header">
          <button
            aria-controls="app-navigation"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="app-mobile-menu-button"
            onClick={() => setMobileOpen(true)}
            ref={mobileMenuButton}
            type="button"
          >
            {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <span>SG-SST</span>
        </div>
        {children}
      </main>
    </div>
  );
}
