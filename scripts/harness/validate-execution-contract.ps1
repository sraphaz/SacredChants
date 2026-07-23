#Requires -Version 5.1
<#
.SYNOPSIS
  Valida contrato(s) do Execution Control Protocol.
.EXAMPLE
  ./validate-execution-contract.ps1 -ContractPath .arah/local/execution/active/task-….yaml
  ./validate-execution-contract.ps1 -AllActive
  ./validate-execution-contract.ps1 -ContractPath … -ProposedState done -ProposedEvidence "file updated"
#>
param(
    [string]$ContractPath = '',
    [string]$TaskId = '',
    [string]$RepoRoot = '',
    [switch]$AllActive,
    [string]$ProposedState = '',
    [string[]]$ProposedEvidence = @(),
    [string[]]$ProposedChangedFiles = @(),
    [string]$ProposedBlockingReason = '',
    [switch]$Json,
    [switch]$Strict
)

$ErrorActionPreference = 'Stop'
if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
. (Join-Path (Join-Path $RepoRoot 'scripts/agents') 'execution-lib.ps1')

$violations = [System.Collections.Generic.List[object]]::new()

function Add-Violation {
    param([string]$Code, [string]$Message)
    $violations.Add([pscustomobject]@{ code = $Code; message = $Message })
}

function Test-OneContract {
    param($c, [string]$path)

    if (-not $c.task_id) { Add-Violation 'missing_task_id' "${path}: task_id required" }
    if (-not $c.objective) { Add-Violation 'missing_objective' "${path}: objective required" }

    $statesNeedingExecutor = @('routed', 'executing', 'verifying', 'done', 'blocked')
    if ($statesNeedingExecutor -contains $c.state) {
        if (-not $c.primary_executor) {
            Add-Violation 'executor_missing' "${path}: primary_executor required in state $($c.state)"
        }
    }

    if ($c.primary_executor) {
        $role = Get-EcpAgentExecutionRole -RepoRoot $RepoRoot -AgentId $c.primary_executor
        if ($role.found) {
            if ($role.can_route -and -not $role.can_execute -and $c.primary_executor -eq 'orchestrator') {
                Add-Violation 'executor_lacks_capability' "${path}: orchestrator cannot be primary_executor"
            }
            if (-not $role.can_execute -and $role.can_consult -and -not $role.can_route) {
                # pure consultant as executor
                if (-not $role.can_execute) {
                    Add-Violation 'consultant_cannot_execute' "${path}: consultant $($c.primary_executor) cannot be primary_executor"
                }
            }
            if (-not $role.can_execute -and $role.can_review -and -not $role.can_consult) {
                Add-Violation 'executor_lacks_capability' "${path}: reviewer $($c.primary_executor) cannot be primary_executor"
            }
        }

        # Exactly one — subordinates ok, but consultants must not equal executor
        if (@($c.participants.consultants) -contains $c.primary_executor) {
            Add-Violation 'executor_in_consultants' "${path}: primary_executor listed as consultant"
        }
    }

    # Counters vs limits
    if ([int]$c.counters.handoffs -gt [int]$c.limits.max_handoffs) {
        Add-Violation 'handoff_limit_exceeded' "${path}: handoffs $($c.counters.handoffs) > max $($c.limits.max_handoffs)"
    }
    if ([int]$c.counters.consultations -gt [int]$c.limits.max_consultations) {
        Add-Violation 'consultation_limit_exceeded' "${path}: consultations $($c.counters.consultations) > max $($c.limits.max_consultations)"
    }
    if ([int]$c.counters.analysis_cycles -gt [int]$c.limits.max_analysis_cycles) {
        Add-Violation 'analysis_cycle_limit_exceeded' "${path}: analysis_cycles $($c.counters.analysis_cycles) > max $($c.limits.max_analysis_cycles)"
    }

    # History transitions
    $prev = $null
    foreach ($h in @($c.history)) {
        if ($h.from -and $h.from -ne 'none' -and $h.to) {
            if (-not (Test-EcpTransitionAllowed -From $h.from -To $h.to)) {
                Add-Violation 'invalid_state_transition' "${path}: $($h.from)->$($h.to)"
            }
            if ($h.from -eq 'executing' -and $h.to -eq 'routed') {
                Add-Violation 'invalid_state_transition' "${path}: cannot return executing→routed"
            }
        }
        # Loop detection: same from→to repeated many times
        $sig = "$($h.from)->$($h.to)"
        if ($prev -eq $sig -and $sig -match 'executing|routed') {
            Add-Violation 'loop_detected' "${path}: repeated transition $sig"
        }
        $prev = $sig
    }

    $checkState = $c.state
    $evidence = @($c.execution.completion_evidence)
    $blocking = $c.result.blocking_reason
    $changedFiles = @($c.result.changed_files)
    if ($ProposedState) {
        if (-not (Test-EcpTransitionAllowed -From $c.state -To $ProposedState)) {
            Add-Violation 'invalid_state_transition' "${path}: proposed $($c.state)->$ProposedState"
        }
        $checkState = $ProposedState
        if ($ProposedEvidence.Count -gt 0) { $evidence = @($ProposedEvidence) }
        if ($ProposedChangedFiles.Count -gt 0) {
            $changedFiles = @($changedFiles) + @($ProposedChangedFiles)
        } elseif ($ProposedEvidence.Count -gt 0) {
            $changedFiles = @($changedFiles) + @(Get-EcpPathsFromEvidence -Evidence $ProposedEvidence)
        }
        if ($ProposedBlockingReason) { $blocking = $ProposedBlockingReason }
    }

    if ($checkState -eq 'done') {
        if (@($evidence).Count -eq 0 -and @($c.result.evidence).Count -eq 0 -and @($c.result.changed_files).Count -eq 0) {
            Add-Violation 'completion_evidence_required' "${path}: done requires completion evidence"
        } elseif ($c.intent_type -eq 'execution') {
            if (-not (Test-EcpConcreteEvidence -Contract $c -Evidence $evidence)) {
                Add-Violation 'completion_evidence_required' "${path}: execution done requires concrete change evidence (analysis alone is insufficient)"
            }
        }
    }

    if ($checkState -eq 'blocked') {
        if (-not $blocking -or [string]::IsNullOrWhiteSpace([string]$blocking)) {
            Add-Violation 'blocking_reason_required' "${path}: blocked requires blocking_reason"
        }
    }

    # Scope: changed files outside allowed_paths (includes proposed paths on complete)
    foreach ($cf in @($changedFiles | Select-Object -Unique)) {
        if (-not $cf) { continue }
        if (-not (Test-EcpPathInScope -FilePath $cf -AllowedPaths @($c.scope.allowed_paths) -ForbiddenPaths @($c.scope.forbidden_paths))) {
            Add-Violation 'path_out_of_scope' "${path}: changed $cf outside allowed_paths"
        }
    }
}

# Consultant-to-consultant handoff probe (optional env-style params via Proposed*)
if ($env:ECP_TEST_CONSULTANT_HANDOFF -eq '1') {
    Add-Violation 'consultant_to_consultant_handoff_forbidden' 'consultant cannot hand off to another consultant'
}

$targets = @()
if ($ContractPath) {
    $targets += $ContractPath
} elseif ($TaskId) {
    $p = Find-EcpContractPath -RepoRoot $RepoRoot -TaskId $TaskId
    if (-not $p) { Write-Error "task not found: $TaskId"; exit 1 }
    $targets += $p
} elseif ($AllActive) {
    $active = Join-Path (Get-EcpExecutionRoot -RepoRoot $RepoRoot) 'active'
    if (Test-Path $active) {
        $targets += @(Get-ChildItem $active -Filter '*.yaml' | ForEach-Object { $_.FullName })
    }
} else {
    Write-Error 'Specify -ContractPath, -TaskId, or -AllActive'
    exit 10
}

foreach ($t in $targets) {
    $contract = Read-EcpContract -Path $t
    Test-OneContract -c $contract -path $t
}

$result = [ordered]@{
    ok = ($violations.Count -eq 0)
    checked = $targets.Count
    violations = @($violations)
}

if ($Json) {
    $result | ConvertTo-Json -Depth 6
} else {
    if ($result.ok) {
        Write-Host "validate-execution-contract: OK ($($targets.Count) contract(s))"
    } else {
        Write-Host "validate-execution-contract: FAIL ($($violations.Count) violation(s))"
        foreach ($v in $violations) {
            Write-Host "  [$($v.code)] $($v.message)"
        }
    }
}

if (-not $result.ok) { exit 1 }
exit 0
