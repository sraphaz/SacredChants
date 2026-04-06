#!/usr/bin/env node
/**
 * Sacred Chants — CLI to generate a new chant entry (JSON).
 * Usage:
 *   node scripts/generate-chant.js              # interactive prompts
 *   node scripts/generate-chant.js <slug>      # start with slug pre-filled
 *   npm run chant:new [slug]
 *
 * Writes to src/content/chants/<slug>.json (schema: src/content/schemas/chant.ts).
 */

import { createInterface } from 'readline';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHANTS_DIR = join(ROOT, 'src', 'content', 'chants');

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultVal = '') {
  const def = defaultVal ? ` (${defaultVal})` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${def}: `, (answer) => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function buildChant(data) {
  const slug = data.slug || slugify(data.title);
  return {
    slug,
    title: data.title,
    tradition: data.tradition,
    origin: data.origin || undefined,
    language: data.language,
    script: data.script || undefined,
    description: data.description,
    tags: data.tags.length ? data.tags : [],
    audio: data.audio || undefined,
    spotifyUrl: data.spotifyUrl || undefined,
    verses: data.verses.length
      ? data.verses
      : [
          {
            order: 1,
            original: '',
            transliteration: '',
            translations: { pt: '', en: '' },
          },
        ],
  };
}

async function main() {
  const prefillSlug = process.argv[2] || '';

  console.log('\nSacred Chants — New chant entry\n');

  const title = await ask('Title', '');
  if (!title) {
    console.error('Title is required.');
    rl.close();
    process.exit(1);
  }

  const slug = await ask('Slug (filename)', prefillSlug || slugify(title));
  const tradition = await ask('Tradition', 'e.g. Hindu, Buddhist');
  const origin = await ask('Origin (optional)', '');
  const language = await ask('Language', '');
  const script = await ask('Script (optional)', 'e.g. Devanagari');
  const description = await ask('Description', '');
  const tagsInput = await ask('Tags (comma-separated)', '');
  const audio = await ask('Audio URL (optional)', '');
  const spotifyUrl = await ask('Spotify track URL (optional)', '');

  const tags = tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const chant = buildChant({
    slug,
    title,
    tradition,
    origin,
    language,
    script,
    description,
    tags,
    audio: audio || undefined,
    spotifyUrl: spotifyUrl || undefined,
    verses: [],
  });

  const outPath = join(CHANTS_DIR, `${slug}.json`);
  if (existsSync(outPath)) {
    const overwrite = await ask(`File ${slug}.json already exists. Overwrite? (y/N)`, 'n');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Aborted.');
      rl.close();
      process.exit(0);
    }
  }

  writeFileSync(outPath, JSON.stringify(chant, null, 2) + '\n', 'utf8');
  console.log(`\nCreated: src/content/chants/${slug}.json`);
  console.log('Add verses (order, original, transliteration, translations.pt, translations.en).');
  console.log('Optional locales in JSON (see src/content/schemas/chant.ts): description.es/.it/.hi and about.es/.it/.hi;');
  console.log('verse lines[].translations.es/.it/.hi and explanation.* — omit translations.hi if it would duplicate Devanagari original.');
  console.log('Optional: per-line "start" (seconds) for lyric sync; spotifyUrl for Listen on Spotify.\n');
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
