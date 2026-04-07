/**
 * Chant page data helpers. Factory-style functions so [slug].astro stays thin:
 * orchestration and markup; logic and derived data live here. Aligns with
 * Clean Code (small functions, one responsibility) and Factory Method pattern.
 */

import type { Chant, ChantVerse, ChantLine } from '../content/schemas/chant';
import type { Locale } from '../i18n/strings';

type DescObj = {
  en?: string;
  pt?: string;
  es?: string;
  it?: string;
  hi?: string;
  ar?: string;
};

/**
 * Verse line translation for UI: hi/ar only show that locale (no English fallback).
 */
export function lineTranslationForLocale(
  translations: ChantLine['translations'],
  loc: Locale
): string {
  const raw = translations[loc];
  if (loc === 'hi' || loc === 'ar') {
    return typeof raw === 'string' && raw.trim().length > 0 ? raw : '';
  }
  if (typeof raw === 'string' && raw.trim().length > 0) return raw;
  return (translations.en ?? '') as string;
}

/**
 * Verse explanation for UI: same rule as line translations for hi/ar.
 */
export function verseExplanationForLocale(
  exp: ChantVerse['explanation'] | undefined,
  loc: Locale
): string {
  if (!exp) return '';
  const raw = exp[loc];
  if (loc === 'hi' || loc === 'ar') {
    return typeof raw === 'string' && raw.trim().length > 0 ? raw : '';
  }
  if (typeof raw === 'string' && raw.trim().length > 0) return raw;
  return (exp.en ?? exp.pt ?? '') as string;
}

/** Card / list description by UI locale (hi/ar: no cross-locale fallback). */
export function descriptionForLocale(
  chantDesc: Chant['description'],
  locale: Locale
): string {
  if (typeof chantDesc === 'string') return chantDesc;
  const obj: DescObj =
    chantDesc && typeof chantDesc === 'object'
      ? (chantDesc as DescObj)
      : {};
  switch (locale) {
    case 'en':
      return obj.en ?? obj.pt ?? '';
    case 'pt':
      return obj.pt ?? obj.en ?? '';
    case 'es':
      return obj.es ?? obj.en ?? obj.pt ?? '';
    case 'it':
      return obj.it ?? obj.en ?? obj.pt ?? '';
    case 'hi':
      return obj.hi ?? '';
    case 'ar':
      return obj.ar ?? '';
    default:
      return obj.en ?? obj.pt ?? '';
  }
}

/** Meta description for layout: hi/ar pages do not fall back to English. */
export function chantMetaDescription(
  desc: Chant['description'],
  locale: Locale | undefined
): string {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  const d = desc as DescObj;
  if (locale === 'hi' || locale === 'ar') {
    const v = locale ? d[locale] : undefined;
    return typeof v === 'string' ? v : '';
  }
  return (
    (locale ? d[locale] : undefined) ??
    d.en ??
    d.pt ??
    d.es ??
    d.it ??
    d.hi ??
    d.ar ??
    ''
  );
}

/** Sorted verses by order (used by sync lines and lines-with-meta). */
function getSortedVerses(chant: Chant): ChantVerse[] {
  return [...chant.verses].sort((a, b) => a.order - b.order);
}

/**
 * Resolve audio URL with base path for deployment (e.g. GitHub Pages).
 * Content uses paths like /audio/chant.mp3; caller passes fullBase from getFullBase(Astro.url).
 */
export function getAudioUrl(
  chant: { audio?: string },
  fullBase: string
): string {
  if (!chant.audio) return '';
  if (chant.audio.startsWith('http')) return chant.audio;
  return fullBase + chant.audio.replace(/^\//, '');
}

/**
 * Flat list of line start times (one per rendered line) for audio sync.
 */
export function getSyncLines(chant: Chant): { start: number }[] {
  return getSortedVerses(chant).flatMap((v) =>
    v.lines.map((l) => ({ start: l.start }))
  );
}

export interface LineWithMeta {
  verse: ChantVerse;
  line: ChantLine;
  syncIndex: number;
  showVerseLabel: boolean;
  showExplanation: boolean;
}

/**
 * Flat list of verse/line plus metadata for rendering (verse label on first line, explanation on last).
 */
export function getLinesWithMeta(chant: Chant): LineWithMeta[] {
  const sorted = getSortedVerses(chant);
  let syncIndex = 0;
  return sorted.flatMap((verse) => {
    const lineList = verse.lines;
    return lineList.map((line, i) => {
      const showVerseLabel = i === 0;
      const showExplanation = i === lineList.length - 1;
      const out: LineWithMeta = {
        verse,
        line,
        syncIndex,
        showVerseLabel,
        showExplanation,
      };
      syncIndex += 1;
      return out;
    });
  });
}

/**
 * Whether this chant has any verse line with the given translation locale.
 * Used to show fallback notice when ES, IT, HI, or AR is missing.
 */
export function hasTranslation(
  chant: Chant,
  lang: 'es' | 'it' | 'hi' | 'ar'
): boolean {
  const sorted = getSortedVerses(chant);
  return sorted.some((v) =>
    v.lines?.some(
      (l) => (l.translations as Record<string, string> | undefined)?.[lang]
    )
  );
}
