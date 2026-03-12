# Deploy da app de contribuição (app.sacredchants.org)

O site principal está em **GitHub Pages** (sacredchants.org), que só serve estáticos. A API de login e submissão só corre na **Vercel**. Este guia separa o que podes fazer por **comandos no projeto** do que só tu podes fazer (**IONOS** DNS, **GitHub** OAuth, primeiro login na Vercel).

---

## Passo a passo rápido (deploy via CI)

Faz isto na ordem para o GitHub Actions fazer deploy automático para a Vercel em cada push à `main`.

| # | Onde | O quê |
|---|------|--------|
| 1 | **Vercel (browser)** | Criar token: [vercel.com](https://vercel.com) → teu avatar (canto inferior esq.) → **Settings** → **Tokens** → **Create**. Copia o token (só aparece uma vez). |
| 2 | **Projeto (terminal)** | Na raiz do repo: `npx vercel login` e depois `npm run vercel:link`. Escolhe o team e o projeto (ou cria um). Isto gera `.vercel/project.json`. |
| 3 | **Ficheiro local** | Abre `.vercel/project.json`. Vais precisar de `orgId` (→ VERCEL_ORG_ID) e `projectId` (→ VERCEL_PROJECT_ID). |
| 4 | **GitHub CLI** | Instala [GitHub CLI](https://cli.github.com/) e faz `gh auth login`. Na raiz do repo (ou com `GITHUB_REPO=owner/SacredChants`). |
| 5a | **Terminal (Bash)** | Exporta os 3 valores e corre o script (troca pelos teus valores):<br>`export VERCEL_TOKEN="o_token_da_etapa_1"`<br>`export VERCEL_ORG_ID="o_orgId_do_project_json"`<br>`export VERCEL_PROJECT_ID="o_projectId_do_project_json"`<br>`bash scripts/setup-github-secrets-vercel.sh` |
| 5b | **PowerShell** | Define as 3 variáveis e usa `gh secret set` com `--body` (ver secção "Criar os secrets via GitHub CLI" abaixo). |
| 6 | **Verificar** | Faz push para `main`. Em GitHub → **Actions** o workflow deve correr e o step "Deploy to Vercel (Production)" deve fazer deploy (em vez de "skipping"). |

Se algo falhar: o job de deploy **não quebra** o CI se o token não existir; só fica uma mensagem "skipping". Quando os 3 secrets estiverem definidos, o próximo push à `main` faz o deploy.

---

## O que podes fazer daqui (comandos no projeto)

Tudo isto corre na raiz do repo, depois de `npm install`.

### 1. Instalar dependências (inclui Vercel CLI)

```bash
npm install
```

### 2. Primeira vez: login e link Vercel

Só precisas de fazer uma vez:

```bash
npx vercel login
```

Abre o browser para autenticar. Depois:

```bash
npm run vercel:link
```

Escolhe o team/account e o projeto (ou cria um novo com o nome que quiseres, ex. `sacred-chants`).

### 3. Enviar as variáveis de ambiente para a Vercel

Copia o ficheiro de exemplo, preenche os valores (Client ID/Secret do GitHub, token, etc.) e envia para a Vercel:

```bash
# Windows:
copy .env.vercel.example .env.vercel
# macOS/Linux: cp .env.vercel.example .env.vercel
# Edita .env.vercel com os teus valores (nunca faças commit deste ficheiro)

npm run vercel:env
```

Isto lê `.env.vercel` e faz `vercel env add` para cada variável em **Production**. Se uma variável já existir, remove-a no dashboard da Vercel ou com `npx vercel env rm NOME production` e volta a correr.

### 4. Adicionar o domínio na Vercel (uma vez)

```bash
npm run vercel:domain
```

Isto adiciona `app.sacredchants.org` ao projeto. A Vercel vai pedir que configures o DNS (CNAME → `cname.vercel-dns.com`); isso faz-se na IONOS (ver abaixo).

### 5. Deploy para produção (manual)

Sempre que quiseres publicar a app + API à mão:

```bash
npm run deploy:vercel
```

Isto corre `vercel --prod` e usa o projeto já ligado por `vercel link`.

### 6. Deploy via CI (recomendado)

O pipeline em `.github/workflows/ci.yml` faz **deploy para a Vercel só depois** de passar build (incl. unit tests), lint e E2E. Assim o deploy não corre em paralelo com os testes.

- **Ordem:** Build | Lint | E2E (paralelo) → **Deploy Vercel** (só em push para `main`).
- **Secrets no GitHub (Settings → Secrets and variables → Actions):**
  - `VERCEL_TOKEN` — token da Vercel (Account/Team → Settings → Tokens).
  - `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` — no projeto Vercel: Settings → General; ou em `.vercel/project.json` depois de `vercel link`.
- Se `VERCEL_TOKEN` não estiver definido, o job **não falha**: o step de deploy é ignorado e fica uma mensagem no log. Assim o CI continua verde até configurares os secrets.

**Criar os secrets via GitHub CLI (`gh`):**

1. Instala e autentica: [GitHub CLI](https://cli.github.com/) e `gh auth login`.
2. Obtém os valores:
   - **VERCEL_TOKEN:** Vercel → Account/Team → Settings → Tokens → Create.
   - **VERCEL_ORG_ID** e **VERCEL_PROJECT_ID:** Vercel → teu projeto → Settings → General; ou no ficheiro `.vercel/project.json` depois de `vercel link`.
3. Na raiz do repo, define os três secrets:

   **Bash / Git Bash (Windows):**
   ```bash
   # Substitui pelos teus valores; não faças commit destas linhas.
   export VERCEL_TOKEN="o_teu_token"
   export VERCEL_ORG_ID="team_xxxx"
   export VERCEL_PROJECT_ID="prj_xxxx"
   echo -n "$VERCEL_TOKEN"       | gh secret set VERCEL_TOKEN --repo owner/SacredChants
   echo -n "$VERCEL_ORG_ID"      | gh secret set VERCEL_ORG_ID --repo owner/SacredChants
   echo -n "$VERCEL_PROJECT_ID"  | gh secret set VERCEL_PROJECT_ID --repo owner/SacredChants
   ```
   Ou usa o script (com as variáveis já exportadas):
   ```bash
   bash scripts/setup-github-secrets-vercel.sh
   ```

   **PowerShell (Windows):**
   ```powershell
   # Substitui pelos teus valores; não faças commit.
   $env:VERCEL_TOKEN = "o_teu_token"
   $env:VERCEL_ORG_ID = "team_xxxx"
   $env:VERCEL_PROJECT_ID = "prj_xxxx"
   gh secret set VERCEL_TOKEN       --body $env:VERCEL_TOKEN       --repo owner/SacredChants
   gh secret set VERCEL_ORG_ID      --body $env:VERCEL_ORG_ID      --repo owner/SacredChants
   gh secret set VERCEL_PROJECT_ID  --body $env:VERCEL_PROJECT_ID  --repo owner/SacredChants
   ```
   (Troca `owner/SacredChants` pelo teu `owner/repo` se for diferente.)

Para evitar **dois** deploys (o da Vercel por Git e o do nosso workflow), no projeto Vercel: **Settings → Git → Production Branch** pode deixar `main`, mas em **Deploy Hooks** ou em **Ignored Build Step** podes desativar o deploy automático em push e usar só o deploy do CI. Alternativa: deixar a Vercel fazer deploy em cada push; nesse caso o deploy do CI será redundante mas os testes continuam a correr antes do job `deploy-vercel` (que falha sem os secrets até os configurares).

---

## O que só tu podes fazer

### A. IONOS — DNS (subdomínio app)

O domínio sacredchants.org está na **IONOS**. Para o subdomínio **app** apontar para a Vercel:

1. Entra no painel da IONOS onde geres o domínio **sacredchants.org**.
2. Abre a zona DNS / gestão de registos DNS.
3. Adiciona um **novo registo**:
   - **Tipo:** CNAME  
   - **Nome / Host:** `app` (ficará app.sacredchants.org)  
   - **Destino / Aponta para:** `cname.vercel-dns.com`  
4. Guarda. A propagação pode levar alguns minutos; a Vercel ativa o domínio e o SSL quando o CNAME estiver correto.

### B. GitHub — OAuth App (callback URL)

1. GitHub → **Settings** → **Developer settings** → **OAuth Apps**.
2. Abre (ou cria) a OAuth App usada para Sacred Chants.
3. Em **Authorization callback URL** coloca **exatamente:**  
   `https://app.sacredchants.org/api/auth/callback`
4. Guarda. Usa o **Client ID** e **Client Secret** em `.env.vercel` (e em `npm run vercel:env`).

### C. Vercel — primeiro projeto (se não usares só CLI)

Se preferires criar o projeto na Vercel pelo browser (em vez de `vercel link` a um projeto novo):

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → importa o repo **SacredChants**.
2. **Build Command:** `npm run build` | **Output Directory:** `dist`.
3. Depois podes usar `vercel link` neste repo para apontar ao projeto criado e seguir os comandos acima (env, domain, deploy).

---

## Variáveis de ambiente (referência)

| Variável | Descrição |
|----------|-----------|
| `SITE_ORIGIN` | `https://app.sacredchants.org` |
| `BASE_PATH` | `/` |
| `API_ORIGIN` | `https://app.sacredchants.org` |
| `CONTRIBUTE_ORIGIN` | `https://app.sacredchants.org` |
| `GITHUB_CLIENT_ID` | Da OAuth App (GitHub) |
| `GITHUB_CLIENT_SECRET` | Da OAuth App (GitHub) |
| `GITHUB_TOKEN` | Personal Access Token com permissão de **escrita** no repositório (criar branch, ficheiros e PR). **Fine-grained:** Repository → Contents (Read and write), Pull requests (Read and write). **Classic:** scope `repo` (ou `contents` + `pull_requests`). Sem isto, "Create pull request" devolve 500. |
| `SESSION_SECRET` | String aleatória longa (JWT) |
| `GITHUB_REPO_OWNER` | ex. `sraphaz` |
| `GITHUB_REPO_NAME` | `SacredChants` |

---

## Resumo

| Onde | O quê |
|------|--------|
| **Aqui (CLI)** | `npm install` → `vercel login` → `vercel link` → `.env.vercel` + `npm run vercel:env` → `npm run vercel:domain` → `npm run deploy:vercel` |
| **GitHub Actions** | Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; deploy Vercel corre após testes no push para `main` |
| **IONOS** | CNAME `app` → `cname.vercel-dns.com` |
| **GitHub** | OAuth App: Callback URL = `https://app.sacredchants.org/api/auth/callback` |

Depois do DNS ativo, **https://app.sacredchants.org/contribute/** deve ter login e submissão a funcionar; em sacredchants.org o botão “Open contribution app” leva para aí.

---

## Se "Create pull request" devolver 500

1. **Variável em falta:** Confirma que `GITHUB_TOKEN` está definida nas Environment Variables do projeto na Vercel (Production e Preview se usares).
2. **Permissões do token:** O token tem de poder criar branch (`git/refs`), escrever ficheiros no repo e criar pull requests. No GitHub:
   - **Fine-grained PAT:** no repositório, em "Repository permissions" escolhe **Contents** → Read and write, **Pull requests** → Read and write.
   - **Classic PAT:** scope `repo` (acesso total) ou, no mínimo, `contents` e `pull_requests`.
3. Nos logs da Vercel (Functions), o erro pode aparecer como `403 Forbidden` ou "Resource not accessible by personal access token". Corrige as permissões do token e faz redeploy.

---

## Testar localmente (API + login + submit)

Para testar o fluxo de contribuição (Sign in with GitHub, Create PR) no teu PC ou em Docker, vê **[LOCAL-VERCEL-DEV.md](./LOCAL-VERCEL-DEV.md)**. Resumo: `cp .env.local.example .env.local` → preencher → adicionar callback `http://localhost:3000/api/auth/callback` no GitHub → `npm run dev:vercel` (ou `docker compose -f docker-compose.dev.yml up --build`).
