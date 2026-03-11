import { test, expect } from '@playwright/test';

test.describe('Navegação', () => {
  test('home carrega com título e header', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sacred Chants/);
    await expect(page.locator('header').getByText('Sacred Chants').first()).toBeVisible();
  });

  test('lista de chants carrega', async ({ page }) => {
    await page.goto('/chants/');
    await expect(page).toHaveTitle(/Chants/);
    await expect(page.getByRole('main').getByText(/all chants|chants/i).first()).toBeVisible();
  });

  test('página de um chant carrega com player', async ({ page }) => {
    await page.goto('/chants/hanuman-chalisa/');
    await expect(page).toHaveURL(/\/chants\/hanuman-chalisa\/?/);
    await expect(page.locator('#chant-audio, .chant-player-bar').first()).toBeVisible({ timeout: 10000 });
  });

  test.describe('viewport desktop', () => {
    test.use({ project: 'chromium' });
    test('links do header navegam', async ({ page }, testInfo) => {
      if (testInfo.project.name !== 'chromium') test.skip();
      await page.goto('/');
      // Nav link "Chants" (não o logo "Sacred Chants"); menu inline só visível em desktop
      await page.locator('.sc-header__menu').getByRole('link', { name: /^chants$/i }).first().click();
      await expect(page).toHaveURL(/\/chants\/?/);

      await page.goto('/');
      await page.locator('.sc-header__menu').getByRole('link', { name: /^traditions$/i }).first().click();
      await expect(page).toHaveURL(/\/traditions\/?/);
    });
  });
});
