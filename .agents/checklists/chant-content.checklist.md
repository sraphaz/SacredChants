# Checklist — Chant Content

Usar em todo mantra novo ou deepen de locales. Execução: skill
[`.cursor/skills/chant-ingestion/SKILL.md`](../../.cursor/skills/chant-ingestion/SKILL.md).
Domínio consultivo: `chant-content` em `arah.config.yaml`.

Inclui [_shared.conduct.md](_shared.conduct.md).

## Sanskrit lock (antes das traduções)

- [ ] Fontes pesquisadas (≥2 quando possível); variantes anotadas
- [ ] Devanagari alinhado à tradição **e** à forma cantada
- [ ] IAST linha-a-linha com o Devanagari (sandhi, anusvāra, visarga)
- [ ] Diacríticos IAST completos (ā ī ū ṛ ṅ ñ ṇ ś ṣ ḥ ṃ…)
- [ ] Erros típicos de ASR rejeitados; segmentação bate com o áudio
- [ ] Lock declarado — só então parallelizar locales

## Locales (prioridade)

Ordem de qualidade quando o tempo apertar:

1. **pt** — voz do produto
2. **en** — âncora / fallback
3. **es / it** — paridade românica com en/pt
4. **hi / ar** — bundle `scripts/chant-locales/<slug>.json` + `npm run chant:merge-locales`

### Por locale

- [ ] `translations` por linha sem blanks nas línguas prometidas
- [ ] `description` / `about` coerentes; `explanation` onde o verso precisa de contexto
- [ ] Termos sânscritos estáveis entre línguas (glossário interno do canto)
- [ ] Lente dual: fidelidade + acessibilidade contemplativa
- [ ] Hindi/Awadhi: não forçar `hi` nas linhas se o merge deve pular
- [ ] Árabe: RTL ok na UI; arrays do bundle com o mesmo length das linhas flat

## Áudio / karaokê

- [ ] `public/audio/<slug>.mp3` + `audio` + `duration` + `interpreter`
- [ ] `spotifyUrl` só como listen-only (se presente)
- [ ] `lines[].start` monotônicos; âncoras SRT documentadas quando usadas

## Parallel Task (orquestrador)

Após Sanskrit lock, lançar em **paralelo** (não seis agentes permanentes):

- [ ] (B) en + pt
- [ ] (C) es + it
- [ ] (D) hi + ar bundle

Depois: merge no JSON único → validate/build → um PR.
