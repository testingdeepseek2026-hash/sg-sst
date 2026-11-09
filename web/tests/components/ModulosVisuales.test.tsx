import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import Auditorias from '../../src/pages/Auditorias';
import Emergencias from '../../src/pages/Emergencias';
import Incidentes from '../../src/pages/Incidentes';
import Indicadores from '../../src/pages/Indicadores';
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

const incidente = {
  id: 'inc-1',
  tipo: 'accidente',
  codigo: 'INC-001',
  fecha_ocurrencia: '2026-11-01',
  trabajador_id: null,
  lugar: 'Obra Norte',
  descripcion: 'Caída de escalera',
  lesiones: null,
  causa_raiz: null,
  acciones_correctivas: null,
  reporte_arl: false,
  reporte_eps: false,
  reporte_mintrabajo: false,
  dias_perdidos: 1,
  estado: 'investigando',
  investigador: 'Responsable SG-SST',
  fecha_cierre: null,
  creado_en: '2026-11-01T10:00:00.000Z',
};

const accion = {
  id: 'act-1',
  incident_id: 'inc-1',
  descripcion: 'Reemplazar la escalera',
  responsable: 'Responsable SG-SST',
  fecha_limite: '2026-12-01',
  estado: 'pendiente',
  evidencia_url: null,
  creado_en: '2026-11-02T10:00:00.000Z',
  completada_en: null,
};

describe('Módulos con sistema visual compartido', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);

    api.get.mockImplementation((path: string) => {
      if (path.startsWith('/incidents')) {
        if (path === '/incidents') return Promise.resolve([incidente]);
        if (path === '/incidents/inc-1') return Promise.resolve(incidente);
        if (path === '/incidents/inc-1/actions') return Promise.resolve([accion]);
        return Promise.reject(new Error(`Ruta inesperada: ${path}`));
      }
      if (path.startsWith('/workers')) return Promise.resolve([]);
      if (path.startsWith('/indicators')) return Promise.resolve([]);
      if (path.startsWith('/emergency-plans')) return Promise.resolve([]);
      if (path.startsWith('/drills')) return Promise.resolve([]);
      if (path.startsWith('/audits')) {
        if (path === '/audits') return Promise.resolve([]);
        return Promise.resolve({ total: 0, abiertos: 0, en_proceso: 0, cerrados: 0, verificados: 0, vencidos: 0 });
      }
      return Promise.reject(new Error(`Ruta inesperada: ${path}`));
    });

    api.post.mockResolvedValue({});
    api.put.mockResolvedValue({});
    api.delete.mockResolvedValue({});
  });

  it('Incidentes usa textos en español sin secuencias escapadas y muestra las pestañas', async () => {
    render(<Incidentes />);

    expect(
      await screen.findByRole('heading', { name: /reporte e investigación de incidentes/i })
    ).toHaveClass('ui-page-title');

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Registro', 'Investigación', 'Acciones correctivas', 'Seguimiento']);

    const texto = document.body.textContent ?? '';
    expect(texto).not.toContain('\\u');
    expect(texto).toMatch(/Investigación/);
  });

  it('Incidentes registra un incidente enviando trabajador_id null cuando no se selecciona', async () => {
    render(<Incidentes />);

    fireEvent.change(await screen.findByLabelText('Descripción del suceso *'), {
      target: { value: 'Incidente de prueba sin trabajador' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar incidente/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/incidents', expect.any(Object)));
    const payload = (api.post as vi.Mock).mock.calls[0][1];
    expect(payload.descripcion).toBe('Incidente de prueba sin trabajador');
    expect(payload.trabajador_id).toBeNull();
  });

  it('Incidentes abre el formulario de nueva acción correctiva y la guarda', async () => {
    render(<Incidentes />);

    fireEvent.click(await screen.findByRole('tab', { name: /seguimiento/i }));
    fireEvent.click((await screen.findAllByRole('button', { name: /ver detalle/i }))[0]);
    fireEvent.click(await screen.findByRole('tab', { name: /acciones correctivas/i }));
    fireEvent.click(screen.getByRole('button', { name: /nueva acción/i }));

    expect(await screen.findByLabelText('Descripción de la acción *')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Descripción de la acción *'), {
      target: { value: 'Capacitar al personal en uso de escaleras' },
    });
    fireEvent.change(screen.getByLabelText('Responsable *'), {
      target: { value: 'Responsable SG-SST' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar acción/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/incidents/inc-1/actions', expect.objectContaining({
        descripcion: 'Capacitar al personal en uso de escaleras',
        responsable: 'Responsable SG-SST',
      }))
    );
  });

  it('Indicadores muestra los KPIs derivados de los datos y registra un indicador', async () => {
    render(<Indicadores />);

    expect(await screen.findByRole('heading', { name: /indicadores del sg-sst/i })).toHaveClass(
      'ui-page-title'
    );
    expect(screen.getByText('Total indicadores')).toBeInTheDocument();
    expect(
      screen.getAllByText(/no hay indicadores registrados para este periodo/i).length
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Nombre del indicador *'), {
      target: { value: 'Frecuencia de accidentalidad' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar indicador/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/indicators', expect.objectContaining({
        nombre: 'Frecuencia de accidentalidad',
        tipo: 'proceso',
      }))
    );
  });

  it('Emergencias muestra las pestañas y los estados vacíos', async () => {
    render(<Emergencias />);

    expect(
      await screen.findByRole('heading', { name: /plan de emergencias y simulacros/i })
    ).toHaveClass('ui-page-title');
    expect(screen.getByRole('tab', { name: /planes de emergencia/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /simulacros/i })).toBeInTheDocument();
    expect(screen.getAllByText(/no hay planes de emergencias registrados/i).length).toBeGreaterThan(0);
  });

  it('Auditorías muestra las pestañas y el estado vacío', async () => {
    render(<Auditorias />);

    expect(
      await screen.findByRole('heading', { name: /auditoría interna y revisión por la dirección/i })
    ).toHaveClass('ui-page-title');
    expect(screen.getByRole('tab', { name: /auditorías/i })).toBeInTheDocument();
    expect(screen.getAllByText(/no hay auditorías registradas/i).length).toBeGreaterThan(0);
  });
});
