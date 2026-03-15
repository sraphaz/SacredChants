import { test, expect } from '@playwright/test';

test.describe('Locale / idioma', () => {
  test('sem ?lang= usa inglês (en) e combobox mostra EN', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sacred Chants/);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-locale', 'en');
    const select = page.locator('#sc-locale-select');
    await expect(select).toHaveValue('en');
  });

  test('?lang=es define locale es e combobox mostra ES', async ({ page }) => {
    await page.goto('/?lang=es');
    await expect(page).toHaveURL(/\?lang=es/);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-locale', 'es');
    const select = page.locator('#sc-locale-select');
    await expect(select).toHaveValue('es');
    await expect(page.locator('.locale-es').first()).toBeVisible();
  });

  test('?lang=pt define locale pt e combobox mostra PT', async ({ page }) => {
    await page.goto('/chants/?lang=pt');
    await expect(page).toHaveURL(/\/chants\/.*lang=pt/);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-locale', 'pt');
    const select = page.locator('#sc-locale-select');
    await expect(select).toHaveValue('pt');
    await expect(page.locator('.locale-pt').first()).toBeVisible();
  });

  test('página de chant com ?lang=it mostra locale it', async ({ page }) => {
    await page.goto('/chants/gayatri/?lang=it');
    await expect(page).toHaveURL(/\/chants\/gayatri\/.*lang=it/);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-locale', 'it');
    const select = page.locator('#sc-locale-select');
    await expect(select).toHaveValue('it');
  });
});
