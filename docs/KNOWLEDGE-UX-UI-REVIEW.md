# Knowledge — Revisão UX/UI e recomendações do diretor de design

**Data:** Março 2025  
**Âmbito:** Secção Knowledge (índice + subpáginas de conteúdo).

---

## 1. O que já está alinhado com o plano de design

| Princípio | Implementação atual |
|-----------|----------------------|
| **Ordem e hierarquia** | Índice organizado em secções (Start here, First pillar, Concepts, Go deeper, References); títulos de secção em uppercase, cor subtil. |
| **Botões que se destacam** | Nada Yoga como CTA primário (`sc-btn-primary`); restantes links como cartões com `bg-elevated`, borda e hover. |
| **Ritmo vertical** | `mb-page-heading`, `mb-page-content`; gap entre secções do nav com `--sc-space-section-gap`. |
| **Tokens de cor** | Cartões e hovers usam `var(--sc-bg-elevated)`, `var(--sc-border)`, `var(--sc-accent-soft)` — sem cores hardcoded. |
| **Acessibilidade** | `aria-label` no nav, `aria-labelledby` nas secções, `focus-visible` nos links. |
| **Subpáginas** | Link “← Back to Knowledge” consistente; H1 + prose com `max-w-[var(--sc-measure-reading)]`; H2 com estilo unificado. |

---

## 2. Recomendações finais do diretor de design / UX

### 2.1 Manter (não alterar)

- **Um único CTA primário** (Nada Yoga) na página índice — evita ruído e guia o utilizador para o primeiro pilar.
- **Cartões sem ícones** — o conteúdo é textual e contemplativo; ícones adicionais podem distrair.
- **Largura do bloco de navegação** (`max-w-2xl`) — deixa espaço à direita em desktop e mantém leitura confortável.

### 2.2 Melhorias opcionais (backlog)

| Item | Recomendação | Prioridade |
|------|--------------|------------|
| **Espaço entre intro e nav** | Já se usa `mb-10` antes do nav; considerar alinhar com a escala (ex. `var(--sc-space-section-gap)`) em futuras refactors globais. | Baixa |
| **Breadcrumb em subpáginas** | Além do “← Back to Knowledge”, pode acrescentar um breadcrumb discreto (ex. “Knowledge > Nada Yoga”) para contexto em ecrãs grandes. | Baixa |
| **Estado activo no nav** | Na página índice, não há “página actual”; nas subpáginas, o link “Back” já cumpre o papel. Manter como está. | — |
| **Leitura longa nas subpáginas** | Prose já usa `max-w-[var(--sc-measure-reading)]` e `space-y-6`; alinhado com o plano. Manter. | — |

### 2.3 Consistência com o resto do site

- **PageShell**: Knowledge usa o mesmo `PageShell` que Traditions, Contribute, Settings — mesma content width e padding (`max-w-content`, `px-page-x`, `py-page`). ✓  
- **H1**: `font-serif text-sc-3xl sc-heading mb-page-heading` — igual às outras páginas secundárias. ✓  
- **Descrição**: `mb-page-content` e cor `var(--sc-text-muted)`. ✓  

Nenhuma alteração obrigatória; a área Knowledge está alinhada com o plano de design e com a experiência do resto do site.

---

## 3. Resumo executivo

A secção Knowledge cumpre os objectivos de **navegabilidade**, **hierarquia clara** e **elementos interactivos visíveis** (botão primário + cartões). As recomendações finais são de refinamento opcional (escala de espaçamento global, breadcrumb) e não bloqueiam release. O diretor de design e UX consideram a implementação actual **aprovada para produção**.
