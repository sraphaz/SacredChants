## Summary

Adiciona localização em **hindi (`hi`)** (UI, conteúdo opcional nos chants, documentação), **contrato único de URL/locale** (`locale-url-contract.json`) com geração de `public/scripts/sc-locale-url-data.js` para scripts cliente, refatoração de **tema/locale** (`init-theme-locale.js`, `BaseLayout`), script **`npm run verify`** (testes + build), alinhamento do **Playwright** à porta dedicada de preview E2E (`E2E_PREVIEW_PORT`, padrão **4174**) e extensão de **testes unitários e E2E** de locale.

## Description

### O que mudou

- **i18n / UI:** `src/i18n/ui-hi.ts`, extensões em `src/i18n/strings.ts`, `tsconfig.json` (`resolveJsonModule`), contrato `src/i18n/locale-url-contract.json`, gerador `scripts/generate-locale-url-data.mjs` e artefato `public/scripts/sc-locale-url-data.js` (também gerado no `build`).
- **Chants:** schema `src/content/schemas/chant.ts` com campos opcionais para hindi; JSONs em `src/content/chants/*.json` atualizados; utilitários `src/utils/chant-page.ts`, `scripts/generate-chant.js`, script auxiliar `scripts/add-chant-hi-descriptions.mjs`.
- **Páginas e componentes:** `BaseLayout.astro`, páginas de chants, knowledge, settings, contribute, index, traditions; componentes `ChantCard`, `ChantHeader`, `ChantPlayerBar`, `ChantVerse`, `OfflineSaveButton`; estilos em `global.css`.
- **Cliente:** `public/scripts/init-theme-locale.js`, `locale-select.js`.
- **Qualidade:** `package.json` (`verify`, `dev` com geração de locale data), `playwright.config.ts`, `scripts/start-preview-e2e.js`, `e2e/locale.spec.ts`, `tests/unit/locale.test.ts`, `tests/unit/chant-content-schema.test.ts`.
- **Documentação:** `docs/I18N-LOCALIZATION.md`, `docs/I18N-HINDI-PLAN.md`, `docs/I18N-LOCALE-CLEAN-CODE-PLAN.md`.

### Porquê

- Oferecer experiência consistente em **hindi** sem duplicar regras de locale entre servidor e cliente.
- Evitar conflitos quando **4321** está ocupado (dev): preview E2E usa porta configurável e documentada.
- **`npm run verify`** espelha o núcleo do job **build** do CI (testes + build) para validação local rápida.

### Contexto

- Conteúdo hindi nos chants é **opcional** no schema; fallback mantém comportamento em `en`/`pt`/`es`/`it`.
- O CI em `.github/workflows/ci.yml` corre **`npm run test:unit`**, **`npm run build`**, **`npx astro check`** (lint, `continue-on-error`) e **E2E em Docker** (`Dockerfile.e2e`). Este PR não altera o workflow; descreve o alinhamento esperado.

## Type of change

- [ ] New chant (content only)
- [ ] Bug fix
- [x] New feature
- [x] Documentation
- [x] Refactor / code quality

## For new chants only

N/A (não é PR só de chant novo; vários JSONs foram enriquecidos com campos opcionais `hi`).

## How to verify

**CI (GitHub Actions — este PR):**

- Job **build:** `npm ci` → `npm run test:unit` → `npm run build`
- Job **lint:** `npm ci` → `npx astro check` (não bloqueante)
- Job **e2e:** `docker build -f Dockerfile.e2e` → `docker run` (toda a pasta `e2e/*.spec.ts`)

**Local (recomendado antes do merge):**

- [x] `npm run verify` (equivale a testes unitários + `npm run build`)
- [ ] E2E em Docker: `npm run test:e2e:docker`
- [ ] E2E no host: `npx playwright install chromium` (e mobile se usar o projeto mobile), depois `npm run test:e2e` com preview na porta definida por `E2E_PREVIEW_PORT`

**Manual:** `npm run dev` → alternar locale no seletor; abrir `/chants/...`, `/settings`, `/knowledge`, `/contribute` e confirmar textos em hindi quando `hi` está ativo.

## Checklist

- [x] Para alterações de chant: JSON em `src/content/chants/` alinhado com `src/content/schemas/chant.ts`
- [x] Build local: `npm run build` (incluído em `npm run verify`)
- [x] Sem alterações não relacionadas propositadas
- [x] Descrição preenchida (summary, o que mudou, porquê, como verificar)

## Optional

- [ ] Screenshot ou link de preview (Vercel) após deploy de branch de preview, se existir
