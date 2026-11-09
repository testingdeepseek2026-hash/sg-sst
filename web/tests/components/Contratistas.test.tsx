import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Contratistas from '../../src/pages/Contratistas';
import { render } from '../setup';

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({ api }));

const contaractorApto = {
  id: 'ctr-1',
  nombre: 'Instalaciones Eléctricas SAS',
  nit: '900.123.456-7',
  servicio: 'Instalación de tableros',
  arl: 'Positiva',
  examen_medico: 1,
  capacitacion_sst: 1,
  epp: 1,
  estado: 'aprobado' as const,
  fecha_evaluacion: '2026-10-15',
  notas: 'Acceso solo a cuarto eléctrico.',
  creado_en: '2026-10-01T10:00:00.000Z',
  actualizado_en: '2026-10-15T10:00:00.000Z',
};

const contratistaPendiente = {
  id: 'ctr-2',
  nombre: 'Servicios de CCTV Andinos',
  nit: '901.555.222-1',
  servicio: 'Mantenimiento de cámaras',
  arl: 'Sura',
  examen_medico: 1,
  capacitacion_sst: 0,
  epp: 0,
  estado: 'pendiente' as const,
  fecha_evaluacion: '2026-11-01',
  notas: '',
  creado_en: '2026-11-01T10:00:00.000Z',
  actualizado_en: '2026-11-01T10:00:00.000Z',
};

describe('Contratistas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue([contaractorApto, contratistaPendiente]);
  });

  it('aplica los patrones visuales compartidos al formulario y al listado', async () => {
    const { container } = render(<Contratistas />);

    expect(
      await screen.findByRole('heading', {
        name: /gestión de contratistas y proveedores/i,
      })
    ).toHaveClass('ui-page-title');
    expect(screen.getByRole('button', { name: /nuevo contratista/i })).toHaveClass('ui-primary-button');
    expect(screen.getByLabelText('Nombre / Razón Social *')).toBeInTheDocument();
    expect(screen.getByText('Nombre / Razón Social *')).toHaveClass('ui-field-label');
    expect(screen.getByLabelText('Servicio / Actividad *')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado de evaluación')).toBeInTheDocument();

    // Tabla con contenedor desplazable y estados accesibles
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('.contratistas-table-wrap')).toBeInTheDocument();
    expect(screen.getAllByText('Aprobado').length).toBeGreaterThan(0);

    // Tarjeta adaptable con la misma información
    const cards = await screen.findAllByRole('article');
    const card = cards.find((c) => c.textContent?.includes('Servicios de CCTV Andinos'))!;
    expect(within(card).getByText('Servicios de CCTV Andinos')).toBeInTheDocument();
    expect(within(card).getByText('Pendiente')).toBeInTheDocument();

    // Sin emojis en la interfaz
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('permite editar un contratista desde la tarjeta adaptable', async () => {
    render(<Contratistas />);

    await screen.findByRole('heading', { name: /gestión de contratistas y proveedores/i });

    const cards = await screen.findAllByRole('article');
    const card = cards.find((c) => c.textContent?.includes('Servicios de CCTV Andinos'))!;
    fireEvent.click(within(card).getByRole('button', { name: /editar/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Editar contratista' })).toBeInTheDocument()
    );
    expect(screen.getByLabelText('Nombre / Razón Social *')).toHaveValue('Servicios de CCTV Andinos');
    expect(screen.getByLabelText('Servicio / Actividad *')).toHaveValue('Mantenimiento de cámaras');
  });

  it('muestra el error de carga en un mensaje accesible', async () => {
    api.get.mockRejectedValueOnce(new Error('No autenticado'));

    render(<Contratistas />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No autenticado');
  });
});
