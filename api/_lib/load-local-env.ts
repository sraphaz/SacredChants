/**
 * Ensure `.env.local` / `.env` are applied for `vercel dev` API routes.
 * Vercel CLI injects Project → Development env into memory; local OAuth secrets
 * often live only in `.env.local` and would otherwise be missing.
 *
 * On cloud Production/Preview, skip file load (platform env is the source of truth).
 * On `vercel dev`, VERCEL_ENV is typically "development" — load local files with override.
 *
 * Avoids the `dotenv` package so Vercel API TypeScript builds stay dependency-free.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

function applyEnvFile(path: string, override: boolean): void {
  const text = readFileSync(path, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!override && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

export function loadLocalEnv(): void {
  if (loaded) return;
  loaded = true;
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production' || vercelEnv === 'preview') {
    return;
  }
  const root = process.cwd();
  // Load base `.env` first, then `.env.local` with override so local secrets win
  // (never let a stale `.env` GITHUB_TOKEN clobber `.env.local`).
  for (const name of ['.env', '.env.local']) {
    const path = resolve(root, name);
    if (existsSync(path)) {
      applyEnvFile(path, true);
    }
  }
}

loadLocalEnv();
