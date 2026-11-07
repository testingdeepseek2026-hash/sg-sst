import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

import Layout from './components/Layout';
import { api } from './lib/api';
import Incidentes from './pages/Incidentes';
import Inspecciones from './pages/Inspecciones';
import Altura from './pages/Altura';
import Documentos from './pages/Documentos';
import Acciones from './pages/Acciones';
import Auditorias from './pages/Auditorias';
import Alertas from './pages/Alertas';
import Dashboard from './pages/Dashboard';
import Empresa from './pages/Empresa';
import Estandares from './pages/Estandares';
import Hazards from './pages/Hazards';
import Importar from './pages/Importar';
import Indicadores from './pages/Indicadores';
import Login from './pages/Login';
import Planes from './pages/Planes';
import Politica from './pages/Politica';
import Roles from './pages/Roles';
import Trabajadores from './pages/Trabajadores';
import Usuarios from './pages/Usuarios';

const PUBLIC_PAGES = ['/login'];

function App() {
  const [user, setUser] = useState<{ id: string; email: string; nombre: string; rol: string } | null>(null);
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

  if (loading) return <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:'#f3f4f6'}}><div style={{fontSize:18,color:'#0f766e'}}>Cargando SG-SST…</div></div>;

  const isAuth = !!user;
  
  // Si no está autenticado y es una página pública, mostrar login
  if (!isAuth && PUBLIC_PAGES.includes(location.pathname)) {
    return <Login onLogin={(u) => setUser(u)} />;
  }
  
  // Si no está autenticado y no es una página pública, mostrar login (el useEffect se encargará de redirigir)
  if (!isAuth) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  return (
    <Layout user={user} onLogout={() => { setUser(null); api.post('/users/logout'); }}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="empresa" element={<Empresa />} />
        <Route path="usuarios" element={<Usuarios />} />
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
        <Route path="alertas" element={<Alertas />} />
        <Route path="importar" element={<Importar />} />
        <Route path="politica" element={<Politica />} />
      </Routes>
    </Layout>
  );
}

export default App;
