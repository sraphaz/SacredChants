/**
 * Chant page data helpers. Factory-style functions so [slug].astro stays thin:
 * orchestration and markup; logic and derived data live here. Aligns with
 * Clean Code (small functions, one responsibility) and Factory Method pattern.
 */

import type { Chant, ChantVerse, ChantLine } from '../content/schemas/chant';

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
