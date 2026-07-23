#Requires -Version 5.1
<#
.SYNOPSIS
  Cria e inicia um contrato de execução (Execution Control Protocol).
.DESCRIPTION
  Não simula LLM. Produz artefatos determinísticos que orientam o executor
  (Cursor / Claude Code / agente humano). Após routed→executing, o orquestrador
  encerra o papel de comando da sessão.
.EXAMPLE
  ./execute-task.ps1 -Objective "Implementar endpoint" -Area backend -WorkClass standard
  ./execute-task.ps1 -ContractPath .arah/local/execution/active/task-….yaml
#>
param(
    [string]$Objective = '',
    [string]$Area = 'backend',
    [ValidateSet('trivial', 'standard', 'architectural', 'release', '')]
    [string]$WorkClass = 'standard',
    [ValidateSet('analysis', 'execution', 'review', 'planning', '')]
    [string]$IntentType = 'execution',
    [string]$ContractPath = '',
    [string]$PreferredExecutor = '',
    [string[]]$ExpectedOutputs = @(),
    [string[]]$VerificationCommands = @(),
    [string]$RepoRoot = '',
    [switch]$DryRun,
    [switch]$Json,
    [switch]$FailOnAmbiguousExecutors
)

$ErrorActionPreference = 'Stop'
if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
. (Join-Path $PSScriptRoot 'execution-lib.ps1')

$cfg = Get-EcpConfig -RepoRoot $RepoRoot
if (-not $cfg.enabled) {
    Write-Host 'execution_control.enabled=false — skipping formal contract (compat mode)'
    if ($Json) {
        @{ enabled = $false; skipped = $true } | ConvertTo-Json
    }
    exit 0
}

Ensure-EcpLedgerDirs -RepoRoot $RepoRoot | Out-Null

if ($ContractPath) {
    $contract = Read-EcpContract -Path $ContractPath
} else {
    if (-not $Objective) {
        Write-Error 'Use -Objective or -ContractPath'
        exit 10
    }
    if (-not $WorkClass) { $WorkClass = 'standard' }
    if (-not $IntentType) { $IntentType = 'execution' }
    try {
        $contract = New-EcpContract `
            -RepoRoot $RepoRoot `
            -Objective $Objective `
            -Area $Area `
            -WorkClass $WorkClass `
            -IntentType $IntentType `
            -PreferredExecutor $PreferredExecutor `
            -ExpectedOutputs $ExpectedOutputs `
            -VerificationCommands $VerificationCommands
    } catch {
        Write-Error $_.Exception.Message
        exit 1
    }
}

# Ambiguity: multiple operational candidates without explicit primary
if ($FailOnAmbiguousExecutors -and $contract.participants.subordinates.Count -gt 0 -and -not $PreferredExecutor) {
    # When callers insist on hard-fail for multi-executor rules before subordination
    if ($env:ECP_REQUIRE_SINGLE_EXECUTOR -eq '1') {
        Write-Error 'exactly_one_primary_executor_required'
        exit 1
    }
}

# Capability check
$role = Get-EcpAgentExecutionRole -RepoRoot $RepoRoot -AgentId $contract.primary_executor
if ($role.found -and -not $role.can_execute) {
    Write-Error "executor_lacks_capability:$($contract.primary_executor)"
    exit 1
}

# intake → routed → executing
try {
    if ($contract.state -eq 'intake') {
        Set-EcpState -Contract $contract -NewState 'routed' -Note 'orchestrator selected primary_executor; routing complete'
    }
    if ($contract.state -eq 'routed') {
        Set-EcpState -Contract $contract -NewState 'executing' -Note 'session handed to primary_executor; orchestrator stands down'
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

$path = $null
if (-not $DryRun) {
    $path = Save-EcpContract -RepoRoot $RepoRoot -Contract $contract

    # Briefing for the executor agent (deterministic artifact)
    $briefDir = Join-Path (Get-EcpExecutionRoot -RepoRoot $RepoRoot) $contract.task_id
    if (-not (Test-Path $briefDir)) { New-Item -ItemType Directory -Path $briefDir -Force | Out-Null }
    $brief = @"
# Execution briefing — $($contract.task_id)

You are the **primary_executor**: `$($contract.primary_executor)`.

## Objective
$($contract.objective)

## Rules
- You alone conduct execution.
- Consultants may only return structured consultation-result YAML under consultations/.
- Consultants must not talk to each other or redefine the executor.
- Do not return to routed after executing.
- Finish only as **done** (with concrete evidence) or **blocked** (with a specific reason).
- Analysis alone is not completion when intent_type=execution.

## Scope
Area: $($contract.scope.area)
Allowed paths:
$($contract.scope.allowed_paths | ForEach-Object { "- $_" } | Out-String)

## Limits
- max_handoffs: $($contract.limits.max_handoffs)
- max_consultations: $($contract.limits.max_consultations)
- max_analysis_cycles: $($contract.limits.max_analysis_cycles)

## Consultants
$((@($contract.participants.consultants) | ForEach-Object { "- $_" }) -join "`n")

## Reviewers
$((@($contract.participants.reviewers) | ForEach-Object { "- $_" }) -join "`n")

## Complete
``````
arah task complete -TaskId $($contract.task_id) -Evidence "…"
``````
"@
    Write-EcpAtomicFile -Path (Join-Path $briefDir 'BRIEFING.md') -Content $brief
}

# Validate after persist
$validator = Join-Path $RepoRoot 'scripts/harness/validate-execution-contract.ps1'
if ($path -and (Test-Path -LiteralPath $validator)) {
    if ($Json) {
        & $validator -ContractPath $path -RepoRoot $RepoRoot *>$null
    } else {
        & $validator -ContractPath $path -RepoRoot $RepoRoot
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$out = [ordered]@{
    task_id = $contract.task_id
    state = $contract.state
    primary_executor = $contract.primary_executor
    work_class = $contract.work_class
    intent_type = $contract.intent_type
    consultants = @($contract.participants.consultants)
    reviewers = @($contract.participants.reviewers)
    subordinates = @($contract.participants.subordinates)
    choreography_rule = $contract.choreography_rule
    contract_path = $path
    orchestrator_stood_down = $true
}

if ($Json) {
    $out | ConvertTo-Json -Depth 5
} else {
    Write-Host "execute-task: $($contract.task_id)"
    Write-Host "  state: $($contract.state)"
    Write-Host "  primary_executor: $($contract.primary_executor)"
    Write-Host "  work_class: $($contract.work_class)"
    Write-Host "  consultants: $((@($contract.participants.consultants) -join ', '))"
    if ($path) { Write-Host "  contract: $path" }
    Write-Host '  orchestrator: stood down after routing'
}

exit 0
