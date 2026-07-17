/**
 * Apply SRT-derived timestamps to narasimha-kavacham.json.
 *
 * Source: TurboScribe word-level SRT (ASR text is noisy; times are used as anchors).
 * Gap ~4:21–6:00: ASR collapsed; times interpolated from singing pace.
 *
 * Run: node scripts/apply-narasimha-timestamps.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHANT_PATH = path.join(__dirname, '..', 'src', 'content', 'chants', 'narasimha-kavacham.json');

/** Known start times (seconds) by flat line index — from SRT anchors. */
const ANCHORS = {
  // v1 — nṛsiṃha-kavacaṃ… / sarva-rakṣā…
  0: 13.4,
  1: 25.6,
  // v2
  2: 37.5,
  3: 44.8,
  // v3
  4: 54.2,
  5: 63.7,
  // v4
  6: 73.2,
  7: 82.6,
  // v5
  8: 92.3,
  9: 101.5,
  // v6 — virājita-pada… / garutmatā…
  10: 113.1,
  11: 120.5,
  // v7 — sva-hṛt-kamala… / nṛsiṃho me śiraḥ…
  12: 131.8,
  13: 139.6,
  // v8
  14: 148.9,
  15: 158.1,
  // v9
  16: 169.6,
  17: 177.1,
  // v10
  18: 188.6,
  19: 196.1,
  // v11
  20: 207.1,
  21: 215.2,
  // v12
  22: 226.1,
  23: 233.8,
  // v13 — madhyaṃ… / nābhiṃ…
  24: 243.8,
  25: 252.8,
  // v14 starts after nabhim (SRT gap begins soon after)
  26: 262.0,
  // … interpolated through v24 …
  // v25 l1 devāsura… (just before eka-sandhyam in SRT)
  48: 470.7,
  // v25 l2 eka-sandhyaṃ (SRT: एकसंगं)
  49: 479.7,
  // v26 sarva-maṅgala… / dvā-triṃśati…
  50: 491.7,
  51: 498.4,
  // v27 kavacasyāsya… / anena mantra-rājena…
  52: 509.7,
  53: 517.3,
  // v28 tilakaṃ… / tri-vāraṃ…
  54: 528.0,
  55: 537.7,
  // v29 prāśayed… / tasya rogāḥ…
  56: 546.8,
  57: 555.2,
  // v30 kimatra… / manasā…
  58: 565.4,
  59: 573.9,
  // v31 garjantaṃ (4 lines) — first sung pass in SRT
  60: 584.0, // garjantaṃ garjayantaṃ…
  61: 598.6, // dīpyantaṃ tāpayantaṃ… (SRT तपयंतं)
  62: 605.5, // krandantaṃ… (repeat section onset)
  63: 650.0, // vīkṣantaṃ pūrayantaṃ… namāmi (late pass)
  // v32 colophon — end of sung garjantam / before outro
  64: 693.0,
};

const TOTAL_LINES = 65;

function fillTimes(anchors, total) {
  const times = new Array(total).fill(null);
  for (const [k, v] of Object.entries(anchors)) {
    times[+k] = v;
  }
  // interpolate nulls between known anchors
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

const times = fillTimes(ANCHORS, TOTAL_LINES);
const chant = JSON.parse(fs.readFileSync(CHANT_PATH, 'utf8'));

let idx = 0;
const report = [];
for (const verse of chant.verses) {
  for (const line of verse.lines) {
    const start = times[idx];
    line.start = start;
    report.push({
      idx,
      verse: verse.order,
      start,
      translit: line.transliteration.slice(0, 48),
      anchored: Object.prototype.hasOwnProperty.call(ANCHORS, String(idx)),
    });
    idx++;
  }
}

if (idx !== TOTAL_LINES) {
  throw new Error(`Line count mismatch: applied ${idx}, expected ${TOTAL_LINES}`);
}

// Duration from Spotify / SRT outro (~13:18 usable; track 13:33)
chant.duration = 813;

fs.writeFileSync(CHANT_PATH, JSON.stringify(chant, null, 2) + '\n');

console.log('Applied timestamps to', idx, 'lines\n');
console.log(
  report
    .map(
      (r) =>
        `${String(r.idx).padStart(2)} v${String(r.verse).padStart(2)} ${r.start
          .toFixed(1)
          .padStart(6)}s ${r.anchored ? '*' : ' '} ${r.translit}`
    )
    .join('\n')
);
console.log('\n* = SRT anchor, others interpolated');
