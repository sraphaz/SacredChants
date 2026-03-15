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

  test('select PT then select EN stays on English (no redirect back to PT)', async ({ page }) => {
    await page.goto('/?lang=pt');
    await expect(page).toHaveURL(/\?lang=pt/);
    await expect(page.locator('html')).toHaveAttribute('data-locale', 'pt');
    const select = page.locator('#sc-locale-select');
    await select.selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('data-locale', 'en', { timeout: 8000 });
    await expect(select).toHaveValue('en');
    expect(page.url()).not.toMatch(/\?lang=pt/);
  });

  test('chant page with ?lang=es shows verse subtitles (fallback when es missing)', async ({ page }) => {
    await page.goto('/chants/gayatri/?lang=es');
    await expect(page).toHaveURL(/\/chants\/gayatri\/.*lang=es/);
    await expect(page.locator('html')).toHaveAttribute('data-locale', 'es');
    const translationsBlock = page.locator('.verse-block .translations .locale-es').first();
    await expect(translationsBlock).toBeVisible({ timeout: 5000 });
    await expect(translationsBlock).not.toBeEmpty();
  });

  test('chant page with ?lang=it shows verse subtitles (fallback when it missing)', async ({ page }) => {
    await page.goto('/chants/gayatri/?lang=it');
    await expect(page).toHaveURL(/\/chants\/gayatri\/.*lang=it/);
    await expect(page.locator('html')).toHaveAttribute('data-locale', 'it');
    const translationsBlock = page.locator('.verse-block .translations .locale-it').first();
    await expect(translationsBlock).toBeVisible({ timeout: 5000 });
    await expect(translationsBlock).not.toBeEmpty();
  });
});
