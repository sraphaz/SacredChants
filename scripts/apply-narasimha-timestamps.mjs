/**
 * Apply SRT-derived timestamps to narasimha-kavacham.json.
 *
 * Source: TurboScribe word-level SRT (ASR text is noisy; times are used as anchors).
 * Gap ~4:21–6:00: ASR collapsed; times interpolated from singing pace.
 * Verse 31 (garjantam…): refined with faster-whisper on an MP3 segment.
 *
 * Run: node scripts/apply-narasimha-timestamps.mjs
 *
 * Generic path for other mantras:
 *   node scripts/apply-chant-timestamps.mjs <slug> --anchors <file.json> [--duration SEC]
 * See .cursor/skills/chant-ingestion/SKILL.md
 */
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyAnchorsToChant,
  chantPathForSlug,
  formatReport,
} from './lib/chant-timestamps.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHANT_PATH = chantPathForSlug(ROOT, 'narasimha-kavacham');

/** Known start times (seconds) by flat line index — from SRT / whisper anchors. */
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
  // v31 garjantaṃ (4 lines) — refined against the MP3 with word timestamps
  60: 584.0, // garjantaṃ garjayantaṃ…
  61: 596.7, // dīpyantaṃ tāpayantaṃ…
  62: 611.9, // krandantaṃ roṣayantaṃ…
  63: 626.9, // vīkṣantaṃ pūrayantaṃ… namāmi
  // v32 colophon — sung three times; highlight from its first pass
  64: 641.5,
};

// Duration from Spotify / SRT outro (~13:18 usable; track 13:33)
const DURATION = 813;

const { report, lineCount } = applyAnchorsToChant({
  chantPath: CHANT_PATH,
  anchors: ANCHORS,
  duration: DURATION,
});

console.log('Applied timestamps to', lineCount, 'lines\n');
console.log(formatReport(report));
console.log('\n* = SRT/whisper anchor, others interpolated');
