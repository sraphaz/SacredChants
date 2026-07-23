#Requires -Version 5.1
<#
.SYNOPSIS
  Ritual ontogênico - define células, tecidos e vias de sinalização do organismo ARAH.
.DESCRIPTION
  Primeiro momento de definição: lê agentes existentes + discovery.proposed.yaml
  e gera docs/_meta/organism.manifest.yaml. Não cria agentes novos; só declara
  o mapa vivo do repositório para comunicação e evolução.
.EXAMPLE
  ./organism-bootstrap.ps1
  ./organism-bootstrap.ps1 -Force
#>
param(
    [switch]$Force,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$MetaDir = Join-Path (Join-Path $Root 'docs') '_meta'
$OutFile = Join-Path $MetaDir 'organism.manifest.yaml'
$DiscoveryFile = Join-Path $MetaDir 'discovery.proposed.yaml'
$StateDir = Join-Path (Join-Path $Root '.arah') 'organism'
$StateFile = Join-Path $StateDir 'state.json'
$AgentsDir = Join-Path $Root '.agents'

. (Join-Path $PSScriptRoot 'config-parser.ps1')

if ((Test-Path $OutFile) -and -not $Force) {
    Write-Host "organism: manifest exists (use -Force to redefine) -> $OutFile"
    exit 0
}

function Get-AgentIdsFromDir {
    param([string]$Dir, [string]$Kind)
    if (-not (Test-Path $Dir)) { return @() }
    Get-ChildItem $Dir -Filter '*.agent.yaml' -File | ForEach-Object {
        $raw = Get-Content $_.FullName -Raw
        $id = if ($raw -match '(?m)^id:\s*(\S+)') { $Matches[1] } else { $_.BaseName -replace '\.agent$', '' }
        $name = if ($raw -match '(?m)^name:\s*(.+)$') { $Matches[1].Trim() } else { $id }
        [pscustomobject]@{ id = $id; name = $name; kind = $Kind; file = $_.FullName }
    }
}

$cells = @()
$cells += Get-AgentIdsFromDir -Dir $AgentsDir -Kind 'operational'
$cells += Get-AgentIdsFromDir -Dir (Join-Path $AgentsDir 'domain') -Kind 'domain'
$cells += Get-AgentIdsFromDir -Dir (Join-Path $AgentsDir 'specialists') -Kind 'specialist'

# Fallbacks if empty (fresh install before domain sync)
if ($cells.Count -eq 0) {
    foreach ($id in @('orchestrator', 'planner', 'backend', 'frontend', 'qa', 'pr-steward', 'spec-steward', 'solutions-architect', 'docs-steward', 'release', 'security')) {
        $cells += [pscustomobject]@{ id = $id; name = $id; kind = 'operational'; file = '' }
    }
}

$project = Split-Path $Root -Leaf
$cfgPath = Join-Path $Root 'arah.config.yaml'
if (Test-Path $cfgPath) {
    $raw = Get-Content $cfgPath -Raw
    if ($raw -match '(?m)^\s*name:\s*(\S+)') { $project = $Matches[1].Trim('"').Trim("'") }
}

$discoveryNote = if (Test-Path $DiscoveryFile) { 'present' } else { 'absent - run arah discover first for richer bootstrap' }

# Tissues (groups) - organic clusters
$tissues = @(
    @{
        id = 'delivery'
        purpose = 'Entregar mudanças via PR com qualidade'
        members = @('orchestrator', 'backend', 'frontend', 'qa', 'pr-steward')
        topic = 'delivery'
    },
    @{
        id = 'governance'
        purpose = 'Spec-before-work, gates e auditoria'
        members = @('spec-steward', 'solutions-architect', 'security', 'pr-steward')
        topic = 'governance'
    },
    @{
        id = 'craft'
        purpose = 'Qualidade estrutural e craft'
        members = @('clean-craft-advisor', 'test-architect', 'architecture-documenter', 'qa')
        topic = 'craft'
    },
    @{
        id = 'domain-sense'
        purpose = 'Pareceres de domínio e especialistas técnicos'
        members = @($cells | Where-Object { $_.kind -in @('domain', 'specialist') } | ForEach-Object { $_.id })
        topic = 'domain'
    }
)

# Filter tissue members to known cells
$cellIds = @($cells | ForEach-Object { $_.id })
$tissuesFiltered = @()
foreach ($t in $tissues) {
    $members = @($t.members | Where-Object { $_ -in $cellIds -or $_ -like '*-*' })
    # keep declared members even if not yet synced (domain advisors may appear after sync)
    $members = @($t.members | Select-Object -Unique)
    if ($members.Count -eq 0) { continue }
    $tissuesFiltered += @{ id = $t.id; purpose = $t.purpose; members = $members; topic = $t.topic }
}

$roleMap = @{
    orchestrator = 'roteia intenção -> célula'
    planner = 'traduz backlog em specs/issues'
    backend = 'implementa superfície de servidor'
    frontend = 'implementa superfície de cliente'
    qa = 'garante qualidade no PR'
    'pr-steward' = 'conduz PR até ready-for-merge'
    'spec-steward' = 'governa specs SDD'
    'solutions-architect' = 'ADRs e arquitetura'
    'docs-steward' = 'taxonomia e sync de docs'
    release = 'versão, CI/CD, IaC'
    security = 'deps, secrets, superfície de risco'
    'clean-craft-advisor' = 'parecer de craft/SOLID'
    'test-architect' = 'estratégia de testes'
    'architecture-documenter' = 'documentação arquitetural'
}

function Get-EmitTypes {
    param([string]$Kind)
    switch ($Kind) {
        'operational' { return @('attract', 'consult', 'propose', 'acknowledge', 'status') }
        'domain' { return @('consult', 'acknowledge', 'propose') }
        'specialist' { return @('consult', 'acknowledge', 'propose') }
        default { return @('status') }
    }
}

$ts = (Get-Date).ToUniversalTime().ToString('o')
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# Generated by organism-bootstrap.ps1 - first-moment definition')
[void]$sb.AppendLine('schema: arah-harness/organism')
[void]$sb.AppendLine('version: "0.1.0"')
[void]$sb.AppendLine("generated_at: $ts")
[void]$sb.AppendLine("project: $project")
[void]$sb.AppendLine('metaphor: |')
[void]$sb.AppendLine('  TechOrganism = organismo tecnológico. Agentes = células. Grupos = tecidos.')
[void]$sb.AppendLine('  Sinais tipados = comunicação química auditável. Evolução = seleção via PR.')
[void]$sb.AppendLine("discovery: $discoveryNote")
[void]$sb.AppendLine('cells:')
foreach ($c in $cells) {
    $role = if ($roleMap.ContainsKey($c.id)) { $roleMap[$c.id] } else { $c.name }
    $emit = Get-EmitTypes -Kind $c.kind
    $recv = @('attract', 'consult', 'acknowledge', 'coalesce', 'evolve', 'status')
    $maxA = if ($c.kind -eq 'operational') { 'activate' } else { 'consult' }
    [void]$sb.AppendLine("  - id: $($c.id)")
    [void]$sb.AppendLine("    kind: $($c.kind)")
    [void]$sb.AppendLine("    role: `"$role`"")
    [void]$sb.AppendLine("    max_autonomy: $maxA")
    [void]$sb.AppendLine('    can_emit:')
    foreach ($e in $emit) { [void]$sb.AppendLine("      - $e") }
    [void]$sb.AppendLine('    can_receive:')
    foreach ($r in $recv) { [void]$sb.AppendLine("      - $r") }
}
[void]$sb.AppendLine('tissues:')
foreach ($t in $tissuesFiltered) {
    [void]$sb.AppendLine("  - id: $($t.id)")
    [void]$sb.AppendLine("    purpose: `"$($t.purpose)`"")
    [void]$sb.AppendLine("    topic: $($t.topic)")
    [void]$sb.AppendLine('    members:')
    foreach ($m in $t.members) { [void]$sb.AppendLine("      - $m") }
}
[void]$sb.AppendLine('signaling:')
[void]$sb.AppendLine('  bus_path: .arah/local/bus/')
[void]$sb.AppendLine('  default_mode: passive')
[void]$sb.AppendLine('homeostasis:')
[void]$sb.AppendLine('  regenerate_command: arah regenerate')
[void]$sb.AppendLine('  doctor_command: arah doctor')
[void]$sb.AppendLine('  drift_check: arah sync-check')
[void]$sb.AppendLine('evolution:')
[void]$sb.AppendLine('  mode: propose_only')
[void]$sb.AppendLine('  artifact: docs/_meta/evolution.proposed.yaml')
[void]$sb.AppendLine('  human_gate: proposal_before_implementation')
[void]$sb.AppendLine('  forbidden:')
[void]$sb.AppendLine('    - silent_agent_spawn')
[void]$sb.AppendLine('    - silent_kernel_rewrite')
[void]$sb.AppendLine('    - auto_merge')

$content = $sb.ToString()

if ($DryRun) {
    Write-Host "[dry-run] would write $OutFile"
    Write-Host $content
    exit 0
}

if (-not (Test-Path $MetaDir)) { New-Item -ItemType Directory -Path $MetaDir -Force | Out-Null }
Set-Content -Path $OutFile -Value $content -Encoding UTF8

if (-not (Test-Path $StateDir)) { New-Item -ItemType Directory -Path $StateDir -Force | Out-Null }
$state = @{
    ts = $ts
    project = $project
    cells = $cells.Count
    tissues = $tissuesFiltered.Count
    status = 'bootstrapped'
    discovery = $discoveryNote
} | ConvertTo-Json -Compress
Set-Content -Path $StateFile -Value $state -Encoding UTF8

Write-Host "organism: bootstrapped -> $OutFile"
Write-Host "  cells: $($cells.Count)  tissues: $($tissuesFiltered.Count)"
Write-Host "  next: arah evolve | emit signals via signal-bus.ps1"

$record = Join-Path $PSScriptRoot 'record-agent-event.ps1'
if (Test-Path $record) {
    & $record -AgentId orchestrator -Action 'organism.bootstrap' -Outcome ok -AutonomyLevel route -Details "cells=$($cells.Count)" 2>$null
}

exit 0
