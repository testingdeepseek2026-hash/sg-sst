import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Planes from '../../src/pages/Planes';
import { render } from '../setup';

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/lib/api', () => ({ api }));

const actividad = {
  id: 'plan-1',
  anio: 2026,
  objetivo: 'Actualizar la política SG-SST',
  meta: 'Política vigente',
  responsable: 'Vigía SST',
  fecha_inicio: '2026-01-01',
  fecha_fin: '2026-12-31',
  presupuesto: 0,
  estado: 'cumplido',
  programa: 'POLÍTICA DEL SISTEMA DE GESTIÓN',
  evidencia_esperada: 'Política firmada',
  meses: [1, 6],
};

describe('Plan anual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path: string) => {
      if (path === '/plans/annual') return Promise.resolve([actividad]);
      if (path === '/plans/annual/evidencias') return Promise.resolve([]);
      if (
        path === '/plans/training' ||
        path === '/plans/trainings' ||
        path === '/workers'
      ) {
        return Promise.resolve([]);
      }
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });
    api.postFile = vi.fn().mockResolvedValue({ id: 'ev-1' });
  });

  it('presenta métricas en tarjetas y pestañas accesibles', async () => {
    render(<Planes />);

    expect(
      await screen.findByRole('heading', {
        name: /plan anual de trabajo y cronograma de capacitación/i,
      })
    ).toHaveClass('ui-page-title');
    const annualTab = screen.getByRole('tab', { name: 'Plan anual' });
    expect(annualTab).toHaveAttribute('aria-selected', 'true');
    expect(annualTab).toHaveAttribute('aria-controls', 'plans-panel-planes');
    expect(screen.getByRole('tab', { name: 'Ejecución' })).not.toHaveAttribute('aria-controls');
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(document.querySelectorAll('.plans-kpi-card')).toHaveLength(6);
    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.getByText('POLÍTICA DEL SISTEMA DE GESTIÓN')).toBeInTheDocument();
    expect(screen.getByText('Exportar PDF')).toBeInTheDocument();
    expect(screen.getByText('Exportar Excel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Capacitaciones' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Capacitaciones' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'plans-panel-capacitacion');
    expect(screen.getByRole('tab', { name: 'Capacitaciones' })).toHaveAttribute(
      'aria-controls',
      'plans-panel-capacitacion'
    );
    expect(
      within(screen.getByRole('tabpanel')).getByText('Total Capacitaciones')
    ).toBeInTheDocument();
    expect(document.querySelectorAll('.plans-kpi-card')).toHaveLength(4);

    fireEvent.click(screen.getByRole('tab', { name: 'Ejecución' }));
    expect(await screen.findByRole('tabpanel')).toHaveAttribute('id', 'plans-panel-ejecucion');
    expect(screen.getByText('Total Ejecuciones')).toBeInTheDocument();
    expect(document.querySelectorAll('.plans-kpi-card')).toHaveLength(4);
  });

  it('muestra el cronograma mensual y el porcentaje de cumplimiento', async () => {
    render(<Planes />);

    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.getByTitle('Ene')).toBeInTheDocument();
    expect(screen.getByTitle('Jun')).toBeInTheDocument();
    expect(screen.getByText('Evidencia: Política firmada')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});
