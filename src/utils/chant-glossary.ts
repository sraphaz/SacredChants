import type { ChantGlossary, ChantGlossaryEntry } from '../content/schemas/glossary';
import { chantGlossarySchema } from '../content/schemas/glossary';
import type { Locale } from '../i18n/strings';

/** Normalize a token for glossary lookup (IAST or Devanagari). */
export function normalizeGlossaryKey(raw: string): string {
  return raw
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/^[|'\"“”‘’\[\(]+|[|'\"“”‘’\]\),;:.!?]+$/g, '')
    .replace(/[|॥।]+$/g, '');
}

/** Build lowercase key → entry map from a glossary array. */
export function buildGlossaryLookup(
  glossary: ChantGlossary
): Map<string, ChantGlossaryEntry> {
  const map = new Map<string, ChantGlossaryEntry>();
  for (const entry of glossary) {
    for (const key of entry.keys) {
      const n = normalizeGlossaryKey(key);
      if (n) map.set(n, entry);
    }
    const iast = normalizeGlossaryKey(entry.iast);
    if (iast) map.set(iast, entry);
    if (entry.original) {
      const o = normalizeGlossaryKey(entry.original);
      if (o) map.set(o, entry);
    }
  }
  return map;
}

export function lookupGlossaryEntry(
  lookup: Map<string, ChantGlossaryEntry>,
  token: string
): ChantGlossaryEntry | undefined {
  const n = normalizeGlossaryKey(token);
  if (!n) return undefined;
  if (lookup.has(n)) return lookup.get(n);
  // Try without trailing anusvāra / ṃ / ṁ / ḥ for loose matching
  const stripped = n.replace(/[ṃṁḥm]$/u, '');
  if (stripped && stripped !== n && lookup.has(stripped)) {
    return lookup.get(stripped);
  }
  return undefined;
}

export type GlossaryTextPiece =
  | { type: 'text'; value: string }
  | { type: 'word'; value: string; entryId: string; hasEntry: true }
  | { type: 'word'; value: string; hasEntry: false };

/**
 * Split transliteration (or Devanagari) into text + word pieces.
 * Hyphenated compounds yield separate clickable parts when each part matches.
 */
export function tokenizeGlossaryLine(
  line: string,
  lookup: Map<string, ChantGlossaryEntry>,
  idForEntry: (entry: ChantGlossaryEntry) => string
): GlossaryTextPiece[] {
  if (!line) return [];
  const pieces: GlossaryTextPiece[] = [];
  // Keep separators: spaces, | ॥ । punctuation; split hyphen compounds into parts
  const re = /([^\s|॥।\-]+)|([\s|॥।\-]+)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m[2] != null) {
      pieces.push({ type: 'text', value: m[2] });
      continue;
    }
    const value = m[1]!;
    const entry = lookupGlossaryEntry(lookup, value);
    if (entry) {
      pieces.push({
        type: 'word',
        value,
        entryId: idForEntry(entry),
        hasEntry: true,
      });
    } else {
      pieces.push({ type: 'word', value, hasEntry: false });
    }
  }
  return pieces;
}

export function glossaryTextForLocale(
  texts: { en: string; pt: string; es?: string; it?: string; hi?: string; ar?: string },
  locale: Locale
): string {
  const own = texts[locale as keyof typeof texts];
  if (typeof own === 'string' && own.trim()) return own;
  if (locale === 'hi' || locale === 'ar') return '';
  return texts.en || texts.pt || '';
}

/** Stable id for data attributes / popover targeting. */
export function glossaryEntryId(entry: ChantGlossaryEntry): string {
  return normalizeGlossaryKey(entry.iast).replace(/[^a-z0-9āīūṛṝḷṅñṭḍṇśṣḥṃṁ\-']/gi, '-');
}

export function parseAndValidateGlossary(data: unknown): ChantGlossary {
  return chantGlossarySchema.parse(data);
}

const glossaryModules = import.meta.glob('../content/glossaries/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

/** Load glossary for a chant slug if present under src/content/glossaries/. */
export function loadChantGlossary(slug: string): ChantGlossary | null {
  const needle = `/glossaries/${slug}.json`;
  const hit = Object.entries(glossaryModules).find(([path]) =>
    path.replace(/\\/g, '/').endsWith(needle)
  );
  if (!hit) return null;
  try {
    return parseAndValidateGlossary(hit[1]);
  } catch {
    return null;
  }
}
