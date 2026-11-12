import { expect, test } from '@playwright/test';

test('los campos de texto ocupan el ancho disponible en cuatro pantallas', async ({ page }) => {
  await page.route('**/api/users/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-test',
        email: 'auditoria@ejemplo.invalid',
        nombre: 'Usuario de prueba',
        rol: 'administrador',
      }),
    })
  );
  await page.route('**/api/hazards/catalog*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/hazards/assessments*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/emergency-plans*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/drills*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/incidents*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/workers*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/altura/permits*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/api/altura/ats*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  const viewports = [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ];
  const screens = [
    { path: '/riesgos', textarea: '#hazards-controles' },
    { path: '/emergencias', textarea: '#plan-contenido' },
    { path: '/incidentes', textarea: '#inc-desc' },
    { path: '/altura', textarea: '#ats-peligro' },
  ];

  for (const screen of screens) {
    await page.setViewportSize(viewports[0]);
    await page.goto(screen.path);
    if (screen.path === '/altura') {
      await page.getByRole('tab', { name: /ATS - Análisis de trabajo seguro/ }).click();
    }

    const textarea = page.locator(screen.textarea);
    await expect(textarea).toBeVisible();

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const dimensions = await textarea.evaluate(element => ({
        field: element.parentElement?.getBoundingClientRect().width ?? 0,
        textarea: element.getBoundingClientRect().width,
      }));
      expect(dimensions.textarea).toBeGreaterThan(dimensions.field * 0.9);
    }
  }
});
