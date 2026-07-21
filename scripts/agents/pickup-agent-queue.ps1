#Requires -Version 5.1
<#
.SYNOPSIS
  Lista/seleciona a próxima issue aberta com label agent-queue.
.DESCRIPTION
  Pickup estruturado para agentes: escolhe o próximo item, opcionalmente grava o body
  em disco, e imprime number/title/url/bodyPath. Não cria branch nem PR.
.EXAMPLE
  ./scripts/agents/pickup-agent-queue.ps1
  ./scripts/agents/pickup-agent-queue.ps1 -Json -WriteBody
  ./scripts/agents/pickup-agent-queue.ps1 -IssueNumber 67 -WriteBody
#>
param(
    [string]$Repo = 'sraphaz/SacredChants',
    [int]$IssueNumber = 0,
    [switch]$RequireBugLabel,
    [switch]$Json,
    [switch]$WriteBody,
    [string]$BodyDir = '',
    [int]$Limit = 5
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $BodyDir) {
    $BodyDir = Join-Path $repoRoot '.arah\local\agent-queue'
}

function Get-AgentQueueIssues {
    param([string]$RepoName, [switch]$BugOnly, [int]$Max)
    $labelArgs = @('--label', 'agent-queue')
    if ($BugOnly) { $labelArgs += @('--label', 'bug') }
    $raw = gh issue list --repo $RepoName @labelArgs --state open --limit $Max `
        --json number,title,url,labels,createdAt,assignees 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "gh issue list failed: $raw"
    }
    @($raw | ConvertFrom-Json)
}

function Write-IssueBodyFile {
    param([string]$RepoName, [int]$Number, [string]$OutDir)
    if (-not (Test-Path -LiteralPath $OutDir)) {
        New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    }
    $path = Join-Path $OutDir ("issue-{0}.md" -f $Number)
    $view = gh issue view $Number --repo $RepoName --json title,body,url 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "gh issue view failed: $view"
    }
    $issue = $view | ConvertFrom-Json
    $md = @"
# #$Number — $($issue.title)

$($issue.url)

---

$($issue.body)
"@
    Set-Content -LiteralPath $path -Value $md -Encoding utf8
    return $path
}

$issues = Get-AgentQueueIssues -RepoName $Repo -BugOnly:$RequireBugLabel -Max $Limit

if ($IssueNumber -gt 0) {
    $next = $issues | Where-Object { $_.number -eq $IssueNumber } | Select-Object -First 1
    if (-not $next) {
        # Still allow pickup of a specific open issue even if label list is empty/stale
        $view = gh issue view $IssueNumber --repo $Repo --json number,title,url,labels,createdAt,assignees,state 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Issue #$IssueNumber not found: $view"
            exit 1
        }
        $next = $view | ConvertFrom-Json
        if ($next.state -ne 'OPEN') {
            Write-Error "Issue #$IssueNumber is not open (state=$($next.state))"
            exit 1
        }
    }
} else {
    if (-not $issues -or $issues.Count -eq 0) {
        if ($Json) {
            @{ ok = $true; next = $null; message = 'agent-queue empty' } | ConvertTo-Json -Compress
        } else {
            Write-Host 'agent-queue: nenhuma issue aberta com label agent-queue.'
        }
        exit 0
    }
    $next = $issues | Sort-Object createdAt | Select-Object -First 1
}

$bodyPath = $null
if ($WriteBody) {
    $bodyPath = Write-IssueBodyFile -RepoName $Repo -Number $next.number -OutDir $BodyDir
}

$payload = [ordered]@{
    ok       = $true
    number   = $next.number
    title    = $next.title
    url      = $next.url
    bodyPath = $bodyPath
    next     = $next
    queue    = $issues
    hint     = "Resolve with: ./scripts/agents/resolve-agent-queue-issue.ps1 -IssueNumber $($next.number)  (agent implements; -OpenPr after fix)"
}

if ($Json) {
    $payload | ConvertTo-Json -Depth 6
    exit 0
}

Write-Host "agent-queue next: #$($next.number) — $($next.title)"
Write-Host "  $($next.url)"
if ($bodyPath) {
    Write-Host "  body: $bodyPath"
}
Write-Host ''
Write-Host 'Próximos passos (agente):'
Write-Host "  1. gh issue view $($next.number) --repo $Repo"
Write-Host "  2. ./scripts/agents/execute-task.ps1 -Objective `"Fix #$($next.number): …`" -Area <area> -WorkClass standard"
Write-Host '  3. Corrigir no escopo mínimo; testes; evidência'
Write-Host "  4. ./scripts/agents/resolve-agent-queue-issue.ps1 -IssueNumber $($next.number) -OpenPr -Paths <files…>"
Write-Host '     (humanos fazem merge — nunca merge automático)'
if ($issues.Count -gt 1) {
    Write-Host ''
    Write-Host "Fila ($($issues.Count) abertas):"
    foreach ($i in ($issues | Sort-Object createdAt)) {
        $mark = if ($i.number -eq $next.number) { '>' } else { ' ' }
        Write-Host ("  {0} #{1} {2}" -f $mark, $i.number, $i.title)
    }
}
