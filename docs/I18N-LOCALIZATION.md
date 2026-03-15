# Localização (i18n) — Sacred Chants

Este documento descreve a implementação completa da localização do site em **en** (inglês), **pt** (português), **es** (espanhol) e **it** (italiano).

---

## Resumo

| Componente | Locales suportados | Observações |
|------------|--------------------|-------------|
| UI (navegação, labels, botões) | en, pt, es, it | `src/i18n/strings.ts` |
| Cânticos: description, about, verses | en, pt, es, it | Schema em `src/content/schemas/chant.ts` |
| URL | `?lang=en`, `?lang=pt`, `?lang=es`, `?lang=it` | `pt-br` tratado como `pt` |

---

## Schema dos cânticos

O schema Zod em `src/content/schemas/chant.ts` define os locales opcionais para:

- **`description`**: `en` (obrigatório), `pt` (obrigatório), `es`, `it` — texto curto no cabeçalho
- **`about`**: `en`, `pt`, `es`, `it` — texto longo "Sobre este cântico"
- **`verses[].lines[].translations`**: `en`, `pt`, `es`, `it` — tradução de cada linha
- **`verses[].explanation`**: `en`, `pt`, `es`, `it` — explicação opcional do verso

Fallback: se um locale estiver em falta, usa-se `en` ou `pt` por ordem. A UI mostra o aviso *"Verse translations in this language are not yet available; showing English."* quando o texto visível é fallback para inglês.

---

## Cânticos localizados

Todos os cânticos têm **en** e **pt** completos. **es** e **it** foram adicionados conforme abaixo:

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

> **Nota sobre Hanuman Chalisa:** Alguns blocos em `es`/`it` usam ainda o texto em inglês como placeholder. A UI continua a funcionar com fallback; futuras contribuições podem completar as traduções.

---

## Componentes principais

### ChantVerse.astro

- Define `VERSE_LOCALES = ['en', 'pt', 'es', 'it']`
- Para cada locale, renderiza `<p class="locale-{loc}">` com a tradução (ou fallback)
- O utilizador vê apenas o bloco correspondente ao `data-locale` do `<html>` (via CSS)

### Locale selector

- ID `#sc-locale-select` (desktop) e `#sc-locale-select-drawer` (drawer mobile)
- Ao alterar, atualiza `?lang=` na URL e o `data-locale` no `<html>`

---

## Como adicionar um novo locale

1. **`src/i18n/strings.ts`**: adicionar chave ao tipo `Locale` e ao objeto `ui`
2. **`src/content/schemas/chant.ts`**: adicionar `xx` opcional em `description`, `about`, `translations`, `explanation`
3. **`ChantVerse.astro`**: adicionar `'xx'` a `VERSE_LOCALES` e mapear labels
4. **Layout/navegação**: incluir o novo locale no combo de idiomas
5. **Cânticos JSON**: preencher `description.xx`, `about.xx`, `translations.xx` em cada chant
6. **E2E**: adicionar teste em `e2e/locale.spec.ts` para `?lang=xx`

---

## Testes E2E

- `e2e/locale.spec.ts` — verifica:
  - locale por defeito (en) sem `?lang=`
  - `?lang=es`, `?lang=pt`, `?lang=it` definem `data-locale` e combo
  - Página de chant com `?lang=es` ou `?lang=it` mostra bloco `.locale-es` ou `.locale-it`
  - Hanuman Chalisa: troca ES → PT → EN e confirma texto no primeiro verso em cada idioma

---

## Referências

- Strings UI: `src/i18n/strings.ts`
- Schema: `src/content/schemas/chant.ts`
- Componente de versos: `src/components/ChantVerse.astro`
- Cânticos: `src/content/chants/*.json`
- Testes: `e2e/locale.spec.ts`
