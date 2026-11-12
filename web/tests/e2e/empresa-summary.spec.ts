import { expect, test } from '@playwright/test';

test('el resumen de empresa mantiene la jerarquía visual de la página', async ({ page }) => {
  await page.route('**/api/users/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-test',
        email: 'usuario@ejemplo.invalid',
        nombre: 'Usuario de prueba',
        rol: 'administrador',
      }),
    })
  );
  await page.route('**/api/companies', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'empresa-demo',
        razon_social: 'Empresa de demostración',
        nit: '900000000-0',
        direccion: '',
        telefono: '',
        email: '',
        clase_riesgo: 'III',
        estandar_set: '7',
        sector: 'Demostración',
        actividad_economica: 'Prueba automatizada',
        numero_trabajadores: 3,
        tiene_vigia_sst: false,
        tiene_copasst: false,
        tiene_comite_convivencia: false,
        tiene_brigada: false,
        canal_alertas: 'app',
      }),
    })
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/empresa');

  const items = page.locator('.empresa-resumen-item');
  await expect(items).toHaveCount(4);
  const standardsSummary = page.locator('.empresa-resumen-estandares');
  await expect(standardsSummary).toBeVisible();
  await expect(standardsSummary.locator('.empresa-resumen-card')).toHaveCount(2);

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const layout = await standardsSummary.evaluate(element => {
      const title = element.querySelector('.empresa-resumen-title');
      const formTitle = document.querySelector('.empresa-form-title');
      const grid = element.querySelector('.empresa-resumen-grid');
      if (!title || !formTitle || !grid) throw new Error('Falta el contenido del resumen');
      return {
        padding: Number.parseFloat(getComputedStyle(element).paddingTop),
        titleFontSize: getComputedStyle(title).fontSize,
        formTitleFontSize: getComputedStyle(formTitle).fontSize,
        gridDisplay: getComputedStyle(grid).display,
        overflows: element.scrollWidth > element.clientWidth,
      };
    });
    expect(layout.padding).toBeGreaterThan(0);
    expect(layout.titleFontSize).toBe(layout.formTitleFontSize);
    expect(layout.gridDisplay).toBe('grid');
    expect(layout.overflows).toBe(false);

    for (const item of await items.all()) {
      const positions = await item.evaluate(element => {
        const label = element.querySelector('.empresa-resumen-label');
        const value = element.querySelector('.empresa-resumen-value');
        if (!label || !value) throw new Error('Falta la etiqueta o el valor del resumen');
        return {
          labelBottom: label.getBoundingClientRect().bottom,
          valueTop: value.getBoundingClientRect().top,
        };
      });
      expect(positions.valueTop).toBeGreaterThanOrEqual(positions.labelBottom);
    }
  }
});
