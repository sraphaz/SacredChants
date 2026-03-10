# Contributing to Sacred Chants

Thank you for considering contributing. This document explains how to add new chants and improve the project.

## Adding a new chant

### 1. Create a JSON file

Create a new file in `src/content/chants/`. The **filename** (without `.json`) will be the chant’s URL slug, e.g.:

- `src/content/chants/hanuman-chalisa.json` → `/chants/hanuman-chalisa`

### 2. Follow the chant schema

Each file must validate against the Zod schema. Required fields:

| Field         | Type     | Description                          |
|---------------|----------|--------------------------------------|
| `slug`        | string   | Same as filename (e.g. `my-chant`)   |
| `title`       | string   | Display title                        |
| `tradition`   | string   | e.g. Hindu, Buddhist, Indigenous     |
| `language`    | string   | Original language name               |
| `description` | string   | Short description                    |
| `verses`      | array    | At least one verse (see below)       |

Optional: `origin`, `script`, `tags` (string[]), `audio` (URL), `spotifyUrl` (URL).

**Audio and lyric sync**

- **`audio`** — URL to an MP3/OGG file. If present, an audio player is shown on the chant page.
- **`spotifyUrl`** — Link to the track on Spotify. Shown as “Listen on Spotify” (no playback sync; Spotify does not expose playback position).
- **Lyric sync** — To have the current verse highlight and follow the audio (and allow clicking a verse to jump to that time), add a **`startTime`** (number, seconds from start) to each verse. Example: `"order": 1, "startTime": 0, "original": "..."`. Only verses with `startTime` are synced; you can add it to some verses only.

### 3. Verse structure

Each item in `verses` must have:

- `order` — number (1, 2, 3, …)
- `startTime` — optional number (seconds from start of audio) for lyric sync
- `original` — text in original script
- `transliteration` — romanized form
- `translations` — object with optional `pt` and `en` strings

Example:

```json
{
  "order": 1,
  "original": "श्रीगुरु चरण सरोज रज",
  "transliteration": "śrī guru charaṇa sarōja raja",
  "translations": {
    "pt": "Com a poeira dos pés de lótus do venerável Guru",
    "en": "With the dust of the lotus feet of the revered Guru"
  }
}
```

### 4. Validate and preview

- Run `npm run dev` and open `/chants/your-slug`.
- The build will fail if the schema is invalid (e.g. missing required field or wrong type).

### 5. Submit a pull request

- One chant per PR is preferred.
- Ensure the JSON is valid and the slug matches the filename.

## Code contributions

- Follow the existing structure and naming.
- Use TypeScript and the existing Zod schemas.
- Prefer minimal, accessible HTML and Tailwind for layout.

## Releases and deployment

- **CI** (`.github/workflows/ci.yml`): on every push/PR to `main` — runs build and lint.
- **Release build** (`.github/workflows/release.yml`): on push to `main` — validates build (e.g. for branch protection).
- **Deploy** (`.github/workflows/deploy.yml`): on every **published GitHub Release** — builds the site and deploys to **GitHub Pages**.

To publish a new version: create a new Release in the repo (e.g. tag `v0.2.0` and publish). The deploy workflow will run automatically and update the site at `https://sraphaz.github.io/SacredChants/`.

## Questions

Open an issue for discussion or questions about traditions, attribution, or schema changes.
