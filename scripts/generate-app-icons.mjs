/**
 * Single source: public/brand/app-icon.png
 * Outputs: favicon.png, apple-touch-icon.png, brand/icon-192.png, brand/icon-512.png
 * Run via npm run icons:generate (also runs before astro build).
 */
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public/brand/app-icon.png');

async function main() {
  try {
    await access(src);
  } catch {
    console.error('Missing canonical icon. Add public/brand/app-icon.png');
    process.exit(1);
  }

  const base = sharp(src).png();

  await base.clone().resize(32, 32).toFile(join(root, 'public/favicon.png'));
  await base.clone().resize(180, 180).toFile(join(root, 'public/apple-touch-icon.png'));
  await base.clone().resize(192, 192).toFile(join(root, 'public/brand/icon-192.png'));
  await base.clone().resize(512, 512).toFile(join(root, 'public/brand/icon-512.png'));

  console.log('App icons generated from public/brand/app-icon.png');
}

main();
