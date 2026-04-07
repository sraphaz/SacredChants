/**
 * Merge Arabic (ar) and Hindi (hi) verse-level strings from scripts/chant-locales/<slug>.json
 * into src/content/chants/<slug>.json.
 *
 * Rules:
 * - Hindi (hi) is NOT added to verse translations when chant.language matches Hindi/Awadhi
 *   (text is already in that tradition).
 * - description.ar / about.ar in bundle merge into top-level objects when present.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHANTS = path.join(ROOT, 'src', 'content', 'chants');
const LOCALES = path.join(__dirname, 'chant-locales');

function isSourceHindi(language) {
  return /hindi|awakadhi|awadhi/i.test(String(language || ''));
}

function flattenLines(verses) {
  const out = [];
  for (const v of verses) {
    for (const line of v.lines) out.push(line);
  }
  return out;
}

function mergeChant(slug) {
  const bundlePath = path.join(LOCALES, `${slug}.json`);
  if (!fs.existsSync(bundlePath)) return false;
  const chantPath = path.join(CHANTS, `${slug}.json`);
  const chant = JSON.parse(fs.readFileSync(chantPath, 'utf8'));
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const skipHiVerses = isSourceHindi(chant.language);

  if (bundle.descriptionAr) {
    chant.description = { ...chant.description, ar: bundle.descriptionAr };
  }
  if (bundle.aboutAr && chant.about) {
    chant.about = { ...chant.about, ar: bundle.aboutAr };
  }

  const flat = flattenLines(chant.verses);
  const arLines = bundle.lineTranslationsAr || [];
  const hiLines = bundle.lineTranslationsHi || [];

  if (arLines.length !== flat.length) {
    throw new Error(
      `${slug}: lineTranslationsAr length ${arLines.length} !== ${flat.length} lines`
    );
  }
  if (!skipHiVerses && hiLines.length) {
    if (hiLines.length !== flat.length) {
      throw new Error(
        `${slug}: lineTranslationsHi length ${hiLines.length} !== ${flat.length} lines`
      );
    }
  }

  flat.forEach((line, i) => {
    line.translations = { ...line.translations, ar: arLines[i] };
    if (!skipHiVerses && hiLines.length) {
      line.translations = { ...line.translations, hi: hiLines[i] };
    }
  });

  if (bundle.verseExplanationAr || bundle.verseExplanationHi) {
    let ei = 0;
    for (const v of chant.verses) {
      if (!v.explanation) continue;
      if (bundle.verseExplanationAr?.[ei] != null) {
        v.explanation = {
          ...v.explanation,
          ar: bundle.verseExplanationAr[ei],
        };
      }
      if (!skipHiVerses && bundle.verseExplanationHi?.[ei] != null) {
        v.explanation = {
          ...v.explanation,
          hi: bundle.verseExplanationHi[ei],
        };
      }
      ei += 1;
    }
  }

  fs.writeFileSync(chantPath, JSON.stringify(chant, null, 2) + '\n', 'utf8');
  return true;
}

const slugs = fs
  .readdirSync(LOCALES)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

for (const slug of slugs) {
  mergeChant(slug);
  console.log('merged', slug);
}
