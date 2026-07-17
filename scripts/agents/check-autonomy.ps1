#Requires -Version 5.1
<#
.SYNOPSIS
  Verifica se ação é permitida pela autonomia do agente e gates humanos.
.EXAMPLE
  ./check-autonomy.ps1 -AgentId release -Action release.cut
  ./check-autonomy.ps1 -AgentId backend -Action skill.invoke -Json
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$AgentId,

    [Parameter(Mandatory = $true)]
    [string]$Action,

    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$AutonomyFile = Join-Path $RepoRoot '.agents\autonomy.yaml'

$ranks = @{
    observe = 0; consult = 1; route = 2; activate = 3
    invoke_skill = 4; side_effect = 5; public = 6
}

$maxAutonomy = 'activate'
if (Test-Path $AutonomyFile) {
    $raw = Get-Content $AutonomyFile -Raw
    if ($raw -match "(?m)^\s+$([regex]::Escape($AgentId)):\s*(\S+)") {
        $maxAutonomy = $Matches[1]
    }
}

$actionLevel = @{
    'session.read' = 'observe'
    'domain.consult' = 'consult'
    'route.handoff' = 'route'
    'session.write' = 'activate'
    'skill.invoke' = 'invoke_skill'
    'pr.comment' = 'activate'
    'release.cut' = 'side_effect'
    'deploy.trigger' = 'side_effect'
}

$required = if ($actionLevel.ContainsKey($Action)) { $actionLevel[$Action] } else { 'activate' }
$allowed = $ranks[$maxAutonomy] -ge $ranks[$required]

$actionGates = @{
    'release.cut' = @('release_approval')
    'deploy.trigger' = @('release_approval', 'destructive')
    'skill.invoke' = @('spec_before_work')
}

$gates = @()
if ($actionGates.ContainsKey($Action)) { $gates = @($actionGates[$Action]) }

$gateStatus = @{}
$ledgerPath = Join-Path $RepoRoot '.arah\approvals.yaml'
if (Test-Path $ledgerPath) {
    $ap = Get-Content $ledgerPath -Raw
    foreach ($g in $gates) {
        if ($ap -match "(?m)^\s+$g`:\s*approved") { $gateStatus[$g] = $true }
        else { $gateStatus[$g] = $false }
    }
} else {
    foreach ($g in $gates) { $gateStatus[$g] = $false }
}

$blockingGates = @($gates | Where-Object { -not $gateStatus[$_] })
$finalAllowed = $allowed -and ($blockingGates.Count -eq 0)

$result = [ordered]@{
    agent_id = $AgentId
    action = $Action
    max_autonomy = $maxAutonomy
    required_level = $required
    autonomy_allowed = $allowed
    gates_required = $gates
    gates_blocking = $blockingGates
    allowed = $finalAllowed
}

$recordScript = Join-Path $RepoRoot 'scripts\agents\record-agent-event.ps1'
if (-not $finalAllowed -and (Test-Path $recordScript)) {
    & $recordScript -AgentId $AgentId -Action $Action -Outcome 'blocked' `
        -AutonomyLevel $maxAutonomy -Details ($result | ConvertTo-Json -Compress) -Blocked
}

if ($Json) { $result | ConvertTo-Json -Depth 5 }
else {
    if ($finalAllowed) { Write-Host "ALLOWED: $AgentId → $Action" -ForegroundColor Green }
    else {
        Write-Host "BLOCKED: $AgentId → $Action" -ForegroundColor Red
        if (-not $allowed) { Write-Host "  Insufficient autonomy (max: $maxAutonomy, need: $required)" }
        if ($blockingGates.Count -gt 0) { Write-Host "  Pending gates: $($blockingGates -join ', ')" }
    }
}
if (-not $finalAllowed) { exit 1 }
