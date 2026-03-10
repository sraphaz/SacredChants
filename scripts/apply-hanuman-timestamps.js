/**
 * Apply user-provided timestamps to hanuman-chalisa.json.
 * Segments from the actual recording; Chalisa text ends at 9:49 (589s).
 * Sita Ram repetitions (10:33+) are not in the 43 verses — excluded.
 *
 * Run: node scripts/apply-hanuman-timestamps.js
 *
 * Timestamps may need manual tuning per recording. Use:
 *   node scripts/offset-hanuman-times.js [seconds]   to add a constant offset to all lines.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHANT_PATH = path.join(ROOT, 'src', 'content', 'chants', 'hanuman-chalisa.json');

// Segments from user: (min:sec) in seconds, and approximate line count per segment
const SEGMENTS = [
  [10, 2],    // 0:10
  [38, 2],    // 0:38
  [52, 2],    // 0:52
  [77, 4],    // 1:17
  [103, 4],   // 1:43
  [129, 4],   // 2:09
  [154, 4],   // 2:34
  [180, 4],   // 3:00
  [206, 4],   // 3:26
  [231, 4],   // 3:51
  [257, 4],   // 4:17
  [282, 4],   // 4:42
  [308, 4],   // 5:08
  [334, 4],   // 5:34
  [359, 4],   // 5:59
  [385, 4],   // 6:25
  [411, 4],   // 6:51
  [436, 4],   // 7:16
  [461, 4],   // 7:41
  [488, 4],   // 8:08
  [513, 4],   // 8:33
  [538, 4],   // 8:58
  [565, 4],   // 9:25
  [589, 2],   // 9:49 — end of Chalisa; Sita Ram follows in audio but not in text
];

const TOTAL_LINES = 86; // 43 verses × 2 lines

function expandSegmentsToTimes() {
  const times = [];
  for (let i = 0; i < SEGMENTS.length; i++) {
    const [startSec, count] = SEGMENTS[i];
    const nextStart = i + 1 < SEGMENTS.length ? SEGMENTS[i + 1][0] : startSec + 10;
    const step = (nextStart - startSec) / count;
    for (let j = 0; j < count; j++) {
      times.push(Math.round((startSec + j * step) * 10) / 10);
    }
  }
  return times;
}

const chant = JSON.parse(fs.readFileSync(CHANT_PATH, 'utf8'));
const startTimes = expandSegmentsToTimes();

if (startTimes.length < TOTAL_LINES) {
  console.warn(`Only ${startTimes.length} times; padding with last value to ${TOTAL_LINES}`);
  while (startTimes.length < TOTAL_LINES) startTimes.push(startTimes[startTimes.length - 1]);
} else if (startTimes.length > TOTAL_LINES) {
  startTimes.length = TOTAL_LINES;
}

let lineIndex = 0;
chant.verses.forEach((verse) => {
  verse.lines.forEach((line) => {
    line.start = startTimes[lineIndex];
    lineIndex++;
  });
});

chant.duration = 589; // Chalisa ends at 9:49; audio may continue with Sita Ram

fs.writeFileSync(CHANT_PATH, JSON.stringify(chant, null, 2) + '\n', 'utf8');
console.log('Applied', startTimes.length, 'start times; duration set to 589s (9:49).');
console.log('First line:', startTimes[0], 's; last line:', startTimes[startTimes.length - 1], 's.');
