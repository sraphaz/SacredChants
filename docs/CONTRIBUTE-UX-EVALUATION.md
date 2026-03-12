# Avaliação UX/UI — Fluxo de contribuição

Avaliação do fluxo de contribuição (formulário, rascunhos, dashboard) com foco em clareza, hierarquia visual e alinhamento a padrões de mercado, mantendo a leveza dos elementos.

---

## 1. O que foi ajustado (esta iteração)

### 1.1 Timestamps só quando há áudio
- O campo **"Tempo de início (segundos)"** por verso estava sempre visível, gerando dúvida ("para quê?").
- **Alteração:** o bloco do tempo de início fica **oculto por predefinição** e **só aparece** quando existe URL de áudio ou ficheiro de áudio selecionado.
- Assim, a relação "áudio → sync → timestamps" fica explícita e a interface não sobrecarrega quem não usa áudio.

### 1.2 Bloco de áudio opcional
- Áudio (URL + ficheiro) passou a estar num **bloco próprio** com:
  - Título: "Audio (optional)" / "Áudio (opcional)".
  - Hint: "Add a link or file to enable playback. If you add audio, you can set a start time per verse for lyric sync."
- Reduz ruído na secção de metadados e deixa claro que áudio é opcional e que timestamps dependem dele.

### 1.3 Pré-visualização com contexto
- Acima da miniatura da página do cântico foi adicionada a linha:
  - "Preview — your chant as it will appear on the site:" / "Pré-visualização — o seu cântico como aparecerá no site:".
- Evita que o bloco de preview pareça solto e reforça que é a vista final.

### 1.4 Ordem e hierarquia dos botões (Review)
- Ordem: **Cancelar** | **Guardar rascunho** | **Criar pull request** (primário à direita).
- Cancelar à esquerda; ação principal (Criar PR) em destaque à direita; rascunho como ação secundária no centro.

### 1.5 Rascunhos mais discretos
- O painel "Os seus rascunhos guardados" foi tornado **secundário** em peso visual:
  - Título em uppercase, tamanho menor, cor muted.
  - Lista com tipo mais pequeno; apenas o título do rascunho em cor de texto principal.
- O percurso principal continua a ser 1 → 2 → 3; os rascunhos apoiam sem competir.

---

## 2. Avaliação geral (premium / mercado)

### Pontos fortes
- **Fluxo em 3 passos** claro (Metadados → Versos → Revisão) com navegação por links e scroll.
- **Preview fiel** à página do cântico reduz surpresas após o merge.
- **Rascunhos em localStorage** evitam perda de trabalho sem exigir backend.
- **Condicionalidade** (timestamps só com áudio) segue o princípio de mostrar apenas o relevante.
- **Texto e hints** em EN/PT e alinhados ao propósito de cada campo.

### Onde está “premium”
- Hierarquia visual clara (títulos de secção, hints, blocos opcionais separados).
- Microcopy que explica o “porquê” (ex.: áudio e sync).
- Ações primária vs secundária bem definidas (botões).
- Leveza mantida: sem excesso de bordas, sombras ou componentes pesados.

### Sugestões para evoluir (sem perder leveza)
1. **Progresso visível:** indicador discreto (ex.: “Passo 2 de 3”) ou barra fina no topo, para quem entra pela primeira vez.
2. **Guardar rascunho automático:** opcional, por exemplo a cada N segundos sem edição ou ao sair do step, com toast “Rascunho guardado”.
3. **Validação inline:** mostrar erro por campo (ex.: slug inválido) junto do input, além da mensagem geral.
4. **Acessibilidade:** garantir que o painel de timestamps (quando visível) tem foco lógico e que os drafts são navegáveis por teclado e leitor de ecrã.

---

## 3. Resumo

O fluxo de contribuição está mais **claro e focado**: timestamps só aparecem com áudio, o bloco de áudio está agrupado e explicado, a preview tem contexto e os rascunhos ficam em segundo plano. A base está alinhada a boas práticas de UX (relevância condicional, hierarquia, microcopy) mantendo a interface leve.
