#Requires -Version 5.1
<#
.SYNOPSIS
  Homeostase do biocomponente - regenera o harness no repositorio consumidor.
.DESCRIPTION
  Pipeline unificado:
    1) update kernel (opcional, via -UpdateKernel / harness path)
    2) domain sync
    3) discover
    4) organism bootstrap
    5) evolve
    5b) metrics rollup (Economy Intelligence)
    6) export-graph
    7) doctor
  Sugestoes ficam em docs/_meta/*.proposed.yaml para o repositorio evoluir.
.EXAMPLE
  ./regenerate-harness.ps1
  ./regenerate-harness.ps1 -UpdateKernel -HarnessRoot C:\arah-harness -Force
#>
param(
    [string]$HarnessRoot = '',
    [switch]$UpdateKernel,
    [switch]$Force,
    [switch]$ApplyDiscovery,
    [switch]$SkipDoctor,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$Agents = $PSScriptRoot
$PwshExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell' }

Write-Host "regenerate: organism homeostasis -> $Root"

# 0) Migrate execution_control if absent (preserve consumer overlays)
$cfgPath = Join-Path $Root 'arah.config.yaml'
if ((Test-Path -LiteralPath $cfgPath) -and -not $DryRun) {
    $cfgRaw = Get-Content -LiteralPath $cfgPath -Raw
    if ($cfgRaw -notmatch '(?m)^execution_control:') {
        $cfgRaw = $cfgRaw.TrimEnd() + @"


# Execution Control Protocol (added by regenerate — safe defaults)
execution_control:
  enabled: true
  terminal_states:
    - done
    - blocked
  limits:
    max_handoffs: 2
    max_consultations: 2
    max_analysis_cycles: 1
  behavior:
    require_primary_executor: true
    forbid_consultant_to_consultant_handoff: true
    require_completion_evidence: true
    require_blocking_reason: true
    prevent_reroute_after_execution_started: true
"@
        Set-Content -LiteralPath $cfgPath -Value $cfgRaw -Encoding UTF8
        Write-Host "regenerate: migrated execution_control into arah.config.yaml"
    }
    $cfgRaw = Get-Content -LiteralPath $cfgPath -Raw
    if ($cfgRaw -notmatch '(?m)^update_check:') {
        $cfgRaw = $cfgRaw.TrimEnd() + @"


# Harness update notifications (added by regenerate)
update_check:
  enabled: true
  repository: sraphaz/arah-harness
  notify:
    issue: true
    label: arah-harness-update
"@
        Set-Content -LiteralPath $cfgPath -Value $cfgRaw -Encoding UTF8
        Write-Host "regenerate: migrated update_check into arah.config.yaml"
    }
}
# Ensure update-check workflow present (do not overwrite custom consumer edits unless missing)
$updWf = Join-Path $Root '.github/workflows/harness-update-check.yml'
$updTpl = $null
if ($HarnessRoot) {
    $updTpl = Join-Path $HarnessRoot 'templates/github/workflows/harness-update-check.yml'
} elseif ($env:ARAH_HARNESS_PATH) {
    $updTpl = Join-Path $env:ARAH_HARNESS_PATH 'templates/github/workflows/harness-update-check.yml'
}
if (-not (Test-Path -LiteralPath $updWf) -and $updTpl -and (Test-Path -LiteralPath $updTpl) -and -not $DryRun) {
    $wfDir = Split-Path $updWf -Parent
    if (-not (Test-Path $wfDir)) { New-Item -ItemType Directory -Path $wfDir -Force | Out-Null }
    Copy-Item $updTpl $updWf -Force
    Write-Host "regenerate: installed .github/workflows/harness-update-check.yml"
}
foreach ($sub in @('active', 'completed', 'blocked')) {
    $d = Join-Path $Root ".arah/local/execution/$sub"
    if (-not (Test-Path -LiteralPath $d) -and -not $DryRun) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

function Invoke-Step {
    param([string]$Name, [scriptblock]$Block)
    Write-Host ""
    Write-Host "==> $Name"
    if ($DryRun) {
        Write-Host "[dry-run] $Name"
        return
    }
    & $Block
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "regenerate step failed: $Name (exit $LASTEXITCODE)"
    }
}

# 1) Kernel update (optional - requires harness clone)
if ($UpdateKernel) {
    Invoke-Step 'update kernel' {
        if (-not $HarnessRoot) {
            if ($env:ARAH_HARNESS_PATH) { $script:HarnessRoot = $env:ARAH_HARNESS_PATH }
        }
        if (-not $HarnessRoot) {
            Write-Warning 'UpdateKernel skipped: set -HarnessRoot or ARAH_HARNESS_PATH'
            return
        }
        $cli = Join-Path $HarnessRoot 'cli'
        $cli = Join-Path $cli 'arah.ps1'
        if (-not (Test-Path $cli)) { throw "Harness CLI not found: $cli" }
        & $PwshExe -NoProfile -ExecutionPolicy Bypass -File $cli update -Target $Root -Force:$Force
    }
}

# 2) Domain sync
Invoke-Step 'domain sync' {
    $script = Join-Path $Agents 'domain-sync.ps1'
    if (-not (Test-Path $script)) { throw 'domain-sync.ps1 missing - run arah init/update first' }
    $invokeArgs = @()
    if ($DryRun) { $invokeArgs += '-DryRun' }
    & $PwshExe -NoProfile -ExecutionPolicy Bypass -File $script @invokeArgs
}

# 3) Discover
Invoke-Step 'discover' {
    $script = Join-Path $Agents 'discover-repo.ps1'
    $invokeArgs = @()
    if ($ApplyDiscovery) { $invokeArgs += '-Apply' }
    if ($DryRun) { $invokeArgs += '-DryRun' }
    & $PwshExe -NoProfile -ExecutionPolicy Bypass -File $script @invokeArgs
}

# 4) Organism bootstrap
Invoke-Step 'organism bootstrap' {
    $script = Join-Path $Agents 'organism-bootstrap.ps1'
    $invokeArgs = @()
    if ($Force) { $invokeArgs += '-Force' }
    if ($DryRun) { $invokeArgs += '-DryRun' }
    & $PwshExe -NoProfile -ExecutionPolicy Bypass -File $script @invokeArgs
}

# 5) Evolve
Invoke-Step 'evolve' {
    $script = Join-Path $Agents 'evolve-harness.ps1'
    $invokeArgs = @()
    if ($DryRun) { $invokeArgs += '-DryRun' }
    & $PwshExe -NoProfile -ExecutionPolicy Bypass -File $script @invokeArgs
}

# 5b) Economy Intelligence scorecard
Invoke-Step 'metrics rollup' {
    $script = Join-Path $Agents 'metrics-rollup.ps1'
    if (-not (Test-Path $script)) {
        Write-Warning 'metrics-rollup.ps1 missing - skip'
        return
    }
    # -File argv (not call-operator array splat) — Mode ValidateSet-safe
    $invokeArgs = @('-Mode', 'rollup')
    if ($DryRun) { $invokeArgs += '-DryRun' }
    & $PwshExe -NoProfile -ExecutionPolicy Bypass -File $script @invokeArgs
}

# 6) Export graph
Invoke-Step 'export-graph' {
    $script = Join-Path $Agents 'export-agent-graph.ps1'
    if (-not (Test-Path $script)) {
        Write-Warning 'export-agent-graph.ps1 missing - skip'
        return
    }
    Push-Location $Root
    try { & $PwshExe -NoProfile -ExecutionPolicy Bypass -File $script } finally { Pop-Location }
}

# 7) Doctor
if (-not $SkipDoctor) {
    Invoke-Step 'doctor' {
        $validate = Join-Path $Agents 'validate-manifests.ps1'
        if (Test-Path $validate) {
            & $PwshExe -NoProfile -ExecutionPolicy Bypass -File $validate
        }
        if ($HarnessRoot -or $env:ARAH_HARNESS_PATH) {
            $hr = if ($HarnessRoot) { $HarnessRoot } else { $env:ARAH_HARNESS_PATH }
            $doctor = Join-Path $hr 'cli'
            $doctor = Join-Path $doctor 'doctor.ps1'
            if (Test-Path $doctor) {
                & $PwshExe -NoProfile -ExecutionPolicy Bypass -File $doctor -Target $Root
            }
        }
    }
}

Write-Host ""
Write-Host 'regenerate: complete'
Write-Host '  artifacts:'
Write-Host '    docs/_meta/discovery.proposed.yaml'
Write-Host '    docs/_meta/organism.manifest.yaml'
Write-Host '    docs/_meta/evolution.proposed.yaml'
Write-Host '    docs/_meta/agent-graph.generated.json'
Write-Host '    .arah/observability/summary.yaml (metrics scorecard)'
Write-Host '  review proposals -> PR -> human merge'

$record = Join-Path $Agents 'record-agent-event.ps1'
if ((Test-Path $record) -and -not $DryRun) {
    & $record -AgentId orchestrator -Action 'regenerate.homeostasis' -Outcome ok -AutonomyLevel activate -Details 'pipeline=ok' 2>$null
}

exit 0
