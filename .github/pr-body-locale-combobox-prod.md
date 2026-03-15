## Bug em produção: idioma “perde-se” / combobox de locale

### Problema
Em produção, o idioma selecionado pelo utilizador **perde-se** aparentemente ao acaso: o combobox de idioma (EN | PT | ES | IT) deixa de refletir o locale real da página, ou a página mostra conteúdo num idioma diferente do selecionado. Isto gera confusão e má experiência, sobretudo para utilizadores que escolhem PT, ES ou IT.

### Causas identificadas
1. **`selected` em múltiplas opções do `<select>`**  
   Em HTML, quando várias `<option>` têm o atributo `selected` (incluindo `selected="false"`), o comportamento é imprevisível: alguns browsers tratam `selected="false"` como “selecionado”. O markup estava a usar `selected={initialLocale === 'x'}` para todas as opções, o que em Astro pode gerar `selected="false"` nas não selecionadas.

2. **Falta de fallback explícito para inglês**  
   Quando não há `?lang=` na URL e o valor do combobox não era válido, não havia garantia de que o sistema assumisse inglês (EN) como padrão, o que podia deixar o combobox e o conteúdo dessincronizados.

3. **Combobox não sincronizado após carregamento**  
   O script `init-theme-locale.js` define `data-locale` no `<html>` a partir da URL/localStorage, mas o valor do `<select>` era definido apenas no HTML de servidor. Se o browser interpretasse mal o `selected` ou houvesse redirect, o combobox podia mostrar um valor diferente do locale efetivo.

4. **Redirect ao repor `?lang=` podia perder query params e hash**  
   Ao repor o idioma guardado na URL, o redirect não preservava outros parâmetros nem o `#anchor`, podendo quebrar links partilhados ou estado da página.

### Alterações feitas

#### `src/layouts/BaseLayout.astro`
- **Apenas uma opção com `selected`:** Uso de `selected={initialLocale === 'en' ? true : undefined}` (e equivalente para pt/es/it) para que só a opção do idioma atual tenha o atributo; as outras não recebem `selected`, evitando `selected="false"`.
- **Idioma padrão explícito:** `initialLocale` passa a ser sempre um dos valores válidos, com fallback para `'en'` quando o resultado de `getLocaleFromUrl` não for pt/es/it.
- **Sincronização do combobox no carregamento:** O script inline que corre após o DOM existir lê `document.documentElement.dataset.locale` (definido por `init-theme-locale.js`) e define `value` dos dois selects (header e drawer) para esse locale; se o valor atual do select não for válido (en/pt/es/it), força `'en'`.
- **Troca de idioma preserva URL:** O handler `change` do select usa `URLSearchParams`: mantém os restantes query params e o hash, alterando apenas o parâmetro `lang` (ou removendo-o quando se escolhe EN).

#### `public/scripts/init-theme-locale.js`
- **Redirect preserva query e hash:** Ao repor `?lang=` a partir do idioma guardado, o redirect é feito para `pathname + queryString + hash`, mantendo outros parâmetros e o fragmento da URL.

#### Testes
- **`tests/unit/locale.test.ts`:** Testes para `getLocaleFromUrl` (sem param → en, inválido → en, pt/pt-br → pt, es → es, it → it) e para `langQuery` (en → `''`, pt/es/it → `?lang=...`).
- **`tests/unit/chant-content-schema.test.ts`:** Garante que o schema de conteúdo aceita `description`, `about`, `verses[].lines[].translations` e `verses[].explanation` com locales opcionais `es` e `it`.
- **`e2e/locale.spec.ts`:** E2E para: sem `?lang=` → `data-locale="en"` e combobox EN; `?lang=es` → locale es e combobox ES; `?lang=pt` em `/chants/`; página de chant com `?lang=it`.

### Como validar
- **Local:** `npm run test` (unit) e `npm run test:e2e -- e2e/locale.spec.ts` (E2E com preview).
- **Produção (após deploy):** Abrir o site sem `?lang=`, verificar combobox em EN; escolher PT/ES/IT e navegar entre páginas; recarregar e confirmar que o idioma e o combobox permanecem corretos; abrir um link com `?lang=es` e outro com `#section` e confirmar que o redirect (quando aplicável) não perde parâmetros nem hash.

### Impacto
- **Utilizadores:** O idioma escolhido deixa de “saltar” ou dessincronizar; o combobox reflete sempre o locale efetivo; links com `?lang=` e âncoras continuam a funcionar.
- **Sem breaking changes:** Comportamento da URL e dos locales mantém-se; apenas se corrige o bug e se torna o padrão EN explícito e estável.

Closes #[número do issue do bug em prod, se existir]
