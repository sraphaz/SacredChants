# Agent notes — Sacred Chants

## New mantra / chant ingestion

When adding or syncing a mantra (text, audio, karaoke timestamps, locales):

1. Read and follow the project skill: [`.cursor/skills/chant-ingestion/SKILL.md`](.cursor/skills/chant-ingestion/SKILL.md)
2. Extra detail (SRT mapping, ffmpeg + faster-whisper): [`.cursor/skills/chant-ingestion/reference.md`](.cursor/skills/chant-ingestion/reference.md)
3. Quality pass: [`.agents/checklists/chant-content.checklist.md`](.agents/checklists/chant-content.checklist.md)

**Sanskrit mantras:** research and lock Devanagari + IAST first (tradition + sung form). Only then launch parallel Task workstreams for locales — e.g. (B) en+pt, (C) es+it, (D) hi+ar bundle — and merge into one chant PR. Do not spawn one permanent agent per language.

**Spotify** (`spotifyUrl`) is listen-only. Karaoke requires `public/audio/<slug>.mp3` + `lines[].start`.

Shared timestamp tooling: `scripts/lib/chant-timestamps.mjs`, `scripts/apply-chant-timestamps.mjs`.

Domain consult (ARAH): `chant-content` in `arah.config.yaml` (run `arah domain sync` after editing enrich/validate).

## Other pointers

- Schema: `src/content/schemas/chant.ts`
- Locale merge: `npm run chant:merge-locales`
- Human contributing guide: `CONTRIBUTING.md`
