# Skills — kernel ARAH

Cada `.skill.yaml` encapsula **comando + guardrail + critério de sucesso**.
Comandos de teste são resolvidos via `arah.config.yaml` quando aplicável.

| Skill | Descrição |
|-------|-----------|
| run-tests | Suíte da área alterada |
| open-pr | Abre PR com template |
| spec-validate | Valida specs YAML |
| harness-run | Executa harness SDD |
| code-review | Revisão estrutural |
| craft-review | Revisão de craft/qualidade |
| sync-docs | Sincroniza documentação |
| spec-author | Autoria de spec |
| backlog-to-issue | Backlog → issue |
| release-cut | Corte de release |
| dep-audit | Auditoria de dependências |
| doc-taxonomy | Valida taxonomia doc |
| iac-plan | Plano de infra |
| register-adr | Registra ADR |
| architecture-review | Revisão arquitetural |
| address-bot-review | Endereça bots |
| respond-bot-review | Responde bots |
| next-phase | Avança fila de fases |

Execução: `./scripts/agents/invoke-skill.ps1 -Skill run-tests -Area backend`
