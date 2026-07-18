#Requires -Version 5.1
<#
.SYNOPSIS
  Valida coreografia de agentes runtime da solução (ex.: packages/ai-orchestrator/agents/).
.DESCRIPTION
  Checagens:
    - manifests *.agent.yaml para cada agente referenciado em rules;
    - co_activation: primary e with existem como manifest;
    - draft-generation: harness-runner antes de draft-writer;
    - compliance-guard presente em regras de entrega com escrita.
  Configuração em arah.config.yaml → runtime.path (opcional).
.EXAMPLE
  ./validate-solution-choreography.ps1
  ./validate-solution-choreography.ps1 -Json
#>
param(
    [switch]$Json,
    [switch]$Strict
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

. (Join-Path $Root 'scripts/agents/config-parser.ps1')
. (Join-Path $Root 'scripts/agents/choreography-parser.ps1')

$config = Get-ArahProjectConfig -Root $Root
$errors = @()
$warnings = @()

if (-not $config.runtime.path) {
    if ($Json) {
        [ordered]@{ ok = $true; skipped = $true; reason = 'runtime.path not configured' } | ConvertTo-Json
    } else {
        Write-Host 'validate-solution-choreography: skipped (no runtime.path in arah.config.yaml)'
    }
    exit 0
}

$runtimeDir = Join-Path $Root ($config.runtime.path -replace '/', [IO.Path]::DirectorySeparatorChar)
if (-not (Test-Path $runtimeDir)) {
    $errors += "runtime path not found: $($config.runtime.path)"
} else {
    $choreoFile = if ($config.runtime.choreography) { $config.runtime.choreography } else { 'choreography.yaml' }
    $choreoPath = Join-Path $runtimeDir $choreoFile
    if (-not (Test-Path $choreoPath)) {
        $errors += "missing runtime choreography: $choreoFile"
    } else {
        $raw = Get-Content $choreoPath -Raw
        $rules = Parse-ChoreographyRules -Raw $raw
        $coPairs = Parse-ChoreographyCoActivation -Raw $raw

        $manifestIds = @(
            Get-ChildItem $runtimeDir -Filter '*.agent.yaml' -ErrorAction SilentlyContinue |
                ForEach-Object {
                    $r = Get-Content $_.FullName -Raw
                    if ($r -match '(?m)^id:\s*(\S+)') { $Matches[1].Trim() } else { $_.BaseName -replace '\.agent$', '' }
                }
        ) | Select-Object -Unique

        foreach ($rule in $rules) {
            if ($rule.agents.Count -eq 0) {
                $errors += "runtime rule '$($rule.id)': no agents"
            }
            $agentIds = @($rule.agents | ForEach-Object { $_.id })
            foreach ($aid in $agentIds) {
                if ($manifestIds -notcontains $aid) {
                    $errors += "runtime rule '$($rule.id)': agent '$aid' missing manifest in $($config.runtime.path)"
                }
            }

            if ($rule.id -match 'draft') {
                if ($agentIds -notcontains 'harness-runner') {
                    $errors += "runtime rule '$($rule.id)': harness-runner required before draft-writer"
                }
                if ($agentIds -notcontains 'draft-writer') {
                    $warnings += "runtime rule '$($rule.id)': expected draft-writer"
                }
                if ($agentIds -contains 'harness-runner' -and $agentIds -contains 'draft-writer') {
                    $h = [array]::IndexOf($agentIds, 'harness-runner')
                    $d = [array]::IndexOf($agentIds, 'draft-writer')
                    if ($h -gt $d) {
                        $errors += "runtime rule '$($rule.id)': harness-runner must precede draft-writer"
                    }
                }
            }
        }

        foreach ($pair in $coPairs) {
            if ($manifestIds -notcontains $pair.primary) {
                $errors += "co_activation: primary '$($pair.primary)' missing manifest"
            }
            foreach ($w in @($pair.with)) {
                if ($w -and $manifestIds -notcontains $w) {
                    $errors += "co_activation: partner '$w' (primary $($pair.primary)) missing manifest"
                }
            }
        }

        if ($config.runtime.autonomy) {
            $autonomyPath = Join-Path $runtimeDir $config.runtime.autonomy
            if (-not (Test-Path $autonomyPath)) {
                $warnings += "runtime autonomy file missing: $($config.runtime.autonomy)"
            }
        }
    }
}

$ok = ($errors.Count -eq 0) -and (-not ($Strict -and $warnings.Count -gt 0))

if ($Json) {
    [ordered]@{
        ok       = $ok
        path     = $config.runtime.path
        errors   = @($errors)
        warnings = @($warnings)
    } | ConvertTo-Json -Depth 6
} else {
    Write-Host "Solution runtime choreography — $($config.runtime.path)"
    foreach ($w in $warnings) { Write-Warning $w }
    foreach ($e in $errors) { Write-Error $e -ErrorAction Continue }
    if ($ok) { Write-Host 'OK — runtime agents choreographed.' }
}

if (-not $ok) { exit 1 }
exit 0
