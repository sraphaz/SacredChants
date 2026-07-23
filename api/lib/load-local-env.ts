/**
 * Ensure `.env.local` / `.env` are applied for `vercel dev` API routes.
 * Vercel CLI injects Project → Development env into memory; local OAuth secrets
 * often live only in `.env.local` and would otherwise be missing.
 *
 * On cloud Production/Preview, skip file load (platform env is the source of truth).
 * On `vercel dev`, VERCEL_ENV is typically "development" — load local files with override.
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

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
      loadEnv({ path, override: true });
    }
  }
}

loadLocalEnv();
