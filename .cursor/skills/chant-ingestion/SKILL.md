---
name: chant-ingestion
description: >-
  Ingest a new Sacred Chants mantra end-to-end: Sanskrit lock (Devanagari + IAST
  research), parallel locale packs, chant JSON, locale merge (ar/hi), local MP3,
  word-level SRT → line timestamps with interpolation, ffmpeg + faster-whisper
  repair when ASR fails, schema validate, preview, commit. Use when adding a new
  chant/mantra/kavacham, aligning karaoke timestamps, applying SRT timings,
  wiring public/audio MP3, or reviewing Sanskrit text / translations.
---

# Chant / mantra ingestion pipeline

Repo-local skill for Sacred Chants. Follow this for every new mantra so tooling stays consistent and evolvable.

## Hard rules

1. **Spotify is listen-only.** `spotifyUrl` shows “Listen on Spotify”. It does **not** expose playback position. Karaoke sync **requires** a local MP3 at `public/audio/<slug>.mp3` and `audio: "/audio/<slug>.mp3"`.
2. Sync field is **`lines[].start`** (seconds), not a verse-level `startTime`. Schema: `src/content/schemas/chant.ts`.
3. Do not rewrite unrelated chants. One chant per PR preferred.
4. Prefer the shared timestamp lib over one-off copy-paste.
5. **Sanskrit lock before locales.** For Sanskrit (or Devanagari-script) mantras, do not parallelize translations until Devanagari + IAST are researched, cross-checked, and locked. See phases below.

## Checklist

```
Task Progress:
- [ ] 1. Gate: Sanskrit lock (research + Devanagari/IAST review) — if language is Sanskrit
- [ ] 2. Parallel locale packs (en+pt, es+it, hi+ar) after lock — fill missing / improve weak
- [ ] 3. Scaffold/finalize chant JSON (locked original + IAST + translations)
- [ ] 4. Bundle ar/hi in scripts/chant-locales/ + merge
- [ ] 5. Copy MP3 → public/audio/<slug>.mp3; set audio, duration, interpreter
- [ ] 6. Optional: spotifyUrl (listen-only link)
- [ ] 7. Word-level SRT → anchors → apply timestamps
- [ ] 8. If mid-track ASR fails: ffmpeg segment + faster-whisper refine
- [ ] 9. Validate (build / schema), preview, commit
```

Quality checklist (locales priority): [`.agents/checklists/chant-content.checklist.md`](../../../.agents/checklists/chant-content.checklist.md).

---

## Phase A — Gate: Sanskrit lock

**When:** `language` is Sanskrit (or the chant is traditionally Sanskrit with Devanagari `original` lines). Skip this gate for vernacular-only chants (e.g. pure Hindi bhajan with no Sanskrit source layer).

**Goal:** Lock `lines[].original` (Devanagari) and `lines[].transliteration` (IAST) before any translation workstream edits meanings.

### Research

1. Gather **at least two** independent sources when possible (public-domain stotra sites, critical editions, user PDF, published booklet). Note variants.
2. Prefer the reading that matches **how it is sung** on the target recording (line breaks, repeated refrains, omitted verses).
3. Cross-check Devanagari ↔ IAST line-by-line (same sandhi, same anusvāra/visarga choices).
4. If SRT/ASR exists early: use it only as a **phonetic hint** for sung form — never trust ASR spelling as the lock.

### Sanskrit review checklist

- [ ] Sandhi consistent with chosen edition (no random splits that break meter/meaning)
- [ ] Anusvāra (ं / ṃ) and visarga (ः / ḥ) correct; final -m/-n not mangled
- [ ] IAST diacritics complete: ā ī ū ṛ ṝ ḷ ṅ ñ ṇ ś ṣ ḥ ṃ (no ASCII shortcuts in locked text)
- [ ] Avagraha (ऽ / ') and daṇḍa where the source tradition uses them
- [ ] Proper names / epithets stable (e.g. Narasiṃha / Nṛsiṃha — pick one IAST form and keep it)
- [ ] Common ASR false friends rejected (e.g. nara-simha vs narasiṃha; random Latin lookalikes)
- [ ] Line segmentation matches sung delivery (refrain repeats get their own lines if sung)
- [ ] Sources cited in the PR/commit notes or `about` when non-obvious

**Lock criterion:** orchestrator (or Sanskrit workstream) declares Devanagari + IAST stable. Only then launch Phase B.

### Parallelism during the gate

You may run **one** deep-research Task (A) while scaffolding slug/audio/SRT paths — but **do not** start locale meaning packs until the lock is done.

---

## Phase B — Parallel locale packs

**When:** Sanskrit text is locked (or chant is non-Sanskrit and line text is already stable).

**Do not** create six permanent language agents. The **orchestrating agent** launches short-lived parallel Task workstreams, then merges results into one chant JSON (+ ar/hi bundle).

### Recommended Task split (launch concurrently)

| Stream | Scope | Writes |
|--------|--------|--------|
| **(A)** Sanskrit fidelity | Already done in Phase A; re-open only if lock regressions appear | `original`, `transliteration` only |
| **(B)** Meaning core | **en + pt** line translations, `description`, `about`, key `explanation` | `translations.en/pt`, descriptions |
| **(C)** Romance parity | **es + it** (match en/pt sense; natural idiom) | `translations.es/it` |
| **(D)** hi + ar bundle | Hindi + Arabic arrays + optional description/about/explanation | `scripts/chant-locales/<slug>.json` |

Priority if time-boxed: **pt → en → es/it → hi/ar** (see chant-content checklist).

### Orchestrator merge rules

1. Streams must **not** rewrite locked Devanagari/IAST (except stream A on explicit unlock).
2. Keep glossary consistency across locales (kavaca, dhyāna, names).
3. Dual lens for `about` / `explanation`: tradition fidelity **and** contemplative accessibility (clear refuge/meaning without dogma dumping).
4. After (D): `npm run chant:merge-locales`.
5. One PR per chant; parallel Tasks are workstreams, not parallel PRs.

### How another agent should invoke this

1. Read this skill + checklist.
2. If Sanskrit: finish **Phase A** (research Task) → mark lock.
3. In **one message**, launch Tasks **B + C + D** in parallel (Cursor `Task` tool, multiple calls).
4. Merge outputs → continue audio/SRT phases below.

---

## 1. Create chant JSON

Paths:
- Content: `src/content/chants/<slug>.json`
- Schema: `src/content/schemas/chant.ts`
- Scaffold CLI: `npm run chant:new [slug]` → `scripts/generate-chant.js` (stub; usually edit JSON by hand for full verses)

Structure (see Hanuman / Narasimha as references):

```json
{
  "slug": "my-mantra",
  "title": "…",
  "tradition": "Hindu",
  "language": "Sanskrit",
  "script": "Devanagari",
  "description": { "en": "…", "pt": "…", "es": "…", "it": "…", "hi": "…", "ar": "…" },
  "tags": ["mantra"],
  "audio": "/audio/my-mantra.mp3",
  "interpreter": "Artist name",
  "duration": 420,
  "spotifyUrl": "https://open.spotify.com/track/…",
  "about": { "en": "…", "pt": "…" },
  "verses": [
    {
      "order": 1,
      "lines": [
        {
          "start": 0,
          "original": "देवनागरी…",
          "transliteration": "iast…",
          "translations": { "en": "…", "pt": "…", "es": "…", "it": "…" }
        }
      ],
      "explanation": { "en": "…", "pt": "…" }
    }
  ]
}
```

Sources: public-domain stotra sites, user PDF, or provided text. Keep Devanagari + IAST aligned line-by-line with how it is sung (Phase A).

## 2. Arabic / Hindi locale merge

- Write `scripts/chant-locales/<slug>.json` with `lineTranslationsAr`, `lineTranslationsHi` (arrays, same length as flat lines), plus optional `descriptionAr`, `aboutAr`, `verseExplanationAr/Hi`.
- If `language` is Hindi/Awadhi, **do not** add `hi` on verse lines (merge script skips).
- Run: `npm run chant:merge-locales`

## 3. Audio

```bash
# copy user MP3 into the repo
cp path/to/recording.mp3 public/audio/<slug>.mp3
```

Set on the chant JSON:
- `audio`: `"/audio/<slug>.mp3"` (site-relative; works with Astro base path helpers)
- `duration`: total seconds (from ffprobe / player)
- `interpreter`: performer credit
- `spotifyUrl`: optional marketing link only

Get duration:

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 public/audio/<slug>.mp3
```

## 4. Timestamps from word-level SRT

1. Obtain a **word-per-cue** SRT of the same MP3 (TurboScribe or similar). ASR text is often noisy — **use times as anchors**, map by ear / known Sanskrit words.
2. Save source SRT as `scripts/<slug>-source.srt` (reference only).
3. Build an **anchors map**: flat line index → start seconds for lines you can confidently identify.
4. Apply with interpolation for gaps:

```bash
# Generic (anchors JSON file)
node scripts/apply-chant-timestamps.mjs <slug> --anchors scripts/<slug>.anchors.json --duration <sec>

# Or a thin wrapper with commented anchors (preferred for long mantras)
# Pattern: scripts/apply-narasimha-timestamps.mjs → uses scripts/lib/chant-timestamps.mjs
```

Anchors JSON formats accepted:

```json
{ "0": 13.4, "1": 25.6, "48": 470.7 }
```

or

```json
{ "duration": 813, "anchors": { "0": 13.4, "64": 641.5 } }
```

Shared logic: `scripts/lib/chant-timestamps.mjs` (`fillTimes`, `applyAnchorsToChant`).

Reference implementation: `scripts/apply-narasimha-timestamps.mjs` + `scripts/narasimha-kavacham-source.srt`.

## 5. Repair when SRT fails mid-track

When ASR collapses (repeated garbage, huge time jumps, missing verses):

1. Extract a segment with ffmpeg (absolute times on the full track):

```bash
ffmpeg -y -ss 580 -to 660 -i public/audio/<slug>.mp3 -ac 1 -ar 16000 /tmp/<slug>-seg.wav
```

2. Re-transcribe with **faster-whisper** (word timestamps). Prompt with expected Sanskrit/IAST if helpful.

```bash
python -c "from faster_whisper import WhisperModel; m=WhisperModel('small'); segs, _ = m.transcribe('/tmp/seg.wav', word_timestamps=True, language='sa');
[print(w.start, w.word) for s in segs for w in (s.words or [])]"
```

3. Add absolute times (`segment_ss + word.start`) as new anchors; re-run apply script.
4. Verify monotonic `start` values and that long verses are not crushed into one line.

## 6. Validate, preview, commit

```bash
npm run build          # schema + Astro build
npm run dev            # http://127.0.0.1:4321/chants/<slug>/
```

Manual check: play audio, confirm highlight advances; click lines to seek.

Commit (conventional): `feat: add <Title> chant` or `fix(<slug>): refine line timestamps`.

## Key paths

| Role | Path |
|------|------|
| Schema | `src/content/schemas/chant.ts` |
| Chant JSON | `src/content/chants/<slug>.json` |
| Locale bundles | `scripts/chant-locales/<slug>.json` |
| Merge ar/hi | `npm run chant:merge-locales` |
| Timestamp lib | `scripts/lib/chant-timestamps.mjs` |
| Generic apply | `scripts/apply-chant-timestamps.mjs` |
| Example wrapper | `scripts/apply-narasimha-timestamps.mjs` |
| Audio | `public/audio/<slug>.mp3` |
| Domain consult | `arah.config.yaml` → `chant-content`; checklist under `.agents/checklists/` |
| Human docs | `CONTRIBUTING.md`, `docs/I18N-LOCALIZATION.md` |
| Extra detail | [reference.md](reference.md) |

## Additional resources

- For SRT mapping tips, whisper repair, and Narasimha worked example → [reference.md](reference.md)
- Domain brief / review invariants → `arah.config.yaml` (`chant-content`) + `.agents/checklists/chant-content.checklist.md`
