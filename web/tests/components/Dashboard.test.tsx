import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import Dashboard from '../../src/pages/Dashboard.tsx';
import { render } from '../setup.tsx';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/lib/api';

const compliance = { total: 4, cumplidos: 3, incumplidos: 1, porcentaje: 75 };
const workers = [
  { id: 'w1', nombres: 'Ana', apellidos: 'Pérez', estado: 'activo' },
  { id: 'w2', nombres: 'Luis', apellidos: 'Díaz', estado: 'activo' },
];
const actions = [
  { id: 'a1', descripcion: 'Actualizar matriz de peligros', estado: 'pendiente', fecha_limite: '2026-12-01' },
];
const incidents = [
  { id: 'i1', tipo: 'Incidente', descripcion: 'Caída de herramienta', estado: 'abierto' },
];

describe('Tablero SG-SST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((path: string) => Promise.resolve({
      '/standards/cumplimiento': compliance,
      '/workers': workers,
      '/actions': actions,
      '/incidents': incidents,
    }[path]));
  });

  it('resume el cumplimiento, trabajadores, acciones e incidentes de la API', async () => {
    render(<Dashboard />);

    expect(await screen.findByText('Tablero de Control SG-SST')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Trabajadores registrados')).toBeInTheDocument();
    expect(screen.getByText('Actualizar matriz de peligros')).toBeInTheDocument();
    expect(screen.getByText(/Caída de herramienta/)).toBeInTheDocument();
  });

  it('muestra el estado vacío si todavía no hay información', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => Promise.resolve(
      path === '/standards/cumplimiento' ? null : []
    ));
    render(<Dashboard />);

    expect(await screen.findByText(/Bienvenido al Tablero SG-SST/)).toBeInTheDocument();
    expect(screen.getByText(/Aún no hay datos registrados/)).toBeInTheDocument();
  });

  it('presenta un mensaje de error cuando falla la carga', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Servicio no disponible'));
    render(<Dashboard />);

    expect(await screen.findByText(/Error al cargar los datos/)).toBeInTheDocument();
    expect(screen.getByText('Servicio no disponible')).toBeInTheDocument();
  });
});
