# Auditoria: conteúdo nas 4 línguas (EN, PT, ES, IT)

Este documento atesta que todo o conteúdo user-facing está disponível em **en**, **pt**, **es** e **it**.

## 1. Cânticos (`src/content/chants/*.json`)

| Ficheiro | description | about | verses[].lines[].translations | explanation (se existir) |
|----------|-------------|-------|------------------------------|---------------------------|
| ganapati-mantra.json | ✅ 4 | ✅ 4 | ✅ 4 | — |
| gayatri.json | ✅ 4 | ✅ 4 | ✅ 4 | ✅ 4 |
| hanuman-chalisa.json | ✅ 4 | ✅ 4 | ✅ 4 (corrigido ES/IT) | ✅ 4 (4 blocos) |
| karpura-gauram.json | ✅ 4 | ✅ 4 | ✅ 4 | — |
| om-nama-shivaya.json | ✅ 4 | ✅ 4 | ✅ 4 | — |
| shanti-mantra.json | ✅ 4 | ✅ 4 | ✅ 4 | — |
| shivopasana-mantra.json | ✅ 4 | ✅ 4 | ✅ 4 | — |
| twameva-mata.json | ✅ 4 | ✅ 4 | ✅ 4 | — |

## 2. UI (`src/i18n/strings.ts`)

- **en**: conjunto completo de chaves (nav, home, chants, chant, traditions, knowledge, contribute, form, lang, settings).
- **pt**: mesma estrutura.
- **es**: mesma estrutura; correção aplicada em `settings.languagePt` → "Portugués".
- **it**: mesma estrutura.

## 3. Páginas

- **BaseLayout.astro**: selector de idioma com opções EN, PT, ES, IT (com ícones 🇬🇧 🇵🇹 🇪🇸 🇮🇹); links e labels por locale.
- **index.astro**: títulos e descrições em 4 idiomas.
- **chants/index.astro**, **chants/[slug].astro**: uso de `ui[locale]` e blocos locale-en/pt/es/it onde aplicável.
- **traditions/index.astro**: título, descrição e "no traditions" em 4 idiomas.
- **knowledge/index.astro** e subpáginas (nada-yoga, vibration-mind, elements-and-sound, sound-attributes, balance-and-healing, references, sound-and-humanity): secções e parágrafos com `locale-en`, `locale-pt`, `locale-es`, `locale-it`.
- **contribute/index.astro**, **contribute/guide.astro**, **contribute/form.astro**: textos da UI via `ui[locale]` (strings em 4 idiomas).
- **settings/index.astro**: labels e opções via `ui[locale].settings` (4 idiomas).

## 4. Componentes

- **ChantVerse.astro**: fallback de tradução apenas para EN; exibe `translations[locale]` (en/pt/es/it) quando existir.
- **ChantHeader.astro**, **KnowledgePageHeader.astro**: títulos por locale quando aplicável.

## 5. Script de correção

- **scripts/fix-hanuman-es-it.mjs**: aplica traduções ES/IT aos versos do Hanuman Chalisa (substitui placeholders em inglês). Já executado; ficheiro mantido para referência e re-aplicação se necessário.

---

**Data da auditoria**: 2025-03-12  
**Conclusão**: Todo o conteúdo está traduzido nas quatro línguas (EN, PT, ES, IT). Aviso de fallback em `[slug].astro` é exibido apenas quando `hasEs`/`hasIt` são false (conteúdo do cântico sem ES/IT); com os JSONs actuais isso não ocorre.
