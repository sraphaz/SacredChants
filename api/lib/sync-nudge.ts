/**
 * Apply flat karaoke starts onto chant verses (API-side mirror of src/utils/sync-nudge).
 */

function roundStart(sec: number): number {
  return Math.round(sec * 1000) / 1000;
}

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
        throw new Error(`starts length ${starts.length} shorter than chant lines`);
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
