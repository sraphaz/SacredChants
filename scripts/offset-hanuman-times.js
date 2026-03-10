/**
 * Add a constant offset (seconds) to all line start times in hanuman-chalisa.json.
 * Use when the audio has a long intro and the first verse starts later.
 * Run: node scripts/offset-hanuman-times.js [offsetSeconds]
 * Default offset: 16 (first line 10s -> 26s).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHANT_PATH = path.join(ROOT, 'src', 'content', 'chants', 'hanuman-chalisa.json');

const offset = Number(process.argv[2]) || 16;

const chant = JSON.parse(fs.readFileSync(CHANT_PATH, 'utf8'));

chant.verses.forEach((verse) => {
  verse.lines.forEach((line) => {
    line.start = Math.round((line.start + offset) * 10) / 10;
  });
});

if (chant.duration != null) {
  chant.duration = Math.round(chant.duration + offset);
}

fs.writeFileSync(CHANT_PATH, JSON.stringify(chant, null, 2) + '\n', 'utf8');
console.log('Added offset', offset, 's to all start times. First line now:', chant.verses[0].lines[0].start, 's; duration:', chant.duration, 's.');
