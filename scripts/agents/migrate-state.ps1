#Requires -Version 5.1
<#
.SYNOPSIS
  Migra estado legado (JSONL versionável) para modelo quente/frio.
.DESCRIPTION
  1. Move .arah/bus/signals.jsonl e .arah/audit/events.jsonl → pending arquivo-por-evento
  2. Compacta pending em archive
  3. Escreve resumo frio em docs/_meta/runs/<run-id>/summary.json (versionável)
.EXAMPLE
  ./migrate-state.ps1
  ./migrate-state.ps1 -DryRun
#>
param(
    [switch]$DryRun,
    [switch]$SkipCompact
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'arah-event-io.ps1')
$Root = Get-ArahRoot -FromScriptRoot $PSScriptRoot
$runId = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss') + '-' + (New-ArahUlid).Substring(20, 6).ToLowerInvariant()

function Migrate-LegacyJsonl {
    param(
        [ValidateSet('bus', 'audit')]
        [string]$Kind
    )
    $legacy = Get-ArahLegacyJsonl -Root $Root -Kind $Kind
    if (-not (Test-Path -LiteralPath $legacy)) {
        Write-Host "migrate-state: $Kind — no legacy file"
        return 0
    }
    $lines = @(Get-Content -LiteralPath $legacy | Where-Object { $_.Trim() })
    Write-Host "migrate-state: $Kind — $($lines.Count) legacy lines → pending"
    $n = 0
    foreach ($line in $lines) {
        $scrubbed = Protect-ArahSecrets -Text $line
        try {
            $obj = $scrubbed | ConvertFrom-Json
            $ht = @{}
            $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
            if (-not $ht.ContainsKey('v')) { $ht['v'] = 1 }
        } catch {
            $ht = @{ v = 1; ts = (Get-Date).ToUniversalTime().ToString('o'); raw = $scrubbed; migrated = $true }
        }
        if (-not $DryRun) {
            [void](Write-ArahEventFile -Root $Root -Kind $Kind -Event $ht)
        }
        $n++
    }
    if (-not $DryRun) {
        $bak = $legacy + '.migrated-' + $runId
        Move-Item -LiteralPath $legacy -Destination $bak -Force
        Write-Host "migrate-state: $Kind — legacy renamed to $(Split-Path $bak -Leaf)"
    }
    return $n
}

$busN = Migrate-LegacyJsonl -Kind bus
$auditN = Migrate-LegacyJsonl -Kind audit

if (-not $SkipCompact -and -not $DryRun) {
    $compact = Join-Path $PSScriptRoot 'compact-state.ps1'
    & $compact -Kind all
}

$runsDir = Join-Path (Join-Path (Join-Path $Root 'docs') '_meta') 'runs'
$runDir = Join-Path $runsDir $runId
if (-not $DryRun) {
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
}

$summary = [ordered]@{
    v            = 1
    run_id       = $runId
    migrated_at  = (Get-Date).ToUniversalTime().ToString('o')
    model        = 'hot-local / cold-summary'
    hot_root     = '.arah/local/'
    cold_root    = 'docs/_meta/runs/'
    counts       = @{
        bus_migrated   = $busN
        audit_migrated = $auditN
        bus_total      = if ($DryRun) { $busN } else { Get-ArahEventCount -Root $Root -Kind bus }
        audit_total    = if ($DryRun) { $auditN } else { Get-ArahEventCount -Root $Root -Kind audit }
    }
    notes        = @(
        'Operational signals live under .arah/local/ (gitignored).'
        'This summary is cold evidence suitable for version control.'
        'Decision events and PR-linked evidence should be attached to PRs, not interleaved with code diffs.'
    )
}

$summaryJson = $summary | ConvertTo-Json -Depth 6
if ($DryRun) {
    Write-Host "migrate-state: dry-run summary would write to docs/_meta/runs/$runId/summary.json"
    Write-Host $summaryJson
} else {
    $out = Join-Path $runDir 'summary.json'
    Set-Content -LiteralPath $out -Value $summaryJson -Encoding UTF8
    Write-Host "migrate-state: cold summary → $out"
}

Write-Host "migrate-state: done$($(if ($DryRun) { ' [dry-run]' } else { '' }))"
exit 0
