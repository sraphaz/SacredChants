# PR: Layout dos cânticos, locale minimalista e localização ES/IT (Conhecimento + Cânticos)

## Summary

Ajusta o layout dos cards e da página de cântico (título, intérprete e ícone de áudio na mesma linha), substitui o selector de idioma por um combobox minimalista e completa a localização do conteúdo de Conhecimento e dos cânticos para **espanhol (ES)** e **italiano (IT)**.

Inclui ainda as alterações já presentes no branch (rascunhos no dashboard, preservação de PT em contribute, e melhorias de UX relacionadas).

---

## Description

### 1. Layout: título, intérprete e ícone na mesma linha

- **ChantCard.astro**
  - Uma única linha para título do cântico, nome do intérprete e ícone de áudio (flex: título à esquerda, intérprete e ícone à direita).
  - Intérprete deixa de aparecer num bloco separado abaixo do título.
  - Suporte a 4 locales nos links e nas descrições (`descEn`, `descPt`, `descEs`, `descIt` com fallback).

- **ChantHeader.astro**
  - Título da página, intérprete e ícone de áudio na mesma linha (`chant-header__title-row`).
  - Texto "Interpreted by" e descrição em EN, PT, ES, IT.

### 2. Selector de idioma minimalista (combobox)

- **BaseLayout.astro**
  - Links de idioma (EN | PT | ES | IT) substituídos por um `<select class="sc-locale-select">` no header e no drawer.
  - Opções EN, PT, ES, IT; `selected` conforme `initialLocale`.
  - Script: ao mudar o select, redireciona para `pathname + (lang === 'en' ? '' : '?lang=' + lang)`.

- **global.css**
  - Estilos para `.sc-locale-select` (tamanho, padding, borda, cores com variáveis `--sc-*`, hover e focus) harmonizados com o design do site.

### 3. i18n: espanhol e italiano

- **src/i18n/strings.ts**
  - Strings de UI para `es` e `it`: navegação, conhecimento, cânticos, contribute, settings, tradições, etc.
  - Chaves usadas em todo o site (títulos, botões, labels, mensagens) para suportar `?lang=es` e `?lang=it`.

### 4. Conhecimento localizado para ES e IT

Todas as páginas de Conhecimento passam a ter conteúdo em quatro idiomas (EN, PT, ES, IT):

- **knowledge/index.astro** — Títulos e descrições dos artigos em ES/IT.
- **knowledge/nada-yoga.astro** — Secções completas em locale-es e locale-it.
- **knowledge/sound-and-humanity.astro** — Títulos e parágrafos em ES/IT.
- **knowledge/vibration-mind.astro** — h2 e parágrafos em ES/IT.
- **knowledge/elements-and-sound.astro** — h2 e parágrafos em ES/IT.
- **knowledge/sound-attributes.astro** — h2 e parágrafos em ES/IT.
- **knowledge/balance-and-healing.astro** — Três secções com h2 e parágrafos em ES/IT (incl. "Peace and balance", "What healing means here", "Nuance and limits").
- **knowledge/references.astro** — Títulos "Classical texts" / "Online and modern sources", listas e parágrafo final em ES/IT.

Uso de classes `locale-en`, `locale-pt`, `locale-es`, `locale-it` com visibilidade controlada por `data-locale` / script existente.

### 5. Schema e conteúdo dos cânticos (ES/IT)

- **src/content/schemas/chant.ts**
  - `description`: campos opcionais `es` e `it`.
  - `translations` (linhas): `es` e `it` opcionais.
  - `explanation` (versos): `es` e `it` opcionais.
  - `about`: `es` e `it` opcionais.

- **ChantCard / ChantHeader**
  - Leitura de `description.es`, `description.it` (e fallback para en/pt) para descrição no card e no header da página do cântico.

- **Content** (exemplos de uso do schema)
  - Ajustes em `gayatri.json`, `hanuman-chalisa.json`, `karpura-gauram.json`, `twameva-mata.json` conforme schema e necessidades de exibição (ex. descrições, metadados).

### 6. Outras alterações no branch

- **Rascunhos no dashboard** (contribute): lista única com rascunhos (localStorage) e PRs; link "Continuar" com `?draft=id`; formulário carrega rascunho com `?draft=id`.
- **Preservação de PT em contribute**: returnTo e links internos com `?lang=pt` quando a interface está em português.
- **Contribute**: form, index, dashboard — melhorias de UX e suporte a múltiplos idiomas onde aplicável.
- **api/contribute/submit.ts** — Ajustes alinhados com o fluxo de contribuição e payload.
- **Páginas** (index, settings, traditions): uso de i18n e links com `lang` quando relevante.
- **ChantPlayerBar.astro**, **ChantLayout.astro**, **chants/[slug].astro**, **chants/index.astro** — Integração com locale e layout atualizado.

---

## Type of change

- [x] New feature (layout, locale selector, i18n ES/IT)
- [ ] Bug fix
- [ ] New chant (content only)
- [ ] Documentation
- [ ] Refactor / code quality

---

## How to verify

1. **Build**
   - `npm run build` — deve concluir sem erros.

2. **Layout dos cânticos**
   - Lista de cânticos: em cada card, o título, o nome do intérprete e o ícone de música devem estar na mesma linha (título à esquerda, intérprete e ícone à direita).
   - Abrir um cântico: no header da página, título, intérprete e ícone de áudio na mesma linha.

3. **Selector de idioma**
   - No header (e no drawer em mobile), deve aparecer um combobox com EN, PT, ES, IT em vez de quatro links.
   - Ao escolher outro idioma, a página recarrega com `?lang=es` ou `?lang=it` (ou sem query para EN).

4. **Conhecimento em ES/IT**
   - Abrir `/knowledge/?lang=es` e `/knowledge/?lang=it`: títulos e descrições em espanhol e italiano.
   - Abrir cada artigo (nada-yoga, sound-and-humanity, vibration-mind, elements-and-sound, sound-attributes, balance-and-healing, references) com `?lang=es` e `?lang=it`: conteúdo das secções deve aparecer no idioma correto.

5. **Cânticos**
   - Com `?lang=es` ou `?lang=it`, os cards e as páginas de cântico devem usar descrições em ES/IT quando existirem no JSON; caso contrário, fallback para EN/PT.

6. **Contribute (rascunhos e PT)**
   - Guardar rascunho no formulário → "As minhas contribuições" → rascunho no topo com "Continuar".
   - Em `/contribute/?lang=pt`, após login e navegação, os links devem manter `?lang=pt` onde aplicável.

---

## Checklist

- [x] Build passes locally (`npm run build`)
- [x] Layout e locale: componentes e estilos consistentes com o design
- [x] Conhecimento: todas as páginas com blocos locale-es e locale-it
- [x] Schema de cânticos: campos opcionais ES/IT e fallbacks na UI
- [x] Description preenchida (summary, what changed, why, how to verify)

---

## Ficheiros alterados (resumo)

| Área | Ficheiros |
|------|-----------|
| Layout cânticos | `ChantCard.astro`, `ChantHeader.astro`, `ChantPlayerBar.astro`, `ChantLayout.astro`, `chants/[slug].astro`, `chants/index.astro` |
| Locale | `BaseLayout.astro`, `global.css` |
| i18n | `i18n/strings.ts` |
| Conhecimento | `knowledge/index.astro`, `knowledge/nada-yoga.astro`, `knowledge/sound-and-humanity.astro`, `knowledge/vibration-mind.astro`, `knowledge/elements-and-sound.astro`, `knowledge/sound-attributes.astro`, `knowledge/balance-and-healing.astro`, `knowledge/references.astro` |
| Schema / content | `content/schemas/chant.ts`, `content/chants/gayatri.json`, `hanuman-chalisa.json`, `karpura-gauram.json`, `twameva-mata.json` |
| Contribute / API | `contribute/form.astro`, `contribute/index.astro`, `api/contribute/submit.ts` |
| Outras páginas | `index.astro`, `settings/index.astro`, `traditions/index.astro` |
