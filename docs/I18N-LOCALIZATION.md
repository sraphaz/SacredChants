# Localização (i18n) — Sacred Chants

Este documento descreve a implementação completa da localização do site em **en** (inglês), **pt** (português), **es** (espanhol), **it** (italiano), **hi** (hindi) e **ar** (árabe, RTL).

---

## Resumo

| Componente | Locales suportados | Observações |
|------------|--------------------|-------------|
| UI (navegação, labels, botões) | en, pt, es, it, hi, ar | `src/i18n/strings.ts` + `src/i18n/ui-hi.ts` + `src/i18n/ui-ar.ts` |
| Contrato URL ↔ locale canónico | en, pt, es, it, hi, ar + alias `pt-br` → `pt` | `src/i18n/locale-url-contract.json` (fonte única); `LANG_PARAM_TO_LOCALE` e `SUPPORTED_LOCALES` derivam daqui |
| Script público (init) | Mesmo contrato, zero drift no build | `npm run build` gera `public/scripts/sc-locale-url-data.js` via `scripts/generate-locale-url-data.mjs`; em dev, correr esse script após alterar o JSON |
| Cânticos: description, about, verses | en, pt, es, it, hi, ar (opcional onde indicado) | Schema em `src/content/schemas/chant.ts` |
| URL | `?lang=en`, `?lang=pt`, `?lang=es`, `?lang=it`, `?lang=hi`, `?lang=ar` | `pt-br` tratado como `pt` |

---

## Schema dos cânticos

O schema Zod em `src/content/schemas/chant.ts` define os locales opcionais para:

- **`description`**: `en` (obrigatório), `pt` (obrigatório), `es`, `it`, `hi`, `ar` — texto curto no cabeçalho
- **`about`**: `en`, `pt`, `es`, `it`, `hi`, `ar` — texto longo "Sobre este cântico"
- **`verses[].lines[].translations`**: `en`, `pt`, `es`, `it`, `hi`, `ar` — tradução de cada linha
- **`verses[].explanation`**: `en`, `pt`, `es`, `it`, `hi`, `ar` — explicação opcional do verso

Fallback: se um locale estiver em falta, usa-se `en` ou `pt` por ordem. A UI mostra o aviso *"Verse translations in this language are not yet available; showing English."* (ou equivalente na língua da UI) quando o texto visível é fallback para inglês.

---

## Cânticos localizados

Todos os cânticos têm **en** e **pt** completos. **es**, **it**, **hi** e **ar** são opcionais; quando um destes falta nos versos, aplica-se o fallback acima.

| Cântico | description | about | Versos (translations) | explanation |
|---------|-------------|-------|------------------------|-------------|
| shanti-mantra | ✓ | ✓ | ✓ (1 linha) | — |
| ganapati-mantra | ✓ | ✓ | ✓ (1 verso) | — |
| om-nama-shivaya | ✓ | ✓ | ✓ (1 verso) | — |
| karpura-gauram | ✓ | ✓ | ✓ (2 linhas) | — |
| twameva-mata | ✓ | ✓ | ✓ (4 linhas) | — |
| gayatri | ✓ | ✓ | ✓ (4 linhas) | ✓ |
| shivopasana-mantra | ✓ | ✓ | ✓ (12 versos) | — |
| hanuman-chalisa | ✓ | ✓ | ✓ (86 blocos) | — |

> **Nota sobre Hanuman Chalisa:** Alguns blocos em `es`/`it`/`hi`/`ar` podem usar ainda o texto em inglês como placeholder. A UI continua a funcionar com fallback; futuras contribuições podem completar as traduções.

---

## Componentes principais

### ChantVerse.astro

- Usa `VERSE_LOCALES` derivado de `SUPPORTED_LOCALES` em `strings.ts` (mesma ordem / mesmos locales)
- Para cada locale, renderiza `<p class="locale-{loc}">` com a tradução (ou fallback)
- O utilizador vê apenas o bloco correspondente ao `data-locale` do `<html>` (via CSS)

### Locale selector

- ID `#sc-locale-select` (desktop) e `#sc-locale-select-drawer` (drawer mobile)
- As `<option>` são geradas a partir de `SUPPORTED_LOCALES` e `LOCALE_SELECT_SHORT_LABEL` no `BaseLayout` (sem duplicar lista em HTML)
- Ao alterar, atualiza `?lang=` na URL e o `data-locale` no `<html>`

---

## Como adicionar um novo locale

1. **`src/i18n/locale-url-contract.json`**: incluir o código em `supportedCanonical` (e aliases em `urlAliases` se necessário); correr `node scripts/generate-locale-url-data.mjs` (ou `npm run build`)
2. **`src/i18n/strings.ts`**: adicionar chave ao tipo `Locale`, entrada em `LOCALE_SELECT_SHORT_LABEL`, e ao objeto `ui` (ou ficheiros dedicados como `ui-hi.ts` / `ui-ar.ts`) — `SUPPORTED_LOCALES` passa a derivar do JSON
3. **`src/content/schemas/chant.ts`**: adicionar `xx` opcional em `description`, `about`, `translations`, `explanation`
4. **`ChantVerse.astro`**: `VERSE_LOCALES` segue `SUPPORTED_LOCALES`; mapear labels se necessário
5. **Layout/navegação**: `BaseLayout` gera opções a partir de `SUPPORTED_LOCALES`; garantir `init-theme-locale` + dados gerados alinhados
6. **CSS**: regra `[data-locale="xx"] .locale-xx { display: … }` em `global.css`; para RTL (ex.: `ar`), `dir="rtl"` no `<html>` e estilos em `global.css` conforme o locale
7. **Cânticos JSON**: preencher `description.xx`, `about.xx`, `translations.xx` em cada chant (opcional)
8. **E2E**: adicionar teste em `e2e/locale.spec.ts` para `?lang=xx`
9. **Testes unitários**: `tests/unit/locale.test.ts` e `chant-content-schema.test.ts`

---

## Testes E2E

O arranque padrão (`playwright test`) executa `node scripts/start-preview-e2e.js`, que corre `npm run build` e depois `astro preview` em **`http://127.0.0.1:4174/`** por defeito (variável **`E2E_PREVIEW_PORT`**; assim evita colisão com `astro dev` na porta 4321). O `baseURL` do Playwright usa a mesma porta. Se o build falhar com *«The build was canceled»* (por exemplo, por compilações em paralelo), gera primeiro o site com `npm run build` e defina **`E2E_SKIP_BUILD=1`** no ambiente antes de correr os testes — o script reutiliza `dist/` e só inicia o preview.

- `e2e/locale.spec.ts` — verifica:
  - locale por defeito (en) sem `?lang=`
  - `?lang=es`, `?lang=pt`, `?lang=it`, `?lang=hi`, `?lang=ar` definem `data-locale` e combo
  - Página de chant com `?lang=es` ou `?lang=it` mostra bloco `.locale-es` ou `.locale-it`
  - `/knowledge/?lang=hi` mostra `.locale-hi` e valor `hi` no seletor
  - `/knowledge/?lang=ar` (ou equivalente) valida `.locale-ar` e `dir="rtl"` quando aplicável
  - `/chants/gayatri/?lang=hi` mantém `hi` e mostra blocos `.locale-hi` (incluindo descrição em hindi quando `description.hi` existe no JSON)
  - Hanuman Chalisa: troca ES → PT → EN e confirma texto no primeiro verso em cada idioma

---

## Referências

- Contrato URL / locales: `src/i18n/locale-url-contract.json`, `scripts/generate-locale-url-data.mjs`, `public/scripts/sc-locale-url-data.js` (gerado)
- Init cliente: `public/scripts/init-theme-locale.js` (lê `window.__SC_LOCALE_URL__` com fallback se o ficheiro gerado falhar)
- Strings UI: `src/i18n/strings.ts`, `src/i18n/ui-hi.ts`, `src/i18n/ui-ar.ts`
- Schema: `src/content/schemas/chant.ts`
- Componente de versos: `src/components/ChantVerse.astro`
- Cânticos: `src/content/chants/*.json`
- Testes: `e2e/locale.spec.ts`, `tests/unit/locale.test.ts`, `tests/unit/chant-content-schema.test.ts`
