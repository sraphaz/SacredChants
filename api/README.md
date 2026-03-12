# Contribution API (Serverless)

API for the no-code contribution flow: GitHub OAuth, session, and PR creation.

## Endpoints

- `GET /api/auth/github` — Redirects to GitHub OAuth.
- `GET /api/auth/callback` — OAuth callback; sets session cookie and redirects to site.
- `GET /api/me` — Current user (requires session cookie).
- `POST /api/logout` — Clear session and redirect.
- `POST /api/contribute/submit` — Validate chant payload and create a PR (requires session).
- `GET /api/contribute/list` — List current user's contribution PRs (requires session).

## Environment variables

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `GITHUB_TOKEN` | GitHub token with repo write (for creating PRs) |
| `SESSION_SECRET` | Secret for signing session JWT (or use `GITHUB_CLIENT_SECRET`) |
| `API_ORIGIN` | Base URL of this API (for OAuth redirect_uri). e.g. `https://api.sacredchants.org` |
| `CONTRIBUTE_ORIGIN` | Site origin (Astro app) for post-login redirect. e.g. `https://sacredchants.org` |
| `GITHUB_REPO_OWNER` | Repo owner (default: sraphaz) |
| `GITHUB_REPO_NAME` | Repo name (default: SacredChants) |

## Deployment

Recommended: deploy the whole repo to Vercel so the Astro site and `/api` run on the **same origin**. Then `API_ORIGIN` and `CONTRIBUTE_ORIGIN` can both be the Vercel deployment URL (e.g. `https://sacredchants.vercel.app`). This keeps the session cookie on the same domain.

If the API is on a subdomain (e.g. `api.sacredchants.org`), set the cookie domain explicitly and ensure the frontend sends credentials (same-site or CORS with credentials).

## GitHub setup

1. Create a GitHub OAuth App: Settings → Developer settings → OAuth Apps. Callback URL = `{API_ORIGIN}/api/auth/callback`.
2. For PR creation, use a Personal Access Token or GitHub App with `contents: write` and `pull_requests: write`. Set as `GITHUB_TOKEN`.
3. Add the label `contribution` to the repo (used for listing and AI validation).
