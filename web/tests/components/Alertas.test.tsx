import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import Alertas from '../../src/pages/Alertas';
import { render } from '../setup';

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../src/lib/api', () => ({ api }));

const pendingAlert = {
  id: 'alert-1',
  tipo: 'examen',
  worker_nombre: 'Ana',
  worker_apellido: 'Pérez',
  fecha_vencimiento: '2026-12-01',
  prioridad: 'alta',
  detalle: 'Programar examen periódico',
};

const sentAlert = {
  ...pendingAlert,
  id: 'alert-2',
  enviado_en: '2026-11-08T15:00:00.000Z',
};

describe('Alertas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path: string) => {
      if (path === '/alerts?enviado=0&limit=200') return Promise.resolve([pendingAlert]);
      if (path === '/alerts?enviado=1&limit=200') return Promise.resolve([sentAlert]);
      if (path === '/alerts/stats') {
        return Promise.resolve({ pendientes: 1, enviadas: 0, vencidas: 0, total: 1 });
      }
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });
  });

  it('presenta tarjetas móviles con la misma alerta y permite seleccionarla', async () => {
    render(<Alertas />);

    expect(await screen.findByRole('heading', { name: /alertas y recordatorios/i })).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveTextContent('Ana Pérez');
    expect(screen.getByRole('article')).toHaveTextContent('Programar examen periódico');

    const mobileCheckbox = screen.getByRole('checkbox', { name: /seleccionar alerta de ana/i });
    fireEvent.click(mobileCheckbox);
    await waitFor(() => expect(mobileCheckbox).toBeChecked());
  });

  it('muestra el historial enviado en el mismo formato móvil', async () => {
    render(<Alertas />);
    await screen.findByRole('heading', { name: /alertas y recordatorios/i });
    fireEvent.click(screen.getByRole('tab', { name: /enviadas/i }));

    expect(await screen.findByRole('article')).toHaveTextContent('Ana Pérez');
    expect(screen.getByRole('article')).toHaveTextContent('Enviada');
  });
});
