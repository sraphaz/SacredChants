#Requires -Version 5.1
<#
.SYNOPSIS
  Compacta eventos pending (arquivo-por-evento) em JSONL por período.
.DESCRIPTION
  Move .arah/local/<bus|audit>/pending/*.json → archive/YYYY-MM.jsonl
  Retenção configurável: -RetainDays (default 90) apaga archives mais antigos.
.EXAMPLE
  ./compact-state.ps1
  ./compact-state.ps1 -Kind bus -RetainDays 30 -DryRun
#>
param(
    [ValidateSet('all', 'bus', 'audit')]
    [string]$Kind = 'all',
    [int]$RetainDays = 90,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'arah-event-io.ps1')
$Root = Get-ArahRoot -FromScriptRoot $PSScriptRoot

function Compact-Kind {
    param([string]$K)
    $pending = Get-ArahPendingDir -Root $Root -Kind $K
    $archive = Get-ArahArchiveDir -Root $Root -Kind $K
    if (-not (Test-Path -LiteralPath $pending)) {
        Write-Host "compact: $K — nothing pending"
        return 0
    }
    $files = @(Get-ChildItem -LiteralPath $pending -Filter '*.json' -ErrorAction SilentlyContinue)
    if ($files.Count -eq 0) {
        Write-Host "compact: $K — nothing pending"
        return 0
    }

    $byMonth = @{}
    foreach ($f in $files) {
        try {
            $obj = Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json
            $ts = if ($obj.ts) { [datetime]$obj.ts } else { $f.LastWriteTimeUtc }
        } catch {
            $ts = $f.LastWriteTimeUtc
        }
        $key = $ts.ToUniversalTime().ToString('yyyy-MM')
        if (-not $byMonth.ContainsKey($key)) { $byMonth[$key] = New-Object System.Collections.Generic.List[object] }
        [void]$byMonth[$key].Add($f)
    }

    $moved = 0
    if (-not (Test-Path -LiteralPath $archive)) {
        if (-not $DryRun) { New-Item -ItemType Directory -Path $archive -Force | Out-Null }
    }

    foreach ($month in ($byMonth.Keys | Sort-Object)) {
        $dest = Join-Path $archive ($month + '.jsonl')
        Write-Host "compact: $K → $dest ($($byMonth[$month].Count) events)"
        foreach ($f in $byMonth[$month]) {
            $line = (Get-Content -LiteralPath $f.FullName -Raw).Trim()
            $line = Protect-ArahSecrets -Text $line
            if ($DryRun) {
                $moved++
                continue
            }
            Add-Content -LiteralPath $dest -Value $line -Encoding UTF8
            Remove-Item -LiteralPath $f.FullName -Force
            $moved++
        }
    }
    return $moved
}

function Enforce-Retention {
    param([string]$K)
    if ($RetainDays -le 0) { return }
    $archive = Get-ArahArchiveDir -Root $Root -Kind $K
    if (-not (Test-Path -LiteralPath $archive)) { return }
    $cutoff = (Get-Date).ToUniversalTime().AddDays(-$RetainDays)
    Get-ChildItem -LiteralPath $archive -Filter '*.jsonl' | ForEach-Object {
        if ($_.Name -match '^(\d{4})-(\d{2})\.jsonl$') {
            $monthStart = Get-Date -Year ([int]$Matches[1]) -Month ([int]$Matches[2]) -Day 1
            if ($monthStart -lt $cutoff) {
                Write-Host "compact: retain — remove $($_.Name) (older than $RetainDays days)"
                if (-not $DryRun) { Remove-Item -LiteralPath $_.FullName -Force }
            }
        }
    }
}

$kinds = if ($Kind -eq 'all') { @('bus', 'audit') } else { @($Kind) }
$total = 0
foreach ($k in $kinds) {
    $total += Compact-Kind -K $k
    Enforce-Retention -K $k
}
Write-Host "compact: done ($total events)$($(if ($DryRun) { ' [dry-run]' } else { '' }))"
exit 0
