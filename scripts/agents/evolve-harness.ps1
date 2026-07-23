#Requires -Version 5.1
<#
.SYNOPSIS
  Ciclo de autoaprendizado - propõe melhorias a partir de auditoria, sinais e telemetria.
.DESCRIPTION
  Consome estado quente (.arah/local/... + legado jsonl) e .cursor/arah-live/
  para gerar docs/_meta/evolution.proposed.yaml. Com -Apply, emite sinal e
  opcionalmente reforça overlays locais - nunca reescreve o kernel em silêncio.
.EXAMPLE
  ./evolve-harness.ps1
  ./evolve-harness.ps1 -Apply
#>
param(
    [switch]$Apply,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'arah-event-io.ps1')
$Root = Get-ArahRoot -FromScriptRoot $PSScriptRoot
$MetaDir = Join-Path (Join-Path $Root 'docs') '_meta'
$OutFile = Join-Path $MetaDir 'evolution.proposed.yaml'
$LiveEvents = Join-Path (Join-Path (Join-Path $Root '.cursor') 'arah-live') 'events.jsonl'
$SummaryFile = Join-Path (Join-Path (Join-Path $Root '.arah') 'observability') 'summary.yaml'
$DiscoveryFile = Join-Path $MetaDir 'discovery.proposed.yaml'
$OrganismFile = Join-Path $MetaDir 'organism.manifest.yaml'
$SkillsDir = Join-Path $Root '.skills'
$ChoreoFile = Join-Path (Join-Path $Root '.agents') 'choreography.yaml'

# Refresh Economy Intelligence scorecard when possible (fail-open)
$metricsScript = Join-Path $PSScriptRoot 'metrics-rollup.ps1'
if (Test-Path -LiteralPath $metricsScript) {
    try {
        & $metricsScript -Mode rollup 2>$null | Out-Null
    } catch { }
}

function Count-Jsonl {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return 0 }
    return @(Get-Content $Path | Where-Object { $_.Trim() }).Count
}

function Read-EventActions {
    param([string[]]$Lines)
    $actions = @()
    foreach ($line in $Lines) {
        try {
            $o = $line | ConvertFrom-Json
            if ($o.action) { $actions += [string]$o.action }
            elseif ($o.type) { $actions += [string]$o.type }
        } catch { }
    }
    return $actions
}

$auditCount = Get-ArahEventCount -Root $Root -Kind audit
$signalCount = Get-ArahEventCount -Root $Root -Kind bus
$liveCount = Count-Jsonl $LiveEvents
$actions = @()
$actions += Read-EventActions (Read-ArahEvents -Root $Root -Kind audit -Last 200)
$actions += Read-EventActions (Read-ArahEvents -Root $Root -Kind bus -Last 200)
$liveLines = @()
if (Test-Path $LiveEvents) { $liveLines = @(Get-Content $LiveEvents | Select-Object -Last 200) }
$actions += Read-EventActions $liveLines

$freq = @{}
foreach ($a in $actions) {
    if (-not $freq.ContainsKey($a)) { $freq[$a] = 0 }
    $freq[$a]++
}

$proposals = @()
$propSeq = 1

function Add-Proposal {
    param(
        [string]$Kind,
        [string]$Target,
        [string]$Change,
        [string]$Rationale,
        [string]$Confidence = 'medium',
        [string[]]$Evidence = @()
    )
    $script:proposals += [ordered]@{
        id = ('EVO-{0:D3}' -f $script:propSeq)
        kind = $Kind
        target = $Target
        change = $Change
        rationale = $Rationale
        confidence = $Confidence
        evidence = $Evidence
        human_gate = 'proposal_before_implementation'
    }
    $script:propSeq++
}

# Heuristic 1: blocked/denied actions -> skill or autonomy proposal
$blocked = @($actions | Where-Object { $_ -match 'blocked|denied' })
if ($blocked.Count -gt 0) {
    Add-Proposal -Kind 'workflow' -Target '.agents/autonomy.yaml' `
        -Change 'Revisar gates/human_gates para ações frequentemente bloqueadas; documentar caminho de aprovação.' `
        -Rationale "Detectados $($blocked.Count) eventos blocked/denied no ledger." `
        -Confidence 'medium' -Evidence @("audit_blocked=$($blocked.Count)")
}

# Heuristic 2: discover ran but organism missing
if ((Test-Path $DiscoveryFile) -and -not (Test-Path $OrganismFile)) {
    Add-Proposal -Kind 'communication' -Target 'docs/_meta/organism.manifest.yaml' `
        -Change 'Executar arah organism bootstrap para fechar o ritual ontogênico.' `
        -Rationale 'Discovery presente sem manifesto de organismo.' `
        -Confidence 'high' -Evidence @('discovery.proposed.yaml')
}

# Heuristic 3: no signals yet -> encourage bootstrap communication
if ($signalCount -eq 0 -and (Test-Path $OrganismFile)) {
    Add-Proposal -Kind 'communication' -Target '.arah/local/bus/' `
        -Change 'Emitir sinais coalesce nos tecidos delivery/governance no início de cada fase.' `
        -Rationale 'Organismo definido mas bus vazio - comunicação ainda não exercitada.' `
        -Confidence 'medium' -Evidence @('organism.manifest.yaml', 'signals=0')
}

# Heuristic 4: frequent skill invokes -> reinforce choreography
$skillInvokes = @($freq.Keys | Where-Object { $_ -match 'skill\.|invoke' })
if ($skillInvokes.Count -gt 0 -and (Test-Path $ChoreoFile)) {
    $top = ($skillInvokes | Sort-Object { $freq[$_] } -Descending | Select-Object -First 1)
    Add-Proposal -Kind 'choreography' -Target '.agents/choreography.yaml' `
        -Change "Garantir que a skill mais usada ($top) esteja declarada nas rules de path correspondentes." `
        -Rationale 'Uso recorrente de skill sem reforço explícito na coreografia degrada descoberta.' `
        -Confidence 'low' -Evidence @("top_action=$top")
}

# Heuristic 5: missing craft skills in .skills
$expectedSkills = @('discover-repo', 'evolve-harness', 'regenerate-harness', 'metrics-rollup')
foreach ($sk in $expectedSkills) {
    $path = Join-Path $SkillsDir "$sk.skill.yaml"
    if (-not (Test-Path $path)) {
        Add-Proposal -Kind 'skill' -Target ".skills/$sk.skill.yaml" `
            -Change "Adicionar skill $sk ao kernel do consumidor via arah regenerate/update." `
            -Rationale "Skill biocomponente ausente - harness desatualizado." `
            -Confidence 'high' -Evidence @("missing=$sk")
    }
}

# Heuristic 6: domain proposals unused
if (Test-Path $DiscoveryFile) {
    $disc = Get-Content $DiscoveryFile -Raw
    if ($disc -match 'proposed_domains:' -and $disc -notmatch '(?m)^proposed_domains:\s*\r?\n\s*\[\]') {
        if ($disc -match '(?m)^\s+- id:\s*(\S+)') {
            Add-Proposal -Kind 'domain_config' -Target 'arah.config.yaml' `
                -Change 'Revisar proposed_domains em discovery.proposed.yaml e Apply se fizer sentido; depois domain sync.' `
                -Rationale 'Há domínios candidatos não aplicados - organismo incompleto para o repo.' `
                -Confidence 'medium' -Evidence @('discovery.proposed.yaml')
        }
    }
}

# Heuristic 7: cell definition freshness
if (Test-Path $OrganismFile) {
    Add-Proposal -Kind 'cell_definition' -Target 'docs/_meta/organism.manifest.yaml' `
        -Change 'Reexecutar organism bootstrap -Force após mudanças grandes de domínio/stack.' `
        -Rationale 'Células e tecidos devem acompanhar a evolução do repositório.' `
        -Confidence 'low' -Evidence @("audit_events=$auditCount", "signals=$signalCount")
}

# Heuristic 8+: Economy Intelligence from metrics summary
$metricsSemaphore = ''
$metricsBlockedRate = ''
$metricsTokensObserved = ''
if (Test-Path -LiteralPath $SummaryFile) {
    $sumRaw = Get-Content -LiteralPath $SummaryFile -Raw
    if ($sumRaw -match '(?m)^\s*semaphore:\s*(\S+)') { $metricsSemaphore = $Matches[1].Trim() }
    if ($sumRaw -match '(?m)^\s*blocked_rate:\s*([0-9.]+)') { $metricsBlockedRate = $Matches[1].Trim() }
    if ($sumRaw -match '(?m)^\s*tokens_observed:\s*(\S+)') { $metricsTokensObserved = $Matches[1].Trim() }

    $blockedNum = 0.0
    if ($metricsBlockedRate) {
        try { $blockedNum = [double]::Parse($metricsBlockedRate, [System.Globalization.CultureInfo]::InvariantCulture) } catch { $blockedNum = 0.0 }
    }

    if ($metricsSemaphore -eq 'expensive' -or $blockedNum -ge 0.25) {
        Add-Proposal -Kind 'economy' -Target '.arah/observability/summary.yaml' `
            -Change 'Reduzir co-ativacao e clarear gates; rodar arah metrics report e atacar roi_hints de friccao.' `
            -Rationale 'Scorecard marca harness caro/friccao alta - eficiencia abaixo do desejado.' `
            -Confidence 'high' -Evidence @("semaphore=$metricsSemaphore", "blocked_rate=$metricsBlockedRate")
    }
    elseif ($metricsSemaphore -eq 'neutral' -and $blockedNum -gt 0.10) {
        Add-Proposal -Kind 'workflow' -Target '.agents/autonomy.yaml' `
            -Change 'Documentar caminho de aprovacao para acoes com blocked_rate elevado; evitar retries cegos.' `
            -Rationale 'Friccao moderada no scorecard - gates podem estar gerando custo sem outcome.' `
            -Confidence 'medium' -Evidence @("semaphore=$metricsSemaphore", "blocked_rate=$metricsBlockedRate")
    }

    if ($metricsTokensObserved -eq 'false' -and $auditCount -ge 10) {
        Add-Proposal -Kind 'economy' -Target 'scripts/agents/record-agent-event.ps1' `
            -Change 'Instrumentar TokensIn/TokensOut/CostUsd nos pontos de invoke-skill e turn-stop quando a fonte de usage existir.' `
            -Rationale 'Ledger ativo sem tokens - Economy Intelligence ainda em proxies (M1).' `
            -Confidence 'low' -Evidence @('tokens_observed=false', "audit_events=$auditCount")
    }

    if ($sumRaw -match 'turn storm') {
        Add-Proposal -Kind 'communication' -Target 'docs/METHOD.md' `
            -Change 'Reforcar comunicacao passiva (arquivo+CI+sinais); evitar chat entre agentes por metrica.' `
            -Rationale 'Hint de turn storm no scorecard - risco a economia de tokens.' `
            -Confidence 'medium' -Evidence @('roi_hints:turn_storm')
    }
}

# Always emit at least a homeostasis proposal when quiet
if ($proposals.Count -eq 0) {
    Add-Proposal -Kind 'workflow' -Target 'homeostasis' `
        -Change 'Manter arah regenerate periódico; ledger ainda fino para aprendizado forte.' `
        -Rationale 'Poucos eventos - evolução conservadora (homeostase).' `
        -Confidence 'low' -Evidence @("audit=$auditCount", "signals=$signalCount", "live=$liveCount")
}

$ts = (Get-Date).ToUniversalTime().ToString('o')
$project = Split-Path $Root -Leaf
$cfgPath = Join-Path $Root 'arah.config.yaml'
if (Test-Path $cfgPath) {
    $raw = Get-Content $cfgPath -Raw
    if ($raw -match '(?m)^\s*name:\s*(\S+)') { $project = $Matches[1].Trim('"').Trim("'") }
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# Generated by evolve-harness.ps1 - propose only; human selects')
[void]$sb.AppendLine('schema: arah-harness/evolution')
[void]$sb.AppendLine("generated_at: $ts")
[void]$sb.AppendLine("project: $project")
[void]$sb.AppendLine('based_on:')
[void]$sb.AppendLine("  audit_events: $auditCount")
[void]$sb.AppendLine("  signals: $signalCount")
[void]$sb.AppendLine("  live_events: $liveCount")
[void]$sb.AppendLine("  discovery_present: $((Test-Path $DiscoveryFile).ToString().ToLower())")
[void]$sb.AppendLine("  organism_present: $((Test-Path $OrganismFile).ToString().ToLower())")
if ($metricsSemaphore) {
    [void]$sb.AppendLine("  metrics_semaphore: $metricsSemaphore")
}
if ($metricsBlockedRate) {
    [void]$sb.AppendLine("  blocked_rate: $metricsBlockedRate")
}
$summaryBits = "audit=$auditCount signals=$signalCount live=$liveCount"
if ($metricsSemaphore) { $summaryBits += " semaphore=$metricsSemaphore" }
[void]$sb.AppendLine("summary: `"$($proposals.Count) propostas a partir de $summaryBits`"")
[void]$sb.AppendLine('proposals:')
foreach ($p in $proposals) {
    [void]$sb.AppendLine("  - id: $($p.id)")
    [void]$sb.AppendLine("    kind: $($p.kind)")
    [void]$sb.AppendLine("    target: $($p.target)")
    [void]$sb.AppendLine("    change: `"$($p.change -replace '"', '''')`"")
    [void]$sb.AppendLine("    rationale: `"$($p.rationale -replace '"', '''')`"")
    [void]$sb.AppendLine("    confidence: $($p.confidence)")
    [void]$sb.AppendLine("    human_gate: $($p.human_gate)")
    [void]$sb.AppendLine('    evidence:')
    foreach ($e in $p.evidence) { [void]$sb.AppendLine("      - $e") }
}
[void]$sb.AppendLine('governance:')
[void]$sb.AppendLine('  mode: propose_only')
[void]$sb.AppendLine('  forbidden: [silent_agent_spawn, silent_kernel_rewrite, auto_merge]')

$content = $sb.ToString()

if ($DryRun) {
    Write-Host "[dry-run] would write $OutFile"
    Write-Host $content
    exit 0
}

if (-not (Test-Path $MetaDir)) { New-Item -ItemType Directory -Path $MetaDir -Force | Out-Null }
Set-Content -Path $OutFile -Value $content -Encoding UTF8
Write-Host "evolve: wrote $OutFile ($($proposals.Count) proposals)"

if ($Apply) {
    $signal = Join-Path $PSScriptRoot 'signal-bus.ps1'
    if (Test-Path $signal) {
        $payload = (@{ proposals = $proposals.Count; artifact = 'docs/_meta/evolution.proposed.yaml' } | ConvertTo-Json -Compress)
        & $signal -From orchestrator -SignalTo '*' -SignalType evolve -Topic homeostasis -Payload $payload -AutonomyLevel consult
    }
    Write-Host "evolve: Apply emitted evolve signal - revise proposals and open PR (no silent kernel rewrite)"
}

$record = Join-Path $PSScriptRoot 'record-agent-event.ps1'
if (Test-Path $record) {
    & $record -AgentId orchestrator -Action 'evolve.propose' -Outcome ok -AutonomyLevel consult -Details "proposals=$($proposals.Count)" 2>$null
}

exit 0
