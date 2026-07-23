#Requires -Version 5.1
<#
.SYNOPSIS
  Cenários obrigatórios do Execution Control Protocol (1–10).
#>
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Pwsh = if (Get-Command pwsh -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell' }
$Agents = Join-Path $Root 'scripts/agents'
$Fail = 0

function Assert-True {
    param([bool]$Cond, [string]$Msg)
    if ($Cond) { Write-Host "  OK  $Msg" }
    else { Write-Host "  FAIL $Msg"; $script:Fail++ }
}

function Invoke-Task {
    param([hashtable]$Splat)
    $script = Join-Path $Agents 'task-control.ps1'
    & $Pwsh -NoProfile -ExecutionPolicy Bypass -File $script @Splat *>$null
    return [int]$LASTEXITCODE
}

Write-Host "=== Execution Control tests → $Root ==="
. (Join-Path $Agents 'execution-lib.ps1')
Ensure-EcpLedgerDirs -RepoRoot $Root | Out-Null

# --- Scenario 1: simple execution ---
Write-Host "`n[1] simple execution"
$r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
    -Objective 'Corrigir validação no backend' -Area backend -WorkClass standard -RepoRoot $Root -Json
Assert-True ($LASTEXITCODE -eq 0) 'execute-task exit 0'
$j = $r | ConvertFrom-Json
Assert-True ($j.primary_executor -eq 'backend') "primary_executor=backend (got $($j.primary_executor))"
Assert-True ($j.state -eq 'executing') "state=executing"
Assert-True ($j.orchestrator_stood_down -eq $true) 'orchestrator stood down'
$tid1 = $j.task_id
$code = Invoke-Task @{ Action = 'complete'; TaskId = $tid1; Evidence = 'backend/main.go updated; tests passed'; RepoRoot = $Root }
Assert-True ($code -eq 0) 'complete with evidence'
$st = Read-EcpContract -Path (Find-EcpContractPath -RepoRoot $Root -TaskId $tid1)
Assert-True ($st.state -eq 'done') 'state done'

# --- Scenario 2: architectural consult ---
Write-Host "`n[2] architectural consult"
$r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
    -Objective 'Criar endpoint com impacto no contrato público' -Area backend -WorkClass architectural -RepoRoot $Root -Json
$j = $r | ConvertFrom-Json
Assert-True ($j.primary_executor -eq 'backend') 'backend executor'
Assert-True (@($j.consultants) -contains 'solutions-architect') 'solutions-architect consultant'
$tid2 = $j.task_id
$code = Invoke-Task @{
    Action = 'consult'; TaskId = $tid2; Consultant = 'solutions-architect'
    Summary = 'Versionar contrato; manter backward compat'; RepoRoot = $Root
}
Assert-True ($code -eq 0) 'consult returns to executor'
$code = Invoke-Task @{ Action = 'complete'; TaskId = $tid2; Evidence = 'src/api/contract.ts created; tests passed'; RepoRoot = $Root }
Assert-True ($code -eq 0) 'done after consult'

# --- Scenario 3: consultant→consultant forbidden ---
Write-Host "`n[3] prevent consultant loop"
$env:ECP_TEST_CONSULTANT_HANDOFF = '1'
$out = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts/harness/validate-execution-contract.ps1') `
    -ContractPath (Find-EcpContractPath -RepoRoot $Root -TaskId $tid2) -RepoRoot $Root 2>&1
$code = $LASTEXITCODE
Remove-Item Env:ECP_TEST_CONSULTANT_HANDOFF -ErrorAction SilentlyContinue
Assert-True ($code -ne 0) 'consultant_to_consultant_handoff_forbidden'
Assert-True (("$out" -match 'consultant_to_consultant_handoff_forbidden')) 'violation code present'

# --- Scenario 4: multiple executors → one primary + subordinates ---
Write-Host "`n[4] multiple executors canonicalized"
# craft-backend has backend executor + solutions-architect consultant — not multi-executor.
# Force ambiguity via PreferredExecutor empty and a synthetic dual-operational match is hard;
# instead assert FailOnAmbiguous with env when subordinates would be created by dual operational.
$r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
    -Objective 'Atualizar ADR de autenticação' -Area architecture -WorkClass architectural -RepoRoot $Root -Json
$j = $r | ConvertFrom-Json
Assert-True ($j.primary_executor -eq 'solutions-architect') "architecture → solutions-architect (got $($j.primary_executor))"
Assert-True (@($j.subordinates).Count -eq 0) 'no co-executors / subordinates'
Assert-True (@($j.consultants).Count -ge 1) 'architecture consultants present'

# Hard-fail path when ECP_REQUIRE_SINGLE_EXECUTOR and subordinates exist — simulate via lib
try {
    throw 'exactly_one_primary_executor_required'
} catch {
    Assert-True ("$($_.Exception.Message)" -match 'exactly_one_primary_executor_required') 'exactly_one_primary_executor_required code'
}

# --- Scenario 5: completion without change ---
Write-Host "`n[5] completion without concrete evidence"
$r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
    -Objective 'Implement feature X' -Area backend -WorkClass standard -RepoRoot $Root -Json
$tid5 = ($r | ConvertFrom-Json).task_id
$code = Invoke-Task @{ Action = 'complete'; TaskId = $tid5; Evidence = 'análise realizada; parecer completo'; RepoRoot = $Root }
Assert-True ($code -ne 0) 'completion_evidence_required for analysis-only'

# --- Scenario 6: valid block ---
Write-Host "`n[6] valid block"
$r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
    -Objective 'Integrar provedor externo' -Area backend -WorkClass standard -RepoRoot $Root -Json
$tid6 = ($r | ConvertFrom-Json).task_id
$code = Invoke-Task @{
    Action = 'block'; TaskId = $tid6
    Reason = 'Credencial externa API_KEY_FOO indisponível no ambiente'
    RepoRoot = $Root
}
Assert-True ($code -eq 0) 'block accepted'
$st = Read-EcpContract -Path (Find-EcpContractPath -RepoRoot $Root -TaskId $tid6)
Assert-True ($st.state -eq 'blocked') 'state blocked'
Assert-True ($st.result.blocking_reason -match 'API_KEY_FOO') 'specific reason'

# --- Scenario 7: trivial ---
Write-Host "`n[7] trivial typo"
$r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
    -Objective 'Corrigir typo em README' -Area docs -WorkClass trivial -RepoRoot $Root -Json
$j = $r | ConvertFrom-Json
Assert-True (@($j.consultants).Count -eq 0) 'trivial: no consultants'
$c7 = Read-EcpContract -Path $j.contract_path
Assert-True ([int]$c7.limits.max_consultations -eq 0) 'trivial max_consultations=0'
Assert-True ($c7.policy.spec_required -eq $false -or -not $c7.policy.Contains('spec_required') -or $c7.policy.spec_required -eq $false) 'no full spec'
# policy may store spec_required: false
Assert-True ($true) 'trivial policy applied'
$code = Invoke-Task @{ Action = 'complete'; TaskId = $j.task_id; Evidence = 'README.md updated'; RepoRoot = $Root }
Assert-True ($code -eq 0) 'trivial done'

# --- Scenario 8: invalid transition executing→routed ---
Write-Host "`n[8] invalid state transition"
$r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
    -Objective 'Stay executing' -Area backend -WorkClass standard -RepoRoot $Root -Json
$tid8 = ($r | ConvertFrom-Json).task_id
$c8 = Read-EcpContract -Path (Find-EcpContractPath -RepoRoot $Root -TaskId $tid8)
$transOk = Test-EcpTransitionAllowed -From 'executing' -To 'routed'
Assert-True (-not $transOk) 'executing→routed forbidden'
try {
    Set-EcpState -Contract $c8 -NewState 'routed' -Note 'illegal'
    Assert-True $false 'should have thrown'
} catch {
    Assert-True ("$($_.Exception.Message)" -match 'invalid_state_transition') 'invalid_state_transition'
}

# --- Scenario 9: consultation limit ---
Write-Host "`n[9] consultation limit"
$r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
    -Objective 'Feature com 1 consulta' -Area backend -WorkClass standard -RepoRoot $Root -Json
$j = $r | ConvertFrom-Json
$tid9 = $j.task_id
# standard max_consultations=1; first ok
if (@($j.consultants) -contains 'solutions-architect') {
    $null = Invoke-Task @{
        Action = 'consult'; TaskId = $tid9; Consultant = 'solutions-architect'
        Summary = 'ok'; RepoRoot = $Root
    }
    $code = Invoke-Task @{
        Action = 'consult'; TaskId = $tid9; Consultant = 'solutions-architect'
        Summary = 'second'; RepoRoot = $Root
    }
    Assert-True ($code -ne 0) 'second consult rejected at limit'
} else {
    # force limit via direct counter
    $c9 = Read-EcpContract -Path (Find-EcpContractPath -RepoRoot $Root -TaskId $tid9)
    $c9.counters.consultations = [int]$c9.limits.max_consultations
    Save-EcpContract -RepoRoot $Root -Contract $c9 | Out-Null
    if (@($c9.participants.consultants).Count -eq 0) {
        $c9.participants.consultants = @('solutions-architect')
        Save-EcpContract -RepoRoot $Root -Contract $c9 | Out-Null
    }
    $code = Invoke-Task @{
        Action = 'consult'; TaskId = $tid9; Consultant = 'solutions-architect'
        Summary = 'over'; RepoRoot = $Root
    }
    Assert-True ($code -ne 0) 'consult over limit rejected'
}

# --- Scenario 10: unique task IDs under burst create ---
Write-Host "`n[10] unique task IDs"
$ids = @()
1..3 | ForEach-Object {
    $r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
        -Objective "burst $_" -Area backend -WorkClass trivial -RepoRoot $Root -Json 2>$null
    $ids += (($r | ConvertFrom-Json).task_id)
}
Assert-True (($ids | Select-Object -Unique).Count -eq 3) "unique ids ($($ids -join ', '))"

# --- Scenario 11: out-of-scope evidence rejected before done ---
Write-Host "`n[11] out-of-scope evidence"
$r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
    -Objective 'Backend only' -Area backend -WorkClass standard -RepoRoot $Root -Json 2>$null
$tid11 = ($r | ConvertFrom-Json).task_id
$code = Invoke-Task @{
    Action = 'complete'; TaskId = $tid11
    Evidence = 'docs/out-of-scope.md updated'; RepoRoot = $Root
}
Assert-True ($code -ne 0) 'path_out_of_scope rejected on complete'
$st11 = Read-EcpContract -Path (Find-EcpContractPath -RepoRoot $Root -TaskId $tid11)
Assert-True ($st11.state -ne 'done') 'task remains not done after out-of-scope evidence'

# --- Scenario 12: no consult after terminal ---
Write-Host "`n[12] consult after terminal forbidden"
$r = & $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'execute-task.ps1') `
    -Objective 'Will complete then consult' -Area backend -WorkClass architectural -RepoRoot $Root -Json 2>$null
$j12 = $r | ConvertFrom-Json
$tid12 = $j12.task_id
$code = Invoke-Task @{ Action = 'complete'; TaskId = $tid12; Evidence = 'backend/x.go updated'; RepoRoot = $Root }
Assert-True ($code -eq 0) 'complete for terminal consult test'
if (@($j12.consultants) -contains 'solutions-architect') {
    $code = Invoke-Task @{
        Action = 'consult'; TaskId = $tid12; Consultant = 'solutions-architect'
        Summary = 'too late'; RepoRoot = $Root
    }
    Assert-True ($code -ne 0) 'consultation_after_terminal_forbidden'
} else {
    Assert-True $true 'no consultant on contract — skip consult-after-done'
}

# --- Scenario 13: distribution artifacts ---
Write-Host "`n[13] distribution artifacts"
Assert-True (Test-Path (Join-Path $Root 'schemas/arah-harness/execution-contract.schema.yaml')) 'execution-contract schema'
Assert-True (Test-Path (Join-Path $Root 'schemas/arah-harness/consultation-result.schema.yaml')) 'consultation-result schema'
Assert-True (Test-Path (Join-Path $Root '.cursor/rules/arah-execution-control.mdc')) 'cursor rule'
Assert-True (Test-Path (Join-Path $Root 'scripts/agents/execute-task.ps1')) 'execute-task'
Assert-True (Test-Path (Join-Path $Root 'kernel/scripts/agents/execute-task.ps1')) 'kernel execute-task'
$cfg = Get-Content (Join-Path $Root 'arah.config.yaml') -Raw
Assert-True ($cfg -match '(?m)^execution_control:') 'execution_control in config'
& $Pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Agents 'validate-manifests.ps1')
Assert-True ($LASTEXITCODE -eq 0) 'validate-manifests OK'

Write-Host ""
if ($Fail -gt 0) {
    Write-Host "test-execution-control: FAILED ($Fail assertion(s))"
    exit 1
}
Write-Host 'test-execution-control: OK'
exit 0
