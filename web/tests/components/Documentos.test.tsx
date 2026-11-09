import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Documentos from '../../src/pages/Documentos';
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

const docVigente = {
  id: 'doc-1',
  codigo: 'PROC-SST-001',
  nombre: 'Procedimiento de Trabajo en Alturas',
  version: '1.1',
  tipo: 'procedimiento',
  archivo_url: '',
  fecha_emision: '2026-05-10',
  fecha_revision: '2026-11-01',
  retencion_anos: 5,
  responsable: 'Vigía SST',
  estado: 'vigente' as const,
  creado_en: '2026-05-10T10:00:00.000Z',
};

const docRegistroMedico = {
  id: 'doc-2',
  codigo: 'REG-MED-004',
  nombre: 'Registro de examen médico ocupacional',
  version: '2.0',
  tipo: 'registro',
  archivo_url: 'data:application/pdf;base64,AAAA',
  fecha_emision: '2026-03-02',
  fecha_revision: null,
  retencion_anos: 20,
  responsable: 'Recursos Humanos',
  estado: 'en_revision' as const,
  creado_en: '2026-03-02T10:00:00.000Z',
};

describe('Documentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue([docVigente, docRegistroMedico]);
  });

  it('aplica los patrones visuales compartidos sin emojis ni advertencias de React', async () => {
    const { container } = render(<Documentos />);

    expect(
      await screen.findByRole('heading', { name: /gestión documental y retención legal/i })
    ).toHaveClass('ui-page-title');
    expect(screen.getByRole('button', { name: /nuevo documento/i })).toHaveClass('ui-primary-button');

    // Filtros con etiquetas accesibles
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Estado')).toHaveLength(2);

    // Tabla maestra dentro de un contenedor desplazable
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(container.querySelector('.documentos-table-wrap')).toBeInTheDocument();
    expect(screen.getAllByText('PROC-SST-001')).toHaveLength(2);

    // Sin emojis y sin opciones duplicadas sin key (antes: option "Instrucción" sin value)
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(screen.getAllByRole('option', { name: 'Instrucción' })).toHaveLength(2);

    // Tarjeta adaptable con la misma información
    const cards = await screen.findAllByRole('article');
    const card = cards.find((c) => c.textContent?.includes('Registro de examen médico'))!;
    expect(within(card).getByText('En revisión')).toBeInTheDocument();
    expect(within(card).getByText('20 años (médicos / exposición)')).toBeInTheDocument();
  });

  it('permite editar un documento desde la tarjeta adaptable y conserva sus datos', async () => {
    render(<Documentos />);

    await screen.findByRole('heading', { name: /gestión documental y retención legal/i });

    const cards = await screen.findAllByRole('article');
    const card = cards.find((c) => c.textContent?.includes('Procedimiento de Trabajo en Alturas'))!;
    fireEvent.click(within(card).getByRole('button', { name: /editar/i }));

    await waitFor(() => expect(screen.getByLabelText('Código *')).toHaveValue('PROC-SST-001'));
    expect(screen.getByLabelText('Nombre del documento *')).toHaveValue('Procedimiento de Trabajo en Alturas');
    expect(screen.getByLabelText('Retención (años) *')).toHaveValue(5);
  });

  it('muestra el error de carga en un mensaje accesible', async () => {
    api.get.mockRejectedValueOnce(new Error('No autenticado'));

    render(<Documentos />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No autenticado');
  });
});
