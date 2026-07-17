#Requires -Version 5.1
<#
.SYNOPSIS
  Simula eventos ARAH Live para testar a extensão sem depender de hooks do Cursor.
.EXAMPLE
  ./demo-live-session.ps1
  ./demo-live-session.ps1 -Subagent explore
#>
param(
    [string[]]$Files = @('apps/web/app/page.tsx', 'packages/core-cases/src/index.ts'),
    [string]$Subagent = 'explore'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Telemetry = Join-Path $PSScriptRoot 'session-telemetry.ps1'

Write-Host "ARAH Live demo → $Root"
Write-Host ""

& $Telemetry -Action session-start -HookInput '{"session_id":"demo-local"}'
Start-Sleep -Milliseconds 300

& $Telemetry -Action file-edit -ChangedFiles $Files
Start-Sleep -Milliseconds 300

& $Telemetry -Action subagent-start -HookInput "{`"subagent_type`":`"$Subagent`"}"
Start-Sleep -Milliseconds 300

$statePath = Join-Path $Root '.cursor/arah-live/state.json'
if (Test-Path $statePath) {
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    Write-Host "Estado gravado:"
    Write-Host "  regras:      $(($state.matched_rules) -join ', ')"
    Write-Host "  operacionais: $(($state.active_agents) -join ', ')"
    Write-Host "  dominio:     $(($state.active_domains) -join ', ')"
    Write-Host "  specialists: $(($state.active_specialists) -join ', ')"
    Write-Host "  subagentes:  $(($state.active_subagents.type) -join ', ')"
    Write-Host ""
    Write-Host "Abra no Cursor: icone ARAH → Live Session"
    Write-Host "Arquivo: .cursor/arah-live/state.json"
} else {
    Write-Error "state.json nao criado"
    exit 1
}
