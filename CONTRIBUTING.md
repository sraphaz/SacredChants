# Contributing to Sacred Chants

Thank you for considering contributing. This document explains how to add new chants and improve the project.

## Adding a new chant

For the full agent-oriented pipeline (JSON, locales, MP3, SRT timestamps, whisper repair), see **`AGENTS.md`** and **`.cursor/skills/chant-ingestion/SKILL.md`**.

### 1. Create a JSON file

Create a new file in `src/content/chants/`. The **filename** (without `.json`) will be the chant’s URL slug, e.g.:

- `src/content/chants/hanuman-chalisa.json` → `/chants/hanuman-chalisa`

Scaffold stub: `npm run chant:new [slug]`.

### 2. Follow the chant schema

Each file must validate against the Zod schema (`src/content/schemas/chant.ts`). Required fields:

| Field         | Type     | Description                          |
|---------------|----------|--------------------------------------|
| `slug`        | string   | Same as filename (e.g. `my-chant`)   |
| `title`       | string   | Display title                        |
| `tradition`   | string   | e.g. Hindu, Buddhist, Indigenous     |
| `language`    | string   | Original language name               |
| `description` | object   | Short intro per locale (`en`/`pt` required; `es`/`it`/`hi`/`ar` optional) |
| `verses`      | array    | At least one verse (see below)       |

Optional: `origin`, `script`, `tags` (string[]), `audio`, `interpreter`, `duration`, `spotifyUrl`, `about`, Bandcamp fields.

**Audio and lyric sync**

- **`audio`** — site path to MP3 (e.g. `/audio/my-chant.mp3` under `public/audio/`). Required for in-page karaoke.
- **`spotifyUrl`** — “Listen on Spotify” link only. **No playback sync** (Spotify does not expose position). Karaoke always needs the local MP3.
- **Lyric sync** — each **line** has `start` (seconds). The player highlights and seeks by line. Missing or wrong `start` values break karaoke even if Spotify is linked.

Arabic/Hindi line strings often live in `scripts/chant-locales/<slug>.json` and merge via `npm run chant:merge-locales`.

### 3. Verse structure

Each item in `verses` must have:

- `order` — number (1, 2, 3, …)
- `lines` — array of line objects (at least one)

Each **line** has:

- `start` — number (seconds from start of audio) for lyric sync
- `original` — text in original script
- `transliteration` — romanized form (IAST preferred for Sanskrit)
- `translations` — object with optional `en`, `pt`, `es`, `it`, `hi`, `ar`

Optional per verse: `explanation` (same locale keys).

Example:

```json
{
  "order": 1,
  "lines": [
    {
      "start": 10.0,
      "original": "श्रीगुरु चरण सरोज रज",
      "transliteration": "śrī guru charaṇa sarōja raja",
      "translations": {
        "pt": "Com a poeira dos pés de lótus do venerável Guru",
        "en": "With the dust of the lotus feet of the revered Guru"
      }
    }
  ]
}
```

Apply timestamps from SRT anchors: `node scripts/apply-chant-timestamps.mjs <slug> --anchors <file.json> [--duration SEC]`.

### 4. Validate and preview

- Run `npm run build` (schema validation) and `npm run dev`; open `/chants/your-slug`.
- The build will fail if the schema is invalid (e.g. missing required field or wrong type).

### 5. Submit a pull request

- One chant per PR is preferred.
- Ensure the JSON is valid and the slug matches the filename.

## Code contributions

- Follow the existing structure and naming.
- Use TypeScript and the existing Zod schemas.
- Prefer minimal, accessible HTML and Tailwind for layout.

## Commits and releases

We use **Conventional Commits** so that each merge to `main` can trigger an automatic release and deploy.

### Commit message format

Use a type and optional scope in the first line:

```
<type>(<scope>): <description>

[optional body]
```

**Types that trigger a release:**

| Type     | Effect on version | Example                    |
|----------|-------------------|----------------------------|
| `feat`   | Minor (0.x.0)     | `feat: add Hanuman Chalisa` |
| `fix`    | Patch (0.0.x)     | `fix: audio URL on GitHub Pages` |
| `perf`   | Patch             | `perf: reduce bundle size`  |
| `docs`   | No release        | `docs: update CONTRIBUTING` |
| `chore`  | No release        | `chore: bump deps`          |
| `style`  | No release        | `style: format with prettier` |

Use **BREAKING CHANGE:** in the body (or suffix `!` after type) for a major version bump.

### Flow

1. You open a PR; CI runs (build + lint).
2. After merge to `main`, the **Release** workflow runs:
   - Analyzes commits since the last tag.
   - If there is at least one `feat` or `fix` (or other release type), it creates a new **GitHub Release** (tag + notes) with **Semantic Versioning**.
3. The **Deploy** workflow runs when a release is **published**, building from that tag and deploying to GitHub Pages.

So: **merge to main with conventional commits → automatic release (when applicable) → automatic deploy.**

## Questions

Open an issue for discussion or questions about traditions, attribution, or schema changes.
