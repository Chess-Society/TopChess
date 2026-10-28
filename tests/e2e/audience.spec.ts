import { test, expect } from '@playwright/test';

test('pestañas de alumnos y profesores con selección manual y reparto claro', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Tu profesor no aparece aquí por registrarse.' }),
  ).toBeVisible();
  const students = page.getByRole('tab', { name: /Para alumnos/ });
  const teachers = page.getByRole('tab', { name: /Para profesores/ });
  await students.focus();
  await page.keyboard.press('ArrowRight');
  await expect(teachers).toBeFocused();
  await expect(teachers).toHaveAttribute('aria-selected', 'true');
  await expect(teachers).toHaveCSS('background-color', 'rgb(242, 240, 237)');
  await expect(teachers).toHaveCSS('color', 'rgb(23, 21, 28)');
  await expect(
    page.getByRole('heading', { name: 'Un reparto que puedes entender.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tu siguiente gran jugada.' })).toBeHidden();
  const slider = page.getByRole('slider');
  await page.screenshot({ path: 'test-results/landing-profesores-desktop.png', fullPage: true });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('95');
  await expect(page.locator('.commission-totals')).toContainText('47,50');
  await expect(page.locator('.commission-totals')).toContainText('2,50');
  await page.reload();
  await expect(teachers).toHaveAttribute('aria-selected', 'true');
  await teachers.focus();
  await page.keyboard.press('Home');
  await expect(students).toBeFocused();
  await expect(students).toHaveAttribute('aria-selected', 'true');
});

test('ambas propuestas se adaptan a 320 px sin errores de navegador', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  for (const audience of ['alumnos', 'profesores']) {
    await page.goto(`/?para=${audience}`);
    await expect(page.getByRole('tab', { name: `Para ${audience}`, exact: false })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (audience === 'profesores')
      await page.screenshot({ path: 'test-results/landing-profesores-mobile.png', fullPage: true });
  }
  await page.getByRole('link', { name: 'Presentar mi candidatura' }).click();
  await expect(page).toHaveURL(/\/ser-profesor$/);
  expect(errors).toEqual([]);
});
