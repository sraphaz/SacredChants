/**
 * Update Hanuman Chalisa line timestamps from IA transcription.
 * Transcription: first timestamp of each line (86 lines).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEW_STARTS = [
  27, 39, 52, 64, 76, 90, 96, 103, 110, 115, 122, 129, 135, 141, 147, 154, 160, 167, 173, 180, 186, 193, 199, 205, 211, 218, 224, 231, 237, 244, 250, 256, 263, 269, 275, 282, 288, 295, 301, 308, 314, 320, 327, 332, 339, 346, 352, 359, 365, 372, 378, 384, 391, 398, 404, 410, 416, 423, 428, 435, 442, 449, 455, 461, 468, 474, 482, 487, 493, 500, 506, 512, 519, 525, 531, 538, 544, 550, 557, 564, 570, 577, 583, 589, 596, 608
];

const jsonPath = path.join(__dirname, '..', 'src', 'content', 'chants', 'hanuman-chalisa.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

let idx = 0;
for (const verse of data.verses) {
  for (const line of verse.lines) {
    if (idx >= NEW_STARTS.length) throw new Error('More lines than timestamps');
    line.start = NEW_STARTS[idx++];
  }
}

if (idx !== NEW_STARTS.length) throw new Error('Line count mismatch: ' + idx + ' vs ' + NEW_STARTS.length);

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Updated 86 line timestamps in hanuman-chalisa.json');
