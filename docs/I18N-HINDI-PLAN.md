# Plano: localização Hindi (`hi`) — Sacred Chants

Este documento é o plano de implementação para acrescentar **hindi (`hi`)** como quinto locale da UI e do conteúdo, **no mesmo padrão** de `en`, `pt`, `es` e `it`. A branch de trabalho sugerida é `feat/locale-hindi`.

**Referência existente:** [docs/I18N-LOCALIZATION.md](./I18N-LOCALIZATION.md) (fluxo atual de quatro línguas).

---

## 1. Objetivo

- Suportar **`?lang=hi`**, seletor de idioma com opção **HI**, `data-locale="hi"` e `document.documentElement.lang = 'hi'`.
- Traduzir **toda a UI** (`strings.ts`) para hindi de qualidade (revisão humana recomendada).
- Estender o **schema de cânticos** e o componente de versos para **`hi` opcional**, com regras editoriais para **não duplicar** texto já presente em devanágari no campo `original`.
- Traduzir **todo o conteúdo estático** do site (home, traditions, knowledge, contribute, settings, meta/descrições) para hindi, usando o mesmo mecanismo de blocos `.locale-*` já usado nas outras línguas.

---

## 2. Princípios (alinhados ao projeto atual)

| Área | Padrão a manter |
|------|------------------|
| Fonte de verdade de locales | `Locale`, `SUPPORTED_LOCALES`, `getLocaleFromUrl`, `langQuery` em `src/i18n/strings.ts` |
| URL | `?lang=hi` (minúsculas, como `es` / `it`) |
| Persistência | `localStorage` chave `sacred-chants-lang` + `init-theme-locale.js` lista de locales permitidos |
| Seletor | `data-supported-locales` JSON = `SUPPORTED_LOCALES`; `locale-select.js` já itera isso |
| CSS | Uma regra `html[data-locale="hi"] .locale-hi { display: block; }` (e análogas) em `global.css`, mais pseudo-elementos para legendas de tradução em versos se existirem para `it`/`es` |
| Cânticos | Zod em `chant.ts`; render em `ChantVerse.astro` com fallback `en` (e cadeia já usada) |
| Testes | `tests/unit/chant-content-schema.test.ts` + `e2e/locale.spec.ts` |

**Hindi é LTR:** não é necessário `dir="rtl"`; devanágari em `original` continua com `dir="auto"` onde já está.

---

## 3. Cânticos: evitar tradução duplicada quando o original já é Hindi / Sânscrito

Muitos versos têm `original` em **devanágari** (sânscrito ou hindi religioso). O campo `translations` oferece **glossas** em línguas modernas (en, pt, es, it).

**Regra editorial para `translations.hi`:**

1. **Omitir `hi`** quando a linha não tiver glossa útil em hindi além do próprio `original` (ou seja, não copiar o devanágari para `translations.hi` só para preencher o schema).
2. **Preencher `hi`** quando fizer sentido, por exemplo:
   - parafrase ou explicação em hindi moderno (khari boli) diferente do texto ritual;
   - linhas cuja `original` não esteja em devanágari e exista tradução natural para hindi.
3. **Fallback na UI:** quando `hi` estiver ausente, manter o comportamento atual de fallback (ex.: mostrar `en`, com mensagem de *translation fallback* já existente para o locale ativo — será preciso estender a cópia em `ui.hi.chant.translationFallback` e a lógica em `[slug].astro` se hoje estiver hardcoded a `es`/`it`).

**Metadados do cântico (`description.hi`, `about.hi`):** devem existir em hindi para cada cântico quando a UI estiver em `hi`, mesmo que os versos usem fallback; isso mantém cartões e “Sobre este cântico” coerentes.

**Tabela resumo por ficheiro JSON** (`src/content/chants/*.json`): para cada um, adicionar chaves opcionais `hi` em `description`, `about`, `verses[].lines[].translations`, `verses[].explanation` **apenas onde agregar valor**, conforme as regras acima.

---

## 4. Fases de implementação

### Fase A — Infraestrutura (obrigatória primeiro)

1. **`src/i18n/strings.ts`**
   - `export type Locale = 'en' | 'pt' | 'es' | 'it' | 'hi'`
   - `SUPPORTED_LOCALES` incluir `'hi'`
   - `LOCALE_PARAM_VALUES` incluir `'hi'`
   - `getLocaleFromUrl`: `lang === 'hi' → 'hi'`
   - `langQuery`: inalterado exceto que `hi` → `?lang=hi`
   - Objeto **`ui.hi`**: espelhar a estrutura completa de `ui.en` (todas as chaves aninhadas), com strings em hindi.

2. **`public/scripts/init-theme-locale.js`**
   - `allowedLocales`: incluir `'hi'`
   - Ramo `savedLang` / `normalizedUrlLang` para `'hi'` (espelhar `es` / `it`)

3. **`src/layouts/BaseLayout.astro`**
   - Importar `tHi = ui.hi`
   - `initialLocale`: incluir `hi` na condição (hoje só lista pt/es/it vs en)
   - `navItems`: cada `labelByLocale` com chave `hi`
   - Links do header “Sacred Chants” para `?lang=hi` (padrão dos outros)
   - `<option value="hi">HI</option>` nos dois `<select>`
   - `FooterTaglines`: `hi: tHi.home.tagline`
   - `html lang={initialLocale}` já funciona com `hi`

4. **`src/styles/global.css`**
   - Comentário do bloco de locales: EN / PT / ES / IT / **HI**
   - Regras `html[data-locale="hi"] …` para `.locale-hi` (e ocultar outras)
   - Se existir `.prose-chant .translations [data-lang="it"]::before`, adicionar equivalente `[data-lang="hi"]::before` com label em hindi (“अनुवाद” ou o termo escolhido na UI)

5. **`src/content/schemas/chant.ts`**
   - Em `translations` (linha), `explanation`, `description`, `about`: adicionar `hi: z.string().optional()` onde `es`/`it` já existem

6. **`src/components/ChantVerse.astro`**
   - `VERSE_LOCALES`: `['en', 'pt', 'es', 'it', 'hi']`
   - `verseLabelByLocale` + imports `tHi`
   - Loops de traduções e explanations incluem `hi`

7. **`src/components/ChantCard.astro`**
   - `AUDIO_ICON_TITLE_BY_LOCALE.hi`
   - `getDescriptionByLocale` / lista de locales derivada de `SUPPORTED_LOCALES` (se já usar spread, confirmar após tipo `Locale`)

8. **Páginas com `labelByLocale` / `titleByLocale` hardcoded** (grep `it: tIt`):
   - `src/pages/index.astro` — CTAs e links `?lang=hi`
   - `src/pages/knowledge/*.astro` — `titleByLocale` e `backLabelByLocale` com `hi`
   - `src/pages/contribute/dashboard.astro` — hoje parcialmente `pt`/`en`; alinhar a `getLocaleFromUrl` + `hi` nas query strings e links de auth
   - Qualquer outro ficheiro listado no grep de `tIt.` / `Record<Locale`

9. **`src/pages/chants/[slug].astro`**
   - Garantir mensagens de fallback de tradução e meta `description` consideram `hi`

10. **Formulário de contribuição** (`src/pages/contribute/form.astro` + scripts inline)
    - Se o preview de versos listar `translation_en`, etc., planear campos ou nota para `translation_hi` opcional (pode ser fase posterior para não bloquear o site)

11. **Documentação**
    - Atualizar `docs/I18N-LOCALIZATION.md` (tabela e passos “novo locale” com `hi`)
    - Manter este plano como histórico ou fundi-lo após conclusão

12. **Testes**
    - `tests/unit/chant-content-schema.test.ts`: caso com `translations.hi` / `description.hi`
    - `e2e/locale.spec.ts`: `?lang=hi` → `data-locale=hi`, combo HI, e um chant com `.locale-hi` visível (ou fallback documentado)

### Fase B — Conteúdo UI e páginas longas (trabalho de tradução)

- Completar **100%** de `ui.hi` em `strings.ts` (paridade estrita de chaves com `ui.en`).
- **Home** (`index.astro`): todos os blocos `.locale-hi` com copy em hindi.
- **Traditions** (`traditions/index.astro`).
- **Knowledge**: `index.astro` + cada artigo em `knowledge/*.astro` (grandes blocos de prosa — maior esforço).
- **Contribute**: `index`, `guide`, `form`, `dashboard` — strings via `ui` + textos estáticos em `.locale-hi`.
- **Settings** (`settings/index.astro`).
- Revisar **descrições default** em `BaseLayout` / meta se houver variante por idioma.

### Fase C — Dados dos cânticos (`src/content/chants/*.json`)

- Por cada `slug`: `description.hi`, `about.hi` quando aplicável.
- Versos: `translations.hi` e `explanation.hi` segundo a secção 3 (sem duplicar devanágari inútil).

### Fase D — Polimento

- **Fontes:** confirmar que a stack atual (serif/sans) renderiza devanágari + hindi legível; ajustar `global.css` se necessário.
- **Manifest / SEO:** `short_name` e descrições se existirem por locale (baixa prioridade).
- **Scripts utilitários** (`scripts/generate-chant.js`, etc.): mensagens para contribuidores mencionando `hi` opcional.

---

## 5. Inventário rápido de ficheiros a tocar (grep recomendado)

Após Fase A, correr no repositório:

- `SUPPORTED_LOCALES`, `Locale`, `VERSE_LOCALES`
- `locale-it`, `locale-es`, `lang=it`, `lang=es`
- `tIt`, `tEs`, `labelByLocale`, `titleByLocale`, `Record<Locale`
- `allowedLocales` em `init-theme-locale.js`

Garantir que **nenhum** switch manual fica só `pt` / `en` (ex.: dashboard).

---

## 6. Estimativa de esforço

| Fase | Esforço relativo |
|------|------------------|
| A — Infra + schema + componentes | Médio (1–2 dias dev) |
| B — UI + todas as páginas estáticas em hindi | Alto (tradução + revisão) |
| C — JSON dos cânticos | Médio a alto (conteúdo + regras anti-duplicação) |
| D — Polimento | Baixo |

---

## 7. Ordem sugerida no Git

1. Commit 1: Fase A (código + `ui.hi` mínimo copiado de `en` como placeholder **temporário** — evitar ship em produção até B parcial mínima).
2. Ou: Commit 1 só mecânica + `ui.hi` já com tradução profissional das strings críticas (nav, chant, erros).
3. Commits seguintes: conteúdo por área (home → knowledge → contribute → chants).

---

## 8. Critérios de aceitação

- [x] `?lang=hi` funciona em todas as rotas principais sem 404 nem JS quebrado.
- [x] Seletor guarda `hi` no `localStorage` e reaplica ao voltar ao site.
- [x] Build + testes unitários (`npm test`) passam; e2e em `e2e/locale.spec.ts` (com `E2E_SKIP_BUILD=1` após build local se o preview falhar a compilar em paralelo — ver `docs/I18N-LOCALIZATION.md`).
- [x] Regra editorial: não preencher `translations.hi` só para copiar o `original` em devanágari; metadados `description.hi` / `about.hi` adicionados a todos os cânticos (script idempotente `scripts/add-chant-hi-descriptions.mjs`).
- [x] Documentação `I18N-LOCALIZATION.md` atualizada.

---

*Plano criado para a branch `feat/locale-hindi`; implementação pode seguir por PRs parciais (A primeiro, depois B/C).*
