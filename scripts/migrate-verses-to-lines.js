/**
 * Migrates chant JSONs from verse-level (original/transliteration with newlines)
 * to line-level (verses[].lines[] with start, original, transliteration, translations).
 *
 * Usage: node scripts/migrate-verses-to-lines.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHANTS_DIR = path.join(__dirname, '..', 'src', 'content', 'chants');

function migrateVerse(verse) {
  const origLines = (verse.original || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const translitLines = (verse.transliteration || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const n = Math.max(origLines.length, translitLines.length, 1);
  const firstStart = typeof verse.startTime === 'number' && verse.startTime >= 0 ? verse.startTime : 0;
  const lines = [];
  for (let i = 0; i < n; i++) {
    lines.push({
      start: i === 0 ? firstStart : 0,
      original: origLines[i] ?? '',
      transliteration: translitLines[i] ?? '',
      translations: verse.translations ? { ...verse.translations } : { pt: undefined, en: undefined },
    });
  }
  const out = { order: verse.order, lines };
  if (verse.explanation && (verse.explanation.pt || verse.explanation.en)) {
    out.explanation = verse.explanation;
  }
  return out;
}

function migrateChant(obj) {
  if (!obj.verses || !Array.isArray(obj.verses)) return obj;
  const verses = obj.verses.map(migrateVerse);
  return { ...obj, verses };
}

const files = fs.readdirSync(CHANTS_DIR).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const filePath = path.join(CHANTS_DIR, file);
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const migrated = migrateChant(data);
  fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2) + '\n', 'utf8');
  console.log('Migrated:', file);
}

console.log('Done. Migrated', files.length, 'chant(s).');
