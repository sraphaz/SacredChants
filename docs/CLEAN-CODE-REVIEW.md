# Clean Code Review — Sacred Chants

Revisão do repositório com base nos princípios de **Clean Code** (Robert C. Martin — Uncle Bob). Foco em nomes, funções, duplicação, responsabilidade única e cheiros de código.

---

## 1. Antigravity Awesome Skills — Instalação

- **npm:** O pacote `antigravity-awesome-skills` na npm está incompleto (falta `lib/symlink-safety`), o que gera `MODULE_NOT_FOUND` ao rodar `npx antigravity-awesome-skills`.
- **Instalação a partir do repositório:** Foi feito clone de `https://github.com/sickn33/antigravity-awesome-skills` e executado `node tools/bin/install.js install --cursor`. O script correu mas falhou ao copiar para `C:\Users\rapha\.cursor\skills` com **EPERM** (operação não permitida). Provável causa: Cursor a usar a pasta de skills.
- **Recomendação:** Fechar o Cursor, executar de novo a partir do clone:  
  `cd <clone>/antigravity-awesome-skills` e `node tools/bin/install.js install --cursor`. Ou executar o terminal como administrador se for o caso.

---

## 2. Pontos positivos (alinhados com Clean Code)

### Nomes que revelam intenção
- **API:** `getSessionCookie`, `verifySession`, `createSession`, `escapeForInlineCode`, `escapeTableCell`, `formatChantContentAsMarkdown`, `createContributionPR` — nomes claros e pesquisáveis.
- **i18n:** `getLocaleFromUrl`, `langQuery` — intenção óbvia.
- **Session:** `createSession`, `verifySession`, `getSessionCookie`, `setSessionCookieHeader`, `clearSessionCookieHeader` — verbos adequados.

### Funções pequenas e com uma responsabilidade
- **api/lib/session.ts:** Funções curtas, uma responsabilidade cada; boa separação entre criar/verificar sessão e ler/escrever cookie.
- **api/lib/github.ts:** `getOctokit()` e `createContributionPR()` bem delimitadas; a segunda orquestra mas mantém um único nível de abstração (branch, ficheiro, PR).
- **api/contribute/close.ts:** Handler linear: método → auth → body → validação → GitHub → resposta. Fácil de ler.
- **src/utils/bandcamp.ts:** `getBandcampArtUrl` faz uma coisa: fetch + regex og:image; tratamento de erro com `undefined` em vez de exceção não tratada.

### Comentários úteis
- JSDoc na API (submit, close, session, github) explica contrato e erros; comentário em `bandcamp.ts` sobre uso em build time.
- Comentários em `chant-schema.ts` a explicar alinhamento com o schema do content.

### Tratamento de erros
- API usa códigos HTTP corretos (401, 403, 405, 400, 500) e JSON estruturado.
- `verifySession` devolve `null` em falha (e o caller trata); em TypeScript isso é explícito. Evitar “return null” em excesso no futuro: considerar Result ou throw em cenários críticos.
- `submit.ts` distingue erro de config (GITHUB_TOKEN) de 403 e devolve `hint` — bom para diagnóstico.

### Dados e abstração
- Schema Zod em `chant-schema.ts` e `chant.ts` define um contrato claro; tipos inferidos (`ChantPayload`, `Chant`) evitam “objetos mágicos”.

---

## 3. Melhorias recomendadas

### 3.1 Duplicação e rigidez — ChantCard.astro

**Problema:** O card repete quatro blocos quase idênticos (um por locale: en, pt, es, it). Qualquer alteração de estrutura ou copy (ex.: acessibilidade, novo locale) exige editar quatro sítios.

**Princípio violado:** DRY, rigidez (“hard to change”).

**Sugestão:** Um único bloco de template que recebe `locale` e dados derivados (desc, link com `?lang=`), e um loop (ou componente interno) sobre os locales. Exemplo de ideia:

```astro
---
const locales = ['en', 'pt', 'es', 'it'] as const;
const descByLocale = { en: descEn, pt: descPt, es: descEs, it: descIt };
---
{locales.map((loc) => (
  <a href={...} class={`locale-${loc} block p-6`}>
    ...
    <p>{descByLocale[loc]}</p>
    ...
  </a>
))}
```

Assim o “newspaper” fica mais curto e mudanças futuras são num único sítio.

---

### 3.2 Nomes abreviados

**BaseLayout.astro / várias páginas:** A variável `q` para “query string de idioma” (`q = (l) => l === 'en' ? '' : '?lang=' + l`) é pouco reveladora.

**Sugestão:** Renomear para `langQueryParam` ou `localeQuery` (ou reutilizar o nome da função `langQuery` de `strings.ts` e usar essa função em todo o lado). Objetivo: nome pesquisável e que explique o propósito.

---

### 3.3 Handler grande — api/contribute/submit.ts

**Problema:** O handler `default async function handler(...)` faz: método POST, auth, parse body, validação schema, construção de `prBody` (string longa), chamada a `createContributionPR`, tratamento de erro com hints. Tem muitas linhas e mais de um nível de abstração no mesmo sítio.

**Sugestão (Stepdown Rule):**
- Extrair construção do PR body para uma função `buildContributionPRBody(chant, user, contentAddedMd, contributeOrigin)` que devolve a string.
- Manter no handler apenas: validação de método, auth, parse + validação Zod, build body, chamada GitHub, resposta. Assim o handler “conta a história” em passos de alto nível e os detalhes ficam em funções com nomes descritivos.

---

### 3.4 Comentário obrigatório / ruído

**BaseLayout.astro:** Script inline com variável `allowed = ['en', 'pt', 'pt-br', 'es', 'it']`. Se existir comentário do tipo “allowed locales”, está ok; evitar comentários que apenas repitam o código (ex.: “set allowed to array of locales”).

**Regra geral:** Preferir explicar “porquê” ou contrato (ex.: “pt-br is normalized to pt for storage”); evitar “o quê” redundante.

---

### 3.5 Inline script longo — BaseLayout.astro

**Problema:** O bloco `(function() { ... })();` no `<head>` inicializa tema, fontSize, fontFamily, spacing, verseTint, textColor, bg e locale a partir de `localStorage` e URL. É longo e mistura várias responsabilidades.

**Sugestão (opcional):** Extrair para um ficheiro `.js` (por exemplo `init-theme-and-locale.js`) que faz:
- `initThemeFromStorage()`
- `initLocaleFromUrlAndStorage()`
e que é referenciado com `<script src="...">`. Facilita testes e leitura; o HTML fica com “carregar e executar init”.

---

### 3.6 Lei de Demeter / acoplamento

Em vários `.astro`, acedem-se várias propriedades encadeadas (ex.: `chant.description?.en`, `chant.description?.pt`). No ChantCard já existe um objeto `desc` e fallbacks; está razoável. Manter o padrão de “um objeto de dados derivado por componente” (ex.: `descEn`, `descPt`, …) em vez de repetir `chant.description?.x` em muitos sítios — isso já reduz acoplamento à estrutura do content.

---

## 4. Resumo por área

| Área            | Naming | Funções | Comentários | Duplicação | Error handling | SRP |
|-----------------|--------|---------|-------------|------------|----------------|-----|
| api/            | ✅     | ⚠️ submit longo | ✅ | ✅ | ✅ | ✅ |
| api/lib/        | ✅     | ✅     | ✅ | ✅ | ✅ | ✅ |
| src/i18n/       | ✅     | ✅     | n/a | n/a | ✅ | ✅ |
| src/utils/      | ✅     | ✅     | ✅ | ✅ | ✅ | ✅ |
| src/components/ | ✅     | n/a    | n/a | ❌ ChantCard 4× | n/a | ⚠️ |
| src/layouts/    | ⚠️ q   | n/a    | ⚠️ | ✅ | n/a | ⚠️ script longo |

---

## 5. Checklist Clean Code (resumo)

- [x] Nomes na maioria intenção-reveladores e pesquisáveis.
- [x] Funções na API e libs pequenas e com uma responsabilidade; exceção: handler de submit.
- [x] Comentários úteis (JSDoc, “porquê”) onde existe documentação.
- [x] Redução de duplicação: ChantCard com um único template e loop por locale.
- [x] Tratamento de erros explícito na API; uso de códigos HTTP e mensagens claras.
- [x] Stepdown: submit handler usa `buildContributionPRBody` e `buildSubmitErrorHint`.
- [x] Nomes: BaseLayout usa `langQuery` de i18n em vez de `q`.

---

## 6. Refactor implementado (Clean Code)

As seguintes alterações foram aplicadas:

1. **ChantCard.astro**
   - Um único template com loop sobre `CARD_LOCALES` (en, pt, es, it). Dados por locale (href, description, audioTitle) derivados no frontmatter; função `getDescriptionByLocale` e constante `AUDIO_ICON_TITLE_BY_LOCALE`. Elimina os quatro blocos duplicados (DRY).

2. **api/contribute/submit.ts**
   - `buildContributionPRBody(chant, userLogin, contentAddedMd, contributeOrigin)` extraída; responsabilidade única de montar o corpo do PR.
   - `buildSubmitErrorHint(message, status)` extraída para hints de erro (config / 403).
   - Handler reduzido a passos de alto nível: método → auth → parse → validação → build body → create PR → resposta.

3. **BaseLayout.astro**
   - Uso de `langQuery` importado de `../i18n/strings` em vez da variável local `q`; nomes intenção-reveladores.
   - Script de init (tema + locale) extraído para `public/scripts/init-theme-locale.js`, com funções `applyThemeFromStorage()` e `resolveLocaleFromUrlAndStorage()`; referenciado com `<script is:inline src={FULL_BASE + 'scripts/init-theme-locale.js'}></script>`.

4. **Naming**
   - BaseLayout: remoção de `q`; uso consistente de `langQuery` de `i18n/strings.ts`.

---

## 7. Próximos passos (opcionais)

- ~~Revisar outras páginas que usem padrões repetidos por locale~~ — feito na ronda 2 (ver §8).
- Manter funções na API com menos de ~20 linhas e uma única responsabilidade.

---

## 8. Refactor implementado — Ronda 2 (review completo)

Aplicação do review Uncle Bob ao resto do site:

### 8.1 Naming: `q` → `localeQuery`

- **Problema:** A variável `q` para a query string de idioma era pouco reveladora (ver §3.2).
- **Alteração:** Em todas as páginas que usavam `const q = langQuery(locale)`, a variável foi renomeada para `localeQuery` e todas as referências atualizadas.
- **Ficheiros:** `src/pages/knowledge/*.astro` (nada-yoga, references, sound-and-humanity, balance-and-healing, sound-attributes, elements-and-sound, vibration-mind, index), `src/pages/contribute/index.astro`, `src/pages/contribute/form.astro`, `src/pages/traditions/index.astro`. (Em `settings` e `dashboard`, `q` mantém-se para `URLSearchParams`/array — significado diferente.)

### 8.2 ChantPlayerBar.astro — DRY por locale

- **Problema:** Quatro blocos repetidos para o label de “Lyrics sync” e quatro para o estado do toggle.
- **Alteração:** Constante `PLAYER_LOCALES = ['en', 'pt', 'es', 'it']`, objetos `syncLabels` e `syncOnLabels` no frontmatter, e um único loop `.map()` para cada grupo de spans. IDs do estado do toggle mantidos (`chant-sync-toggle-state` para en, `chant-sync-toggle-state-pt`, etc.) para compatibilidade com o script.

### 8.3 Knowledge pages — cabeçalho partilhado (back link + título)

- **Problema:** Em todas as páginas de knowledge (nada-yoga, references, sound-and-humanity, balance-and-healing, sound-attributes, elements-and-sound, vibration-mind) repetia-se o mesmo bloco: link “← Back to Knowledge” com quatro spans por locale e `<h1>` com quatro spans por locale.
- **Alteração:** Criado componente `KnowledgePageHeader.astro` que recebe `backHref`, `titleByLocale` e `backLabelByLocale`, e renderiza um único loop sobre `KNOWLEDGE_HEADER_LOCALES` para o link e para o título. Todas as 7 páginas de knowledge passam a usar este componente; novo locale ou alteração de estrutura fica num único sítio.

### 8.4 ChantVerse.astro — DRY por locale (en/pt)

- **Problema:** Dois blocos repetidos para o label “Verse N” e dois para cada tradução e explicação (en/pt).
- **Alteração:** Constante `VERSE_LOCALES = ['en', 'pt']`, objeto `verseLabelByLocale`, e loops `.map()` para o label do verso, para as traduções e para as explicações. O schema de versos mantém apenas en/pt; es/it podem ser adicionados no futuro alterando a constante e o tipo.

---

Este documento pode ser atualizado à medida que novas refatorações forem feitas.
