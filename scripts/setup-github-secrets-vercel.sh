#!/usr/bin/env bash
# Cria os secrets do GitHub Actions necessários para o deploy Vercel via CI.
# Requer: gh CLI instalado e autenticado (gh auth login).
# Uso:
#   export VERCEL_TOKEN="..."
#   export VERCEL_ORG_ID="..."
#   export VERCEL_PROJECT_ID="..."
#   ./scripts/setup-github-secrets-vercel.sh
# Ou no Windows (PowerShell): ver instruções em docs/DEPLOY-VERCEL-APP.md

set -e

REPO="${GITHUB_REPO:-}"
if [ -z "$REPO" ]; then
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
fi
if [ -z "$REPO" ]; then
  echo "Não foi possível detetar o repo. Exporta GITHUB_REPO (ex: owner/repo) ou corre dentro do repo com 'gh' configurado."
  exit 1
fi

missing=0
for name in VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID; do
  val="${!name}"
  if [ -z "$val" ]; then
    echo "Missing: $name (exporta antes de correr o script)"
    missing=1
  fi
done
if [ "$missing" -eq 1 ]; then
  echo ""
  echo "Obter valores:"
  echo "  VERCEL_TOKEN   → Vercel: Account/Team → Settings → Tokens (Create)"
  echo "  VERCEL_ORG_ID  → Vercel: Project → Settings → General (Organization ID)"
  echo "  VERCEL_PROJECT_ID → Vercel: Project → Settings → General (Project ID)"
  echo "  Ou em .vercel/project.json após 'vercel link'"
  exit 1
fi

echo "A definir secrets no repo: $REPO"
echo -n "$VERCEL_TOKEN"   | gh secret set VERCEL_TOKEN    --repo "$REPO"
echo -n "$VERCEL_ORG_ID"  | gh secret set VERCEL_ORG_ID   --repo "$REPO"
echo -n "$VERCEL_PROJECT_ID" | gh secret set VERCEL_PROJECT_ID --repo "$REPO"
echo "Secrets definidos: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID"
