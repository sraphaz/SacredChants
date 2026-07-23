#Requires -Version 5.1
<#
.SYNOPSIS
  Operações CLI sobre contratos de execução: status, validate, complete, block, consult.
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('status', 'validate', 'complete', 'block', 'consult', 'create')]
    [string]$Action,

    [string]$TaskId = '',
    [string]$Objective = '',
    [string]$Area = 'backend',
    [ValidateSet('trivial', 'standard', 'architectural', 'release', '')]
    [string]$Class = 'standard',
    [ValidateSet('analysis', 'execution', 'review', 'planning', '')]
    [string]$IntentType = 'execution',
    [string]$Evidence = '',
    [string[]]$EvidenceList = @(),
    [string]$Reason = '',
    [string]$Consultant = '',
    [string]$Summary = '',
    [switch]$Blocking,
    [string]$RepoRoot = '',
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
. (Join-Path $PSScriptRoot 'execution-lib.ps1')

function Get-ContractOrThrow {
    param([string]$Id)
    if (-not $Id) { throw 'TaskId required' }
    $p = Find-EcpContractPath -RepoRoot $RepoRoot -TaskId $Id
    if (-not $p) { throw "task not found: $Id" }
    return @{ path = $p; contract = (Read-EcpContract -Path $p) }
}

switch ($Action) {
    'create' {
        $script = Join-Path $PSScriptRoot 'execute-task.ps1'
        $splat = @{
            Objective = $Objective
            Area = $Area
            WorkClass = $(if ($Class) { $Class } else { 'standard' })
            IntentType = $(if ($IntentType) { $IntentType } else { 'execution' })
            RepoRoot = $RepoRoot
            Json = $Json
        }
        & $script @splat
        exit $LASTEXITCODE
    }
    'status' {
        $pack = Get-ContractOrThrow -Id $TaskId
        $c = $pack.contract
        $out = [ordered]@{
            task_id = $c.task_id
            state = $c.state
            primary_executor = $c.primary_executor
            objective = $c.objective
            work_class = $c.work_class
            intent_type = $c.intent_type
            consultants = @($c.participants.consultants)
            counters = $c.counters
            limits = $c.limits
            path = $pack.path
            blocking_reason = $c.result.blocking_reason
            evidence = @($c.execution.completion_evidence)
        }
        if ($Json) { $out | ConvertTo-Json -Depth 5 }
        else {
            Write-Host "task $($c.task_id): $($c.state)"
            Write-Host "  executor: $($c.primary_executor)"
            Write-Host "  objective: $($c.objective)"
            Write-Host "  path: $($pack.path)"
            if ($c.result.blocking_reason) { Write-Host "  blocked: $($c.result.blocking_reason)" }
        }
        exit 0
    }
    'validate' {
        $pack = Get-ContractOrThrow -Id $TaskId
        $validator = Join-Path $RepoRoot 'scripts/harness/validate-execution-contract.ps1'
        & $validator -ContractPath $pack.path -RepoRoot $RepoRoot -Json:$Json
        exit $LASTEXITCODE
    }
    'complete' {
        $ev = @()
        if ($Evidence) { $ev += $Evidence }
        if ($EvidenceList.Count -gt 0) { $ev += $EvidenceList }
        if ($ev.Count -eq 0) {
            Write-Error 'completion_evidence_required: use -Evidence'
            exit 1
        }
        $pack = Get-ContractOrThrow -Id $TaskId
        $c = $pack.contract
        if ($c.state -in @('done', 'blocked')) {
            Write-Error "terminal_state_immutable:$($c.state)"
            exit 1
        }
        # Extract paths before validation so scope checks see proposed changes
        $extracted = @(Get-EcpPathsFromEvidence -Evidence $ev)
        $validator = Join-Path $RepoRoot 'scripts/harness/validate-execution-contract.ps1'
        & $validator -ContractPath $pack.path -RepoRoot $RepoRoot `
            -ProposedState done -ProposedEvidence $ev -ProposedChangedFiles $extracted
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

        if ($c.state -eq 'executing') {
            Set-EcpState -Contract $c -NewState 'verifying' -Note 'verification started'
        }
        if ($c.state -eq 'verifying' -or $c.state -eq 'executing') {
            try {
                if ($c.state -ne 'verifying') { Set-EcpState -Contract $c -NewState 'verifying' -Note 'verify' }
            } catch { }
            Set-EcpState -Contract $c -NewState 'done' -Note 'completion evidence accepted'
        } elseif ($c.state -ne 'done') {
            Set-EcpState -Contract $c -NewState 'done' -Note 'completion evidence accepted'
        }
        $c.execution.completion_evidence = @($c.execution.completion_evidence) + $ev
        $c.result.evidence = @($c.result.evidence) + $ev
        $c.result.changed_files = @(@($c.result.changed_files) + @($extracted) | Select-Object -Unique)
        $path = Save-EcpContract -RepoRoot $RepoRoot -Contract $c
        if ($Json) {
            @{ task_id = $c.task_id; state = 'done'; path = $path; evidence = $ev } | ConvertTo-Json
        } else {
            Write-Host "task $($c.task_id): done"
            Write-Host "  evidence: $($ev -join '; ')"
            Write-Host "  path: $path"
        }
        exit 0
    }
    'block' {
        if (-not $Reason) {
            Write-Error 'blocking_reason_required: use -Reason'
            exit 1
        }
        $pack = Get-ContractOrThrow -Id $TaskId
        $c = $pack.contract
        $validator = Join-Path $RepoRoot 'scripts/harness/validate-execution-contract.ps1'
        & $validator -ContractPath $pack.path -RepoRoot $RepoRoot `
            -ProposedState blocked -ProposedBlockingReason $Reason
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Set-EcpState -Contract $c -NewState 'blocked' -Note $Reason
        $c.result.blocking_reason = $Reason
        $path = Save-EcpContract -RepoRoot $RepoRoot -Contract $c
        if ($Json) {
            @{ task_id = $c.task_id; state = 'blocked'; reason = $Reason; path = $path } | ConvertTo-Json
        } else {
            Write-Host "task $($c.task_id): blocked"
            Write-Host "  reason: $Reason"
            Write-Host "  path: $path"
        }
        exit 0
    }
    'consult' {
        if (-not $Consultant -or -not $Summary) {
            Write-Error 'consult requires -Consultant and -Summary'
            exit 1
        }
        $pack = Get-ContractOrThrow -Id $TaskId
        $c = $pack.contract
        if ($c.state -in @('done', 'blocked')) {
            Write-Error "consultation_after_terminal_forbidden:$($c.state)"
            exit 1
        }
        if ($c.state -notin @('routed', 'executing', 'verifying')) {
            Write-Error "consultation_invalid_state:$($c.state)"
            exit 1
        }
        if (@($c.participants.consultants) -notcontains $Consultant) {
            Write-Error "consultant_not_in_contract:$Consultant"
            exit 1
        }
        # Forbid consultant→consultant: consultant must not be another agent initiating
        if ($env:ECP_CONSULT_TARGET_CONSULTANT) {
            Write-Error 'consultant_to_consultant_handoff_forbidden'
            exit 1
        }
        if ([int]$c.counters.consultations -ge [int]$c.limits.max_consultations) {
            Write-Error 'consultation_limit_exceeded: executor must proceed or block'
            exit 1
        }
        $c.counters.consultations = [int]$c.counters.consultations + 1
        $consultDir = Join-Path (Join-Path (Get-EcpExecutionRoot -RepoRoot $RepoRoot) $c.task_id) 'consultations'
        if (-not (Test-Path $consultDir)) { New-Item -ItemType Directory -Path $consultDir -Force | Out-Null }
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $blockVal = if ($Blocking) { 'true' } else { 'false' }
        $reasonLine = if ($Blocking) { "  reason: $(ConvertTo-EcpYamlScalar $Reason)`n  evidence: $(ConvertTo-EcpYamlScalar $Evidence)" } else { "  reason: null`n  evidence: null" }
        $yaml = @"
version: "1.0"
task_id: $($c.task_id)
consultant: $Consultant
summary: $(ConvertTo-EcpYamlScalar $Summary)
recommendations: []
risks: []
constraints: []
blocking:
  value: $blockVal
$reasonLine
scope_expansion_requested:
  value: false
  paths: []
  justification: null
"@
        $outPath = Join-Path $consultDir "$stamp-$Consultant.yaml"
        Write-EcpAtomicFile -Path $outPath -Content $yaml
        if ($Blocking) {
            Set-EcpState -Contract $c -NewState 'blocked' -Note "critical consult block from $Consultant"
            $c.result.blocking_reason = $Reason
        }
        Save-EcpContract -RepoRoot $RepoRoot -Contract $c | Out-Null
        if ($Json) {
            @{ task_id = $c.task_id; consultation = $outPath; consultations = $c.counters.consultations } | ConvertTo-Json
        } else {
            Write-Host "consultation recorded: $outPath"
            Write-Host "  consultations: $($c.counters.consultations)/$($c.limits.max_consultations)"
        }
        exit 0
    }
}
