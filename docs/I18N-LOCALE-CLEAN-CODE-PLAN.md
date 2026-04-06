# Revisão de locale (Clean Code / Uncle Bob) — plano de implementação

**Contexto:** Pedido de revisão de i18n/locale alinhada a princípios de *Clean Code* (Robert C. Martin). O skill `uncle-bob-craft` do ecossistema *antigravity-awesome-skills* não está presente neste ambiente; esta revisão replica o enfoque já descrito em `docs/CLEAN-CODE-REVIEW.md` (nomes, DRY, SRP, funções pequenas, uma fonte de verdade).

**Objetivo:** Reduzir duplicação e rigidez em torno de locales, clarificar contratos URL ↔ storage ↔ DOM, e manter testes como rede de segurança.

---

## 1. Estado atual (pontos fortes)

| Princípio | Onde se vê |
|-----------|------------|
| Nomes revelam intenção | `getLocaleFromUrl`, `langQuery`, `SUPPORTED_LOCALES`, `Locale` |
| Fonte de verdade única (UI) | `SUPPORTED_LOCALES` em `src/i18n/strings.ts`; uso em BaseLayout, index, ChantCard, ChantVerse, ChantPlayerBar, settings (via JSON injetado), KnowledgePageHeader, LocaleNavLinks, FooterTaglines |
| Separação conteúdo vs UI | Schema Zod dos cânticos vs `ui` / `ui-hi` |
| Init extraído | `public/scripts/init-theme-locale.js` (tema + locale) |

---

## 2. Cheiros e dívidas (revisão)

### 2.1 Duplicação — seletores de idioma no `BaseLayout`

**Problema:** Dois `<select>` repetem cinco `<option>` com `value` e rótulos `EN/PT/...` hardcoded, embora exista `data-supported-locales` e `SUPPORTED_LOCALES` no servidor.

**Princípios:** DRY, rigidez (novo locale = muitos sítios).

**Direção:** Gerar `<option>` com `SUPPORTED_LOCALES.map`, usando rótulo curto derivado de `ui[loc].lang` (primeiras letras ou mapa `LOCALE_SELECT_LABEL: Record<Locale, string>` se quiseres `EN` fixo independentemente do nome nativo).

**Critério de aceite:** Adicionar um locale fictício no type + array gera opções sem editar HTML duplicado.

---

### 2.2 Duplicação e complexidade — `init-theme-locale.js`

**Problema:** `allowedLocales = ['en', 'pt', 'pt-br', ...]` não está ligado a `SUPPORTED_LOCALES`. A resolução de `locale` usa uma cadeia longa de ternários (difícil de ler e de testar).

**Princípios:** DRY (alinhamento com `strings.ts`), *stepdown*, funções pequenas.

**Direção:**

1. Documentar contrato: “valores aceites na URL” = `SUPPORTED_LOCALES` ∪ `{ pt-br }` (ou exportar `URL_LANG_ALIASES` / `normalizeLangParam` em TS e **gerar** um snippet ou constante para o script público no build — opcional e mais pesado).
2. Mínimo viável: extrair em `init-theme-locale.js` funções nomeadas, por exemplo `normalizeUrlLangParam(raw)`, `resolveCanonicalLocale(urlLang, savedLang)` com tabela ou `switch`, e comentário de uma linha a explicar **porquê** `pt-br` → `pt`.

**Critério de aceite:** Comportamento idêntico aos testes manuais atuais; preferencialmente teste unitário do módulo se o script for importável ou se a lógica for movida para `src` e empacotada.

---

### 2.3 Cadeias de ternários — `[slug].astro` e `contribute/index.astro`

**Problema:** Scripts inline escolhem labels/strings por `locale` com vários níveis de `?:`.

**Princípios:** Aberto/fechado (melhor dados + lookup), legibilidade.

**Direção:** Preferir `const LABELS = { en: ..., pt: ..., ... }` gerado no frontmatter a partir de `ui[locale].chant.*` ou `data-*` únicos por locale já no HTML; no cliente, `labels[locale] ?? labels.en`.

**Critério de aceite:** Novo locale não exige novo ramo de ternário no script.

---

### 2.4 `getLocaleFromUrl` — estilo e alinhamento com parâmetros

**Problema:** Sequência de `if` espelha `LOCALE_PARAM_VALUES`; fácil divergir se alguém alterar só um sítio.

**Direção (opcional):** Mapa explícito `const LANG_PARAM_TO_LOCALE: Record<string, Locale> = { pt: 'pt', 'pt-br': 'pt', ... }` com fallback `'en'`, ou função `normalizeLangParam(s: string): Locale | null`.

**Critério de aceite:** Um único sítio lista aliases; testes em `tests/unit/locale.test.ts` cobrem `pt-br` e desconhecido → `en`.

---

### 2.5 Comentário em `langQuery`

**Problema:** JSDoc menciona “keeps pt-br” mas a implementação só emite `?lang=` com chaves canónicas (`pt`, não `pt-br`).

**Direção:** Ajustar comentário para refletir o comportamento real (canonical keys na query) ou implementar preservação de `pt-br` se for requisito de produto (improvável).

---

### 2.6 Documentação `docs/I18N-LOCALIZATION.md`

**Problema:** Secção ChantVerse ainda pode referir lista literal antiga; o código usa `[...SUPPORTED_LOCALES]`.

**Direção:** Uma linha: “`VERSE_LOCALES` deriva de `SUPPORTED_LOCALES`”.

---

### 2.7 Formulário de contribuição (âmbito separado)

**Nota:** O fluxo “conteúdo do cântico” continua centrado em **en/pt** no schema e na UI do form (regra de negócio). Não confundir com locales da **interface**. Qualquer expansão (descrições es/it/hi no form) é fase distinta e toca em Zod + copy + validação JS.

---

## 3. Plano de implementação (fases)

Ordem sugerida: do menor risco ao maior; cada fase deve terminar com `npm run build` e `npm test`.

| Fase | Entrega | Esforço | Risco |
|------|---------|---------|-------|
| **A** | Corrigir JSDoc de `langQuery`; atualizar `I18N-LOCALIZATION.md` (ChantVerse / seletor se necessário) | Baixo | Nenhum |
| **B** | `BaseLayout`: `<option>` gerados por `SUPPORTED_LOCALES` + rótulos derivados | Baixo | Baixo |
| **C** | Refatorar `init-theme-locale.js`: funções nomeadas + `normalize`/`resolve` sem mudar comportamento | Médio | Médio (init em todas as páginas) |
| **D** | `[slug].astro` e `contribute/index.astro`: substituir ternários por lookup/objeto ou dados no DOM | Médio | Baixo |
| **E** (opcional) | `getLocaleFromUrl` via mapa de aliases; alargar `locale.test.ts` | Baixo | Baixo |
| **F** (opcional) | Build gera constante de locales para o script público (zero drift TS ↔ JS) | Alto | Médio |

**Estado (implementado):** Fases A–F concluídas no código: `locale-url-contract.json` + `LANG_PARAM_TO_LOCALE` / `SUPPORTED_LOCALES`; `BaseLayout` com opções geradas; `init-theme-locale.js` refatorado com funções nomeadas e leitura de `__SC_LOCALE_URL__`; `[slug].astro` (sync) e `contribute/index.astro` (welcome) com lookup em vez de cadeias de ternários; `scripts/generate-locale-url-data.mjs` + `sc-locale-url-data.js` no pipeline `npm run build`; testes em `tests/unit/locale.test.ts` alargados.

### Revisão Uncle Bob (craft) — como este plano mapeia

| Critério | Onde foi aplicado |
|----------|-------------------|
| DRY / rigidez | Lista de locales num único JSON; selects gerados por `SUPPORTED_LOCALES`; mapa `LANG_PARAM_TO_LOCALE` |
| Legibilidade (stepdown, uma abstração por função) | `init-theme-locale.js` com `normalizeUrlLangParam`, `canonicalForStorage`, `localeFromSavedOnly`, etc. |
| Aberto/fechado (novo locale) | Novo código em contrato + `ui` + `LOCALE_SELECT_SHORT_LABEL` + schema/CSS — sem novos ramos `?:` nos scripts de sync |
| Fronteira explícita | Contrato URL (`locale-url-contract`) ↔ TS (`strings.ts`) ↔ runtime (`sc-locale-url-data.js` + fallback) |
| Testes como rede | `locale.test.ts` cobre `getLocaleFromUrl`, `langQuery` e o mapa exportado |

---

## 4. Verificação contínua

- `npm test` (especialmente `tests/unit/locale.test.ts`)
- `npm run build`
- Smoke manual: `?lang=pt-br`, `?lang=hi`, settings + reload, seletor header/drawer

---

## 5. Definição de “feito”

- Nenhuma lista de locales duplicada sem comentário de **porquê** (ex.: `pt-br` só na camada URL).
- Novo locale `Locale` + entrada em `SUPPORTED_LOCALES` + `ui` (e schema de conteúdo se aplicável) como checklist único.
- Scripts inline de locale reduzidos a lookup ou dados declarativos.

---

*Última atualização: plano executado (A–F); documentação em `docs/I18N-LOCALIZATION.md` atualizada para o contrato JSON e o script gerado.*

---

## 6. Verificação pós-implementação

- [x] `npm test` (incl. `tests/unit/locale.test.ts`)
- [x] `npm run build` (incl. `generate-locale-url-data.mjs`)
- [ ] Smoke E2E local: `npx playwright test e2e/locale.spec.ts` (preview E2E em `127.0.0.1:4174` por defeito; `PLAYWRIGHT_BASE_URL` / `E2E_PREVIEW_PORT` para override)
- [ ] Manual: `?lang=pt-br`, `?lang=hi`, seletor header/drawer, página de cântico com sync
