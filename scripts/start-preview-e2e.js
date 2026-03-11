#!/usr/bin/env node
/**
 * Build with base path / and start preview for E2E tests.
 * Usage: node scripts/start-preview-e2e.js
 */
import { spawn } from 'child_process';

const env = { ...process.env, BASE_PATH: '/' };

console.log('[e2e] Building with BASE_PATH=/ ...');
const build = spawn('npm', ['run', 'build'], {
  env,
  stdio: 'inherit',
  shell: true,
});

build.on('close', (code) => {
  if (code !== 0) process.exit(code);
  console.log('[e2e] Starting preview server...');
  const preview = spawn('npm', ['run', 'preview'], {
    env: process.env,
    stdio: 'inherit',
    shell: true,
  });
  preview.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
});

build.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
