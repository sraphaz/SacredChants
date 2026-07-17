#!/usr/bin/env node
/**
 * Apply karaoke line timestamps to any chant JSON.
 *
 * Usage:
 *   node scripts/apply-chant-timestamps.mjs <slug> --anchors <file.json> [--duration SEC] [--dry-run]
 *
 * Anchors file: JSON object mapping flat line index (string or number) → start seconds.
 * Missing indices between known anchors are linearly interpolated.
 *
 * Example anchors JSON:
 *   { "0": 13.4, "1": 25.6, "48": 470.7, "64": 641.5 }
 *
 * Per-chant wrappers (e.g. apply-narasimha-timestamps.mjs) keep commented anchor maps
 * and call the shared library — prefer that when anchors need rich comments.
 *
 * Spotify URLs are listen-only; karaoke sync requires a local MP3 in public/audio/.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyAnchorsToChant,
  chantPathForSlug,
  formatReport,
} from './lib/chant-timestamps.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function usage(code = 1) {
  console.error(`Usage:
  node scripts/apply-chant-timestamps.mjs <slug> --anchors <file.json> [--duration SEC] [--dry-run]

Example:
  node scripts/apply-chant-timestamps.mjs my-mantra --anchors scripts/my-mantra.anchors.json --duration 420`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { slug: null, anchorsPath: null, duration: undefined, dryRun: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') usage(0);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--anchors') args.anchorsPath = argv[++i];
    else if (a === '--duration') args.duration = Number(argv[++i]);
    else if (a.startsWith('-')) {
      console.error('Unknown flag:', a);
      usage(1);
    } else positional.push(a);
  }
  args.slug = positional[0] || null;
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.slug || !args.anchorsPath) usage(1);

const anchorsAbs = path.isAbsolute(args.anchorsPath)
  ? args.anchorsPath
  : path.join(ROOT, args.anchorsPath);

if (!fs.existsSync(anchorsAbs)) {
  console.error('Anchors file not found:', anchorsAbs);
  process.exit(1);
}

const anchorsRaw = JSON.parse(fs.readFileSync(anchorsAbs, 'utf8'));
const anchors = anchorsRaw.anchors && typeof anchorsRaw.anchors === 'object'
  ? anchorsRaw.anchors
  : anchorsRaw;

const duration =
  args.duration ??
  (typeof anchorsRaw.duration === 'number' ? anchorsRaw.duration : undefined);

const chantPath = chantPathForSlug(ROOT, args.slug);
if (!fs.existsSync(chantPath)) {
  console.error('Chant not found:', chantPath);
  process.exit(1);
}

const { report, lineCount } = applyAnchorsToChant({
  chantPath,
  anchors,
  duration,
  dryRun: args.dryRun,
});

console.log(
  `${args.dryRun ? '[dry-run] ' : ''}Applied timestamps to ${lineCount} lines → ${path.relative(ROOT, chantPath)}\n`
);
console.log(formatReport(report));
console.log('\n* = anchor, others interpolated');
if (duration != null) console.log(`duration = ${duration}s`);
