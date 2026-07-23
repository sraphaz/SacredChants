#Requires -Version 5.1
<#
.SYNOPSIS
  Economy Intelligence - agrega audit/live/signals em scorecard de eficiencia.
.DESCRIPTION
  Le estado quente (.arah/local/audit + bus + legado) e live, calcula totais,
  rates e semaphore, e escreve .arah/observability/summary.yaml
  (schema arah-harness/metrics-summary).
  Modo report imprime scorecard humano. -Digest grava docs/_meta/metrics.digest.md.
.EXAMPLE
  ./metrics-rollup.ps1
  ./metrics-rollup.ps1 -Mode report
  ./metrics-rollup.ps1 -Digest
#>
param(
    [ValidateSet('rollup', 'report')]
    [string]$Mode = 'rollup',

    [int]$Last = 500,

    [switch]$Digest,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'arah-event-io.ps1')
$Root = Get-ArahRoot -FromScriptRoot $PSScriptRoot
$LiveEvents = Join-Path (Join-Path (Join-Path $Root '.cursor') 'arah-live') 'events.jsonl'
$ObsDir = Join-Path (Join-Path $Root '.arah') 'observability'
$SummaryFile = Join-Path $ObsDir 'summary.yaml'
$MetaDir = Join-Path (Join-Path $Root 'docs') '_meta'
$DigestFile = Join-Path $MetaDir 'metrics.digest.md'

function Count-JsonlLines {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return 0 }
    return @(Get-Content -LiteralPath $Path | Where-Object { $_.Trim() }).Count
}

function Read-AuditEvents {
    param([int]$Max)
    $events = @()
    $lines = @(Read-ArahEvents -Root $Root -Kind audit -Last $Max)
    foreach ($line in $lines) {
        try {
            $events += ($line | ConvertFrom-Json)
        } catch { }
    }
    return $events
}

function Get-PropInt {
    param($Obj, [string]$Name)
    if ($null -eq $Obj) { return 0 }
    $p = $Obj.PSObject.Properties[$Name]
    if ($null -eq $p -or $null -eq $p.Value -or "$($p.Value)" -eq '') { return 0 }
    try { return [int]$p.Value } catch { return 0 }
}

function Get-PropDouble {
    param($Obj, [string]$Name)
    if ($null -eq $Obj) { return 0.0 }
    $p = $Obj.PSObject.Properties[$Name]
    if ($null -eq $p -or $null -eq $p.Value -or "$($p.Value)" -eq '') { return 0.0 }
    try { return [double]$p.Value } catch { return 0.0 }
}

function Format-Rate {
    param([double]$Value)
    return ('{0:N3}' -f $Value).Replace(',', '.')
}

$project = Split-Path $Root -Leaf
$cfgPath = Join-Path $Root 'arah.config.yaml'
if (Test-Path -LiteralPath $cfgPath) {
    $raw = Get-Content -LiteralPath $cfgPath -Raw
    if ($raw -match '(?m)^\s*name:\s*(\S+)') {
        $project = $Matches[1].Trim('"').Trim("'")
    }
}

$auditTotal = Get-ArahEventCount -Root $Root -Kind audit
$signalCount = Get-ArahEventCount -Root $Root -Kind bus
$liveCount = Count-JsonlLines $LiveEvents
$events = @(Read-AuditEvents -Max $Last)
$n = $events.Count

$byOutcome = @{ ok = 0; blocked = 0; denied = 0; error = 0; pending = 0 }
$byAgent = @{}
$byAction = @{}
$correlations = @{}
$tokensIn = 0
$tokensOut = 0
$costUsd = 0.0
$tokensObserved = $false
$lastAgent = ''
$lastAction = ''
$lastOutcome = ''

foreach ($e in $events) {
    $outcome = if ($e.outcome) { [string]$e.outcome } else { 'ok' }
    if (-not $byOutcome.ContainsKey($outcome)) { $byOutcome[$outcome] = 0 }
    $byOutcome[$outcome]++

    $agent = if ($e.agent_id) { [string]$e.agent_id } else { 'unknown' }
    if (-not $byAgent.ContainsKey($agent)) {
        $byAgent[$agent] = @{ events = 0; blocked = 0; tokens_in = 0; tokens_out = 0; cost_usd = 0.0 }
    }
    $byAgent[$agent].events++
    if ($outcome -in @('blocked', 'denied')) { $byAgent[$agent].blocked++ }

    $action = if ($e.action) { [string]$e.action } else { 'unknown' }
    if (-not $byAction.ContainsKey($action)) { $byAction[$action] = 0 }
    $byAction[$action]++

    if ($e.correlation_id) { $correlations[[string]$e.correlation_id] = $true }

    $tin = Get-PropInt $e 'tokens_in'
    $tout = Get-PropInt $e 'tokens_out'
    $cost = Get-PropDouble $e 'cost_usd'
    if ($tin -gt 0 -or $tout -gt 0 -or $cost -gt 0) { $tokensObserved = $true }
    $tokensIn += $tin
    $tokensOut += $tout
    $costUsd += $cost
    $byAgent[$agent].tokens_in += $tin
    $byAgent[$agent].tokens_out += $tout
    $byAgent[$agent].cost_usd += $cost

    $lastAgent = $agent
    $lastAction = $action
    $lastOutcome = $outcome
}

$blockedCombo = $byOutcome['blocked'] + $byOutcome['denied']
$okRate = if ($n -gt 0) { [double]$byOutcome['ok'] / $n } else { 0.0 }
$blockedRate = if ($n -gt 0) { [double]$blockedCombo / $n } else { 0.0 }
$errorRate = if ($n -gt 0) { [double]$byOutcome['error'] / $n } else { 0.0 }
$uniqueCorr = @($correlations.Keys).Count

$roiHints = New-Object System.Collections.Generic.List[string]
$semaphore = 'insufficient_data'
$rationale = 'Ledger fino (<5 eventos) - insuficientes para julgar eficiencia.'

$hasOrganismActions = $false
foreach ($ak in $byAction.Keys) {
    if ($ak -match 'evolve|propose|discover|organism|signal') { $hasOrganismActions = $true; break }
}

if ($n -ge 5) {
    if ($blockedRate -ge 0.25 -or $errorRate -ge 0.15) {
        $semaphore = 'expensive'
        $rationale = 'Alta friccao (blocked/error). Harness pode estar custando mais do que entrega.'
    }
    elseif ($blockedRate -le 0.10 -and $okRate -ge 0.75 -and ($signalCount -gt 0 -or $hasOrganismActions)) {
        $semaphore = 'productive'
        $rationale = 'Alta taxa de ok, pouca friccao e sinais de ciclo TechOrganism em uso.'
    }
    else {
        $semaphore = 'neutral'
        $rationale = 'Atividade presente sem friccao extrema - monitore tendencias.'
    }

    if ($blockedRate -gt 0.10) {
        [void]$roiHints.Add(("blocked_rate={0}: revisar human_gates e autonomia frequentes" -f (Format-Rate $blockedRate)))
    }
    if ($errorRate -gt 0.05) {
        [void]$roiHints.Add(("error_rate={0}: investigar falhas de skill/script" -f (Format-Rate $errorRate)))
    }
    if ($uniqueCorr -gt 0 -and $n -gt ($uniqueCorr * 15)) {
        [void]$roiHints.Add('muitos eventos por correlation_id - possivel turn storm; reforcar modo passivo')
    }
    if (-not $tokensObserved) {
        [void]$roiHints.Add('tokens nao observados - score usa proxies (outcomes/turns); plugar usage quando disponivel (M2)')
    }
    else {
        $avgOut = if ($n -gt 0) { [int]($tokensOut / $n) } else { 0 }
        if ($avgOut -gt 8000) {
            [void]$roiHints.Add("tokens_out medios altos ($avgOut/evento) - revisar skills caras e co-ativacao")
        }
    }
    $proposeLike = @($byAction.Keys | Where-Object { $_ -match 'propose|evolve|discover' })
    if ($proposeLike.Count -eq 0 -and $n -ge 10) {
        [void]$roiHints.Add('muitos eventos sem propose/evolve/discover - ciclo organismico pouco exercitado')
    }
    if ($roiHints.Count -eq 0) {
        [void]$roiHints.Add('sem alertas fortes - manter regenerate periodico e observabilidade')
    }
}
else {
    [void]$roiHints.Add('coletar mais eventos (audit/live) antes de decidir se o harness vale a pena')
}

$ts = (Get-Date).ToUniversalTime().ToString('o')
$costStr = [string]::Format([System.Globalization.CultureInfo]::InvariantCulture, '{0:0.####}', $costUsd)
$topAgents = @($byAgent.Keys | Sort-Object { $byAgent[$_].events } -Descending)
$topActions = @($byAction.Keys | Sort-Object { $byAction[$_] } -Descending | Select-Object -First 20)

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# Generated by metrics-rollup.ps1 - Economy Intelligence scorecard')
[void]$sb.AppendLine('schema: arah-harness/metrics-summary')
[void]$sb.AppendLine("generated_at: $ts")
[void]$sb.AppendLine("updated_at: $ts")
[void]$sb.AppendLine("project: $project")
[void]$sb.AppendLine('window:')
[void]$sb.AppendLine("  audit_events: $auditTotal")
[void]$sb.AppendLine("  signals: $signalCount")
[void]$sb.AppendLine("  live_events: $liveCount")
[void]$sb.AppendLine("  last_n: $Last")
[void]$sb.AppendLine('totals:')
[void]$sb.AppendLine("  events: $n")
[void]$sb.AppendLine("  ok: $($byOutcome['ok'])")
[void]$sb.AppendLine("  blocked: $($byOutcome['blocked'])")
[void]$sb.AppendLine("  denied: $($byOutcome['denied'])")
[void]$sb.AppendLine("  error: $($byOutcome['error'])")
[void]$sb.AppendLine("  pending: $($byOutcome['pending'])")
[void]$sb.AppendLine("  tokens_in: $tokensIn")
[void]$sb.AppendLine("  tokens_out: $tokensOut")
[void]$sb.AppendLine("  cost_usd: $costStr")
[void]$sb.AppendLine("  tokens_observed: $($tokensObserved.ToString().ToLower())")
[void]$sb.AppendLine('efficiency:')
[void]$sb.AppendLine("  blocked_rate: $(Format-Rate $blockedRate)")
[void]$sb.AppendLine("  error_rate: $(Format-Rate $errorRate)")
[void]$sb.AppendLine("  ok_rate: $(Format-Rate $okRate)")
[void]$sb.AppendLine("  unique_correlations: $uniqueCorr")
[void]$sb.AppendLine("  semaphore: $semaphore")
[void]$sb.AppendLine("  rationale: `"$($rationale -replace '"', '''')`"")
[void]$sb.AppendLine('by_outcome:')
foreach ($k in @('ok', 'blocked', 'denied', 'error', 'pending')) {
    [void]$sb.AppendLine("  ${k}: $($byOutcome[$k])")
}
[void]$sb.AppendLine('by_agent:')
foreach ($a in $topAgents) {
    $row = $byAgent[$a]
    [void]$sb.AppendLine("  `"$a`":")
    [void]$sb.AppendLine("    events: $($row.events)")
    [void]$sb.AppendLine("    blocked: $($row.blocked)")
    [void]$sb.AppendLine("    tokens_in: $($row.tokens_in)")
    [void]$sb.AppendLine("    tokens_out: $($row.tokens_out)")
}
[void]$sb.AppendLine('by_action:')
foreach ($a in $topActions) {
    [void]$sb.AppendLine("  `"$($a -replace '"', '''')`": $($byAction[$a])")
}
[void]$sb.AppendLine('roi_hints:')
foreach ($h in $roiHints) {
    [void]$sb.AppendLine("  - `"$($h -replace '"', '''')`"")
}
[void]$sb.AppendLine("total_events: $n")
[void]$sb.AppendLine("last_agent: $lastAgent")
[void]$sb.AppendLine("last_action: $lastAction")
[void]$sb.AppendLine("last_outcome: $lastOutcome")

$yaml = $sb.ToString()

if ($DryRun) {
    Write-Host "[dry-run] would write $SummaryFile"
    Write-Host $yaml
    exit 0
}

if (-not (Test-Path -LiteralPath $ObsDir)) {
    New-Item -ItemType Directory -Path $ObsDir -Force | Out-Null
}
$utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($SummaryFile, $yaml, $utf8Bom)
if ($Mode -eq 'rollup') {
    Write-Host "metrics: wrote $SummaryFile (events=$n semaphore=$semaphore)"
}

if ($Digest) {
    if (-not (Test-Path -LiteralPath $MetaDir)) {
        New-Item -ItemType Directory -Path $MetaDir -Force | Out-Null
    }
    $md = New-Object System.Text.StringBuilder
    [void]$md.AppendLine('# Metrics digest - Economy Intelligence')
    [void]$md.AppendLine('')
    [void]$md.AppendLine("Generated: $ts")
    [void]$md.AppendLine("Project: $project")
    [void]$md.AppendLine('')
    [void]$md.AppendLine("## Semaphore: **$semaphore**")
    [void]$md.AppendLine('')
    [void]$md.AppendLine($rationale)
    [void]$md.AppendLine('')
    [void]$md.AppendLine('| Metric | Value |')
    [void]$md.AppendLine('|--------|-------|')
    [void]$md.AppendLine("| Audit events (window) | $n / $auditTotal |")
    [void]$md.AppendLine("| Signals | $signalCount |")
    [void]$md.AppendLine("| Live events | $liveCount |")
    [void]$md.AppendLine("| ok / blocked / error | $($byOutcome['ok']) / $($byOutcome['blocked']) / $($byOutcome['error']) |")
    [void]$md.AppendLine("| blocked_rate | $(Format-Rate $blockedRate) |")
    [void]$md.AppendLine("| ok_rate | $(Format-Rate $okRate) |")
    [void]$md.AppendLine("| tokens_in / tokens_out | $tokensIn / $tokensOut |")
    [void]$md.AppendLine("| cost_usd | $costStr |")
    [void]$md.AppendLine("| tokens_observed | $tokensObserved |")
    [void]$md.AppendLine('')
    [void]$md.AppendLine('## ROI hints')
    [void]$md.AppendLine('')
    foreach ($h in $roiHints) { [void]$md.AppendLine("- $h") }
    [void]$md.AppendLine('')
    [void]$md.AppendLine('_Runtime summary: `.arah/observability/summary.yaml` (gitignored). This digest is optional to version._')
    [System.IO.File]::WriteAllText($DigestFile, $md.ToString(), $utf8Bom)
    Write-Host "metrics: wrote digest $DigestFile"
}

if ($Mode -eq 'report') {
    Write-Host ''
    Write-Host '=== ARAH Economy Intelligence ==='
    Write-Host "project:     $project"
    Write-Host "semaphore:   $semaphore"
    Write-Host "rationale:   $rationale"
    Write-Host "events:      $n (audit_total=$auditTotal signals=$signalCount live=$liveCount)"
    Write-Host "outcomes:    ok=$($byOutcome['ok']) blocked=$($byOutcome['blocked']) denied=$($byOutcome['denied']) error=$($byOutcome['error'])"
    Write-Host "rates:       blocked=$(Format-Rate $blockedRate) ok=$(Format-Rate $okRate) error=$(Format-Rate $errorRate)"
    Write-Host "tokens:      in=$tokensIn out=$tokensOut cost_usd=$costStr observed=$tokensObserved"
    Write-Host 'roi_hints:'
    foreach ($h in $roiHints) { Write-Host "  - $h" }
    if ($topAgents.Count -gt 0) {
        Write-Host 'top_agents:'
        foreach ($a in ($topAgents | Select-Object -First 5)) {
            Write-Host "  - $a events=$($byAgent[$a].events) blocked=$($byAgent[$a].blocked)"
        }
    }
    Write-Host "summary:     $SummaryFile"
}

exit 0
