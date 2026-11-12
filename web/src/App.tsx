import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import Layout from './components/Layout';
import { api } from './lib/api';

const Acciones = lazy(() => import('./pages/Acciones'));
const Alertas = lazy(() => import('./pages/Alertas'));
const Altura = lazy(() => import('./pages/Altura'));
const Auditorias = lazy(() => import('./pages/Auditorias'));
const Bitacora = lazy(() => import('./pages/Bitacora'));
const Contratistas = lazy(() => import('./pages/Contratistas'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Documentos = lazy(() => import('./pages/Documentos'));
const Emergencias = lazy(() => import('./pages/Emergencias'));
const Empresa = lazy(() => import('./pages/Empresa'));
const Estandares = lazy(() => import('./pages/Estandares'));
const Hazards = lazy(() => import('./pages/Hazards'));
const Importar = lazy(() => import('./pages/Importar'));
const Incidentes = lazy(() => import('./pages/Incidentes'));
const Indicadores = lazy(() => import('./pages/Indicadores'));
const Inspecciones = lazy(() => import('./pages/Inspecciones'));
const Login = lazy(() => import('./pages/Login'));
const Planes = lazy(() => import('./pages/Planes'));
const Politica = lazy(() => import('./pages/Politica'));
const Roles = lazy(() => import('./pages/Roles'));
const Trabajadores = lazy(() => import('./pages/Trabajadores'));
const Usuarios = lazy(() => import('./pages/Usuarios'));

const PUBLIC_PAGES = ['/login'];

function AppLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={`app-loading${fullScreen ? ' app-loading--screen' : ''}`}
      role="status"
    >
      <span aria-hidden="true" className="app-loading-indicator" />
      <span>Cargando SG-SST…</span>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<{
    id: string;
    email: string;
    nombre: string;
    rol: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get('/users/me');
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Manejo de redirección con useEffect para evitar problemas de renderizado
  useEffect(() => {
    if (loading) return;

    const isAuth = !!user;

    if (!isAuth && !PUBLIC_PAGES.includes(location.pathname)) {
      navigate('/login', { replace: true });
    } else if (isAuth && location.pathname === '/login') {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  if (loading) return <AppLoading fullScreen />;

  const isAuth = !!user;

  // Si no está autenticado y es una página pública, mostrar login
  if (!isAuth && PUBLIC_PAGES.includes(location.pathname)) {
    return (
      <Suspense fallback={<AppLoading fullScreen />}>
        <Login onLogin={(u) => setUser(u)} />
      </Suspense>
    );
  }

  // Si no está autenticado y no es una página pública, mostrar login (el useEffect se encargará de redirigir)
  if (!isAuth) {
    return (
      <Suspense fallback={<AppLoading fullScreen />}>
        <Login onLogin={(u) => setUser(u)} />
      </Suspense>
    );
  }

  return (
    <Layout
      user={user}
      onLogout={() => {
        setUser(null);
        api.post('/users/logout');
      }}
    >
      <Suspense fallback={<AppLoading />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="empresa" element={<Empresa />} />
          <Route path="usuarios" element={<Usuarios rol={user.rol} />} />
          <Route path="roles" element={<Roles />} />
          <Route path="trabajadores" element={<Trabajadores />} />
          <Route path="riesgos" element={<Hazards />} />
          <Route path="estandar" element={<Estandares />} />
          <Route path="planes" element={<Planes />} />
          <Route path="indicadores" element={<Indicadores />} />
          <Route path="incidentes" element={<Incidentes />} />
          <Route path="inspecciones" element={<Inspecciones />} />
          <Route path="altura" element={<Altura />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="acciones" element={<Acciones />} />
          <Route path="auditorias" element={<Auditorias />} />
          <Route path="bitacora" element={<Bitacora />} />
          <Route path="emergencias" element={<Emergencias />} />
          <Route path="contratistas" element={<Contratistas />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="importar" element={<Importar />} />
          <Route path="politica" element={<Politica />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default App;
