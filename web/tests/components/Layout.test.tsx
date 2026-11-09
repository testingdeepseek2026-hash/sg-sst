import { fireEvent, render, screen } from '../setup';
import { describe, expect, it, vi } from 'vitest';
import Layout from '../../src/components/Layout';

describe('Navegación de la aplicación', () => {
  it('conserva todas las rutas agrupadas por tareas', () => {
    render(
      <Layout user={{ nombre: 'Responsable SST', rol: 'administrador' }} onLogout={vi.fn()}>
        <h1>Contenido de prueba</h1>
      </Layout>,
    );

    expect(screen.getByRole('region', { name: 'Planear' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ejecutar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Verificar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Administración' })).toBeInTheDocument();

    const expectedPaths = [
      '/dashboard',
      '/trabajadores',
      '/riesgos',
      '/estandar',
      '/politica',
      '/planes',
      '/indicadores',
      '/incidentes',
      '/inspecciones',
      '/altura',
      '/emergencias',
      '/contratistas',
      '/acciones',
      '/auditorias',
      '/bitacora',
      '/alertas',
      '/empresa',
      '/usuarios',
      '/roles',
      '/documentos',
      '/importar',
    ];

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(expectedPaths.length);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(expectedPaths);
    expect(screen.getByRole('heading', { name: 'Contenido de prueba' })).toBeInTheDocument();
  });

  it('permite contraer y expandir el menú en escritorio', () => {
    render(
      <Layout user={{ nombre: 'Responsable SST', rol: 'administrador' }} onLogout={vi.fn()}>
        Contenido de prueba
      </Layout>,
    );

    const collapseButton = screen.getByRole('button', { name: 'Contraer menú' });
    fireEvent.click(collapseButton);
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expandir menú' }));
    expect(screen.getByRole('button', { name: 'Contraer menú' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('abre el menú móvil y lo cierra con Escape', () => {
    const { container } = render(
      <Layout user={{ nombre: 'Responsable SST', rol: 'administrador' }} onLogout={vi.fn()}>
        Contenido de prueba
      </Layout>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(container.querySelector('.app-sidebar--mobile-open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar menú de navegación' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tablero' })).toHaveFocus();

    const lastMenuControl = screen.getByRole('button', { name: /Cerrar sesión/ });
    lastMenuControl.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Cerrar menú de navegación' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú de navegación' }));
    expect(container.querySelector('.app-sidebar--mobile-open')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('.app-sidebar--mobile-open')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();
  });

  it('ejecuta el cierre de sesión desde el menú', () => {
    const onLogout = vi.fn();
    render(
      <Layout user={{ nombre: 'Responsable SST', rol: 'administrador' }} onLogout={onLogout}>
        Contenido de prueba
      </Layout>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
