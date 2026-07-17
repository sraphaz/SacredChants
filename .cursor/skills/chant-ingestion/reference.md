# Chant ingestion — reference

Companion to [SKILL.md](SKILL.md). Read when aligning a long stotra or repairing ASR gaps.

## Flat line index

Timestamps apply to a **flattened** list of lines:

```
verse 1 line 0 → index 0
verse 1 line 1 → index 1
verse 2 line 0 → index 2
…
```

`scripts/lib/chant-timestamps.mjs` walks `chant.verses[].lines[]` in that order.

## Mapping word-level SRT → anchors

1. Parse SRT cues into `{ startSec, text }`.
2. Search for distinctive words that match IAST/Devanagari line openings (e.g. `garjantam`, `sva-hṛt-kamala`).
3. Ignore ASR spelling; trust timing when the phonetics roughly match.
4. Prefer **line starts** (first sung word of that line), not mid-phrase hits.
5. Leave uncertain regions **without** anchors so linear interpolation fills them — better than wrong anchors.

### Interpolation caveats

- Interpolation assumes roughly even pace between anchors. Dense verses or long held notes can skew.
- After apply, spot-check interpolated spans in the player; refine with whisper segments if off by >~2–3s.

## ffmpeg + faster-whisper recipe

```bash
# 1) Cut segment (example: verse near 9:40–11:00)
ffmpeg -y -ss 580 -to 660 -i public/audio/my-mantra.mp3 -ac 1 -ar 16000 /tmp/my-mantra-seg.wav

# 2) Word timestamps (install once: pip install faster-whisper)
python <<'PY'
from faster_whisper import WhisperModel
model = WhisperModel("small")  # or "medium" if quality needed
segments, _ = model.transcribe(
    "/tmp/my-mantra-seg.wav",
    word_timestamps=True,
    language="sa",  # or "hi" / omit if auto works better
    initial_prompt="nṛsiṃha kavacaṃ garjantaṃ dīpyantaṃ krandantaṃ vīkṣantaṃ",
)
offset = 580.0
for seg in segments:
    for w in seg.words or []:
        print(f"{offset + w.start:.1f}\t{w.word}")
PY
```

Map printed words to line indices; update anchors; re-run apply script.

## Spotify limitation (detail)

| Field | Behavior |
|-------|----------|
| `spotifyUrl` | External link / CTA only |
| `audio` + MP3 | In-page player + `lines[].start` karaoke |
| Bandcamp fields | Optional embed / link (see schema) |

Never promise karaoke sync from Spotify alone.

## Narasimha Kavacam — worked example

| Artifact | Path |
|----------|------|
| Chant | `src/content/chants/narasimha-kavacham.json` |
| Locale bundle | `scripts/chant-locales/narasimha-kavacham.json` |
| SRT source | `scripts/narasimha-kavacham-source.srt` |
| Apply wrapper | `scripts/apply-narasimha-timestamps.mjs` |
| Audio | `public/audio/narasimha-kavacham.mp3` |
| Spotify | `https://open.spotify.com/track/6BJRN8vLW3kzENL4uEhL25` (listen-only) |

Pipeline used:
1. Full multilingual text + explanations.
2. TurboScribe word SRT → anchors for clear sections; mid-track ASR gap (~v14–v24) interpolated.
3. MP3 wired for karaoke.
4. Verse 31 (`garjantam` … `vikshantam`) + colophon refined with faster-whisper on ~580–660s segment:
   - garjantam 584.0, dipyantam 596.7, krandantam 611.9, vikshantam 626.9, colophon 641.5

## Adding a thin wrapper for a new mantra

When anchors need comments, copy the Narasimha pattern:

```js
import { applyAnchorsToChant, chantPathForSlug, formatReport } from './lib/chant-timestamps.mjs';

const ANCHORS = { 0: 12.0, 1: 20.5 /* … */ };
const { report, lineCount } = applyAnchorsToChant({
  chantPath: chantPathForSlug(ROOT, 'my-slug'),
  anchors: ANCHORS,
  duration: 400,
});
```

For machine-generated anchors without comments, use JSON + `apply-chant-timestamps.mjs` only.

## Related docs

- `CONTRIBUTING.md` — human contributor overview
- `docs/I18N-LOCALIZATION.md` — locale fields and merge rules
- `.github/ISSUE_TEMPLATE/new_chant.md` — issue template for proposals
