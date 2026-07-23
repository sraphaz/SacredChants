#Requires -Version 5.1
<#
.SYNOPSIS
  Biblioteca do Execution Control Protocol — contratos, limites, seleção de executor.
.NOTES
  Dot-source apenas. Não simula LLM; produz e valida artefatos determinísticos.
#>

$script:EcpTerminalStates = @('done', 'blocked')
$script:EcpValidTransitions = @{
    'intake'     = @('routed', 'blocked')
    'routed'     = @('executing', 'blocked')
    'executing'  = @('verifying', 'blocked', 'done')
    'verifying'  = @('done', 'blocked', 'executing')
    'done'       = @()
    'blocked'    = @()
}

function Get-EcpRepoRoot {
    param([string]$Start = $PSScriptRoot)
    $cand = Resolve-Path (Join-Path $Start '..\..') -ErrorAction SilentlyContinue
    if ($cand) { return $cand.Path }
    return (Get-Location).Path
}

function Get-EcpExecutionRoot {
    param([string]$RepoRoot)
    return (Join-Path $RepoRoot '.arah/local/execution')
}

function Ensure-EcpLedgerDirs {
    param([string]$RepoRoot)
    $root = Get-EcpExecutionRoot -RepoRoot $RepoRoot
    foreach ($sub in @('active', 'completed', 'blocked')) {
        $p = Join-Path $root $sub
        if (-not (Test-Path -LiteralPath $p)) {
            New-Item -ItemType Directory -Path $p -Force | Out-Null
        }
    }
    return $root
}

function Get-EcpConfig {
    param([string]$RepoRoot)
    $defaults = [ordered]@{
        enabled = $true
        terminal_states = @('done', 'blocked')
        limits = [ordered]@{
            max_handoffs = 2
            max_consultations = 2
            max_analysis_cycles = 1
        }
        behavior = [ordered]@{
            require_primary_executor = $true
            forbid_consultant_to_consultant_handoff = $true
            require_completion_evidence = $true
            require_blocking_reason = $true
            prevent_reroute_after_execution_started = $true
        }
        work_classes = [ordered]@{
            trivial = [ordered]@{
                spec_required = $false
                max_consultations = 0
                max_handoffs = 0
                max_analysis_cycles = 0
            }
            standard = [ordered]@{
                lightweight_spec = $true
                max_consultations = 1
                max_handoffs = 1
                max_analysis_cycles = 1
            }
            architectural = [ordered]@{
                full_spec_required = $true
                max_consultations = 2
                max_handoffs = 2
                max_analysis_cycles = 1
            }
            release = [ordered]@{
                release_approval_required = $true
                human_gate_required = $true
                max_consultations = 2
                max_handoffs = 1
                max_analysis_cycles = 1
            }
        }
    }

    $cfgPath = Join-Path $RepoRoot 'arah.config.yaml'
    if (-not (Test-Path -LiteralPath $cfgPath)) { return $defaults }

    $raw = Get-Content -LiteralPath $cfgPath -Raw
    if ($raw -match '(?m)^\s*execution_control:\s*$') {
        if ($raw -match '(?m)^\s+enabled:\s*(true|false)') {
            $defaults.enabled = ($Matches[1] -eq 'true')
        }
        if ($raw -match '(?m)^\s+max_handoffs:\s*(\d+)') {
            $defaults.limits.max_handoffs = [int]$Matches[1]
        }
        if ($raw -match '(?m)^\s+max_consultations:\s*(\d+)') {
            $defaults.limits.max_consultations = [int]$Matches[1]
        }
        if ($raw -match '(?m)^\s+max_analysis_cycles:\s*(\d+)') {
            $defaults.limits.max_analysis_cycles = [int]$Matches[1]
        }
    } elseif ($raw -notmatch '(?m)^execution_control:') {
        # Absent → new default enabled (migration adds explicit block on regenerate)
        $defaults.enabled = $true
    }
    return $defaults
}

function New-EcpTaskId {
    param([string]$RepoRoot = '')
    # Second granularity alone collides under automation; millis + short suffix keep IDs unique.
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmssfff'
    $suffix = ([guid]::NewGuid().ToString('n')).Substring(0, 6)
    $id = 'task-{0}-{1}' -f $stamp, $suffix
    if ($RepoRoot) {
        $n = 0
        while ((Find-EcpContractPath -RepoRoot $RepoRoot -TaskId $id) -and $n -lt 5) {
            $suffix = ([guid]::NewGuid().ToString('n')).Substring(0, 6)
            $id = 'task-{0}-{1}' -f $stamp, $suffix
            $n++
        }
    }
    return $id
}

function Get-EcpPathsFromEvidence {
    param([string[]]$Evidence)
    $paths = @()
    foreach ($e in @($Evidence)) {
        if ($e -match '([\w./\\-]+\.(?:ts|tsx|js|go|ps1|yaml|yml|md|json))') {
            $paths += ($Matches[1] -replace '\\', '/')
        }
    }
    return @($paths | Select-Object -Unique)
}

function Test-EcpPathInScope {
    param(
        [string]$FilePath,
        [string[]]$AllowedPaths,
        [string[]]$ForbiddenPaths = @()
    )
    $cf = $FilePath.Replace('\', '/')
    foreach ($fp in @($ForbiddenPaths)) {
        $fprefix = ($fp -replace '\*\*.*$', '' -replace '\*$', '').TrimEnd('/')
        if ($fprefix -and $cf -like ($fprefix + '*')) { return $false }
        if ($fp -eq '**') { return $false }
    }
    $paths = @($AllowedPaths)
    if ($paths.Count -eq 0) { return $true }
    foreach ($p in $paths) {
        if ($p -eq '**' -or $p -eq '**/*') { return $true }
        $prefix = ($p -replace '\*\*.*$', '' -replace '\*$', '').TrimEnd('/')
        if (-not $prefix -or $cf -like ($prefix + '*')) { return $true }
    }
    return $false
}

function Get-EcpWorkClassPolicy {
    param(
        [string]$WorkClass,
        [System.Collections.IDictionary]$Config
    )
    $wc = $WorkClass.ToLowerInvariant()
    if ($Config.work_classes.Contains($wc)) {
        return $Config.work_classes[$wc]
    }
    return $Config.work_classes['standard']
}

function ConvertTo-EcpYamlScalar {
    param($Value)
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [bool]) { if ($Value) { return 'true' } else { return 'false' } }
    if ($Value -is [int] -or $Value -is [long] -or $Value -is [double]) { return "$Value" }
    $s = [string]$Value
    if ($s -match '[:#\[\]\{\},&*!|>''"%@`]|^\s|\s$|^$|^(true|false|null)$') {
        return ("'{0}'" -f ($s -replace "'", "''"))
    }
    return $s
}

function Write-EcpYamlList {
    param(
        [System.Text.StringBuilder]$Sb,
        [string]$Indent,
        [string]$Key,
        [object[]]$Items
    )
    if ($null -eq $Items -or $Items.Count -eq 0) {
        [void]$Sb.AppendLine("$Indent${Key}: []")
        return
    }
    [void]$Sb.AppendLine("$Indent${Key}:")
    foreach ($i in $Items) {
        [void]$Sb.AppendLine("$Indent  - $(ConvertTo-EcpYamlScalar $i)")
    }
}

function ConvertTo-EcpContractYaml {
    param([System.Collections.IDictionary]$Contract)
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine('version: "1.0"')
    [void]$sb.AppendLine("task_id: $(ConvertTo-EcpYamlScalar $Contract.task_id)")
    [void]$sb.AppendLine("objective: $(ConvertTo-EcpYamlScalar $Contract.objective)")
    [void]$sb.AppendLine("work_class: $(ConvertTo-EcpYamlScalar $Contract.work_class)")
    [void]$sb.AppendLine("intent_type: $(ConvertTo-EcpYamlScalar $Contract.intent_type)")
    [void]$sb.AppendLine("state: $(ConvertTo-EcpYamlScalar $Contract.state)")
    [void]$sb.AppendLine("primary_executor: $(ConvertTo-EcpYamlScalar $Contract.primary_executor)")
    if ($Contract.choreography_rule) {
        [void]$sb.AppendLine("choreography_rule: $(ConvertTo-EcpYamlScalar $Contract.choreography_rule)")
    }
    [void]$sb.AppendLine('participants:')
    Write-EcpYamlList $sb '  ' 'consultants' @($Contract.participants.consultants)
    Write-EcpYamlList $sb '  ' 'reviewers' @($Contract.participants.reviewers)
    Write-EcpYamlList $sb '  ' 'subordinates' @($Contract.participants.subordinates)
    [void]$sb.AppendLine('scope:')
    [void]$sb.AppendLine("  area: $(ConvertTo-EcpYamlScalar $Contract.scope.area)")
    Write-EcpYamlList $sb '  ' 'allowed_paths' @($Contract.scope.allowed_paths)
    Write-EcpYamlList $sb '  ' 'forbidden_paths' @($Contract.scope.forbidden_paths)
    [void]$sb.AppendLine('execution:')
    Write-EcpYamlList $sb '  ' 'expected_outputs' @($Contract.execution.expected_outputs)
    Write-EcpYamlList $sb '  ' 'verification_commands' @($Contract.execution.verification_commands)
    Write-EcpYamlList $sb '  ' 'completion_evidence' @($Contract.execution.completion_evidence)
    [void]$sb.AppendLine('limits:')
    [void]$sb.AppendLine("  max_handoffs: $($Contract.limits.max_handoffs)")
    [void]$sb.AppendLine("  max_consultations: $($Contract.limits.max_consultations)")
    [void]$sb.AppendLine("  max_analysis_cycles: $($Contract.limits.max_analysis_cycles)")
    [void]$sb.AppendLine('counters:')
    [void]$sb.AppendLine("  handoffs: $($Contract.counters.handoffs)")
    [void]$sb.AppendLine("  consultations: $($Contract.counters.consultations)")
    [void]$sb.AppendLine("  analysis_cycles: $($Contract.counters.analysis_cycles)")
    [void]$sb.AppendLine('policy:')
    foreach ($k in @($Contract.policy.Keys)) {
        [void]$sb.AppendLine("  ${k}: $(ConvertTo-EcpYamlScalar $Contract.policy[$k])")
    }
    [void]$sb.AppendLine('result:')
    Write-EcpYamlList $sb '  ' 'changed_files' @($Contract.result.changed_files)
    Write-EcpYamlList $sb '  ' 'commands_executed' @($Contract.result.commands_executed)
    Write-EcpYamlList $sb '  ' 'evidence' @($Contract.result.evidence)
    [void]$sb.AppendLine("  blocking_reason: $(ConvertTo-EcpYamlScalar $Contract.result.blocking_reason)")
    if ($Contract.history -and $Contract.history.Count -gt 0) {
        [void]$sb.AppendLine('history:')
        foreach ($h in $Contract.history) {
            [void]$sb.AppendLine("  - at: $(ConvertTo-EcpYamlScalar $h.at)")
            [void]$sb.AppendLine("    from: $(ConvertTo-EcpYamlScalar $h.from)")
            [void]$sb.AppendLine("    to: $(ConvertTo-EcpYamlScalar $h.to)")
            if ($h.note) {
                [void]$sb.AppendLine("    note: $(ConvertTo-EcpYamlScalar $h.note)")
            }
        }
    } else {
        [void]$sb.AppendLine('history: []')
    }
    return $sb.ToString()
}

function Write-EcpAtomicFile {
    param(
        [string]$Path,
        [string]$Content
    )
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $tmp = "$Path.$([guid]::NewGuid().ToString('n')).tmp"
    try {
        Set-Content -LiteralPath $tmp -Value $Content -Encoding UTF8
        Move-Item -LiteralPath $tmp -Destination $Path -Force
    } finally {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
    }
}

function ConvertFrom-EcpContractYaml {
    param([string]$Raw)
    # YAML-lite parser for contracts we emit (controlled shape).
    $c = [ordered]@{
        version = '1.0'
        task_id = ''
        objective = ''
        work_class = 'standard'
        intent_type = 'execution'
        state = 'intake'
        primary_executor = $null
        choreography_rule = $null
        participants = [ordered]@{ consultants = @(); reviewers = @(); subordinates = @() }
        scope = [ordered]@{ area = ''; allowed_paths = @(); forbidden_paths = @() }
        execution = [ordered]@{ expected_outputs = @(); verification_commands = @(); completion_evidence = @() }
        limits = [ordered]@{ max_handoffs = 2; max_consultations = 2; max_analysis_cycles = 1 }
        counters = [ordered]@{ handoffs = 0; consultations = 0; analysis_cycles = 0 }
        policy = [ordered]@{}
        result = [ordered]@{ changed_files = @(); commands_executed = @(); evidence = @(); blocking_reason = $null }
        history = @()
    }

    function Read-Scalar([string]$line) {
        if ($line -match ':\s*(.*)$') {
            $v = $Matches[1].Trim()
            if ($v -eq 'null' -or $v -eq '~' -or $v -eq '') { return $null }
            if ($v -eq 'true') { return $true }
            if ($v -eq 'false') { return $false }
            if ($v -match '^''(.*)''$') { return $Matches[1] -replace "''", "'" }
            if ($v -match '^"(.*)"$') { return $Matches[1] }
            if ($v -eq '[]') { return @() }
            return $v
        }
        return $null
    }

    $lines = $Raw -split "`r?`n"
    $section = ''
    $sub = ''
    $hist = $null
    foreach ($line in $lines) {
        if ($line -match '^\s*$' -or $line -match '^\s*#') { continue }
        if ($line -match '^(version|task_id|objective|work_class|intent_type|state|primary_executor|choreography_rule):\s*') {
            $key = $Matches[1]
            $c[$key] = Read-Scalar $line
            $section = ''; $sub = ''
            continue
        }
        if ($line -match '^(participants|scope|execution|limits|counters|policy|result|history):\s*$') {
            $section = $Matches[1]; $sub = ''; continue
        }
        if ($section -eq 'history' -and $line -match '^\s+-\s+at:\s*(.+)$') {
            if ($hist) { $c.history += $hist }
            $hist = [ordered]@{ at = (Read-Scalar ("at: $($Matches[1])")); from = ''; to = ''; note = $null }
            continue
        }
        if ($section -eq 'history' -and $hist -and $line -match '^\s+(from|to|note):\s*') {
            $hk = $Matches[1]
            $hist[$hk] = Read-Scalar $line
            continue
        }
        if ($line -match '^\s{2}(consultants|reviewers|subordinates|allowed_paths|forbidden_paths|expected_outputs|verification_commands|completion_evidence|changed_files|commands_executed|evidence):\s*(.*)$') {
            $sub = $Matches[1]
            $rest = $Matches[2].Trim()
            $target = $null
            if ($section -eq 'participants') { $target = $c.participants }
            elseif ($section -eq 'scope') { $target = $c.scope }
            elseif ($section -eq 'execution') { $target = $c.execution }
            elseif ($section -eq 'result') { $target = $c.result }
            if ($target -and $rest -eq '[]') { $target[$sub] = @(); $sub = ''; continue }
            if ($target) { $target[$sub] = @() }
            continue
        }
        if ($sub -and $line -match '^\s+-\s+(.+)$') {
            $item = $Matches[1].Trim().Trim("'").Trim('"')
            $target = $null
            if ($section -eq 'participants') { $target = $c.participants }
            elseif ($section -eq 'scope') { $target = $c.scope }
            elseif ($section -eq 'execution') { $target = $c.execution }
            elseif ($section -eq 'result') { $target = $c.result }
            if ($target) { $target[$sub] = @($target[$sub] + $item) }
            continue
        }
        if ($section -eq 'scope' -and $line -match '^\s{2}area:\s*') {
            $c.scope.area = Read-Scalar $line
            continue
        }
        if ($section -eq 'limits' -and $line -match '^\s{2}(max_handoffs|max_consultations|max_analysis_cycles):\s*(\d+)') {
            $c.limits[$Matches[1]] = [int]$Matches[2]
            continue
        }
        if ($section -eq 'counters' -and $line -match '^\s{2}(handoffs|consultations|analysis_cycles):\s*(\d+)') {
            $c.counters[$Matches[1]] = [int]$Matches[2]
            continue
        }
        if ($section -eq 'policy' -and $line -match '^\s{2}([\w_]+):\s*') {
            $c.policy[$Matches[1]] = Read-Scalar $line
            continue
        }
        if ($section -eq 'result' -and $line -match '^\s{2}blocking_reason:\s*') {
            $c.result.blocking_reason = Read-Scalar $line
            continue
        }
    }
    if ($hist) { $c.history += $hist }
    return $c
}

function Read-EcpContract {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "execution contract not found: $Path"
    }
    return (ConvertFrom-EcpContractYaml (Get-Content -LiteralPath $Path -Raw))
}

function Find-EcpContractPath {
    param(
        [string]$RepoRoot,
        [string]$TaskId
    )
    $root = Get-EcpExecutionRoot -RepoRoot $RepoRoot
    foreach ($bucket in @('active', 'completed', 'blocked')) {
        $p = Join-Path (Join-Path $root $bucket) "$TaskId.yaml"
        if (Test-Path -LiteralPath $p) { return $p }
    }
    return $null
}

function Save-EcpContract {
    param(
        [string]$RepoRoot,
        [System.Collections.IDictionary]$Contract
    )
    $ledger = Ensure-EcpLedgerDirs -RepoRoot $RepoRoot
    $bucket = switch ($Contract.state) {
        'done' { 'completed' }
        'blocked' { 'blocked' }
        default { 'active' }
    }
    # Remove from other buckets (atomic move semantics)
    foreach ($b in @('active', 'completed', 'blocked')) {
        $old = Join-Path (Join-Path $ledger $b) "$($Contract.task_id).yaml"
        if ($b -ne $bucket -and (Test-Path -LiteralPath $old)) {
            Remove-Item -LiteralPath $old -Force
        }
    }
    $dest = Join-Path (Join-Path $ledger $bucket) "$($Contract.task_id).yaml"
    $yaml = ConvertTo-EcpContractYaml -Contract $Contract
    Write-EcpAtomicFile -Path $dest -Content $yaml

    # Per-task consultation dir
    $taskDir = Join-Path $ledger $Contract.task_id
    $consultDir = Join-Path $taskDir 'consultations'
    if (-not (Test-Path -LiteralPath $consultDir)) {
        New-Item -ItemType Directory -Path $consultDir -Force | Out-Null
    }
    return $dest
}

function Add-EcpHistory {
    param(
        [System.Collections.IDictionary]$Contract,
        [string]$From,
        [string]$To,
        [string]$Note = ''
    )
    $entry = [ordered]@{
        at = (Get-Date).ToUniversalTime().ToString('o')
        from = $From
        to = $To
        note = $Note
    }
    $Contract.history = @($Contract.history) + @($entry)
}

function Test-EcpTransitionAllowed {
    param([string]$From, [string]$To)
    if (-not $script:EcpValidTransitions.ContainsKey($From)) { return $false }
    return ($script:EcpValidTransitions[$From] -contains $To)
}

function Set-EcpState {
    param(
        [System.Collections.IDictionary]$Contract,
        [string]$NewState,
        [string]$Note = ''
    )
    $from = [string]$Contract.state
    if ($from -eq $NewState) { return }
    if (-not (Test-EcpTransitionAllowed -From $from -To $NewState)) {
        throw "invalid_state_transition:$from->$NewState"
    }
    Add-EcpHistory -Contract $Contract -From $from -To $NewState -Note $Note
    $Contract.state = $NewState
}

function Get-EcpAgentExecutionRole {
    param(
        [string]$RepoRoot,
        [string]$AgentId
    )
    $role = [ordered]@{
        can_route = $false
        can_execute = $false
        can_consult = $false
        can_review = $false
        found = $false
        path = $null
    }
    $agentsRoot = Join-Path $RepoRoot '.agents'
    $files = Get-ChildItem -Path $agentsRoot -Recurse -Filter '*.agent.yaml' -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        $raw = Get-Content -LiteralPath $f.FullName -Raw
        if ($raw -notmatch "(?m)^id:\s*$([regex]::Escape($AgentId))\s*$") { continue }
        $role.found = $true
        $role.path = $f.FullName
        if ($raw -match '(?ms)^execution_role:\s*\r?\n(.*?)(?=^[A-Za-z_]|\z)') {
            $block = $Matches[1]
            if ($block -match '(?m)^\s+can_route:\s*(true|false)') { $role.can_route = $Matches[1] -eq 'true' }
            if ($block -match '(?m)^\s+can_execute:\s*(true|false)') { $role.can_execute = $Matches[1] -eq 'true' }
            if ($block -match '(?m)^\s+can_consult:\s*(true|false)') { $role.can_consult = $Matches[1] -eq 'true' }
            if ($block -match '(?m)^\s+can_review:\s*(true|false)') { $role.can_review = $Matches[1] -eq 'true' }
        } else {
            # Fallback heuristics for unmigrated manifests
            if ($AgentId -eq 'orchestrator') { $role.can_route = $true }
            elseif ($AgentId -in @('backend', 'frontend', 'docs-steward', 'solutions-architect', 'spec-steward', 'planner', 'release')) {
                $role.can_execute = $true
                $role.can_consult = $true
            }
            elseif ($AgentId -in @('qa', 'pr-steward', 'security')) { $role.can_review = $true }
            else { $role.can_consult = $true }
        }
        break
    }
    return $role
}

function Resolve-EcpAreaPaths {
    param([string]$Area)
    $map = @{
        backend = @('backend/**', 'src/**/api/**', 'services/**')
        frontend = @('frontend/**', 'apps/web/**', 'apps/mobile/**')
        docs = @('docs/**')
        architecture = @('docs/architecture/**', 'docs/design/**', 'docs/adr/**')
        spec = @('docs/specs/**', 'scripts/harness/**')
        sdd = @('docs/specs/**')
        testing = @('tests/**', 'e2e/**', 'docs/testing/**')
        ops = @('.github/workflows/**', 'infrastructure/**')
        security = @('**')
        harness = @('kernel/**', '.agents/**', 'scripts/**', 'schemas/**')
    }
    $key = $Area.ToLowerInvariant()
    if ($map.ContainsKey($key)) { return @($map[$key]) }
    return @("$key/**")
}

function Resolve-EcpPrimaryExecutor {
    param(
        [string]$RepoRoot,
        [string]$Area,
        [string]$PreferredExecutor = ''
    )
    . (Join-Path $PSScriptRoot 'get-choreography-rules.ps1')
    $rules = Get-AllChoreographyRules -Root $RepoRoot
    $areaPaths = Resolve-EcpAreaPaths -Area $Area

    $matched = $null
    foreach ($rule in $rules) {
        if ($rule.when -eq 'pull_request') { continue }
        foreach ($ap in $areaPaths) {
            foreach ($rp in @($rule.paths)) {
                if ($rp -eq $ap -or $ap.StartsWith(($rp -replace '\*\*.*$', '')) -or $rp.StartsWith(($ap -replace '\*\*.*$', ''))) {
                    $matched = $rule
                    break
                }
            }
            if ($matched) { break }
        }
        if ($matched) { break }
        # Also match by area name heuristics on rule id
        if ($rule.id -match [regex]::Escape($Area)) { $matched = $rule; break }
    }

    # Area routing shortcuts (orchestrator table)
    $areaExec = @{
        backend = 'backend'
        frontend = 'frontend'
        docs = 'docs-steward'
        spec = 'spec-steward'
        sdd = 'spec-steward'
        architecture = 'solutions-architect'
        ops = 'release'
        security = 'security'
        planning = 'planner'
        testing = 'qa'
        harness = 'docs-steward'
    }

    $executors = @()
    $consultants = @()
    $reviewers = @()
    $ruleId = $null

    if ($matched) {
        $ruleId = $matched.id
        if ($matched.primary_executor) {
            $executors += $matched.primary_executor
        }
        foreach ($a in @($matched.agents)) {
            $roleHint = 'auto'
            if ($a -is [hashtable] -and $a.ContainsKey('role') -and $a.role) {
                $roleHint = [string]$a.role
            } elseif ($a.PSObject.Properties['role'] -and $a.role) {
                $roleHint = [string]$a.role
            }
            if ($matched.primary_executor -and $a.id -eq $matched.primary_executor) {
                if ($executors -notcontains $a.id) { $executors += $a.id }
                continue
            }
            if ($a.type -eq 'domain' -or $a.type -eq 'specialist') {
                $consultants += $a.id
            } elseif ($roleHint -eq 'executor' -or ($a.autonomy -contains 'execute_change')) {
                if ($executors -notcontains $a.id) { $executors += $a.id }
            } elseif ($roleHint -eq 'consultant' -or ($a.autonomy -contains 'consult') -or ($a.autonomy -contains 'consult_post')) {
                $consultants += $a.id
            } elseif ($roleHint -eq 'reviewer' -or $a.id -in @('qa', 'pr-steward', 'security')) {
                $reviewers += $a.id
            } elseif ($a.type -eq 'operational' -and $a.id -ne 'orchestrator') {
                if ($executors -notcontains $a.id) { $executors += $a.id }
            }
        }
    }

    $areaKey = $Area.ToLowerInvariant()
    # Canonical area → executor map wins for primary selection (overlays may match first)
    if (-not $PreferredExecutor -and $areaExec.ContainsKey($areaKey)) {
        $PreferredExecutor = $areaExec[$areaKey]
    }
    if ($PreferredExecutor) {
        # Exactly one primary; demote other operational candidates from mismatched overlays
        foreach ($extra in @($executors | Where-Object { $_ -ne $PreferredExecutor })) {
            if ($consultants -notcontains $extra) { $consultants += $extra }
        }
        $executors = @($PreferredExecutor)
        # Prefer choreography rule that declares this primary_executor
        foreach ($rule in $rules) {
            if ($rule.when -eq 'pull_request') { continue }
            if ($rule.primary_executor -eq $PreferredExecutor) {
                $matched = $rule
                $ruleId = $rule.id
                foreach ($a in @($rule.agents)) {
                    if ($a.id -eq $PreferredExecutor) { continue }
                    if ($a.type -eq 'domain' -or ($a.role -eq 'consultant') -or ($a.autonomy -contains 'consult') -or ($a.autonomy -contains 'consult_post')) {
                        if ($consultants -notcontains $a.id) { $consultants += $a.id }
                    } elseif ($a.role -eq 'reviewer' -or $a.id -in @('qa', 'pr-steward', 'security')) {
                        if ($reviewers -notcontains $a.id) { $reviewers += $a.id }
                    }
                }
                break
            }
        }
    } elseif ($executors.Count -eq 0) {
        throw 'exactly_one_primary_executor_required:no_eligible_executor'
    }

    $executors = @($executors | Select-Object -Unique)
    $consultants = @($consultants | Where-Object { $_ -notin $executors } | Select-Object -Unique)
    $reviewers = @($reviewers | Where-Object { $_ -notin $executors -and $_ -notin $consultants } | Select-Object -Unique)

    if ($executors.Count -eq 0) {
        throw 'exactly_one_primary_executor_required:no_eligible_executor'
    }

    $primary = $executors[0]
    $subordinates = @()
    if ($executors.Count -gt 1) {
        # Canonical: first is primary; others are subordinates (not co-executors)
        $subordinates = @($executors | Select-Object -Skip 1)
    }

    $role = Get-EcpAgentExecutionRole -RepoRoot $RepoRoot -AgentId $primary
    if ($role.found -and -not $role.can_execute -and -not $role.can_route) {
        # reviewers-only cannot execute
        if (-not $role.can_execute) {
            throw "executor_lacks_capability:$primary"
        }
    }
    if ($role.found -and $role.can_route -and -not $role.can_execute -and $primary -eq 'orchestrator') {
        throw 'orchestrator_cannot_be_primary_executor'
    }

    return [ordered]@{
        primary_executor = $primary
        consultants = $consultants
        reviewers = $reviewers
        subordinates = $subordinates
        choreography_rule = $ruleId
        allowed_paths = $areaPaths
        ambiguous_executors = @($executors)
    }
}

function New-EcpContract {
    param(
        [string]$RepoRoot,
        [string]$Objective,
        [string]$Area = 'backend',
        [string]$WorkClass = 'standard',
        [string]$IntentType = 'execution',
        [string]$PreferredExecutor = '',
        [string[]]$ExpectedOutputs = @(),
        [string[]]$VerificationCommands = @()
    )
    $cfg = Get-EcpConfig -RepoRoot $RepoRoot
    $policy = Get-EcpWorkClassPolicy -WorkClass $WorkClass -Config $cfg
    $resolved = Resolve-EcpPrimaryExecutor -RepoRoot $RepoRoot -Area $Area -PreferredExecutor $PreferredExecutor

    # Trivial: strip consultants
    $consultants = @($resolved.consultants)
    $maxConsult = $cfg.limits.max_consultations
    $maxHand = $cfg.limits.max_handoffs
    $maxAnal = $cfg.limits.max_analysis_cycles
    if ($policy.Contains('max_consultations')) { $maxConsult = [int]$policy.max_consultations }
    if ($policy.Contains('max_handoffs')) { $maxHand = [int]$policy.max_handoffs }
    if ($policy.Contains('max_analysis_cycles')) { $maxAnal = [int]$policy.max_analysis_cycles }
    if ($maxConsult -eq 0) { $consultants = @() }

    $contract = [ordered]@{
        version = '1.0'
        task_id = (New-EcpTaskId -RepoRoot $RepoRoot)
        objective = $Objective
        work_class = $WorkClass.ToLowerInvariant()
        intent_type = $IntentType.ToLowerInvariant()
        state = 'intake'
        primary_executor = $resolved.primary_executor
        choreography_rule = $resolved.choreography_rule
        participants = [ordered]@{
            consultants = $consultants
            reviewers = @($resolved.reviewers)
            subordinates = @($resolved.subordinates)
        }
        scope = [ordered]@{
            area = $Area
            allowed_paths = @($resolved.allowed_paths)
            forbidden_paths = @()
        }
        execution = [ordered]@{
            expected_outputs = @($ExpectedOutputs)
            verification_commands = @($VerificationCommands)
            completion_evidence = @()
        }
        limits = [ordered]@{
            max_handoffs = $maxHand
            max_consultations = $maxConsult
            max_analysis_cycles = $maxAnal
        }
        counters = [ordered]@{
            handoffs = 0
            consultations = 0
            analysis_cycles = 0
        }
        policy = [ordered]@{}
        result = [ordered]@{
            changed_files = @()
            commands_executed = @()
            evidence = @()
            blocking_reason = $null
        }
        history = @()
    }
    foreach ($k in @($policy.Keys)) {
        if ($k -notmatch '^max_') { $contract.policy[$k] = $policy[$k] }
    }
    Add-EcpHistory -Contract $contract -From 'none' -To 'intake' -Note 'contract created'
    return $contract
}

function Test-EcpConcreteEvidence {
    param(
        [System.Collections.IDictionary]$Contract,
        [string[]]$Evidence
    )
    if ($Contract.intent_type -ne 'execution') {
        return ($Evidence.Count -gt 0 -or @($Contract.execution.completion_evidence).Count -gt 0)
    }
    $all = @($Evidence) + @($Contract.execution.completion_evidence) + @($Contract.result.evidence) + @($Contract.result.changed_files) + @($Contract.result.commands_executed)
    $all = @($all | Where-Object { $_ })
    if ($all.Count -eq 0) { return $false }
    # Reject pure analysis markers
    $concrete = $false
    foreach ($e in $all) {
        $s = [string]$e
        if ($s -match '(?i)(updated|created|removed|deleted|wrote|patched|test(s)?\s+(pass|ok|green)|executed|file:|path:|\.(ts|tsx|js|go|ps1|yaml|yml|md)\b)') {
            $concrete = $true
            break
        }
        if ($s -match '(?i)^(analy[sz]e|análise|parecer|review only)') { continue }
        # any changed file path counts
        if ($s -match '[\\/]' -or $s -match '\.') { $concrete = $true; break }
    }
    return $concrete
}
