import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Politica from '../../src/pages/Politica.tsx';
import { render } from '../setup.tsx';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/politica' }),
  };
});

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/lib/api';

const mockPolicies = [
  { id: 'p1', version: 1, titulo: 'Política SST 2026', contenido: 'Contenido de la política...', estado: 'vigente', firmado_por: 'Gerente General', fecha_firma: '2026-01-15', fecha_divulgacion: null, creado_en: '2026-01-10' },
  { id: 'p2', version: 2, titulo: 'Política SST 2025', contenido: 'Versión anterior...', estado: 'archivada', firmado_por: 'Gerente Anterior', fecha_firma: '2025-01-15', fecha_divulgacion: '2025-01-20', creado_en: '2025-01-10' },
];

const mockObjectives = [
  { id: 'o1', policy_id: 'p1', descripcion: 'Reducir accidentes en 20%', tipo: 'resultado', meta: '20%', responsable: 'Jefe SST', fecha_limite: '2026-12-31', estado: 'en_proceso' },
  { id: 'o2', policy_id: 'p1', descripcion: 'Capacitar 100% trabajadores', tipo: 'proceso', meta: '100%', responsable: 'RRHH', fecha_limite: '2026-06-30', estado: 'cumplido' },
];

describe('Política SST Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'prompt').mockReturnValue('Responsable SST');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (api.get as vi.Mock).mockResolvedValue(
      mockPolicies.map(policy => ({
        ...policy,
        objectives: policy.id === 'p1' ? mockObjectives : [],
      }))
    );
    (api.post as vi.Mock).mockResolvedValue({});
    (api.put as vi.Mock).mockResolvedValue({});
    (api.delete as vi.Mock).mockResolvedValue(null);
  });

  it('debe renderizar política activa', async () => {
    render(<Politica />);
    
    expect(await screen.findByText('Política SST y Objetivos')).toBeInTheDocument();
    expect(await screen.findByText('Política SST 2026')).toBeInTheDocument();
    expect(await screen.findByText('VIGENTE')).toBeInTheDocument();
    expect(await screen.findByText('Gerente General')).toBeInTheDocument();
    expect(await screen.findByText('-')).toBeInTheDocument();
  });

  it('debe mostrar objetivos de política activa', async () => {
    render(<Politica />);
    
    await screen.findByText('Política SST 2026');
    
    expect(await screen.findByText(/Objetivos SST/)).toBeInTheDocument();
    expect(await screen.findByText('Reducir accidentes en 20%')).toBeInTheDocument();
    expect(await screen.findByText('Capacitar 100% trabajadores')).toBeInTheDocument();
    expect(await screen.findByText('EN PROCESO')).toBeInTheDocument();
    expect(await screen.findByText('CUMPLIDO')).toBeInTheDocument();
  });

  it('debe mostrar el estado vacío cuando no hay política vigente', async () => {
    (api.get as vi.Mock).mockResolvedValue(
      mockPolicies.map(policy => ({ ...policy, estado: 'borrador', objectives: [] }))
    );
    render(<Politica />);

    expect(await screen.findByRole('heading', { name: 'Objetivos SST - Sin política vigente' })).toBeInTheDocument();
    expect(screen.getByText('No hay política vigente.')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('debe listar histórico de políticas', async () => {
    render(<Politica />);
    
    await screen.findByText('Histórico de Versiones');
    expect(await screen.findByText('Política SST 2025')).toBeInTheDocument();
    expect(await screen.findByText('Archivada')).toBeInTheDocument();
  });

  it('debe abrir modal para crear nueva política (borrador)', async () => {
    const { container } = render(<Politica />);
    
    await screen.findByText('Política SST 2026');
    await userEvent.click(screen.getByRole('button', { name: /nueva versión/i }));
    
    expect(await screen.findByText('Nueva Política (Borrador)')).toBeInTheDocument();
    expect(container.querySelector('input')).toBeInTheDocument();
    expect(container.querySelector('textarea')).toBeInTheDocument();
  });

  it('debe crear política en estado borrador', async () => {
    const { container } = render(<Politica />);
    
    await screen.findByText('Política SST 2026');
    await userEvent.click(screen.getByRole('button', { name: /nueva versión/i }));
    
    await userEvent.clear(container.querySelector('input')!);
    await userEvent.type(container.querySelector('input')!, 'Nueva Política');
    await userEvent.clear(container.querySelector('textarea')!);
    await userEvent.type(container.querySelector('textarea')!, 'Contenido de la nueva política...');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/policies', expect.objectContaining({
        titulo: 'Nueva Política',
        estado: 'borrador',
      }));
    });
  });

  it('debe firmar política y ponerla vigente', async () => {
    (api.get as vi.Mock).mockResolvedValue([
      ...mockPolicies.map(policy => ({
        ...policy,
        objectives: policy.id === 'p1' ? mockObjectives : [],
      })),
      { id: 'p3', version: 3, titulo: 'Borrador', contenido: 'Borrador de política', estado: 'borrador', objectives: [] },
    ]);
    render(<Politica />);
    
    await screen.findByText('Política SST 2026');
    await userEvent.click(screen.getByRole('button', { name: /firmar y vigentizar/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/policies/p3/firmar', { firmado_por: 'Responsable SST' });
    });
  });

  it('debe mostrar botones de acción según estado', async () => {
    render(<Politica />);
    
    await screen.findByText('Política SST 2026');
    
    // Política vigente: mostrar divulgar, archivar
    expect(screen.getByRole('button', { name: /divulgar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /archivar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /firmar/i })).not.toBeInTheDocument();
  });

  it('debe divulgar política vigente', async () => {
    render(<Politica />);
    
    await screen.findByText('Política SST 2026');
    await userEvent.click(screen.getByRole('button', { name: /divulgar/i }));
    
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/policies/p1/divulgar');
    });
  });

  it('debe archivar política', async () => {
    render(<Politica />);
    
    await screen.findByText('Política SST 2026');
    await userEvent.click(screen.getByRole('button', { name: /archivar/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/policies/p1/archivar');
    });
  });

  describe('Gestión de Objetivos', () => {
    it('debe abrir modal para nuevo objetivo', async () => {
      render(<Politica />);
      
      await screen.findByText(/Objetivos SST/);
      await userEvent.click(screen.getByRole('button', { name: /nuevo objetivo/i }));
      
      expect(await screen.findByRole('heading', { name: 'Nuevo Objetivo' })).toBeInTheDocument();
      expect(screen.getByText('Descripción *')).toBeInTheDocument();
      expect(screen.getByText('Tipo *')).toBeInTheDocument();
      expect(screen.getAllByText('Meta')).toHaveLength(2);
      expect(screen.getAllByText('Responsable')).toHaveLength(2);
      expect(screen.getAllByText('Fecha Límite')).toHaveLength(2);
    });

    it('debe crear objetivo de tipo resultado', async () => {
      const { container } = render(<Politica />);
      
      await screen.findByText(/Objetivos SST/);
      await userEvent.click(screen.getByRole('button', { name: /nuevo objetivo/i }));
      
      await userEvent.type(container.querySelector('textarea')!, 'Nuevo objetivo');
      await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'resultado');
      await userEvent.type(container.querySelector('input[placeholder^="Ej:"]')!, '30%');
      await userEvent.type(container.querySelector('input[placeholder="Nombre o cargo"]')!, 'Jefe SST');
      await userEvent.type(container.querySelector('input[type="date"]')!, '2026-12-31');
      await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/policies/p1/objectives', expect.objectContaining({
          descripcion: 'Nuevo objetivo',
          tipo: 'resultado',
        }));
      });
    });

    it('debe actualizar estado de objetivo', async () => {
      render(<Politica />);
      
      await screen.findByText('Reducir accidentes en 20%');
      
      await userEvent.click(screen.getAllByRole('button', { name: /^editar$/i })[0]);
      await userEvent.selectOptions(screen.getAllByRole('combobox')[1], 'cumplido');
      await userEvent.click(screen.getByRole('button', { name: /guardar/i }));
      
      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith('/objectives/o1', expect.objectContaining({
          estado: 'cumplido',
        }));
      });
    });

    it('debe eliminar objetivo', async () => {
      render(<Politica />);
      
      await screen.findByText('Reducir accidentes en 20%');
      await userEvent.click(screen.getAllByRole('button', { name: /^eliminar$/i })[0]);
      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith('/objectives/o1');
      });
    });
  });

  it('debe mostrar versiones de política al editar vigente', async () => {
    // Simular política vigente que se edita -> crea nueva versión borrador
    const policiesWithDraft = [
      { ...mockPolicies[0], estado: 'vigente' },
      { id: 'p3', version: 2, titulo: 'Política SST 2026 (v2)', contenido: 'Nueva versión', estado: 'borrador', firmado_por: null, fecha_firma: null, fecha_divulgacion: null },
    ];
    
    (api.get as vi.Mock).mockResolvedValue(policiesWithDraft.map(policy => ({
      ...policy,
      objectives: policy.id === 'p1' ? mockObjectives : [],
    })));
    
    render(<Politica />);
    
    await screen.findByText('Política SST 2026 (v2)');
    expect(await screen.findByText('BORRADOR')).toBeInTheDocument();
  });
});