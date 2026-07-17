/**
 * Shared helpers for applying line-level karaoke timestamps to chant JSON.
 *
 * Flat line index = verses flattened left-to-right, top-to-bottom.
 * Missing anchors between known ones are linearly interpolated.
 */

import fs from 'fs';
import path from 'path';

/**
 * @param {Record<string|number, number>} anchors  flat line index → seconds
 * @param {number} total  total line count
 * @returns {number[]}
 */
export function fillTimes(anchors, total) {
  const times = new Array(total).fill(null);
  for (const [k, v] of Object.entries(anchors)) {
    times[+k] = v;
  }
  let i = 0;
  while (i < total) {
    if (times[i] != null) {
      i++;
      continue;
    }
    let prev = i - 1;
    while (prev >= 0 && times[prev] == null) prev--;
    let next = i + 1;
    while (next < total && times[next] == null) next++;
    if (prev < 0 || next >= total) {
      throw new Error(`Cannot interpolate line ${i}: missing boundary anchors`);
    }
    const span = next - prev;
    const t0 = times[prev];
    const t1 = times[next];
    for (let j = prev + 1; j < next; j++) {
      const frac = (j - prev) / span;
      times[j] = Math.round((t0 + (t1 - t0) * frac) * 10) / 10;
    }
    i = next;
  }
  return times.map((t) => Math.round(t * 10) / 10);
}

/**
 * Count flat lines in a chant object.
 * @param {{ verses: { lines: unknown[] }[] }} chant
 */
export function countLines(chant) {
  let n = 0;
  for (const verse of chant.verses) n += verse.lines.length;
  return n;
}

/**
 * Apply start times to every line; optionally set duration.
 *
 * @param {object} opts
 * @param {string} opts.chantPath  absolute path to chant JSON
 * @param {Record<string|number, number>} opts.anchors
 * @param {number} [opts.duration]  set chant.duration when provided
 * @param {boolean} [opts.dryRun]
 * @returns {{ times: number[], report: object[], lineCount: number }}
 */
export function applyAnchorsToChant({ chantPath, anchors, duration, dryRun = false }) {
  const chant = JSON.parse(fs.readFileSync(chantPath, 'utf8'));
  const total = countLines(chant);
  const times = fillTimes(anchors, total);

  const report = [];
  let idx = 0;
  for (const verse of chant.verses) {
    for (const line of verse.lines) {
      const start = times[idx];
      line.start = start;
      report.push({
        idx,
        verse: verse.order,
        start,
        translit: (line.transliteration || '').slice(0, 48),
        anchored: Object.prototype.hasOwnProperty.call(anchors, String(idx)) ||
          Object.prototype.hasOwnProperty.call(anchors, idx),
      });
      idx++;
    }
  }

  if (typeof duration === 'number' && Number.isFinite(duration)) {
    chant.duration = duration;
  }

  if (!dryRun) {
    fs.writeFileSync(chantPath, JSON.stringify(chant, null, 2) + '\n');
  }

  return { times, report, lineCount: idx, chant };
}

export function formatReport(report) {
  return report
    .map(
      (r) =>
        `${String(r.idx).padStart(2)} v${String(r.verse).padStart(2)} ${r.start
          .toFixed(1)
          .padStart(6)}s ${r.anchored ? '*' : ' '} ${r.translit}`
    )
    .join('\n');
}

/** Resolve `src/content/chants/<slug>.json` from repo root. */
export function chantPathForSlug(root, slug) {
  return path.join(root, 'src', 'content', 'chants', `${slug}.json`);
}
