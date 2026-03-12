# Avaliação e Plano — Funcionalidade de Contribuição (No-Code) e Publicação

**Objetivo:** Permitir que qualquer pessoa, sem conhecimentos de programação, contribua com cânticos através de uma interface web; associar contribuições a utilizadores (com login simples); e definir o fluxo desde a submissão até à publicação no site (revisão, aprovação, integração no repositório e deploy).

**Escopo deste documento:** Apenas avaliação e plano de implementação. Nenhuma implementação é feita nesta fase.

---

## 1. Estado atual do projeto

### 1.1 Conteúdo (schema e estrutura)

- **Fonte de verdade:** ficheiros JSON em `src/content/chants/` (um ficheiro por cântico).
- **Schema (Zod):** `src/content/schemas/chant.ts` define:
  - **Raiz:** `slug`, `title`, `tradition`, `origin` (opcional), `language`, `script` (opcional), `description` (en/pt), `tags`, `verses`.
  - **Áudio e media (todos opcionais):** `audio` (URL), `duration`, `spotifyUrl`, `bandcampEmbedSrc`, `bandcampUrl`, `bandcampArtImage`.
  - **About:** objeto opcional com `en` e `pt` (texto longo: significado, contexto, história).
  - **Versos:** array de objetos com `order`, `lines` e `explanation` opcional.
  - **Cada linha:** `start` (segundos para sync com áudio), `original` (símbolos originais, e.g. Devanagari), `transliteration`, `translations.pt` / `translations.en`.

A estrutura já cobre:
- Língua original e script (símbolos).
- Transliteração (segunda linha).
- Tradução por verso/linha (pt/en).
- Descrição curta (intro) e secção “About” mais elaborada.
- Áudio opcional e sync por tempo (`start` por linha).

### 1.2 Página “Contribute”

- **Localização:** `src/pages/contribute/index.astro`.
- **Conteúdo:** Instruções para programadores: criar JSON em `src/content/chants/`, seguir o schema, fazer PR. Não há formulário nem geração de JSON para não-programadores.

### 1.3 Publicação atual

- **Build:** Astro estático (SSG). Todas as páginas de cânticos vêm de `getStaticPaths()` a partir da collection `chants`.
- **CI/CD:** `.github/workflows/ci.yml` — em cada push/PR: build, lint, E2E; em `main`: semantic-release (tag + GitHub Release) e depois deploy para GitHub Pages a partir do tag (ou `main` se não houve release).
- **Conclusão:** Novos cânticos só entram no site após merge na `main` e um novo deploy (release ou manual). Não existe backend nem base de dados; tudo é ficheiro no repositório.

---

## 2. Requisitos da funcionalidade de contribuição (no-code)

### 2.1 O que o contribuidor deve poder fazer, sem programar

| Requisito | Detalhe |
|-----------|--------|
| **Estrutura do cântico** | Preencher: título, tradição, origem (opcional), língua, script (opcional), descrição curta (en/pt), tags. |
| **Símbolos originais** | Inserir texto na escrita original (e.g. Devanagari). |
| **Transliteração** | Segunda linha, por verso/linha. |
| **Tradução** | Tradução do verso (pt e/ou en). |
| **Descrição inicial** | Texto curto de introdução (já existe no schema como `description`). |
| **About** | Texto mais elaborado (já existe como `about`). |
| **Áudio** | Opcional: associar um ficheiro de áudio ou URL. Se não quiser, não preenche. |
| **Tempos (sync)** | Opcional: se houver áudio, poder indicar o tempo de início (em segundos) de cada linha para karaoke. Pode deixar em branco ou usar 0. |

Ou seja, a interface deve expor o mesmo modelo de dados que o JSON, mas através de formulários/wizard, sem editar JSON à mão.

### 2.2 Quem contribui (utilizador e login)

- **Login obrigatório** para aceder à área de contribuição (submeter novo cântico ou rascunhos).
- **Autenticação preferida: Sign in with GitHub**
  - O fluxo mantém-se “através do GitHub”: o contribuidor não precisa de saber Git nem de ter conta no nosso sistema além do GitHub. Identidade = conta GitHub (username, avatar, id).
  - O backend cria o PR em nome do repositório (bot) ou associa o PR ao autor via descrição “Contributed by @username”; assim o histórico fica no GitHub e reduzimos a necessidade de base de dados de utilizadores própria.
  - **Perfil mínimo:** nome e avatar vêm do GitHub; opcionalmente permitir bio/descrição guardada no nosso lado (em store serverless) para exibir “Contribuído por Nome” na página do cântico.
- **Associação:** cada contribuição fica ligada ao utilizador GitHub (e ao PR quando criado), para listagens (“minhas contribuições”), moderação e atribuição.
- **Alternativa:** se for necessário aceitar contribuidores sem conta GitHub, pode manter-se um fluxo secundário (email + código ou password) com mais superfície de backend; a recomendação é começar só com GitHub para reduzir custo e complexidade.

### 2.3 Fluxo contribuição → publicação no site

- **Submissão:** o contribuidor preenche o formulário e submete (rascunho ou “enviar para revisão”).
- **Destino desejado:** que a contribuição se torne conteúdo publicado no site, ou seja, que entre no repositório (novo ou alterado ficheiro em `src/content/chants/`) e que o pipeline atual (build + release/deploy) publique as páginas.
- **Revisão e aprovação:** antes de publicar, é necessário um passo humano: revisão (lista de correções, sugestões) e aprovação. Não se quer publicar automaticamente sem este controlo.
- **Integração técnica:** opções plausíveis:
  - **A)** Criação automática de um Pull Request no GitHub (a partir da contribuição aprovada ou da submissão “para revisão”), para a equipa fazer review no GitHub e merge quando estiver correto.
  - **B)** Backend com “lista de revisão” e “aprovação”; após aprovação, um processo (job/action) cria o PR ou comita diretamente numa branch e depois abre PR para `main`.

Em ambos os casos, a publicação final continua a ser: merge na `main` → CI → release/deploy existente. Ou seja, o “no-code” termina na geração do conteúdo e no PR (ou no pedido de publicação); o merge e o deploy mantêm-se no modelo atual.

### 2.4 Validação do conteúdo com inteligência artificial (opcional)

- **Objetivo:** Um passo extra de validação automática do conteúdo (qualidade, adequação, conformidade com o domínio “cântico sagrado”) antes ou durante a revisão humana.
- **Ativação condicional:** A validação por IA deve poder ser **ligada ou desligada** em função de:
  - **Créditos / custo:** por exemplo, um limite mensal de chamadas a um modelo pago (OpenAI, Anthropic, etc.); quando os créditos acabam, o passo de IA é ignorado sem bloquear o fluxo.
  - **Feature flag:** permitir desativar globalmente (ex.: em caso de orçamento zero ou manutenção).
- **Onde executar a validação — preferência: no GitHub (CI), não no site**
  - **Vantagem:** O site não consome API de IA; não há custo por visita nem necessidade de expor chaves no frontend. O custo ocorre só quando um PR é aberto ou atualizado.
  - **Implementação sugerida:** Uma **GitHub Action** que corre em cada PR que altera ficheiros em `src/content/chants/`. A action:
    - Obtém o diff ou o conteúdo do(s) ficheiro(s) JSON alterados.
    - Chama um modelo de IA (via API) com um prompt específico de “validação de cântico”: verificar coerência (título vs tradição vs língua), tom adequado (conteúdo sagrado/devocional), ausência de texto inadequado, e opcionalmente sugestões de melhoria (ex.: tradução incompleta).
    - Publica o resultado como comentário no PR (ex.: “🤖 AI check: OK” ou “⚠️ Sugestões: …”) e, opcionalmente, define um status check (pass/fail) para o PR.
  - **Modelo:** Usar um modelo **mais barato** (ex.: GPT-4o-mini, Claude Haiku, ou equivalente) para manter custo baixo; o agente é “só” validação/sugestão, não geração longa.
- **Fallback:** Se a validação por IA estiver desativada (créditos ou flag), o fluxo segue normalmente; a revisão humana continua a ser o gate principal para publicação.

### 2.5 Listagens e visibilidade do estado das contribuições

- **Para o contribuidor:** Página (ou secção) “Minhas contribuições” onde possa ver:
  - O que já **enviou** (submetido para revisão).
  - O que está em **rascunho** (não enviado).
  - O que foi **aprovado** (ex.: PR criado e talvez já em revisão no GitHub).
  - O que já foi **publicado** (PR merged; cântico no ar).
  - O que foi **rejeitado** ou pedido para alterações (com link para o PR ou comentários).
- **Para a equipa / mantenedores:** Listagem das contribuições **pendentes de revisão**, **aprovadas** (PR aberto) e **já publicadas**, para saber o que revisar e o que já entrou.
- **Fonte de verdade:** Pode ser obtida a partir do **próprio GitHub** (lista de PRs com label tipo `contribution`, `contribution-pending`, `contribution-approved`), consumida por uma API serverless que agrega PRs + metadados, ou por uma página que chame a GitHub API (com cache). Assim evitamos duplicar estado numa base de dados; o GitHub é o sistema de registo e o backend serverless só agrega/expõe para a UI.

---

## 3. Avaliação técnica e arquitetura

### 3.1 Restrições atuais

- **Site 100% estático:** Astro gera HTML no build; não há API nem base de dados no projeto.
- **Conteúdo = ficheiros no repo:** a única “base de dados” de cânticos é a pasta `src/content/chants/` e o schema Zod.
- **Deploy:** GitHub Actions + GitHub Pages; publicação via merge em `main` e (opcionalmente) semantic-release.

### 3.2 O que é preciso para “contribuição no-code + login”

- **Persistência de utilizadores e sessões:** com **Sign in with GitHub**, reduz-se a necessidade de guardar passwords ou enviar emails; o backend serverless pode guardar apenas GitHub id + username + avatar (e opcionalmente bio) numa store leve (ex.: KV/store do próprio fornecedor serverless). Sessão via cookie/JWT após OAuth.
- **Persistência de contribuições (rascunhos e submissões):** guardar o conteúdo submetido antes de virar PR. Em arquitetura serverless, usar store gerida (ex.: Vercel KV, Upstash Redis, DynamoDB, ou tabela serverless) com custo por uso, sem servidor sempre ligado.
- **De “contribuição aprovada” a “conteúdo no site”:**
  - **Recomendação — PR automático:** um serviço **serverless** (function que corre sob demanda) com credenciais seguras (GitHub App ou token) cria uma branch, adiciona/altera o JSON em `src/content/chants/`, e abre um PR para `main`. A equipa revê no GitHub; a **validação por IA** pode correr no próprio GitHub (Action no PR). Merge manual; o CI atual trata do deploy.

### 3.3 Backend obrigatoriamente serverless e de baixo custo

- **Requisito:** Qualquer backend desta funcionalidade deve ser **100% serverless** — sem servidor sempre ligado, para controlar custos e alinhar com o facto de o projeto já estar hospedado de forma estática (GitHub Pages).
- **O que “serverless” cobre aqui:**
  - **Auth:** OAuth com GitHub (redirect + callback) implementado em 1–2 funções (ex.: `api/auth/github`, `api/auth/callback`).
  - **API de contribuições:** funções que recebem o payload do formulário, validam com Zod, guardam rascunho ou disparam a criação do PR; leitura para “minhas contribuições” e listagens.
  - **Persistência:** uso de bases/stores serverless (KV, tabela, ou blob) oferecidas pelo mesmo fornecedor das funções, para rascunhos, metadados de submissão e opcionalmente perfil (bio).
  - **Criação do PR:** uma função (ou GitHub Action acionada por webhook) que, após aprovação, usa a GitHub API para criar branch, ficheiro(s) e PR.
- **Hospedagem sugerida (alinhada ao stack atual):**
  - **Vercel:** funções serverless em TypeScript/Node, KV/store disponível; integra bem com projetos estáticos e com domínio próprio (ex.: `contribute.sacredchants.org` ou `api.sacredchants.org`).
  - **Netlify:** Netlify Functions (Node/TS); Blobs ou serviços externos para persistência.
  - **Cloudflare Workers + KV/D1:** muito económico, TypeScript nativo; exige um pouco mais de configuração para OAuth e chamadas à GitHub API.
- Já existe domínio; o backend pode ser um subdomínio (ex.: `contribute.sacredchants.org`) ou rotas de API no mesmo domínio conforme a escolha de hospedagem.

### 3.4 Opções de arquitetura (resumidas, todas serverless)

| Componente | Recomendação (stack atual) |
|------------|----------------------------|
| **Auth** | GitHub OAuth; funções serverless para `/auth/github` e `/auth/callback`; sessão em cookie/httpOnly. |
| **Perfil / listagens** | Store serverless (KV ou tabela) para bio + metadados; listagens de “minhas contribuições” e “pendentes” podem vir de GitHub API (PRs com labels) + cache. |
| **Rascunhos e submissões** | Store serverless (KV/blob ou tabela) com payload do chant + estado (rascunho, enviado, aprovado, rejeitado). |
| **Criação de PR** | Função serverless (ou Action) com GitHub App/token; cria branch, escreve `src/content/chants/<slug>.json`, abre PR. |
| **Validação por IA** | GitHub Action que corre em PRs que tocam em `src/content/chants/`; chama modelo barato (ex.: GPT-4o-mini); comenta no PR; opcionalmente on/off por créditos ou secret. |
| **Frontend** | Astro (site estático) + páginas/rotas em `/contribute` que chamam a API serverless (fetch); formulário no-code e listagens consomem essa API. |

Tudo acima pode ser implementado sem servidor dedicado; o site público continua estático e o custo adicional fica limitado ao uso real (funções + store + eventual API de IA só em PRs).

### 3.5 Alinhamento com boas práticas do projeto

- **Clean code / padrões:** a nova lógica (validação do formulário, geração do JSON do cântico, chamadas à API do GitHub) deve viver em módulos bem definidos (ex.: `lib/contribution/`, `lib/github/`), com tipos TypeScript e reutilização do schema Zod (ou schema derivado) para validar o payload antes de gerar o JSON.
- **Design system:** a UI de contribuição (formulários, botões, mensagens) deve usar os mesmos tokens e componentes (PageShell, botões, inputs) referidos em `DESIGN-EVALUATION-AND-IMPROVEMENT-PLAN.md`, para consistência visual e de acessibilidade.
- **Sem alterar o schema de conteúdo à toa:** o formulário no-code deve produzir JSON que obedeça ao `chantSchema` atual; evolução do schema (ex.: novos campos opcionais) pode ser feita em fases posteriores e documentada.

---

## 4. Fluxo proposto (de submissão à publicação)

1. **Utilizador** acede a “Contribuir” no site. Se não estiver autenticado, é redirecionado para **Sign in with GitHub** (OAuth).
2. **Login com GitHub:** após autorização, o backend serverless cria/atualiza sessão e opcionalmente perfil (GitHub id, username, avatar, bio se preenchida). Sem necessidade de email/password no nosso lado.
3. **Formulário de contribuição (no-code):**
   - Passo 1: metadados (título, slug sugerido, tradição, língua, descrição curta, tags, about).
   - Passo 2: versos (para cada verso: linhas com original, transliteração, traduções pt/en; opcionalmente tempo `start` por linha).
   - Passo 3: áudio (opcional): upload de ficheiro ou URL; se houver áudio, opção de preencher tempos por linha.
   - Preview (opcional): visualização do conteúdo como ficará no site.
   - Submeter como “rascunho” (guardar na store serverless) ou “enviar para revisão”.
4. **No backend serverless:** validação contra o schema (Zod). Se “enviar para revisão”, a contribuição fica com estado “pendente” e (conforme o fluxo escolhido) pode gerar logo um **PR** ou entrar numa fila para aprovação interna antes de criar o PR.
5. **Criação do PR (automatizada):** um processo serverless (função ou Action) cria branch, adiciona/altera `src/content/chants/<slug>.json` (e áudio em `public/audio/` se for o caso), e abre um **Pull Request** para `main` com título/descrição que identifiquem o contribuidor (ex.: “Contribution: [title] by @username”). O contribuidor não precisa de saber Git; o fluxo é todo através do nosso site e do GitHub.
6. **Validação por IA (opcional, no GitHub):** uma **GitHub Action** dispara em cada push no PR. Se a validação por IA estiver ativa e houver créditos, a action chama um modelo barato com o conteúdo do JSON e publica um comentário no PR (ex.: “🤖 AI check: OK” ou sugestões). Pode ser ligada/desligada por secret ou créditos; se desativada, o check é ignorado.
7. **Revisão (humana):** equipa revê no GitHub (diff do JSON, comentário da IA se existir). Pode pedir alterações via comentários; o contribuidor pode editar no nosso formulário e reenviar (novo commit no mesmo PR ou novo PR).
8. **Listagens:** o contribuidor vê em “Minhas contribuições” o estado (rascunho, enviado, PR aberto, publicado, rejeitado); a equipa vê o que está pendente de revisão. Fonte: GitHub API (PRs com labels) + metadados na store serverless.
9. **Merge e publicação:** a equipa faz merge do PR no GitHub. O CI existente (build, release, deploy) publica o site; a nova página do cântico passa a estar no ar.

Ficheiros de áudio: hoje estão em `public/audio/`. Para contribuições, pode-se fazer upload no mesmo PR (em `public/audio/`) ou usar storage externo e colocar só a URL no JSON; a primeira opção mantém tudo no repo.

---

## 5. Plano de implementação (fases)

Todas as fases assumem **backend serverless** (Vercel, Netlify ou Cloudflare Workers) e **stack atual** (TypeScript, Astro, GitHub).

### Fase 0 — Decisões e preparação (sem código)

- Definir: hospedagem serverless (Vercel recomendado para alinhar com Astro/TS); onde guardar áudio (repo vs storage externo).
- Registrar GitHub OAuth App (para Sign in with GitHub) e decidir subdomínio (ex.: `contribute.sacredchants.org`).
- Definir política de moderação e checklist de revisão; documentar quem pode aprovar e como se usa o fluxo de PR.

### Fase 1 — Backend serverless mínimo e auth com GitHub

- Funções serverless: `GET/POST` para GitHub OAuth (redirect + callback), sessão (cookie httpOnly ou JWT), endpoint “quem sou eu” e opcionalmente “atualizar bio”.
- Store serverless (KV ou tabela) apenas para: GitHub id, username, avatar, bio opcional; sem passwords nem email próprio.
- Frontend: página “Contribuir” redireciona para login se não autenticado; após login, mostra o wizard de contribuição (ou listagem “Minhas contribuições”).

### Fase 2 — Formulário de contribuição (no-code) e criação de PR

- UI em passos (wizard): metadados → versos (original, transliteração, tradução; tempos opcionais) → áudio opcional; preview.
- Validação no cliente e nas funções serverless com o mesmo Zod do site; geração do JSON conforme `chantSchema`.
- Persistência de rascunhos na store serverless; ao “enviar para revisão”, a função serverless **cria já o PR** (branch + ficheiro(s) + abrir PR), associando o PR ao utilizador GitHub no corpo do PR (“Contributed by @username”).
- Nada de “aprovação interna” antes do PR se se quiser fluxo mais simples: enviar = criar PR; a revisão é toda no GitHub.

### Fase 3 — Listagens (estado das contribuições)

- **Para o contribuidor:** Página “Minhas contribuições” que lista: rascunhos (store serverless), submissões com link para o PR (store + GitHub API para estado do PR: aberto, merged, closed).
- **Para a equipa:** Listagem de PRs com label `contribution` (ou equivalente), obtida via GitHub API (ou função serverless que agrega e devolve JSON), para ver pendentes de revisão, aprovados e já publicados.
- Opcional: guardar na store o mapeamento “submissão id → PR number” para mostrar “Enviado”, “Em revisão”, “Publicado” sem depender só da API do GitHub em tempo real (com cache).

### Fase 4 — Validação por IA no GitHub (opcional, on/off)

- **GitHub Action** que corre em `pull_request` (ou `pull_request_target`) quando há ficheiros alterados em `src/content/chants/*.json`.
  - Lê o conteúdo do(s) ficheiro(s) JSON do PR.
  - Se validação por IA estiver ativa (ex.: secret `AI_VALIDATION_ENABLED` e créditos disponíveis), chama um modelo barato (ex.: OpenAI GPT-4o-mini ou Anthropic Haiku) com prompt fixo de “validação de cântico sagrado” (coerência, tom, sugestões).
  - Publica o resultado como comentário no PR; opcionalmente define um status check (success/failure) para o PR.
- Controlo de custo: validação pode ser desativada por secret; ou implementar contador simples (ex.: uso mensal) e desativar quando ultrapassar um limite.

### Fase 5 — Refino e comunidade

- Na página pública do cântico, opcionalmente mostrar “Contribuído por [Nome]” (dados do GitHub ou bio da store) quando o cântico tiver sido introduzido por contribuição no-code (ex.: metadado no JSON ou tabela slug → GitHub username).
- Ajustes de UX no wizard (preview, ajuda contextual, exemplos) e alinhamento com o design system (tokens, PageShell, acessibilidade).
- Documentação para contribuidores: como funciona o fluxo (enviar → PR → revisão → merge → publicado) e onde ver o estado das suas contribuições.

---

## 6. Riscos e decisões em aberto

| Tema | Risco / decisão |
|------|------------------|
| **Moderação** | Conteúdo inadequado ou erros: a revisão humana e o PR reduzem o risco; definir claramente quem pode aprovar e o checklist de revisão. |
| **Qualidade do texto** | Original/transliteração/tradução podem ter erros; a revisão deve incluir (onde possível) validação por alguém com conhecimento da língua/tradição. A validação por IA pode dar sugestões mas não substitui revisão humana. |
| **Validação por IA** | Custo: usar modelo barato e validação só em PR (não no site); ligar/desligar por créditos ou feature flag. Qualidade do agente: definir prompt estável (schema, tom, adequação) e aceitar que a IA pode falhar; o comentário no PR é “informação”, não gate obrigatório. |
| **Schema e evolução** | Novos campos no futuro (ex.: mais idiomas de tradução): o formulário e o backend devem ser pensados para evoluir sem reescrever tudo (ex.: configuração de campos por coleção). |
| **Áudio** | Tamanho e formato: definir tamanho máximo, formatos aceites (ex.: MP3, OGG) e onde ficam os ficheiros (repo vs CDN). |
| **Auth e privacidade** | Com GitHub OAuth guardamos apenas id, username, avatar, bio; cumprir RGPD (consentimento, direito ao apagamento). Quem não quiser usar GitHub: considerar fluxo alternativo (email) só se for necessário. |
| **Community** | O PR público, a listagem de estado e “Contribuído por” aumentam transparência; manter o fluxo visível (contribuição → PR → revisão → merge) reforça o lado comunitário. |

---

## 7. Resumo

- **Estrutura de conteúdo:** o schema atual já suporta língua original (símbolos), transliteração, tradução, descrição, about, áudio opcional e tempos por linha; a contribuição no-code expõe estes campos em formulário; o fluxo é automatizado até ao PR (a pessoa não precisa de saber programar nem Git).
- **Login:** preferência por **Sign in with GitHub**; perfil mínimo (nome/avatar do GitHub, bio opcional na nossa store); cada contribuição associada ao utilizador GitHub; PR criado automaticamente com “Contributed by @username”.
- **Listagens:** o contribuidor vê “Minhas contribuições” (rascunho, enviado, em revisão, publicado, rejeitado); a equipa vê o que está pendente de revisão; fonte = GitHub (PRs com labels) + store serverless para rascunhos e mapeamento.
- **Validação por IA:** opcional, **ligada/desligada** por créditos ou feature flag; executada **no GitHub** (Action no PR) com modelo barato, comentando no PR; o site não consome API de IA; quando desativada, o fluxo segue normalmente.
- **Publicação:** revisão humana no GitHub; merge manual; CI/deploy existente publica o site.
- **Arquitetura:** **backend 100% serverless** (Vercel, Netlify ou Cloudflare Workers), sem servidor sempre ligado; auth (GitHub OAuth), store para rascunhos e metadados, funções que criam o PR; alinhado ao stack atual (TypeScript, Astro, GitHub). Domínio próprio pode ser usado (ex.: subdomínio para contribuir).
- **Implementação:** em fases — decisões e preparação → auth GitHub + backend serverless → formulário no-code e criação de PR → listagens → validação por IA (Action no GitHub) → refino e “Contribuído por” na UI.

Este documento serve como base para discussão e, quando for aprovado, como referência para a implementação faseada sem alterar o comportamento atual do site até que cada fase esteja integrada e testada.
