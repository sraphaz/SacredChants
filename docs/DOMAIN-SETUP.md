# Configurar domínio sacredchants.org (IONOS + GitHub Pages)

O site está em **GitHub Pages** (build por GitHub Actions). Para usar o domínio **sacredchants.org** comprado na IONOS são precisos dois lados: **DNS na IONOS** e **domínio personalizado no GitHub**. O código (Astro) só precisa de ajuste de `base` e `site` quando o domínio estiver a funcionar.

---

## 1. DNS na IONOS

No painel da IONOS, na gestão do domínio **sacredchants.org**:

### Opção A: Só o apex (sacredchants.org)

- Tipo **A** (4 registos, um para cada IP do GitHub):
  - Nome: `@` (ou deixar vazio para o apex)
  - Valor: `185.199.108.153` | TTL: 3600 (ou padrão)
  - Valor: `185.199.109.153` | TTL: 3600
  - Valor: `185.199.110.153` | TTL: 3600
  - Valor: `185.199.111.153` | TTL: 3600

### Opção B: apex + www

- **Apex** (sacredchants.org): os 4 registos A acima.
- **www** (www.sacredchants.org):
  - Tipo **CNAME**
  - Nome: `www`
  - Valor: `sraphaz.github.io`

Guarda as alterações e espera a propagação (minutos a algumas horas).

---

## 2. Domínio personalizado no GitHub

Tens duas formas: **interface** ou **GitHub CLI**.

### Via interface (recomendado)

1. Repositório **SacredChants** → **Settings** → **Pages**.
2. Em **Custom domain** escreve: `sacredchants.org` (e, se quiseres, depois `www.sacredchants.org`).
3. Clica **Save**.
4. Quando o DNS estiver correto, o GitHub mostra o domínio como verificado; marca **Enforce HTTPS**.

### Via GitHub CLI (`gh`)

Com o [GitHub CLI](https://cli.github.com/) autenticado:

```bash
# Definir domínio personalizado e forçar HTTPS
gh api -X PUT repos/sraphaz/SacredChants/pages \
  -f cname=sacredchants.org \
  -f https_enforced=true \
  -f build_type=workflow
```

Se o endpoint exigir `source`, primeiro obtém a config atual:

```bash
gh api repos/sraphaz/SacredChants/pages
```

E no PUT inclui o mesmo `source` (ex.: `branch: main`, `path: /`) se for necessário. Para builds por **workflow** (Actions), `build_type=workflow` costuma ser suficiente.

**Nota:** A configuração de DNS (IONOS) **não** se faz via Git nem via `gh`; é sempre no painel da IONOS.

---

## 3. Ajustar o projeto para o novo domínio

Quando **sacredchants.org** estiver a abrir o site (mesmo que ainda com caminho `/SacredChants/`), convém servir o site na raiz do domínio.

Em **`astro.config.mjs`**:

- **site:** `https://sacredchants.org`
- **base:** `'/'`

Assim o site fica em `https://sacredchants.org/` (sem `/SacredChants/`).

Exemplo:

```js
// astro.config.mjs
export default defineConfig({
  site: process.env.SITE_ORIGIN || 'https://sacredchants.org',
  base: process.env.BASE_PATH || '/',
  // ...
});
```

Se quiseres manter o comportamento antigo em `sraphaz.github.io/SacredChants/`, podes usar variáveis de ambiente no deploy (ex.: `SITE_ORIGIN` e `BASE_PATH`) e no GitHub Actions definir essas env só quando o custom domain estiver ativo.

---

## 4. Resumo

| Onde        | O quê |
|------------|--------|
| **IONOS**  | Registos A (e opcionalmente CNAME para www). |
| **GitHub** | Settings → Pages → Custom domain **ou** `gh api ... PUT .../pages` com `cname` e `https_enforced`. |
| **Git**    | Só alterar `astro.config.mjs` (e/ou envs no CI) para `site` e `base` do novo domínio. |

Não é possível fazer a parte do DNS (IONOS) nem a verificação do domínio no GitHub apenas com Git CLI; o **commit/push** só afeta o código e o deploy. O domínio em si configura-se na IONOS e no GitHub (UI ou `gh api`).
