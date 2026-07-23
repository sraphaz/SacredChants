#Requires -Version 5.1
<#
.SYNOPSIS
  Barramento de sinais tipados entre células do organismo ARAH.
.DESCRIPTION
  Comunicação orgânica e auditável: arquivo-por-evento em
  .arah/local/bus/pending/<ULID>.json (estado quente). Tipos congelados
  (schema v0.2.0+): attract | consult | propose | acknowledge | coalesce | evolve | status.
  Campo obrigatório `v` no payload (compatibilidade aditiva).
.EXAMPLE
  ./signal-bus.ps1 -From orchestrator -SignalTo backend -SignalType attract -Topic delivery
  ./signal-bus.ps1 -List -Last 10
#>
param(
    [string]$From = '',
    [Alias('To')]
    [string]$SignalTo = '*',
    [ValidateSet('attract', 'consult', 'propose', 'acknowledge', 'coalesce', 'evolve', 'status', '')]
    [Alias('Type')]
    [string]$SignalType = '',
    [string]$Topic = 'general',
    [string]$Payload = '',
    [string]$CorrelationId = '',
    [ValidateSet('observe', 'consult', 'route', 'activate', 'invoke_skill', 'side_effect', 'public')]
    [string]$AutonomyLevel = 'consult',
    [switch]$List,
    [int]$Last = 20
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'arah-event-io.ps1')
$Root = Get-ArahRoot -FromScriptRoot $PSScriptRoot
$SignalSchemaVersion = 1

if ($List) {
    $lines = Read-ArahEvents -Root $Root -Kind bus -Last $Last
    if ($lines.Count -eq 0) {
        Write-Host 'signal-bus: empty (no signals yet)'
        exit 0
    }
    $lines | ForEach-Object { Write-Output $_ }
    exit 0
}

if (-not $From -or -not $SignalType) {
    Write-Error "Use: signal-bus.ps1 -From <cell> -SignalType <attract|consult|propose|...> [-SignalTo cell|tissue|*] [-Topic t] [-Payload json]"
    exit 1
}

$manifest = Join-Path (Join-Path (Join-Path $Root 'docs') '_meta') 'organism.manifest.yaml'
if (Test-Path $manifest) {
    $mraw = Get-Content $manifest -Raw
    if ($mraw -notmatch "(?m)^\s+- id:\s*$([regex]::Escape($From))\s*$") {
        Write-Warning "signal-bus: emitter '$From' not in organism.manifest.yaml (allowed for bootstrap)"
    }
}

if (-not $CorrelationId) {
    $CorrelationId = [guid]::NewGuid().ToString('N').Substring(0, 12)
}

$signalId = [guid]::NewGuid().ToString('N').Substring(0, 10)
$payloadObj = $null
if ($Payload) {
    $scrubbedPayload = Protect-ArahSecrets -Text $Payload
    try { $payloadObj = $scrubbedPayload | ConvertFrom-Json } catch { $payloadObj = @{ text = $scrubbedPayload } }
}

$event = [ordered]@{
    v               = $SignalSchemaVersion
    ts              = (Get-Date).ToUniversalTime().ToString('o')
    signal_id       = $signalId
    type            = $SignalType
    from            = $From
    to              = $SignalTo
    topic           = $Topic
    payload         = $payloadObj
    correlation_id  = $CorrelationId
    autonomy_level  = $AutonomyLevel
}

$path = Write-ArahEventFile -Root $Root -Kind bus -Event $event
Write-Host "signal-bus: $SignalType from=$From to=$SignalTo topic=$Topic id=$signalId file=$(Split-Path $path -Leaf)"

$diagDir = Join-Path (Join-Path $Root '.cursor') 'arah-live'
if ($SignalType -in @('propose', 'evolve', 'coalesce')) {
    if (-not (Test-Path $diagDir)) { New-Item -ItemType Directory -Path $diagDir -Force | Out-Null }
    $diag = Join-Path $diagDir 'diagnostics.jsonl'
    $line = Protect-ArahSecrets -Text (($event | ConvertTo-Json -Compress -Depth 6))
    Add-Content -Path $diag -Value $line -Encoding UTF8
}

$record = Join-Path $PSScriptRoot 'record-agent-event.ps1'
if (Test-Path $record) {
    & $record -AgentId $From -Action "signal.$SignalType" -Outcome ok -AutonomyLevel $AutonomyLevel -CorrelationId $CorrelationId -Details "to=$SignalTo;topic=$Topic" 2>$null
}

exit 0
