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

Optional: `origin`, `script`, `tags` (string[]), `audio` (URL).

### 3. Verse structure

Each item in `verses` must have:

- `order` — number (1, 2, 3, …)
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

## Questions

Open an issue for discussion or questions about traditions, attribution, or schema changes.
