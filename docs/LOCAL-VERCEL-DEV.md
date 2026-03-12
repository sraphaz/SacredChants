# Testar a app de contribuição localmente (Vercel + API)

O site estático (Astro) e a **API** (login GitHub, submissão de PR) correm na Vercel em produção. Para testar **tudo localmente** — incluindo “Sign in with GitHub” e “Create PR” — usa o **Vercel CLI** em modo dev. Assim a API (`/api/auth/github`, `/api/auth/callback`, `/api/me`, `/api/contribute/submit`) corre no teu PC junto com o Astro.

---

## Opção 1: Só Vercel CLI (recomendado)

### 1. Dependências e link

Na raiz do repo:

```bash
npm install
npx vercel login
npm run vercel:link
```

(Se já tiveres feito isto para deploy, não é preciso repetir.)

### 2. Variáveis de ambiente locais

Copia o exemplo e preenche com os teus valores (Client ID/Secret do GitHub, token, etc.):

```bash
# Windows
copy .env.local.example .env.local

# macOS / Linux
cp .env.local.example .env.local
```

Edita `.env.local`. Os valores devem ser **para local**:

| Variável | Valor local |
|----------|-------------|
| `SITE_ORIGIN` | `http://localhost:3000` |
| `API_ORIGIN` | `http://localhost:3000` |
| `CONTRIBUTE_ORIGIN` | `http://localhost:3000` |
| `GITHUB_CLIENT_ID` | (igual ao da OAuth App) |
| `GITHUB_CLIENT_SECRET` | (igual ao da OAuth App) |
| `GITHUB_TOKEN` | PAT com `repo` |
| `SESSION_SECRET` | string aleatória longa |
| `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` | teu repo |

O Vercel CLI carrega `.env.local` em `vercel dev`.

### 3. Callback URL no GitHub (OAuth)

O GitHub permite **vários** callback URLs na mesma OAuth App:

1. GitHub → **Settings** → **Developer settings** → **OAuth Apps** → a tua app.
2. Em **Authorization callback URL** adiciona (além do de produção):  
   `http://localhost:3000/api/auth/callback`
3. Guarda.

Assim o mesmo Client ID/Secret serve para produção e local.

### 4. Arrancar o ambiente local

```bash
npm run dev:vercel
```

Isto corre `vercel dev`: sobe o Astro e as serverless functions na mesma origem. Por defeito fica em **http://localhost:3000**.

- Abre **http://localhost:3000/contribute/**  
- Clica em “Sign in with GitHub” → deve redirecionar para o GitHub e voltar para localhost após login.  
- O formulário de nova contribuição e o “Create PR” usam a API local (`/api/me`, `/api/contribute/submit`).

### 5. Resumo dos comandos

| Comando | Uso |
|---------|-----|
| `npm run dev` | Só Astro; **sem** API (útil para páginas estáticas). |
| `npm run dev:vercel` | Astro + API (login + submit); **usa este para testar o fluxo de contribuição**. |

---

## Opção 2: Docker (ambiente isolado)

Se quiseres o mesmo fluxo dentro de um contentor (por exemplo para CI ou para evitar instalar Node na máquina):

### Pré-requisitos

- Docker e Docker Compose instalados.
- Ficheiro `.env.local` já preenchido na raiz do repo (o contentor monta o repo e usa esse ficheiro).

### Build e execução

Na raiz do repo:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Na primeira vez faz build da imagem; depois sobe o serviço. O app fica em **http://localhost:3000** (porta exposta no `docker-compose.dev.yml`).

- Dentro do contentor corre `vercel dev` (Node + Vercel CLI).
- O `.env.local` é montado como volume; mantém os valores que usas no passo 2 da Opção 1.
- O **callback URL** no GitHub deve continuar a ser `http://localhost:3000/api/auth/callback` (o browser está na tua máquina, não dentro do contentor).

Para parar:

```bash
docker compose -f docker-compose.dev.yml down
```

### Nota

O Docker apenas encapsula o mesmo ambiente que `npm run dev:vercel`: um único processo que corre `vercel dev`. Não há servidor Vercel “real” dentro do contentor; é a mesma experiência que na Opção 1, mas isolada.

---

## Resumo

| Objetivo | Como |
|----------|------|
| Testar login + submit PR localmente | `cp .env.local.example .env.local` → preencher → adicionar callback `http://localhost:3000/api/auth/callback` no GitHub → `npm run dev:vercel` → abrir http://localhost:3000/contribute/ |
| Mesmo fluxo num contentor | `.env.local` preenchido → `docker compose -f docker-compose.dev.yml up --build` → http://localhost:3000/contribute/ |
| Só frontend estático (sem API) | `npm run dev` (Astro em outro porto; sem login nem submit). |

A “API to upload” (submissão de PR) é o **POST /api/contribute/submit**; ela só existe quando corres a stack com `vercel dev` (CLI ou Docker).

---

## Testes E2E do fluxo de contribuição

Os testes E2E (Playwright) cobrem o fluxo de contribuição **sem precisar de API**: build estático + preview. Verificam que as páginas abrem, que o botão "Sign in with GitHub" existe e que o link aponta para a API de auth, e que o formulário está acessível.

**Comandos (na raiz do repo, depois de `npm install`):**

```bash
npx playwright install chromium
npm run test:e2e
npm run test:e2e:contribute   # só testes de contribute
```

O primeiro run faz build e sobe o preview; os testes de contribute garantem: `/contribute/` e `/contribute/form/` carregam, login CTA e link "Sign in with GitHub" visíveis, link com `returnTo` correto, e clique no botão navega para a URL de auth.
