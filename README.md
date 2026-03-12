# Sacred Chants

**A living library of sacred sound traditions.**

Sacred Chants is an open-source contemplative web portal that hosts sacred chants, mantras, prayers, and indigenous devotional songs from different traditions. The platform is lightweight, content-first, and optimized for reading and chanting.

## Features

- **Content-first** — Static site with minimal JavaScript; main site served from GitHub Pages.
- **Multiple traditions** — Hindu, Buddhist, Indigenous, and more.
- **Translations** — Original script, transliteration, Portuguese and English.
- **Audio & lyric sync** — Optional audio player per chant; verses can have `startTime` for sync with playback and click-to-seek.
- **Knowledge section** — Articles on Nada Yoga, elements & sound, vibration & mind, balance & healing, sound & humanity, sound attributes, and references (`/knowledge/`).
- **Accessible** — Semantic HTML, readable typography, contemplative layout; UI in English and Portuguese.
- **Contribution-friendly** — Add chants by opening a PR with a JSON file, or use the **no-code flow**: sign in with GitHub on the contribution app, fill the form, and submit; a pull request is created for you.

## Where it runs

| Site | URL | Role |
|------|-----|------|
| **Main site** | [sacredchants.org](https://sacredchants.org) | GitHub Pages — static content (chants, knowledge, traditions). |
| **Contribution app** | [app.sacredchants.org](https://app.sacredchants.org) | Vercel — login, contribute form, dashboard, serverless API. |

The main site links to the contribution app for “Contribute”; both share the same content once PRs are merged.

## Tech stack

- [Astro](https://astro.build) — Static site generation
- [TypeScript](https://www.typescriptlang.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Content Collections](https://docs.astro.build/en/guides/content-collections/) + [Zod](https://zod.dev) schema validation
- **Contribution API** — Vercel serverless functions (Node), GitHub OAuth (jose), Octokit for PRs

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
    knowledge/       # MD/MDX and data for /knowledge/
  content/schemas/   # Zod schemas for content
  components/
  layouts/
  pages/             # Astro pages (chants, contribute, knowledge, settings)
  styles/
  i18n/              # UI strings (en, pt)
api/                 # Vercel serverless: auth, contribute/submit, contribute/list, me, logout
public/
scripts/             # E2E preview, vercel env, generate-chant, setup-github-secrets-vercel, etc.
```

## Adding a chant

**Option A — No-code (recommended for most contributors)**  
Use the [contribution app](https://app.sacredchants.org/contribute/): sign in with GitHub, open “New contribution”, fill the form, and submit. A pull request is created automatically.

**Option B — Pull request**  
1. Create a new file in `src/content/chants/`, e.g. `my-chant.json`.  
2. Follow the schema in `src/content/schemas/chant.ts` (see also [CONTRIBUTING.md](CONTRIBUTING.md) for verse structure and optional `startTime` for lyric sync).  
3. Run `npm run dev` to preview.  
4. Submit a pull request.

## Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` / `npm run test:unit` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E tests (Playwright; starts server with base `/` automatically) |
| `npm run test:e2e:server` | Start server only for E2E (run in another terminal before `test:e2e` if needed) |
| `npm run test:e2e:ui` | E2E with Playwright UI |
| `npm run test:e2e:docker` | E2E in Docker (recommended: isolated, no host browsers) |
| `npm run chant:new` | Generate a new chant JSON from a script |
| `npm run deploy:vercel` | Deploy to Vercel (production); requires `vercel link` and env (see [docs](docs/DEPLOY-VERCEL-APP.md)) |

Vercel-related: `vercel:link`, `vercel:env`, `vercel:domain` — see [Deploy (Vercel)](docs/DEPLOY-VERCEL-APP.md).

## E2E (Playwright)

E2E tests cover:

- **Drawer (mobile)** — Open/close via button, backdrop, Escape, or link click; drawer height and no scroll bar.
- **Navigation** — Home, chants list, chant page with player; header links on desktop.

**Recommended (isolated):** `npm run test:e2e:docker` — builds with base `/`, runs preview and tests in a container. No host Node/browser setup required.

Local alternative: `npm run test:e2e` (first run can take ~2 min). Or in another terminal: `npm run test:e2e:server`, then `npm run test:e2e`.

## Documentation

| Doc | Description |
|-----|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to add chants (schema, verses, audio), commit format, PR process. |
| [docs/DEPLOY-VERCEL-APP.md](docs/DEPLOY-VERCEL-APP.md) | Deploy the contribution app to Vercel (env, domain, GitHub secrets, CI). |
| [docs/CONTRIBUTION-IMPLEMENTATION-NOTES.md](docs/CONTRIBUTION-IMPLEMENTATION-NOTES.md) | Implementation notes for the no-code contribution flow and API. |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). We use GitHub Issues and Pull Requests with templates; CI runs build, lint, and E2E on every push and PR; optional Vercel deploy on `main` when secrets are configured.

**First push (repo created with `gh repo create`):** If push fails due to workflow scope, run `gh auth refresh -s workflow -h github.com`, complete the browser flow, then `git push -u origin main`.

## License

Open source. Use and contribute under the project license.
