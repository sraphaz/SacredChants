# Notas de implementação — Fluxo de contribuição (branch feat/contribution-no-code)

Implementação inicial do plano em `CONTRIBUTION-FEATURE-EVALUATION-AND-PLAN.md`.

## O que foi implementado

### 1. API serverless (pasta `api/`)

- **Auth:** `GET /api/auth/github` (redirect para GitHub OAuth), `GET /api/auth/callback` (troca de code por token, sessão JWT em cookie), `GET /api/me`, `POST /api/logout`.
- **Contribuição:** `POST /api/contribute/submit` (valida payload com Zod, cria branch + ficheiro em `src/content/chants/<slug>.json`, abre PR com label `contribution`), `GET /api/contribute/list` (lista PRs do utilizador com label e corpo “Contributed by @login”).
- **Session:** JWT (jose), cookie `sc_session`, HttpOnly, SameSite=Lax.
- **Dependências:** `jose`, `octokit`, `zod`; tipos `@vercel/node`, `@types/node`.

### 2. Páginas Astro (contribute)

- **`/contribute/`** — Verificação de sessão em cliente; botão “Sign in with GitHub” (link para `{API}/api/auth/github`) ou links para “Nova contribuição” e “As minhas contribuições” + logout.
- **`/contribute/form/`** — Formulário no-code (metadados + um verso mínimo); submissão por POST para `/api/contribute/submit`; mensagem de sucesso com link para o PR.
- **`/contribute/dashboard/`** — Lista de contribuições (PRs) do utilizador (número, título, estado, link).

Variável de ambiente no frontend: `PUBLIC_CONTRIBUTE_API_ORIGIN`. Se vazia, usa o mesmo origem (recomendado quando o site e a API estão no mesmo deploy, ex.: Vercel).

### 3. Criação de PR (GitHub)

- **`api/lib/github.ts`** — `createContributionPR`: cria branch `contribution/<slug>-<ts>`, adiciona `src/content/chants/<slug>.json`, abre PR com título “Contribution: &lt;title&gt; by @&lt;login&gt;” e label `contribution`.
- **Variáveis:** `GITHUB_TOKEN` (com permissão de escrita no repo), `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`.

### 4. Validação por IA (GitHub Action)

- **Workflow:** `.github/workflows/ai-validate-pr.yml` — dispara em PR que alteram `src/content/chants/*.json`.
- **Script:** `.github/scripts/ai-validate-chant.mjs` — lê o JSON, chama OpenAI `gpt-4o-mini` com prompt de revisão, escreve `comment.md`.
- **Comentário:** a action comenta no PR com “🤖 AI validation” e o resultado.
- **Opcional:** definir `OPENAI_API_KEY` no repositório para ativar; variável `AI_VALIDATION_ENABLED = false` para desativar.

### 5. Configuração Vercel

- **`vercel.json`** — configuração de funções em `api/**/*.ts` (memória e duração).
- O deploy na Vercel usa o build do Astro (`dist`) e serve as funções em `api/` no mesmo domínio, permitindo cookie de sessão no mesmo origem.

## O que falta (futuro)

- Persistência de **rascunhos** (store serverless, ex.: Vercel KV) para guardar contribuições antes de criar o PR.
- Formulário completo com **múltiplos versos**, **about**, **áudio** (upload ou URL) e **tempos** por linha.
- Criação do **label** `contribution` no repositório (ou tratamento de 404 em `addLabels`).
- Documentação para o utilizador final (como obter Client ID/Secret do GitHub, configurar callback URL, variáveis de ambiente).

**Deploy da API (subdomínio):** O site em produção está em GitHub Pages (só estático). Para o login e submissão funcionarem, a app + API têm de estar na Vercel. Ver **[DEPLOY-VERCEL-APP.md](./DEPLOY-VERCEL-APP.md)** para passos completos (Vercel, GitHub OAuth callback, DNS no UNIS). Subdomínio usado: **app.sacredchants.org**. O build do GitHub Pages usa `PUBLIC_CONTRIBUTE_APP_URL=https://app.sacredchants.org` para que as páginas Contribute no site principal liguem para a app no subdomínio.

## Variáveis de ambiente (API)

| Variável | Descrição |
|----------|-----------|
| `GITHUB_CLIENT_ID` | OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret |
| `GITHUB_TOKEN` | Token com repo write (criar PR) |
| `SESSION_SECRET` | Segredo para JWT (ou usar GITHUB_CLIENT_SECRET) |
| `API_ORIGIN` | Base URL da API (para redirect_uri do GitHub) |
| `CONTRIBUTE_ORIGIN` | Origem do site (redirect após login) |
| `GITHUB_REPO_OWNER` | Dono do repo (default: sraphaz) |
| `GITHUB_REPO_NAME` | Nome do repo (default: SacredChants) |

Para a Action de IA: `OPENAI_API_KEY` (secret), `AI_VALIDATION_ENABLED` (variável, opcional).
