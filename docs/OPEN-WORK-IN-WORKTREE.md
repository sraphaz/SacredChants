# Trabalho aberto neste ambiente (worktree)

Lista completa do que está modificado/não commitado e ainda não subiu para `main`.

---

## 1. Alterações modificadas (13 ficheiros)

### Layout e meta
- **`src/layouts/ChantLayout.astro`**  
  Meta description i18n: usa a descrição do cântico no locale atual para SEO em vez de fixar `en`/`pt`.

### Componentes
- **`src/components/ChantPlayerBar.astro`**  
  DRY: substitui os 4 blocos repetidos de labels de sync (EN/PT/ES/IT) por um array `PLAYER_LOCALES` e `.map()`. Mantém o mesmo `id` para o primeiro locale (`chant-sync-toggle-state`) por compatibilidade com JS.

### Knowledge (componente partilhado + páginas)
- **`src/components/KnowledgePageHeader.astro`** (novo, untracked)  
  Componente partilhado: link “voltar” + título da página, com um bloco por locale (en, pt, es, it). Um único sítio para este padrão; novo locale acrescentado num só lugar.

- **`src/pages/knowledge/index.astro`**  
  Renomeia `q` → `localeQuery`; usa `localeQuery` nos links das secções.

- **`src/pages/knowledge/balance-and-healing.astro`**  
  Usa `KnowledgePageHeader`; renomeia `q` → `localeQuery`.

- **`src/pages/knowledge/elements-and-sound.astro`**  
  Idem.

- **`src/pages/knowledge/nada-yoga.astro`**  
  Idem.

- **`src/pages/knowledge/references.astro`**  
  Idem.

- **`src/pages/knowledge/sound-and-humanity.astro`**  
  Idem.

- **`src/pages/knowledge/sound-attributes.astro`**  
  Idem.

- **`src/pages/knowledge/vibration-mind.astro`**  
  Idem.

### Contribute
- **`src/pages/contribute/index.astro`**  
  Renomeia `q` → `localeQuery`; usa `localeQuery` em links e URLs da app.

- **`src/pages/contribute/form.astro`**  
  Renomeia `q` → `localeQuery`; usa em `contributeAppContributeUrl` e `returnToForm`.

### Traditions
- **`src/pages/traditions/index.astro`**  
  Renomeia `q` → `localeQuery`; usa em links para chants por tradição.

---

## 2. Ficheiros não rastreados (relevantes para este PR)

- **`src/components/KnowledgePageHeader.astro`** — incluído no PR de refactor.

Ficheiros de documentação e apoio (opcionais para este PR):
- `docs/CLEAN-CODE-REVIEW.md`
- `docs/PLAN-SPEAK-ALONG-HIGHLIGHT.md`
- `docs/SECURITY-AND-COMPLIANCE.md`
- `docs/SPEAK-ALONG-OPEN-QUESTIONS.md`
- `.env.vercel.example`
- `.github/pr-body-*.md` — rascunhos de PR, não parte do código.

---

## 3. Resumo por tema

| Tema | Ficheiros | Descrição |
|------|-----------|-----------|
| **KnowledgePageHeader** | 1 novo + 7 knowledge pages | Componente partilhado para cabeçalho (voltar + título) nas 4 línguas; remove duplicação. |
| **localeQuery** | knowledge index, 7 knowledge pages, contribute index/form, traditions index | Renomear `q` → `localeQuery` para clareza e consistência. |
| **ChantLayout** | ChantLayout.astro | Meta description por locale para SEO. |
| **ChantPlayerBar** | ChantPlayerBar.astro | DRY nos labels de sync (en/pt/es/it). |

---

## 4. Build

- `npm run build` executado com sucesso com estas alterações.
