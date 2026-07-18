#Requires -Version 5.1
<#
.SYNOPSIS
  Biblioteca compartilhada — validação do harness-model (domain agents, governance, audit, observability).
.NOTES
  Dot-source: . ./harness-model-lib.ps1
#>

$Script:DomainAgentIds = @('clean-craft-advisor', 'test-architect', 'architecture-documenter')
$Script:AutonomyLevels = @('observe', 'consult', 'route', 'activate', 'invoke_skill', 'side_effect', 'public')
$Script:ConsultMaxRank = 1

function Get-AutonomyRank {
    param([string]$Level)
    $idx = [array]::IndexOf($Script:AutonomyLevels, $Level)
    if ($idx -lt 0) { return 99 }
    return $idx
}

function Test-AgentManifestExists {
    param([string]$Target, [string]$AgentId)
    $agentsDir = Join-Path $Target '.agents'
    $candidates = @(
        (Join-Path $agentsDir "domain/$AgentId.agent.yaml"),
        (Join-Path $agentsDir "$AgentId.agent.yaml"),
        (Join-Path $agentsDir "specialists/$AgentId.agent.yaml")
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $true } }
    return $false
}

function Get-ProfileModelFromFile {
    param([string]$ProfileFile)
    if (-not (Test-Path $ProfileFile)) { return $null }
    $raw = Get-Content $ProfileFile -Raw
    $model = @{ domain_agents = @(); governance = @{}; observability = @{}; audit = @{} }

    foreach ($id in $Script:DomainAgentIds) {
        if ($raw -match "(?ms)domain_agents:\s*\n(?:.*?\n)*?-\s*id:\s*$id\b") {
            $block = if ($raw -match "(?ms)(-\s*id:\s*$id\b.*?(?=\n\s*-\s*id:|\ngovernance:|\Z))") { $Matches[1] } else { '' }
            $required = $block -match '(?m)^\s*required:\s*true'
            $maxAut = 'consult'
            if ($block -match '(?m)^\s*max_autonomy:\s*(\S+)') { $maxAut = $Matches[1] }
            $model.domain_agents += @{ id = $id; required = [bool]$required; max_autonomy = $maxAut }
        }
    }
    return $model
}

function Get-InstalledProfileTier {
    param([string]$Target)
    $hp = Join-Path $Target 'harness-profile.yaml'
    if (-not (Test-Path $hp)) { return $null }
    $raw = Get-Content $hp -Raw
    if ($raw -match '(?m)^\s*profile:\s*(\S+)') { return $Matches[1] }
    return $null
}

function Get-TierRequiredDomainAgents {
    param([string]$Tier)
    switch ($Tier) {
        'minimal' {
            return @(
                @{ id = 'architecture-documenter'; required = $true; max_autonomy = 'consult' }
                @{ id = 'clean-craft-advisor'; required = $false; max_autonomy = 'consult' }
                @{ id = 'test-architect'; required = $false; max_autonomy = 'consult' }
            )
        }
        'consulting' { return Get-FullDomainAgents }
        'product' { return Get-FullDomainAgents }
        'enterprise' { return Get-FullDomainAgents }
        'open-source' {
            return @(
                @{ id = 'architecture-documenter'; required = $true; max_autonomy = 'consult' }
                @{ id = 'clean-craft-advisor'; required = $true; max_autonomy = 'consult' }
                @{ id = 'test-architect'; required = $false; max_autonomy = 'consult' }
            )
        }
        default { return @() }
    }
}

function Get-FullDomainAgents {
    return @(
        @{ id = 'clean-craft-advisor'; required = $true; max_autonomy = 'consult' }
        @{ id = 'test-architect'; required = $true; max_autonomy = 'consult' }
        @{ id = 'architecture-documenter'; required = $true; max_autonomy = 'consult' }
    )
}

function Test-HarnessModelCompleteness {
    param(
        [Parameter(Mandatory = $true)][string]$Target,
        [string]$HarnessRoot = '',
        [switch]$Strict
    )
    $failures = @()
    $warnings = @()

    $tier = Get-InstalledProfileTier -Target $Target
    $hp = Join-Path $Target 'harness-profile.yaml'

    # --- harness-profile presente (consulting+) ---
    if ($tier -and $tier -ne 'minimal' -and -not (Test-Path $hp)) {
        $failures += "FAIL harness-profile.yaml ausente (profile $tier)"
    }

    $hpRaw = if (Test-Path $hp) { Get-Content $hp -Raw } else { '' }

    # --- model block in harness-profile ---
    if ($tier -and $tier -ne 'minimal') {
        foreach ($section in @('domain_agents', 'governance', 'observability', 'audit')) {
            if ($hpRaw -notmatch ('(?m)^' + [regex]::Escape($section) + ':')) {
                $failures += "FAIL harness-profile.yaml: seção '$section' ausente (first-class model)"
            }
        }
    }

    # --- domain agents per tier ---
    $expected = if ($tier) { Get-TierRequiredDomainAgents -Tier $tier } else { Get-FullDomainAgents }
    foreach ($slot in $expected) {
        if (-not $slot.required) { continue }
        if (-not (Test-AgentManifestExists -Target $Target -AgentId $slot.id)) {
            $failures += "FAIL domain agent '$($slot.id)' required for tier '$tier' but manifest missing in .agents/domain/"
        }
        $manifest = Join-Path $Target ".agents/domain/$($slot.id).agent.yaml"
        if (Test-Path $manifest) {
            $mraw = Get-Content $manifest -Raw
            if ($mraw -match '(?m)^type:\s*domain') {
                if ($mraw -match '(?m)max_autonomy:\s*(\S+)') {
                    $ma = $Matches[1]
                    if ((Get-AutonomyRank $ma) -gt $Script:ConsultMaxRank) {
                        $failures += "FAIL domain agent '$($slot.id)': max_autonomy '$ma' exceeds consult"
                    }
                }
            }
        }
    }

    # --- governance ---
    $autonomyFile = Join-Path $Target '.agents/autonomy.yaml'
    if ($tier -in @('consulting', 'product', 'enterprise', 'open-source')) {
        if (-not (Test-Path $autonomyFile)) {
            $failures += 'FAIL governance: .agents/autonomy.yaml ausente'
        } else {
            $araw = Get-Content $autonomyFile -Raw
            foreach ($lvl in $Script:AutonomyLevels) {
                if ($araw -notmatch ('(?m)^\s+' + [regex]::Escape($lvl) + ':')) {
                    $warnings += "WARN governance: autonomy level '$lvl' not declared"
                }
            }
            if ($hpRaw -match '(?m)^governance:' -and $hpRaw -notmatch '(?m)^\s*blocked_actions:') {
                $failures += 'FAIL governance: blocked_actions not declared in harness-profile.yaml'
            }
        }
    }

    # --- observability paths ---
    if ($hpRaw -match '(?m)^observability:') {
        foreach ($key in @('diagnostics', 'session_traces', 'metrics_summary')) {
            if ($hpRaw -notmatch ('(?m)^\s+' + [regex]::Escape($key) + ':')) {
                $failures += "FAIL observability: '$key' path not declared in harness-profile.yaml"
            }
        }
    } elseif ($tier -in @('consulting', 'product', 'enterprise')) {
        $failures += 'FAIL observability block missing from harness-profile.yaml'
    }

    # --- audit ---
    if ($tier -in @('consulting', 'product', 'enterprise', 'open-source')) {
        if ($hpRaw -notmatch '(?m)^audit:') {
            $failures += 'FAIL audit block missing from harness-profile.yaml'
        } else {
            if ($hpRaw -notmatch '(?m)^\s*ledger_path:') { $failures += 'FAIL audit: ledger_path not declared' }
            if ($hpRaw -notmatch '(?m)^\s*event_schema:') { $failures += 'FAIL audit: event_schema not declared' }
            if ($hpRaw -notmatch '(?m)^\s*retention_policy:') { $failures += 'FAIL audit: retention_policy not declared' }
        }
        $recordScript = Join-Path $Target 'scripts/agents/record-agent-event.ps1'
        if (-not (Test-Path $recordScript)) {
            $warnings += 'WARN audit: scripts/agents/record-agent-event.ps1 not installed'
        }
    }

    # --- choreography references domain agents (when .agents present) ---
    $choreo = Join-Path $Target '.agents/choreography.yaml'
    if (Test-Path $choreo) {
        $craw = Get-Content $choreo -Raw
        foreach ($slot in ($expected | Where-Object { $_.required })) {
            if ($craw -notmatch "(?m)id:\s*$($slot.id)\b") {
                $warnings += "WARN choreography: domain agent '$($slot.id)' not referenced in rules"
            }
        }
    }

    if ($Strict) { $failures += $warnings; $warnings = @() }
    return @{ failures = $failures; warnings = $warnings; tier = $tier }
}
