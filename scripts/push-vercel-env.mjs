#!/usr/bin/env node
/**
 * Push env vars from .env.vercel to Vercel (Production).
 * Run: npm run vercel:env
 * Requires: .env.vercel (copy from .env.vercel.example), and `vercel link` done once.
 */
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const envPath = join(root, '.env.vercel');

if (!existsSync(envPath)) {
  console.error('Missing .env.vercel. Copy .env.vercel.example to .env.vercel and fill in values.');
  process.exit(1);
}

const raw = readFileSync(envPath, 'utf8');
const lines = raw.split(/\r?\n/).filter((line) => {
  const t = line.trim();
  return t && !t.startsWith('#') && t.includes('=');
});

const vars = [];
for (const line of lines) {
  const eq = line.indexOf('=');
  const name = line.slice(0, eq).trim();
  const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  if (name) vars.push({ name, value });
}

if (vars.length === 0) {
  console.error('.env.vercel has no KEY=VALUE lines.');
  process.exit(1);
}

console.log(`Pushing ${vars.length} env var(s) to Vercel (production)...`);
for (const { name, value } of vars) {
  const r = spawnSync('npx', ['vercel', 'env', 'add', name, 'production'], {
    cwd: root,
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`Failed to add ${name}`);
    process.exit(1);
  }
}
console.log('Done.');
