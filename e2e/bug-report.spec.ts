import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePng = path.join(__dirname, 'fixtures', 'bug-report-sample.png');

/** Stub modern-screenshot so crop e2e does not depend on DOM rasterization quality. */
async function stubPageCapture(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const paint = () => {
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 700;
      const ctx = c.getContext('2d');
      if (!ctx) return c;
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(0, 0, 900, 700);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(120, 140, 260, 180);
      return c;
    };
    // Available before bug-report.js loads capture lib.
    (
      window as unknown as {
        modernScreenshot: { domToCanvas: () => Promise<HTMLCanvasElement> };
      }
    ).modernScreenshot = {
      domToCanvas: async () => paint(),
    };
  });
}

test.describe('Visual bug reporter', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.removeItem('sc-bug-report-draft');
      } catch {
        /* ignore */
      }
    });
  });

  test('abre o painel sem exigir login; formulário editável', async ({ page }) => {
    await page.goto('/?lang=pt');
    await page.locator('#sc-bug-report-open').click();
    const dialog = page.locator('#sc-bug-report-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#sc-bug-report-title')).toBeVisible();
    await expect(page.locator('#sc-bug-report-description')).toBeVisible();
    await expect(page.locator('#sc-bug-report-auth')).toBeHidden();
    await page.locator('#sc-bug-report-title').fill('Botão quebrado');
    await page.locator('#sc-bug-report-description').fill('O FAB cobre o conteúdo');
    await expect(page.locator('#sc-bug-report-title')).toHaveValue('Botão quebrado');
  });

  test('cancelar fecha sem exigir título', async ({ page }) => {
    await page.goto('/?lang=en');
    await page.locator('#sc-bug-report-open').click();
    await expect(page.locator('#sc-bug-report-dialog')).toBeVisible();
    await page.locator('#sc-bug-report-cancel').click();
    await expect(page.locator('#sc-bug-report-dialog')).toBeHidden();
  });

  test('upload de imagem mostra preview e NÃO envia issue', async ({ page }) => {
    let reportPosted = false;
    await page.route('**/api/contribute/report', async (route) => {
      reportPosted = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          issueNumber: 1,
          issueUrl: 'https://github.com/example/repo/issues/1',
        }),
      });
    });
    await page.route('**/api/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not authenticated' }),
      });
    });

    await page.goto('/?lang=pt');
    await page.locator('#sc-bug-report-open').click();
    await page.locator('#sc-bug-report-title').fill('Screenshot bug');
    await page.locator('#sc-bug-report-file').setInputFiles(fixturePng);

    const preview = page.locator('#sc-bug-report-preview');
    await expect(page.locator('#sc-bug-report-preview-wrap')).toBeVisible({ timeout: 10_000 });
    await expect(preview).toHaveAttribute('src', /data:image\//);
    await expect(page.locator('#sc-bug-report-title')).toHaveValue('Screenshot bug');
    expect(reportPosted).toBe(false);
  });

  test('seleção de região anexa preview e NÃO envia issue', async ({ page }) => {
    let reportPosted = false;
    await stubPageCapture(page);
    await page.route('**/api/contribute/report', async (route) => {
      reportPosted = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          issueNumber: 1,
          issueUrl: 'https://github.com/example/repo/issues/1',
        }),
      });
    });
    await page.route('**/api/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not authenticated' }),
      });
    });

    await page.goto('/?lang=pt');
    await page.locator('#sc-bug-report-open').click();
    await page.locator('#sc-bug-report-title').fill('Região selecionada');
    await page.locator('#sc-bug-report-description').fill('Área do header');
    await page.locator('#sc-bug-report-select').click();

    const overlay = page.locator('#sc-bug-report-crop-overlay');
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#sc-bug-report-dialog')).toBeHidden();

    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();
    const x0 = box!.x + 100;
    const y0 = box!.y + 120;
    const x1 = box!.x + 320;
    const y1 = box!.y + 300;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 8 });
    await page.mouse.up();

    const preview = page.locator('#sc-bug-report-preview');
    await expect(page.locator('#sc-bug-report-dialog')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#sc-bug-report-preview-wrap')).toBeVisible({ timeout: 10_000 });
    await expect(preview).toHaveAttribute('src', /data:image\/png/);
    await expect(page.locator('#sc-bug-report-title')).toHaveValue('Região selecionada');
    await expect(page.locator('#sc-bug-report-description')).toHaveValue('Área do header');
    await expect(page.locator('#sc-bug-report-clear-image')).toBeVisible();
    expect(reportPosted).toBe(false);

    const attached = await page.evaluate(() => {
      const img = document.getElementById('sc-bug-report-preview') as HTMLImageElement | null;
      const src = img?.getAttribute('src') || '';
      return {
        hasDataUrl: src.startsWith('data:image/png;base64,'),
        payloadLen: src.length,
      };
    });
    expect(attached.hasDataUrl).toBe(true);
    expect(attached.payloadLen).toBeGreaterThan(80);
  });

  test('enviar sem sessão mostra login e preserva rascunho; auth usa returnOrigin', async ({
    page,
  }) => {
    await page.route('**/api/contribute/report', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not authenticated' }),
      });
    });
    await page.route('**/api/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not authenticated' }),
      });
    });

    await page.goto('/?lang=pt');
    await page.locator('#sc-bug-report-open').click();
    await page.locator('#sc-bug-report-title').fill('Precisa login');
    await page.locator('#sc-bug-report-description').fill('Detalhe do problema');
    await page.locator('#sc-bug-report-submit').click();

    await expect(page.locator('#sc-bug-report-auth')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#sc-bug-report-title')).toHaveValue('Precisa login');
    await expect(page.locator('#sc-bug-report-description')).toHaveValue('Detalhe do problema');

    const signIn = page.locator('#sc-bug-report-signin');
    await expect(signIn).toBeVisible();
    const href = await signIn.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href!).toMatch(/\/api\/auth\/github/);
    expect(href!).toMatch(/returnTo=/);
    expect(href!).toMatch(/returnOrigin=/);

    const pageOrigin = new URL(page.url()).origin;
    const authUrl = new URL(href!, page.url());
    const returnTo = authUrl.searchParams.get('returnTo') || '';
    const returnOrigin = authUrl.searchParams.get('returnOrigin') || '';
    expect(returnTo).toMatch(/report=1/);
    expect(returnTo).toMatch(/lang=pt/);
    expect(returnTo.startsWith('/contribute')).toBe(false);
    expect(returnOrigin).toBe(pageOrigin);
  });

  test('após ?report=1 restaura rascunho do sessionStorage', async ({ page }) => {
    const tinyPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await page.addInitScript(
      ({ title, b64 }) => {
        sessionStorage.setItem(
          'sc-bug-report-draft',
          JSON.stringify({
            title,
            description: 'restored body',
            imageBase64: b64,
            imageMime: 'image/png',
            imageDataUrl: 'data:image/png;base64,' + b64,
            selection: null,
            autoSubmit: false,
          })
        );
      },
      { title: 'Rascunho restaurado', b64: tinyPng }
    );

    await page.goto('/?lang=pt&report=1');
    await expect(page.locator('#sc-bug-report-dialog')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#sc-bug-report-title')).toHaveValue('Rascunho restaurado');
    await expect(page.locator('#sc-bug-report-description')).toHaveValue('restored body');
    await expect(page.locator('#sc-bug-report-preview-wrap')).toBeVisible();
    await expect(page.locator('#sc-bug-report-preview')).toHaveAttribute('src', /data:image\/png/);
  });
});
