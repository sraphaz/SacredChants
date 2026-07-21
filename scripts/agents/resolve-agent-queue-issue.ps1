#Requires -Version 5.1
<#
.SYNOPSIS
  Resolve agent-queue: claim → guidance → verify → OpenPr (branch/commit/push/gh pr create).
.DESCRIPTION
  Parte scriptável (sem LLM): após o código existir, -OpenPr cria um git worktree a partir
  de origin/main, copia -Paths, commit, push -u e gh pr create com Fixes #N.
  Nunca faz merge. Nunca inclui .env / segredos. Seguro com working tree suja.
.EXAMPLE
  ./scripts/agents/resolve-agent-queue-issue.ps1
  ./scripts/agents/resolve-agent-queue-issue.ps1 -IssueNumber 67 -Claim
  ./scripts/agents/resolve-agent-queue-issue.ps1 -IssueNumber 67 -OpenPr -Paths 'src/i18n/strings.ts,tests/unit/pt-copy-orthography.test.ts'
  ./scripts/agents/resolve-agent-queue-issue.ps1 -IssueNumber 67 -OpenPr -DryRun
#>
[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$Repo = 'sraphaz/SacredChants',
    [int]$IssueNumber = 0,
    [switch]$Claim,
    [switch]$OpenPr,
    [string[]]$Paths = @(),
    [string]$CommitMessage = '',
    [string]$BaseBranch = 'main',
    [string]$BranchName = '',
    [switch]$RemoveAgentQueueLabel,
    [switch]$KeepAgentQueueLabel,
    [string]$VerifyCommand = '',
    [switch]$DryRun,
    [switch]$Json,
    [switch]$GuidanceOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

$script:SecretNamePatterns = @(
    '^\.env$',
    '^\.env\..+',
    '\.pem$',
    '\.key$',
    'credentials\.json$',
    'secrets?\.json$',
    'id_rsa',
    '\.arah[/\\]local[/\\]'
)
$script:NoisePathPatterns = @(
    '^\.astro[/\\]',
    '^node_modules[/\\]',
    '^\.cursor[/\\]',
    '^public[/\\]favicon\.png$',
    '^\.DS_Store$',
    'Thumbs\.db$'
)

function Test-BlockedPath {
    param([string]$RelPath)
    $norm = ($RelPath -replace '\\', '/').TrimStart('./')
    $leaf = Split-Path -Leaf $norm
    foreach ($p in $script:SecretNamePatterns) {
        if ($leaf -match $p -or $norm -match $p) { return $true }
    }
    foreach ($p in $script:NoisePathPatterns) {
        if ($norm -match $p) { return $true }
    }
    return $false
}

function ConvertTo-Slug {
    param([string]$Text, [int]$MaxLen = 40)
    $s = $Text.ToLowerInvariant()
    $s = [regex]::Replace($s, '[^a-z0-9]+', '-')
    $s = $s.Trim('-')
    if ($s.Length -gt $MaxLen) { $s = $s.Substring(0, $MaxLen).Trim('-') }
    if (-not $s) { $s = 'fix' }
    return $s
}

function Invoke-GhJson {
    param([string[]]$GhArgs)
    $output = & gh @GhArgs | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw ("gh {0} failed (exit {1}): {2}" -f ($GhArgs -join ' '), $LASTEXITCODE, $output)
    }
    $text = $output.Trim()
    if (-not $text) { return $null }
    return ($text | ConvertFrom-Json)
}

function Invoke-GitQuiet {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = & git @GitArgs 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    return @{ Code = $code; Out = (($out | ForEach-Object { "$_" }) -join "`n") }
}

function Get-NextQueueIssue {
    param([string]$RepoName)
    $list = Invoke-GhJson -GhArgs @(
        'issue', 'list', '--repo', $RepoName,
        '--label', 'agent-queue', '--state', 'open', '--limit', '20',
        '--json', 'number,title,url,labels,createdAt'
    )
    if (-not $list -or @($list).Count -eq 0) { return $null }
    return (@($list) | Sort-Object createdAt | Select-Object -First 1)
}

function Get-IssueDetail {
    param([string]$RepoName, [int]$Number)
    return Invoke-GhJson -GhArgs @(
        'issue', 'view', "$Number", '--repo', $RepoName,
        '--json', 'number,title,url,body,labels,state'
    )
}

function Get-RepoHasLabel {
    param([string]$RepoName, [string]$Name)
    $labels = Invoke-GhJson -GhArgs @('label', 'list', '--repo', $RepoName, '--limit', '100', '--json', 'name')
    return [bool](@($labels) | Where-Object { $_.name -eq $Name })
}

function Write-HereDocFile {
    param([string]$Path, [string]$Content)
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Resolve-CommitPaths {
    param([string[]]$Requested, [string]$Root)
    Push-Location $Root
    try {
        if ($Requested -and $Requested.Count -gt 0) {
            $resolved = @()
            foreach ($p in $Requested) {
                foreach ($piece in ($p -split ',')) {
                    $t = $piece.Trim()
                    if (-not $t) { continue }
                    if (Test-BlockedPath $t) {
                        throw "Refusing to stage blocked path: $t"
                    }
                    if (-not (Test-Path -LiteralPath $t)) {
                        throw "Path not found: $t"
                    }
                    $resolved += $t
                }
            }
            return $resolved
        }

        $status = git status --porcelain -uall
        if (-not $status) {
            throw 'No paths given and working tree is clean — nothing to commit.'
        }
        $auto = @()
        foreach ($line in ($status -split "`n")) {
            if (-not $line.Trim()) { continue }
            $rel = $line.Substring(3).Trim()
            if ($rel -match ' -> ') { $rel = ($rel -split ' -> ')[-1] }
            if (Test-BlockedPath $rel) { continue }
            $auto += $rel
        }
        if ($auto.Count -eq 0) {
            throw 'Working tree has changes but all were excluded (secrets/noise). Pass -Paths explicitly.'
        }
        Write-Warning ("Auto-selected {0} path(s). Prefer -Paths for dirty trees." -f $auto.Count)
        return $auto
    } finally {
        Pop-Location
    }
}

# --- Resolve issue ---
if ($IssueNumber -le 0) {
    $next = Get-NextQueueIssue -RepoName $Repo
    if (-not $next) {
        if ($Json) {
            @{ ok = $true; issue = $null; message = 'agent-queue empty' } | ConvertTo-Json -Compress
        } else {
            Write-Host 'agent-queue: vazia — nada a resolver.'
        }
        exit 0
    }
    $IssueNumber = [int]$next.number
}

$issue = Get-IssueDetail -RepoName $Repo -Number $IssueNumber
if ($issue.state -ne 'OPEN') {
    Write-Error "Issue #${IssueNumber} is not OPEN (state=$($issue.state))"
    exit 1
}

$slug = ConvertTo-Slug -Text $issue.title
if (-not $BranchName) {
    $BranchName = "fix/agent-queue-$IssueNumber-$slug"
}

$guidance = @"
## Agent-queue guidance — #${IssueNumber}

**Title:** $($issue.title)
**URL:** $($issue.url)
**Branch (for -OpenPr):** $BranchName

### Loop (agent)
1. Scope: ``gh issue view ${IssueNumber} --repo $Repo``
2. ARAH: ``./scripts/agents/execute-task.ps1 -Objective "Fix #${IssueNumber}" -Area <area> -WorkClass standard``
3. Implement minimal fix + focused tests
4. Verify (unit/e2e as appropriate)
5. Open PR (scripted): ``./scripts/agents/resolve-agent-queue-issue.ps1 -IssueNumber ${IssueNumber} -OpenPr -Paths <file1,file2>``
6. Humans merge — **never** ``gh pr merge`` / auto-merge

### Guardrails
- No force-push to main
- No secrets (``.env``, ``.env.local``, keys)
- Prefer ``Fixes #${IssueNumber}`` for bugs
- Remove ``agent-queue`` after PR by default (use ``-KeepAgentQueueLabel`` to keep)
- Pass ``-Paths`` as a single comma-separated string when invoking via ``powershell -File``
"@

if ($GuidanceOnly -or (-not $OpenPr -and -not $Claim)) {
    if ($Json) {
        @{
            ok = $true
            issue = $issue
            branch = $BranchName
            guidance = $guidance
            openPrHint = "./scripts/agents/resolve-agent-queue-issue.ps1 -IssueNumber $IssueNumber -OpenPr -Paths <files>"
        } | ConvertTo-Json -Depth 6
    } else {
        Write-Host $guidance
    }
    if (-not $Claim -and -not $OpenPr) { exit 0 }
}

if ($Claim) {
    $claimBody = @"
agent-queue: picking up #${IssueNumber} for assisted/automated fix. Will open a PR when ready — humans merge.
"@
    if ($DryRun) {
        Write-Host "[dry-run] would comment claim on #${IssueNumber}"
    } else {
        $tmpClaim = Join-Path $env:TEMP ("aq-claim-$IssueNumber.txt")
        Write-HereDocFile -Path $tmpClaim -Content $claimBody
        & gh issue comment $IssueNumber --repo $Repo --body-file $tmpClaim | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'gh issue comment (claim) failed' }
        Write-Host "Claimed #${IssueNumber} (comment posted)."
    }
    if (-not $OpenPr) {
        if ($Json) {
            @{ ok = $true; claimed = $true; issue = $issue; branch = $BranchName } | ConvertTo-Json -Depth 5
        }
        exit 0
    }
}

if (-not $OpenPr) { exit 0 }

# --- OpenPr mode (git worktree — safe with dirty working tree) ---
$worktreePath = $null
Push-Location $repoRoot
try {
    if ($VerifyCommand) {
        Write-Host "Running verify: $VerifyCommand"
        if (-not $DryRun) {
            Invoke-Expression $VerifyCommand
            if ($LASTEXITCODE -ne 0) {
                throw "Verify command failed with exit $LASTEXITCODE"
            }
        }
    }

    $toStage = Resolve-CommitPaths -Requested $Paths -Root $repoRoot
    $current = (git rev-parse --abbrev-ref HEAD).Trim()
    $remoteBase = "origin/$BaseBranch"

    if ($DryRun) {
        Write-Host "[dry-run] branch=$BranchName base=$BaseBranch current=$current"
        Write-Host "[dry-run] would use git worktree + stage:"
        $toStage | ForEach-Object { Write-Host "  $_" }
        Write-Host "[dry-run] would push and gh pr create Fixes #${IssueNumber}"
        if ($Json) {
            @{
                ok = $true
                dryRun = $true
                issue = $IssueNumber
                branch = $BranchName
                paths = $toStage
            } | ConvertTo-Json -Depth 5
        }
        exit 0
    }

    if (-not $CommitMessage) {
        $CommitMessage = "fix: resolve agent-queue #${IssueNumber} — $($issue.title)"
        $isBug = @($issue.labels) | Where-Object { $_.name -eq 'bug' }
        if ($isBug) {
            $CommitMessage = "fix: $($issue.title -replace '^\[Bug\]\s*','') (#${IssueNumber})"
        }
    }

    $fetch = Invoke-GitQuiet fetch origin $BaseBranch
    if ($fetch.Code -ne 0) { Write-Warning "git fetch: $($fetch.Out)" }

    $worktreePath = Join-Path $env:TEMP ("sacredchants-aq-${IssueNumber}-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
    if (Test-Path -LiteralPath $worktreePath) {
        Remove-Item -LiteralPath $worktreePath -Recurse -Force
    }

    $refCheck = Invoke-GitQuiet show-ref --verify --quiet "refs/heads/$BranchName"
    if ($refCheck.Code -eq 0) {
        throw "Local branch already exists: $BranchName — delete it or pass -BranchName"
    }

    $baseRef = $remoteBase
    $baseOk = Invoke-GitQuiet rev-parse --verify $remoteBase
    if ($baseOk.Code -ne 0) { $baseRef = $BaseBranch }

    $wt = Invoke-GitQuiet worktree add -b $BranchName $worktreePath $baseRef
    if ($wt.Code -ne 0) {
        throw "git worktree add failed: $($wt.Out)"
    }
    Write-Host "Worktree: $worktreePath (branch $BranchName from $baseRef)"

    foreach ($p in $toStage) {
        if (Test-BlockedPath $p) { throw "Blocked path refused: $p" }
        $src = Join-Path $repoRoot $p
        $dest = Join-Path $worktreePath $p
        $destDir = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -LiteralPath $src -Destination $dest -Force
    }

    Push-Location $worktreePath
    try {
        foreach ($p in $toStage) {
            $add = Invoke-GitQuiet add -- $p
            if ($add.Code -ne 0) { throw "git add failed for ${p}: $($add.Out)" }
        }

        $stagedRaw = Invoke-GitQuiet diff --cached --name-only
        $stagedNames = @($stagedRaw.Out -split "`r?`n" | Where-Object { $_.Trim() })
        if ($stagedNames.Count -eq 0) {
            throw 'Nothing staged after git add — aborting.'
        }
        foreach ($s in $stagedNames) {
            if (Test-BlockedPath $s) {
                Invoke-GitQuiet reset HEAD -- $s | Out-Null
                throw "Refused secret/noise in index: $s"
            }
        }

        $msgFile = Join-Path $env:TEMP ("aq-commit-$IssueNumber.txt")
        Write-HereDocFile -Path $msgFile -Content "$CommitMessage`n"
        $commit = Invoke-GitQuiet commit -F $msgFile
        if ($commit.Code -ne 0) { throw "git commit failed: $($commit.Out)" }

        $push = Invoke-GitQuiet push -u origin HEAD
        if ($push.Code -ne 0) { throw "git push failed (no force): $($push.Out)" }

        $prBody = @"
## Summary
- Autonomous agent-queue resolution for #${IssueNumber}
- $($issue.title)
- Includes agent-queue → OpenPr automation when those files are in ``-Paths``

## Test plan
- [ ] Review diff for scope
- [ ] Run focused unit/e2e if applicable
- [ ] Confirm no secrets in commit

Fixes #${IssueNumber}
"@
        $prBodyFile = Join-Path $env:TEMP ("aq-pr-$IssueNumber.md")
        Write-HereDocFile -Path $prBodyFile -Content $prBody

        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $prOut = & gh pr create --repo $Repo --title $CommitMessage --body-file $prBodyFile --base $BaseBranch 2>&1
        $prCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEap
        if ($prCode -ne 0) {
            throw "gh pr create failed: $prOut"
        }
        $prUrl = ($prOut | Select-Object -Last 1).ToString().Trim()

        $comment = @"
Ready for review: $prUrl

agent-queue automation opened this PR. **Humans merge** — agents never merge.
"@
        $commentFile = Join-Path $env:TEMP ("aq-pr-comment-$IssueNumber.txt")
        Write-HereDocFile -Path $commentFile -Content $comment
        & gh issue comment $IssueNumber --repo $Repo --body-file $commentFile | Out-Null

        $hasReady = Get-RepoHasLabel -RepoName $Repo -Name 'ready-for-review'
        if ($hasReady) {
            & gh issue edit $IssueNumber --repo $Repo --add-label 'ready-for-review' | Out-Null
        }

        $removeQueue = $RemoveAgentQueueLabel -or (-not $KeepAgentQueueLabel)
        if ($removeQueue) {
            $prevEap2 = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & gh issue edit $IssueNumber --repo $Repo --remove-label 'agent-queue' | Out-Null
            $ErrorActionPreference = $prevEap2
        }

        Write-Host "PR: $prUrl"
        if ($Json) {
            @{
                ok = $true
                issue = $IssueNumber
                branch = $BranchName
                prUrl = $prUrl
                paths = $stagedNames
                removedAgentQueueLabel = [bool]$removeQueue
            } | ConvertTo-Json -Depth 5
        }
    } finally {
        Pop-Location
    }
} finally {
    if ($worktreePath) {
        $rm = Invoke-GitQuiet worktree remove --force $worktreePath
        if ($rm.Code -ne 0) {
            Write-Warning "worktree remove: $($rm.Out)"
        }
    }
    Pop-Location
}
