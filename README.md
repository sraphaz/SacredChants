# Sacred Chants

**A living library of sacred sound traditions.**

Sacred Chants is an open-source contemplative web portal that hosts sacred chants, mantras, prayers, and indigenous devotional songs from different traditions. The platform is lightweight, content-first, and optimized for reading and chanting.

## Features

- **Content-first** — Static site with minimal JavaScript
- **Multiple traditions** — Hindu, Buddhist, Indigenous, and more
- **Translations** — Original script, transliteration, Portuguese and English
- **Accessible** — Semantic HTML, readable typography, contemplative layout
- **Contribution-friendly** — Add chants by adding a JSON file and opening a PR

## Tech stack

- [Astro](https://astro.build) — Static site generation
- [TypeScript](https://www.typescriptlang.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Content Collections](https://docs.astro.build/en/guides/content-collections/) + [Zod](https://zod.dev) schema validation

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Project structure

```
src/
  content/
    chants/          # One JSON file per chant
    traditions/
    knowledge/
  content/schemas/   # Zod schemas for content
  components/
  layouts/
  pages/
  styles/
  i18n/             # UI strings (en, pt)
public/
```

## Adding a chant

1. Create a new file in `src/content/chants/`, e.g. `my-chant.json`.
2. Follow the schema in `src/content/schemas/chant.ts` (see [Contribute](/contribute) page).
3. Run `npm run dev` to preview.
4. Submit a pull request.

## Scripts

| Command        | Action           |
|----------------|------------------|
| `npm run dev`  | Start dev server |
| `npm run build`| Build for production |
| `npm run preview` | Preview production build |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). We use GitHub Issues and Pull Requests with templates; CI runs on every push and PR.

**First push (repo already created with `gh repo create`):** If push failed due to workflow scope, run `gh auth refresh -s workflow -h github.com` in your terminal, complete the browser flow, then `git push -u origin main`.

## License

Open source. Use and contribute under the project license.
