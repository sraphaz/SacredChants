#!/usr/bin/env node
/**
 * Build with base path / and start preview for E2E tests.
 * Usage: node scripts/start-preview-e2e.js
 *
 * Set E2E_SKIP_BUILD=1 to skip `npm run build` when `dist/index.html` already exists
 * (avoids nested/cancelled builds when another process is compiling).
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distIndex = join(root, 'dist', 'index.html');

/** Porta fixa para o Playwright bater certo com `webServer.url` (defeito: 4174 — fora da 4321 do `astro dev`). */
const previewPort = (process.env.E2E_PREVIEW_PORT || '').trim() || '4174';
/**
 * O build estático usa `site` (astro.config) para `<base href>` e URLs absolutas de scripts.
 * Sem isto, o preview em 127.0.0.1 carregaria JS/CSS de produção e o locale na URL (ex. ?lang=ar)
 * não coincidia com o bundle antigo — E2E falhavam de forma intermitente/errática.
 */
const previewOrigin = `http://127.0.0.1:${previewPort}`;
const childEnv = {
  ...process.env,
  BASE_PATH: process.env.BASE_PATH ?? '/',
  SITE_ORIGIN: (process.env.SITE_ORIGIN || '').trim() || previewOrigin,
};

function startPreview() {
  console.log('[e2e] Starting preview at http://127.0.0.1:' + previewPort + '/ ...');
  const preview = spawn('npx', ['astro', 'preview', '--host', '127.0.0.1', '--port', previewPort], {
    cwd: root,
    env: childEnv,
    stdio: 'inherit',
    shell: true,
  });
  preview.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
}

const skipBuild = process.env.E2E_SKIP_BUILD === '1' && existsSync(distIndex);
if (skipBuild) {
  console.log('[e2e] E2E_SKIP_BUILD=1 and dist/ present — skipping build.');
  startPreview();
} else {
  console.log('[e2e] Building with BASE_PATH=/ ...');
  const build = spawn('npm', ['run', 'build'], {
    cwd: root,
    env: childEnv,
    stdio: 'inherit',
    shell: true,
  });

  build.on('close', (code) => {
    if (code !== 0) process.exit(code ?? 1);
    startPreview();
  });

  build.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
}
