# Proteção da branch `main`

Regras aplicadas via GitHub (API). Para rever/alterar: **Settings → Branches → Branch protection rules → main**.

## Regras ativas

| Regra | Valor |
|--------|--------|
| **Status checks obrigatórios** | `build`, `lint`, `e2e` (jobs do CI) |
| **Pull request obrigatório** | Sim (merge em main só via PR) |
| **Aprovações obrigatórias** | 0 (pode exigir 1+ em Settings) |
| **Force push** | Bloqueado |
| **Apagar a branch** | Bloqueado |
| **Dismiss stale reviews** | Ativo |

## Como atualizar a proteção (gh CLI)

```bash
gh api repos/sraphaz/SacredChants/branches/main/protection -X PUT --input .github/branch-protection-main.json
```

O ficheiro `branch-protection-main.json` descreve o payload usado; pode ser editado e o comando reexecutado (requer permissões de admin no repo).
