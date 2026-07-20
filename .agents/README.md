# Agent manifests — kernel ARAH (genérico)

Manifests YAML definem **quem** pode fazer **o quê** no repo. Consumidos por:

- Agentes Cursor (via `AGENTS.md` + leitura do manifest)
- `scripts/agents/arah-agents.ps1` (roteamento e coreografia)
- CI (`validate-manifests.ps1`)

## Operacionais — fluxo (abrem PR ou operam gates)

| Arquivo | Agente | Papel |
|---------|--------|-------|
| orchestrator.agent.yaml | Orquestrador | Roteia intenções; não coda |
| planner.agent.yaml | Planner | Backlog → issues + specs |
| docs-steward.agent.yaml | Docs Steward | Taxonomia, doc-sync, índices |
| backend.agent.yaml | Backend | API / serviços server-side |
| frontend.agent.yaml | Frontend | UI web ou mobile |
| qa.agent.yaml | QA / Review | Qualidade em todo PR |
| pr-steward.agent.yaml | PR Steward | Bots, ready-for-merge, next-phase |
| spec-steward.agent.yaml | Spec Steward | Specs SDD + harness |
| solutions-architect.agent.yaml | Solutions Architect | ADRs, arquitetura, diagramas |
| release.agent.yaml | Release / DevOps | CI/CD, versões, IaC |
| security.agent.yaml | Security | Deps, secrets, compliance |

## Consultivos — domínio (não abrem PR; parecer via coreografia)

Gerados por `arah domain add` a partir de `arah.config.yaml` → `.agents/domain/`.

## Consultivos — especialistas (profundidade por stack)

Adicionados conforme stack do projeto em `arah.config.yaml` → `.agents/specialists/`.

## Coreografia

`choreography.yaml` mapeia paths → agentes (co-ativação + pareceres de domínio).
Regras genéricas cobrem specs, PR e áreas de código; regras de domínio são mescladas no init.

Checklists em `checklists/`; templates de PR/gates em `templates/`.
