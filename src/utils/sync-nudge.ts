/**
 * Pure helpers for in-page karaoke sync editing (nudge starts).
 * Client script mirrors the same rules for live preview.
 */

export const SYNC_DRAFT_KEY_PREFIX = 'sc-sync-draft:';
export const SYNC_MIN_GAP = 0.05;

export type SyncReviewExport = {
  kind: 'sync-review';
  version: 1;
  slug: string;
  updatedAt: string;
  /** Flat line starts (seconds), same order as karaoke sync indices. */
  starts: number[];
  /** Anchors map for `npm run chant:apply-timestamps -- <slug> --anchors …` */
  anchors: Record<string, number>;
  /** Only lines that differ from the published baseline. */
  diffs: Array<{ i: number; from: number; to: number }>;
};

export function draftStorageKey(slug: string): string {
  return `${SYNC_DRAFT_KEY_PREFIX}${slug}`;
}

/** Round to 3 decimal places (ms precision is enough for karaoke). */
export function roundStart(sec: number): number {
  return Math.round(sec * 1000) / 1000;
}

/**
 * Nudge start at index by delta seconds and cascade the same shift to all
 * later lines (j >= index). Relative gaps among the cascaded block stay
 * intact. Only clamps against the previous line (and 0) — never shifts
 * lines before the active index.
 */
export function nudgeStart(
  starts: number[],
  index: number,
  delta: number
): number[] {
  if (index < 0 || index >= starts.length || !Number.isFinite(delta) || delta === 0) {
    return starts.slice();
  }
  const next = starts.slice();
  const prevMin = index > 0 ? next[index - 1]! + SYNC_MIN_GAP : 0;
  let effective = delta;
  const proposed = next[index]! + delta;
  if (proposed < prevMin) {
    effective = prevMin - next[index]!;
  }
  if (index === 0 && next[0]! + effective < 0) {
    effective = -next[0]!;
  }
  effective = roundStart(effective);
  if (effective === 0) return next;
  for (let j = index; j < next.length; j++) {
    next[j] = roundStart(Math.max(0, next[j]! + effective));
  }
  return next;
}

export function startsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (roundStart(a[i]!) !== roundStart(b[i]!)) return false;
  }
  return true;
}

export function buildSyncReviewExport(
  slug: string,
  baseline: number[],
  current: number[],
  updatedAt = new Date().toISOString()
): SyncReviewExport {
  const starts = current.map(roundStart);
  const anchors: Record<string, number> = {};
  const diffs: SyncReviewExport['diffs'] = [];
  for (let i = 0; i < starts.length; i++) {
    const to = starts[i]!;
    anchors[String(i)] = to;
    const from = roundStart(baseline[i] ?? to);
    if (from !== to) diffs.push({ i, from, to });
  }
  return {
    kind: 'sync-review',
    version: 1,
    slug,
    updatedAt,
    starts,
    anchors,
    diffs,
  };
}

/** Apply a flat starts array onto chant verses (mutates a shallow-cloned structure). */
export function applyStartsToChantVerses<
  T extends { verses: Array<{ order: number; lines: Array<{ start: number }> }> },
>(chant: T, starts: number[]): T {
  const verses = [...chant.verses]
    .sort((a, b) => a.order - b.order)
    .map((v) => ({
      ...v,
      lines: v.lines.map((l) => ({ ...l })),
    }));
  let i = 0;
  for (const verse of verses) {
    for (const line of verse.lines) {
      if (i >= starts.length) {
        throw new Error(
          `starts length ${starts.length} shorter than chant lines`
        );
      }
      line.start = roundStart(starts[i]!);
      i += 1;
    }
  }
  if (i !== starts.length) {
    throw new Error(
      `starts length ${starts.length} does not match chant lines (${i})`
    );
  }
  return { ...chant, verses };
}
