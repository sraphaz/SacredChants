# Avaliação de Design e Plano de Melhorias — Sacred Chants

**Objetivo:** Produto premium, com direção de design de alto padrão, mantendo leveza, simplicidade, beleza, simetria e ordem.

---

## 1. Avaliação atual

### Pontos fortes
- **Sistema de tokens** bem definido (`design-tokens.css`): escala tipográfica, leading, cores por tema e verse tint, medidas de leitura.
- **Tema claro/escuro** e muitas opções de personalização (tamanho, fonte, espaçamento, cor do verso, fundo) — reforça sensação de cuidado.
- **Hierarquia tipográfica** nos versos (original → transliteração → tradução) e sync de áudio com destaque visual.
- **Leitura contemplativa**: measure 80ch, leading relaxado, serif para texto sagrado.
- **Cores suaves** (stone/warm neutrals) e verse tints discretos — nada agressivo.

### Oportunidades de melhoria (premium + simetria + ordem)

| Área | Situação atual | Impacto |
|------|----------------|---------|
| **Larguras de conteúdo** | Inconsistentes: Home/chants list 2xl/3xl, settings xl, contribute/traditions/knowledge 2xl. | Falta de ordem e previsibilidade. |
| **Padding horizontal** | `px-4` em todo lado; em alguns layouts `md:px-6`. Sem escala unificada. | Simetria lateral irregular em viewports maiores. |
| **Espaçamento vertical** | `py-12`, `py-20`, `mb-10`, `mb-8`, `mt-16` — números soltos, não uma escala. | Ritmo vertical inconsistente. |
| **Header / nav** | `max-w-4xl`; conteúdo principal varia (2xl, 3xl, xl). Nav e main não alinhados. | Quebra de eixo e alinhamento. |
| **Botões e CTAs** | Home: `rounded-md`; chant page: `rounded-full`. Estilos inline e classes mistas. | Falta de sistema de componentes. |
| **Cards** | `rounded-lg`, `border-stone-200`, `bg-white` hardcoded — em dark mode depende de overrides. | Risco de fuga do tema em novos elementos. |
| **Tipografia de títulos** | H1 às vezes `text-4xl md:text-5xl`, às vezes `text-3xl`, sem escala única. | Hierarquia pouco consistente. |
| **Footer** | Uma linha de separador, texto centralizado; visualmente leve mas sem relação clara com a grade. | Pode integrar-se melhor à grelha. |
| **Media widget (chant)** | `max-w-2xl`, `rounded-xl`, `p-5`; Bandcamp embed logo abaixo — bom, mas padding interno pode seguir tokens. | Pequenos desvios da escala. |
| **Settings** | Muitos fieldsets; poderia ter agrupamento visual (cards/panels) e mais ar. | Clareza e respiro. |
| **Acessibilidade visual** | Contraste e foco já tratados (outline, accent). | Manter e documentar. |

---

## 2. Princípios do plano (diretor de design alto padrão)

1. **Uma grelha e uma escala**  
   Largura máxima de conteúdo única (ou duas: “narrow” para leitura longa, “content” para listas/settings). Todo o conteúdo principal e o header/footer assentam na mesma coluna lógica.

2. **Ritmo vertical baseado em tokens**  
   Usar apenas valores da escala (ex.: `--sc-space-section`, `--sc-space-block`, múltiplos definidos em tokens) para `margin`/`padding` entre secções e blocos.

3. **Simetria e alinhamento**  
   Header, main e footer com o mesmo `max-width` e `padding` horizontal; conteúdo centralizado no mesmo eixo.

4. **Leveza e ar**  
   Evitar densidade: mais espaço em branco entre secções do que dentro; botões e cards com padding generoso.

5. **Beleza discreta**  
   Sem adicionar decoração desnecessária; bordas suaves, sombras muito leves (ou nenhuma), cores do sistema. Sensação “premium” por consistência e qualidade tipográfica, não por efeitos.

6. **Ordem através de repetição**  
   Mesmo padrão em todas as páginas: título → descrição/resumo → conteúdo; mesmo estilo de botão/link secundário; mesmos raios de borda por tipo (botão, card, input).

---

## 3. Plano de melhorias (priorizado)

### Fase 1 — Fundação (simetria e escala)

- **1.1 Largura de conteúdo única**
  - Definir em tokens (ou Tailwind): `--sc-content-width: 48rem` (768px) ou `56rem` (896px) como padrão para “content”; manter `--sc-measure-reading` (80ch) para blocos de verso/prose.
  - Aplicar em: layout base (main wrapper), header, footer, todas as páginas (home, chants, chant detail, settings, traditions, knowledge, contribute).
  - Resultado: uma única coluna conceptual; header, main e footer alinhados.

- **1.2 Padding horizontal consistente**
  - Escolher uma escala: ex. `--sc-page-padding: 1.5rem` (mobile) e `2rem` (desktop), ou usar `clamp(1rem, 5vw, 2rem)`.
  - Aplicar ao wrapper de página e ao header/footer para que as margens laterais coincidam em todas as páginas.

- **1.3 Escala de espaçamento vertical**
  - Introduzir em `design-tokens.css`: ex. `--sc-space-page-top: 3rem`, `--sc-space-page-bottom: 4rem`, `--sc-space-heading-subtitle: 0.5rem`, `--sc-space-section-gap: 3rem`.
  - Substituir valores soltos (`py-20`, `mb-10`, `mt-16`, etc.) por classes ou variáveis que usem esses tokens.
  - Garantir ritmo: título → pequeno gap → subtítulo/descrição → gap maior → conteúdo.

### Fase 2 — Componentes e ordem visual

- **2.1 Page shell reutilizável**
  - Criar um componente (ex. `PageShell.astro`) com: `max-width` da content width, padding horizontal da escala, padding vertical superior/inferior da escala.
  - Todas as páginas usam este shell; títulos e descrições seguem o mesmo markup (ex. `PageTitle` + `PageDescription`).

- **2.2 Sistema de botões**
  - Primário: já existe `.sc-btn-primary`; unificar `border-radius` (ex. `rounded-lg` ou `rounded-full` em todo o site) e padding (ex. `px-5 py-2.5`).
  - Secundário: `.sc-btn-secondary` com o mesmo radius e escala de padding.
  - Terciário / link como botão: estilo único para “Listen on Spotify”, “Bandcamp”, etc., usando variáveis (`--sc-text`, `--sc-bg`, `--sc-border`) em vez de stone hardcoded.

- **2.3 Cards**
  - ChantCard e quaisquer outros cards: usar apenas `var(--sc-bg-elevated)`, `var(--sc-border)`, `var(--sc-text)` etc., sem `bg-white`/`border-stone-200`.
  - Raio e padding unificados (ex. `rounded-xl`, `p-6`).
  - Garantir que hover e estados de foco usem tokens (já parcialmente feito).

- **2.4 Header da página de chant**
  - Manter estrutura (meta, título, língua, descrição, tags); garantir que `max-width` do header seja o mesmo do conteúdo abaixo (measure-reading ou content width) e que margens laterais coincidam com o restante da página.

### Fase 3 — Refino premium (leveza e beleza)

- **3.1 Tipografia de títulos**
  - Definir em tokens ou Tailwind: H1 página = um tamanho (ex. `sc-4xl` ou `sc-5xl`), H1 chant = outro se necessário; H2 secção = um tamanho abaixo.
  - Todas as páginas usam a mesma regra para H1 (e H2 onde aplicável).

- **3.2 Media widget e Bandcamp**
  - Padding interno do widget usar tokens (`var(--sc-space-block)` ou similar).
  - Bandcamp embed: mesma largura máxima e margens que o restante do conteúdo; cantos alinhados ao widget (ex. `rounded-b-xl` se o widget tiver `rounded-xl`).

- **3.3 Settings**
  - Agrupar opções em blocos visuais (ex. “Aparência”, “Leitura”, “Cores”) com títulos de secção e um pouco mais de espaço entre grupos.
  - Usar a mesma content width e padding do resto do site; inputs e labels alinhados à mesma grelha.

- **3.4 Footer**
  - Mesmo `max-width` e `padding` do header/main; linhas de texto com espaçamento da escala (ex. `--sc-space-block` entre as duas linhas).

### Fase 4 — Documentação e manutenção

- **4.1 Design system em documento**
  - Criar `docs/DESIGN-SYSTEM.md` (ou secção no README) com: tokens de cor, tipo, espaço e largura; quando usar “content width” vs “measure reading”; exemplos de H1/H2, botões, cards.
  - Regra: “novos componentes devem usar apenas tokens e classes do sistema”.

- **4.2 Checklist de novas páginas**
  - Usar `PageShell`; título e descrição com componentes padrão; botões e links com classes do sistema; sem cores ou espaços hardcoded fora dos tokens.

---

## 4. Resumo executivo

| Princípio | Ação principal |
|-----------|----------------|
| **Simetria e ordem** | Uma content width + padding horizontal único; header, main e footer alinhados. |
| **Ritmo** | Escala de espaçamento vertical em tokens; substituir valores soltos. |
| **Leveza** | Mais espaço em branco entre secções; componentes com padding generoso. |
| **Beleza** | Consistência tipográfica (H1/H2), bordas e raios unificados, cores só via tokens. |
| **Premium** | Sensação de produto cuidado pela coerência e pela qualidade da tipografia e do espaço, não por efeitos visuais. |

Implementar na ordem: **Fase 1** (fundação) → **Fase 2** (componentes e ordem) → **Fase 3** (refino) → **Fase 4** (documentação). Isso mantém a simplicidade e a leveza atuais e eleva a percepção de qualidade através de ordem e consistência.
