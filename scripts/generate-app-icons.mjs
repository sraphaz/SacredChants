/**
 * Single source: public/brand/app-icon.png
 * Outputs: favicon.png, apple-touch-icon.png, brand/icon-192.png, brand/icon-512.png
 * Run via npm run icons:generate (also runs before astro build).
 */
import { access, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public/brand/app-icon.png');

function isPngMagic(buf) {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

async function main() {
  try {
    await access(src);
  } catch {
    console.error('Missing canonical icon. Add public/brand/app-icon.png');
    process.exit(1);
  }

  const fh = await open(src, 'r');
  const head = Buffer.alloc(8);
  await fh.read(head, 0, 8, 0);
  await fh.close();
  if (!isPngMagic(head)) {
    console.error(
      'Canonical icon must be a real PNG (public/brand/app-icon.png). JPEG or other formats must be converted to PNG so the extension and bytes match.'
    );
    process.exit(1);
  }

  const base = sharp(src).png();

  await Promise.all([
    base.clone().resize(32, 32).toFile(join(root, 'public/favicon.png')),
    base.clone().resize(180, 180).toFile(join(root, 'public/apple-touch-icon.png')),
    base.clone().resize(192, 192).toFile(join(root, 'public/brand/icon-192.png')),
    base.clone().resize(512, 512).toFile(join(root, 'public/brand/icon-512.png')),
  ]);

  console.log('App icons generated from public/brand/app-icon.png');
}

main().catch((err) => {
  console.error('Icon generation failed:', err?.message ?? err);
  process.exit(1);
});
