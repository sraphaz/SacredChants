# Clean Code Review Completo e Plano de Refatoração

Revisão alinhada aos princípios de **Clean Code** (Robert C. Martin — Uncle Bob) e aos **Design Patterns** (Gamma, Helm, Johnson, Vlissides), com checklist abrangente de qualidade. Inclui estado atual, achados, mapeamento de padrões à stack do projeto e **plano de trabalho completo** por fases.

---

## Referências

- **Clean Code (Uncle Bob):** nomes intenção-reveladores, funções pequenas e com uma responsabilidade, comentários que explicam “porquê”, formatação (newspaper, densidade vertical), SRP, DRY, Lei de Demeter, tratamento de erros, F.I.R.S.T. em testes, cheiros (rigidez, fragilidade, imobilidade, viscosidade).
- **Awesome / revisão abrangente:** consistência de estrutura, centralização de constantes e paths, testabilidade, manutenção de i18n em um único lugar.
- **Design Patterns (GoF):** Gamma, Helm, Johnson, Vlissides — padrões creacionais, estruturais e comportamentais aplicados à stack (Astro, content collections, layouts, API, i18n). Ver §3.
- **Estado anterior:** `docs/CLEAN-CODE-REVIEW.md` (refactors já feitos: ChantCard, submit.ts, BaseLayout init script, KnowledgePageHeader, ChantPlayerBar, localeQuery, ChantVerse).

---

## 1. Resumo executivo

| Área | Naming | Funções | Comentários | DRY / Duplicação | Error handling | SRP | Notas |
|------|--------|---------|-------------|------------------|----------------|-----|--------|
| api/ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | submit já refatorado |
| api/lib/ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| src/i18n/ | ✅ | ✅ | n/a | n/a | ✅ | ✅ | — |
| src/utils/ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| src/components/ | ✅ | n/a | ⚠️ | ⚠️ ver §2 | n/a | ✅ | Footer/nav ainda 4× locale |
| src/layouts/ | ✅ | n/a | ⚠️ | ⚠️ ver §2 | n/a | ⚠️ | Scripts inline longos |
| src/pages/ | ⚠️ | ⚠️ | ⚠️ | ⚠️ ver §2 | n/a | ⚠️ | BASE/FULL_BASE, blocos locale |

---

## 2. Achados detalhados (Clean Code + abrangente)

### 2.1 Nomes (Meaningful Names)

- **Já corrigido:** `q` → `localeQuery` em knowledge, contribute, traditions (PR #26).
- **Pendente:** Em `settings` e `dashboard` pode existir `q` para `URLSearchParams`; se for query de locale, alinhar ao nome `localeQuery`; se for outra query, usar nome explícito (ex.: `searchParams`).
- **Constantes mágicas:** `valid = ['en', 'pt', 'es', 'it']` em BaseLayout (script inline). Deve vir de uma única fonte (ex.: reexport de `i18n/strings` ou constant `SUPPORTED_LOCALES`).

### 2.2 Funções (Small, One Thing, Stepdown)

- **api/contribute/submit.ts:** Handler ~80 linhas mas já em passos de alto nível (método → auth → parse → validação → build body → create PR → resposta). Funções auxiliares bem extraídas. **Aceitável**; opcional: extrair parse + validação do body para `parseAndValidateBody(req)`.
- **BaseLayout.astro:** Dois scripts inline longos: (1) drawer (abrir/fechar), (2) locale select (storage, URL, sync). **Sugestão:** mover para ficheiros em `public/scripts/` (ex.: `drawer.js`, `locale-select.js`) para facilitar leitura e testes.
- **chants/[slug].astro:** Frontmatter com ~65+ linhas (BASE, FULL_BASE, audioUrlForPlayer, bandcampArtImage, sortedVerses, syncLines, linesWithMeta, hasEs, hasIt). **Sugestão:** extrair para funções com nomes descritivos em `src/utils/chant-page.ts` (ex.: `getAudioUrl(chant, baseUrl)`, `getLinesWithMeta(chant)`, `getSyncLines(chant)`), mantendo a página como orquestração.

### 2.3 Comentários (Explain Why, Avoid Redundancy)

- **Bons:** JSDoc em api/, comentários em chant schema, “Resolve audio URL with base path…” em [slug].astro.
- **A evitar:** Comentários que apenas repetem o código (ex.: “set allowed to array of locales”). Em BaseLayout, preferir comentário único no topo do script: “Valid locales must match i18n/strings; synced from data attribute.”

### 2.4 DRY e duplicação

- **Blocos por locale (en/pt/es/it):**
  - **Já DRY:** ChantCard, ChantVerse, KnowledgePageHeader, ChantPlayerBar (após refactor).
  - **Ainda 4× repetido:** BaseLayout footer (quatro `<p class="locale-*">`); nav e drawer (muitos `<a>` duplicados por locale). **Sugestão:** componente `LocaleAwareNav.astro` e `LocaleAwareFooter.astro` que recebem items/hrefs e renderizam um loop sobre `SUPPORTED_LOCALES`; ou helper que gera os pares (href, label) por locale a partir de `ui`.
- **BASE / FULL_BASE:** Repetido em ~12 páginas. **Sugestão:** util `getFullBase(astroUrl)` em `src/utils/base.ts` (ou em `i18n/strings` se for partilhado com layout) e usar em todas as páginas e no BaseLayout.
- **Imports tEn, tPt, tEs, tIt:** Onde a página só precisa do texto do locale atual, usar `t = ui[locale]` e um único bloco; onde é necessário renderizar os 4 blocos (para CSS .locale-*), manter o padrão atual ou passar `tByLocale` a um componente.

### 2.5 Formatação e estrutura (Newspaper, Vertical Density)

- **Páginas longas:** [slug].astro, contribute/form.astro, contribute/guide.astro têm muito markup. Manter “conceito no topo, detalhes em baixo”; extrair secções para componentes (ex.: “About”, “Verses list”, “Bandcamp block”) quando um bloco passar de ~30–40 linhas.

### 2.6 Lei de Demeter / acoplamento

- **ChantLayout:** Já usa `descriptionForMeta` derivado de `chant.description` e locale; evita encadear `chant.description?.en` no template. **Bom.**
- **ChantCard / outras:** Preferir objetos derivados no frontmatter (ex.: `descByLocale`, `hrefByLocale`) em vez de aceder a `chant.description?.en` em vários sítios no template.

### 2.7 Tratamento de erros

- **API:** Códigos HTTP e JSON estruturados; `buildSubmitErrorHint` para hints ao cliente. **Bom.**
- **Evitar:** “Don’t return null” em excesso; em novos fluxos críticos considerar Result ou throw com mensagem clara.

### 2.8 Testes (F.I.R.S.T.)

- **E2E:** locale, navigation, mobile-drawer, contribute. Cobrem fluxos principais.
- **Gaps:** Nenhum teste unitário para `formatChantContentAsMarkdown`, `buildContributionPRBody`, `getLocaleFromUrl`, `langQuery`. **Sugestão (opcional):** testes unitários para essas funções em `api/` e `src/i18n/` para evitar regressões em refactors.

### 2.9 Cheiros de código (Smells)

- **Rigidez:** Reduzida com KnowledgePageHeader e localeQuery; ainda presente onde nav/footer e BASE estão duplicados.
- **Fragilidade:** Baixa se constantes de locale forem únicas (`SUPPORTED_LOCALES`).
- **Imobilidade:** Utils `getFullBase` e componentes de nav/footer reutilizáveis aumentam reuso.
- **Viscosity:** Naming consistente e funções pequenas tornam “fazer a coisa certa” mais fácil.

---

## 3. Design Patterns (GoF) — mapeamento e oportunidades

Referência: *Design Patterns — Elements of Reusable Object-Oriented Software*, Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides. Aplicação aos módulos, layouts, API e i18n do projeto.

### 3.1 Stack e estruturas do projeto

| Camada | Tecnologia | Estruturas relevantes |
|--------|------------|------------------------|
| **Build / rotas** | Astro (SSG) | `getStaticPaths`, content collections, slots |
| **Conteúdo** | Astro Content Collections | `getCollection('chants')`, `getEntry('chants', slug)`, schema Zod |
| **Layout** | Astro layouts + slots | `BaseLayout` → `<slot />` → `ChantLayout` → `<slot />` → página |
| **UI** | Componentes .astro | ChantCard, ChantVerse, KnowledgePageHeader, nav, footer |
| **i18n** | `src/i18n/strings.ts` | `Locale`, `getLocaleFromUrl`, `langQuery`, objeto `ui` por locale |
| **API** | Vercel serverless | Handlers (submit, list, close), lib (session, github, chant-schema) |
| **Externos** | Bandcamp, GitHub | `getBandcampArtUrl`, Octokit / `createContributionPR` |

### 3.2 Padrões já presentes (implícitos ou explícitos)

| Padrão (GoF) | Onde aparece | Observação |
|--------------|--------------|------------|
| **Template Method** | Fluxo de página: layout define esqueleto (head, header, main, footer), página injeta conteúdo via slot. API: método → auth → parse → validar → executar → responder. | Estrutura estável; passos concretos variam por página/handler. |
| **Facade** | `BaseLayout`: esconde detalhes de nav, drawer, locale select, scripts, footer. `ChantLayout`: facada sobre BaseLayout + meta description por locale. | Simplifica uso; evita que páginas conheçam detalhes do layout. |
| **Strategy** | Resolução de locale: `getLocaleFromUrl` + `langQuery`. Tema: `init-theme-locale.js` aplica tema a partir de storage/URL. | Comportamento variável (locale, tema) isolado em funções/scripts. |
| **Adapter** | `getBandcampArtUrl`: adapta API/HTML do Bandcamp ao formato esperado. API GitHub via Octokit: adapta REST ao uso interno. | Interface estável interna; detalhes externos encapsulados. |
| **Builder (parcial)** | `buildContributionPRBody` e `formatChantContentAsMarkdown`: montam documento (PR body / Markdown) por partes. | Poderia ser formalizado como builder com métodos `.addSection()`, `.build()`. |
| **Factory Method** | `getCollection` / `getEntry`: Astro expõe conteúdo; construção das páginas estáticas é delegada ao framework. | Dados de chant poderiam ser construídos por uma factory explícita (`createChantPageData(entry, baseUrl)`). |
| **Composite** | Árvore de layout: BaseLayout contém header (nav + select), main (slot), footer. Slot preenchido por ChantLayout ou página. | Estrutura em árvore; tratamento uniforme de nó (layout) e folha (conteúdo). |
| **Singleton (ambiente)** | Config e env (BASE_URL, GITHUB_TOKEN) usados como dependências. | Aceitável em serverless; explícito em lib (getOctokit lê env). |

### 3.3 Lacunas e oportunidades (pattern-informed refactor)

| Área | Padrão sugerido | Benefício | Alinhamento Clean Code |
|------|-----------------|-----------|------------------------|
| **Nav / footer com 4 locales** | **Template Method:** componente que itera sobre `SUPPORTED_LOCALES` e contrato de props (hrefByLocale, labelByLocale). | Novo item ou locale num único sítio. | DRY, SRP. |
| **BASE / FULL_BASE** | **Facade:** `getFullBase(url)` como fachada única para URL base do site. | Single source of truth. | Naming, DRY. |
| **Dados da página chant** | **Factory Method:** `createChantPageData(entry, baseUrl)` produz `{ audioUrl, syncLines, linesWithMeta, ... }`. Página consome objeto. | Frontmatter enxuto; lógica testável. | Funções pequenas, Stepdown. |
| **API submit: parse + validação** | **Template Method + Strategy:** handler como template; `parseAndValidateSubmitBody(req)` como estratégia. | Responsabilidades claras. | SRP, teste unitário. |
| **Constantes de locale** | **Singleton (config):** `SUPPORTED_LOCALES` em `i18n/strings`; usado em BaseLayout e scripts. | Uma fonte de verdade. | Naming, rigidez. |
| **PR body** | **Builder (opcional):** objeto com `addSummary()`, `addContent()`, `build()`. | Extensibilidade sem alterar handler. | SRP. |
| **Scripts de layout** | **Observer (cliente):** drawer e locale-select como scripts extraídos; listeners atuais. | Scripts testáveis. | Funções pequenas. |

### 3.4 Mapeamento padrão → tarefas das fases

- **Fase 1:** `SUPPORTED_LOCALES` = config singleton; `getFullBase` = Facade para base URL.
- **Fase 2:** Nav/footer com iteração sobre locales = Template Method; reduz 4× blocos para um loop.
- **Fase 3:** Extração drawer e locale-select = separação de responsabilidades (Strategy/Observer no cliente).
- **Fase 4:** `chant-page.ts` com funções de dados = Factory Method; página consome objeto pronto.
- **Fase 5:** `parseAndValidateSubmitBody` = Strategy; handler = Template Method.
- **Fase 6:** Consistência ES/IT na API = mesma Strategy de locale do site.

### 3.5 Padrões que não se aplicam (ou são overkill)

- **Abstract Factory:** só com múltiplas fontes de conteúdo (CMS + file); uma content collection basta.
- **Decorator (classe):** composição por slots já cobre “layout envolve layout”.
- **Chain of Responsibility:** API pequena; fluxo linear é suficiente.
- **Iterator explícito:** `getCollection` e arrays derivados já são iteráveis.

---

## 4. Plano de trabalho completo (refatoração por fases)

### Fase 1 — Baixo risco, alto impacto (naming + single source of truth)

| # | Tarefa | Ficheiros | Critério de conclusão |
|---|--------|-----------|------------------------|
| 1.1 | Definir `SUPPORTED_LOCALES` (ou `LOCALES`) em `src/i18n/strings.ts` e usar em BaseLayout (script locale) e em qualquer outro sítio que use `['en','pt','es','it']`. | `src/i18n/strings.ts`, `src/layouts/BaseLayout.astro` | Uma única constante; sem arrays mágicos de locale. |
| 1.2 | Verificar `q` em settings/dashboard; renomear para `localeQuery` ou `searchParams` conforme o significado. | `src/pages/settings/index.astro`, `src/pages/contribute/dashboard.astro` (se existir) | Nomes consistentes e intenção-reveladores. |
| 1.3 | Criar `src/utils/base.ts` com `getFullBase(url: URL): string` (BASE_URL + BASE_SLASH + origin) e usar em BaseLayout e em todas as páginas que calculam FULL_BASE. | `src/utils/base.ts`, `BaseLayout.astro`, todas as páginas que usam FULL_BASE | Zero duplicação do cálculo de FULL_BASE. |

**Entregável Fase 1:** PR “refactor: single source for locales and base URL”.

---

### Fase 2 — Redução de duplicação em layout (nav + footer)

| # | Tarefa | Ficheiros | Critério de conclusão |
|---|--------|-----------|------------------------|
| 2.1 | Criar componente `LocaleLinks.astro` (ou usar padrão de “items por locale”) que recebe um array de `{ href, labelByLocale }` (ou href por locale) e renderiza os blocos `locale-en`, `locale-pt`, etc. para nav e drawer. | `src/components/LocaleLinks.astro` (ou similar), `BaseLayout.astro` | Nav e drawer usam o componente; um único loop por item. |
| 2.2 | Aplicar o mesmo padrão ao footer (tagline por locale). | `BaseLayout.astro` ou `LocaleAwareFooter.astro` | Footer com um único bloco iterado por locale. |

**Entregável Fase 2:** PR “refactor: DRY nav and footer locale blocks in BaseLayout”.

---

### Fase 3 — Scripts inline → ficheiros (BaseLayout)

| # | Tarefa | Ficheiros | Critério de conclusão |
|---|--------|-----------|------------------------|
| 3.1 | Extrair lógica do drawer (open/close, listeners) para `public/scripts/drawer.js`; incluir no layout com `<script src={...}></script>`. | `public/scripts/drawer.js`, `BaseLayout.astro` | Sem bloco inline do drawer; script testável. |
| 3.2 | Extrair lógica do locale select (storage, URL, sync do select com data-locale) para `public/scripts/locale-select.js`; usar `data-supported-locales` ou constante partilhada. | `public/scripts/locale-select.js`, `BaseLayout.astro` | Sem bloco inline do locale; valid locales vêm de um único sítio. |

**Entregável Fase 3:** PR “refactor: extract BaseLayout drawer and locale-select to scripts”.

---

### Fase 4 — Página de chant ([slug].astro)

| # | Tarefa | Ficheiros | Critério de conclusão |
|---|--------|-----------|------------------------|
| 4.1 | Criar `src/utils/chant-page.ts` com: `getFullBaseFromAstroUrl(url)`, `getAudioUrl(chant, fullBase)`, `getSyncLines(chant)`, `getLinesWithMeta(chant)`. | `src/utils/chant-page.ts`, `src/pages/chants/[slug].astro` | [slug].astro frontmatter < ~25 linhas; lógica em funções com nomes claros. |
| 4.2 | (Opcional) Extrair secção “About” e “Bandcamp” para componentes `ChantAbout.astro`, `ChantBandcampBlock.astro` se o ficheiro continuar muito longo. | `src/components/ChantAbout.astro`, etc., `[slug].astro` | Página lê como top-down; detalhes em componentes. |

**Entregável Fase 4:** PR “refactor: chant page utils and optional component split”.

---

### Fase 5 — API (opcional)

| # | Tarefa | Ficheiros | Critério de conclusão |
|---|--------|-----------|------------------------|
| 5.1 | Extrair parse + validação do body de submit para `parseAndValidateSubmitBody(req)` que devolve `{ body, audioBase64, audioFilename }` ou erro. | `api/contribute/submit.ts` | Handler ainda mais curto; responsabilidade única. |
| 5.2 | (Opcional) Testes unitários para `formatChantContentAsMarkdown`, `buildContributionPRBody`, `buildSubmitErrorHint`. | `api/contribute/__tests__/submit.test.ts` ou similar | Cobertura para refactors futuros. |

**Entregável Fase 5:** PR “refactor(api): submit body parsing and optional unit tests”.

---

### Fase 6 — Consistência i18n e contribuição

| # | Tarefa | Ficheiros | Critério de conclusão |
|---|--------|-----------|------------------------|
| 6.1 | Em submit.ts, PR body e formatChantContentAsMarkdown: incluir ES/IT onde existir (description, about, verses) para alinhar com as 4 línguas do site. | `api/contribute/submit.ts`, `api/lib/chant-schema.ts` (se necessário) | PR de contribuição mostra EN/PT/ES/IT quando existirem. |
| 6.2 | Revisar contribute/form e contribute/guide: usar `t = ui[locale]` onde só um locale é mostrado; manter blocos por locale apenas onde for necessário (ex.: formulário com labels em 4 idiomas). | `src/pages/contribute/form.astro`, `guide.astro` | Menos duplicação; nomes consistentes. |

**Entregável Fase 6:** PR “refactor: i18n consistency in contribute API and pages”.

---

## 5. Ordem de execução recomendada

1. **Fase 1** — Rápida, baixo risco, desbloqueia consistência de nomes e base URL.
2. **Fase 2** — Reduz duplicação no layout; impacto visível em manutenção.
3. **Fase 3** — Melhora legibilidade e testabilidade dos scripts do layout.
4. **Fase 4** — Simplifica a página mais complexa (chant detail).
5. **Fase 5** — Opcional; fazer se a equipa quiser mais testes e handler mais enxuto.
6. **Fase 6** — Alinha contribuição e formulários com as 4 línguas e reduz ruído.

---

## 6. Checklist Clean Code + Design Patterns (pós-refactor alvo)

- [ ] **Nomes:** Todos os nomes intenção-reveladores e pesquisáveis; `SUPPORTED_LOCALES` e `getFullBase` únicos.
- [ ] **Funções:** Handlers e frontmatter longos reduzidos a orquestração; detalhes em funções < ~20 linhas.
- [ ] **Comentários:** Apenas “porquê” ou contrato; sem comentários redundantes.
- [ ] **DRY:** Nav, footer, BASE e locale blocks sem repetição desnecessária.
- [ ] **SRP:** Componentes e funções com uma responsabilidade clara.
- [ ] **Formatting:** Newspaper; variáveis perto do uso.
- [ ] **Error handling:** API com códigos e mensagens consistentes; sem null em excesso em caminhos críticos.
- [ ] **Testes:** E2E cobrem fluxos principais; opcionalmente unit tests para funções críticas da API e i18n.
- [ ] **Design Patterns (GoF):** Locales e base URL com single source (Singleton/Facade); nav/footer com Template Method (um loop por locale); dados da página chant via Factory Method; API submit com Template Method + Strategy de parse; scripts de layout extraídos (Observer/Strategy no cliente). Sem introduzir padrões desnecessários (Abstract Factory, Chain of Responsibility, Iterator explícito).

---

## 7. Manutenção

- Atualizar `docs/CLEAN-CODE-REVIEW.md` quando concluir cada fase (secção “Refactor implementado”).
- Este plano (`CLEAN-CODE-REFACTOR-PLAN.md`) deve ser ajustado quando novas áreas forem adicionadas (ex.: nova secção do site, nova API) ou quando se introduzir ou revisar uso de padrões GoF (secção 3).
