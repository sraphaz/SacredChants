#Requires -Version 5.1
# Hook passivo: grava pareceres de domínio em .cursor/domain-review.md
# Sem followup_message — economia de tokens (modelo ARAH)

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Script = Join-Path $Root 'scripts/agents/domain-autoreview.ps1'

if (Test-Path $Script) {
    & $Script
}

exit 0
