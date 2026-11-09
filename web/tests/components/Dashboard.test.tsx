import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
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
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
    expect(screen.getAllByText('Trabajadores')).toHaveLength(2);
    expect(screen.getByText('Acciones abiertas')).toBeInTheDocument();
    expect(screen.getByText('Actualizar matriz de peligros')).toBeInTheDocument();
    expect(screen.getByText(/Caída de herramienta/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver plan anual/ })).toHaveAttribute('href', '/planes');
    expect(
      within(screen.getByRole('region', { name: 'Accesos rápidos' }))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
    ).toEqual(['/trabajadores', '/estandar', '/planes', '/incidentes']);
  });

  it('muestra el estado vacío si todavía no hay información', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => Promise.resolve(
      path === '/standards/cumplimiento' ? null : []
    ));
    render(<Dashboard />);

    expect(await screen.findByText(/Bienvenido al Tablero SG-SST/)).toBeInTheDocument();
    expect(screen.getByText(/Aún no hay datos registrados/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Registrar incidente/ })).toHaveAttribute(
      'href',
      '/incidentes'
    );
  });

  it('no presenta un porcentaje cuando todavía no hay estándares evaluados', async () => {
    vi.mocked(api.get).mockImplementation((path: string) =>
      Promise.resolve(
        {
          '/standards/cumplimiento': {
            total: 0,
            cumplidos: 0,
            incumplidos: 0,
            porcentaje: 0,
          },
          '/workers': [],
          '/actions': [],
          '/incidents': [],
        }[path]
      )
    );
    render(<Dashboard />);

    expect(
      await screen.findByText('No hay una evaluación de estándares registrada.')
    ).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('distingue evaluaciones existentes de un porcentaje no reportado', async () => {
    vi.mocked(api.get).mockImplementation((path: string) =>
      Promise.resolve(
        {
          '/standards/cumplimiento': {
            total: 2,
            cumplidos: 1,
            incumplidos: 1,
          },
          '/workers': [],
          '/actions': [],
          '/incidents': [],
        }[path]
      )
    );
    render(<Dashboard />);

    expect(
      await screen.findByText('Hay estándares evaluados, pero no se reportó el porcentaje de avance.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No hay una evaluación de estándares registrada.')
    ).not.toBeInTheDocument();
  });

  it('presenta un mensaje de error cuando falla la carga', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Servicio no disponible'));
    render(<Dashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible cargar el tablero'
    );
    expect(screen.getByText('Servicio no disponible')).toBeInTheDocument();
  });
});
