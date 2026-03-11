#!/usr/bin/env node
/**
 * Entrypoint E2E em Docker: inicia o preview em background, espera estar pronto, corre Playwright.
 * Uso: node scripts/run-e2e-in-docker.mjs
 */
import { spawn, execSync } from 'child_process';
import { createInterface } from 'readline';
import http from 'http';
import { platform } from 'os';

const DEFAULT_PORT = 4321;

function freePort(port) {
  try {
    if (platform() === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', maxBuffer: 10000 }).trim();
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const m = line.trim().split(/\s+/);
        const pid = m[m.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (_) {}
      }
    } else {
      execSync(`lsof -ti:${port} | xargs -r kill -9 2>/dev/null || true`, { stdio: 'ignore' });
    }
  } catch (_) {}
}
const MAX_WAIT_MS = 90_000;
const POLL_MS = 800;

function waitForServer(port) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + MAX_WAIT_MS;
    function poll() {
      const req = http.request({
        hostname: '127.0.0.1',
        port: Number(port),
        path: '/',
        method: 'HEAD',
        timeout: 5000,
      }, (res) => {
        if (res.statusCode < 500) return resolve();
        if (Date.now() > deadline) return reject(new Error('Timeout waiting for server'));
        setTimeout(poll, POLL_MS);
      });
      req.on('error', (err) => {
        if (Date.now() > deadline) return reject(new Error('Timeout waiting for server: ' + err.message));
        setTimeout(poll, POLL_MS);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() > deadline) reject(new Error('Timeout waiting for server'));
        else setTimeout(poll, POLL_MS);
      });
      req.end();
    }
    poll();
  });
}

function parsePortFromPreviewOutput(stream) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    rl.on('line', (line) => {
      const m = line.match(/Local\s+http:\/\/[^:]+:(\d+)/);
      if (m) {
        resolve(parseInt(m[1], 10));
        rl.close();
      }
    });
    rl.on('close', () => resolve(DEFAULT_PORT));
  });
}

async function main() {
  const e2ePort = Number(process.env.E2E_PORT) || 4321;
  const siteOrigin = `http://localhost:${e2ePort}`;
  console.log('[e2e-docker] Building with BASE_PATH=/, SITE_ORIGIN=' + siteOrigin + ' ...');
  const build = spawn('npm', ['run', 'build'], {
    env: { ...process.env, BASE_PATH: '/', SITE_ORIGIN: siteOrigin },
    stdio: 'inherit',
    shell: true,
  });
  await new Promise((resolve, reject) => {
    build.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`build exited ${code}`))));
    build.on('error', reject);
  });

  freePort(e2ePort);
  await new Promise((r) => setTimeout(r, 1000));
  console.log('[e2e-docker] Starting preview server on port', e2ePort, '...');
  const preview = spawn('npm', ['run', 'preview', '--', '--port', String(e2ePort), '--host', '0.0.0.0'], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: true,
  });
  preview.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  const portPromise = parsePortFromPreviewOutput(preview.stdout);
  const port = await Promise.race([
    portPromise,
    new Promise((res) => setTimeout(() => res(e2ePort), 15000)),
  ]);
  const baseUrl = `http://127.0.0.1:${port}/`;
  console.log('[e2e-docker] Preview on port', port, '- waiting for server...');
  await new Promise((r) => setTimeout(r, 5000));
  await waitForServer(port);
  console.log('[e2e-docker] Server ready, running Playwright tests...');

  const playwright = spawn('npx', ['playwright', 'test'], {
    env: { ...process.env, E2E_DOCKER: '1', PLAYWRIGHT_BASE_URL: baseUrl },
    stdio: 'inherit',
    shell: true,
  });
  const code = await new Promise((resolve) => {
    playwright.on('close', resolve);
  });
  preview.kill('SIGTERM');
  process.exit(code ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
