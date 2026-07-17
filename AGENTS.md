# Agent notes — Sacred Chants

## New mantra / chant ingestion

When adding or syncing a mantra (text, audio, karaoke timestamps, locales):

1. Read and follow the project skill: [`.cursor/skills/chant-ingestion/SKILL.md`](.cursor/skills/chant-ingestion/SKILL.md)
2. Extra detail (SRT mapping, ffmpeg + faster-whisper): [`.cursor/skills/chant-ingestion/reference.md`](.cursor/skills/chant-ingestion/reference.md)

**Spotify** (`spotifyUrl`) is listen-only. Karaoke requires `public/audio/<slug>.mp3` + `lines[].start`.

Shared timestamp tooling: `scripts/lib/chant-timestamps.mjs`, `scripts/apply-chant-timestamps.mjs`.

## Other pointers

- Schema: `src/content/schemas/chant.ts`
- Locale merge: `npm run chant:merge-locales`
- Human contributing guide: `CONTRIBUTING.md`
