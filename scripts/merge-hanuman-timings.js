/**
 * Merges hanuman-chalisa-timings.json (start + original per line) into
 * hanuman-chalisa.json, preserving transliteration and translations.
 * Run from repo root: node scripts/merge-hanuman-timings.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHANT_PATH = path.join(ROOT, 'src', 'content', 'chants', 'hanuman-chalisa.json');
const TIMINGS_PATH = path.join(__dirname, 'hanuman-chalisa-timings.json');

const chant = JSON.parse(fs.readFileSync(CHANT_PATH, 'utf8'));
const timings = JSON.parse(fs.readFileSync(TIMINGS_PATH, 'utf8'));

function splitTranslit(translit) {
  const parts = (translit || '').split(/\s+\|\s+/);
  if (parts.length >= 2) return [parts[0].trim(), parts[1].trim()];
  return [translit || '', ''];
}

const mergedVerses = chant.verses.map((verse, idx) => {
  const timingLines = timings[idx];
  if (!timingLines || timingLines.length !== 2) {
    console.warn(`Verse ${verse.order}: expected 2 timing lines, got ${timingLines?.length ?? 0}`);
    return verse;
  }
  const currLines = verse.lines || [];
  const trans0 = currLines[0]?.transliteration ?? '';
  const trans1 = currLines[1]?.transliteration ?? '';
  const [transA, transB] = currLines.length >= 2 ? [trans0, trans1] : splitTranslit(trans0);
  const translations = currLines[0]?.translations ?? verse.translations ?? { en: '', pt: '' };

  const lines = [
    { start: timingLines[0].start, original: timingLines[0].original, transliteration: transA, translations },
    { start: timingLines[1].start, original: timingLines[1].original, transliteration: transB, translations },
  ];
  const out = { order: verse.order, lines };
  if (verse.explanation) out.explanation = verse.explanation;
  return out;
});

chant.verses = mergedVerses;
fs.writeFileSync(CHANT_PATH, JSON.stringify(chant, null, 2) + '\n', 'utf8');
console.log('Merged timings into hanuman-chalisa.json');
