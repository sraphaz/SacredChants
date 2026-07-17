# Proteção da branch `main`

O merge para `main` **só é permitido após todos os checks do CI passarem**. Regras aplicadas via GitHub (API). Para rever/alterar: **Settings → Branches → Branch protection rules → main**.

## Regras ativas

| Regra | Valor |
|--------|--------|
| **Status checks obrigatórios** | `build`, `lint`, `e2e` (todos devem estar verdes) |
| **Branch actualizada (strict)** | Sim — a branch do PR deve estar em dia com `main` para poder fazer merge |
| **Pull request obrigatório** | Sim (merge em main só via PR) |
| **Aprovações obrigatórias** | 0 (pode exigir 1+ em Settings) |
| **Force push** | Bloqueado |
| **Apagar a branch** | Bloqueado |
| **Dismiss stale reviews** | Ativo |

Enquanto algum check falhar ou a branch estiver desactualizada, o botão de merge fica desactivado.

## Auto-merge do Dependabot

O repositório tem **Allow auto-merge** activo. O workflow
`.github/workflows/dependabot-auto-merge.yml` activa auto-merge (squash) em PRs do
Dependabot para:

- updates **patch** e **minor**;
- updates **major** só de tooling seguro (ex.: `vercel`, `semantic-release`, …).

O merge só acontece depois de `build`, `lint` e `e2e` passarem (branch protection).
Majors de frameworks (ex.: Astro) ficam para revisão manual.

## Como aplicar ou actualizar a proteção (gh CLI)

Requer permissões de **admin** no repositório:

```bash
gh api repos/sraphaz/SacredChants/branches/main/protection -X PUT --input .github/branch-protection-main.json
```

O ficheiro `branch-protection-main.json` descreve o payload. Se os checks não aparecerem no dropdown em Settings, os contextos podem ser `CI / build`, `CI / lint`, `CI / e2e` (editar o JSON e voltar a correr o comando).
