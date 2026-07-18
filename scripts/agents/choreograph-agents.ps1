#Requires -Version 5.1
<#
.SYNOPSIS
  Resolve coreografia: agentes, domínios consultivos e skills autônomas.
.EXAMPLE
  ./choreograph-agents.ps1 -ChangedFiles packages/db/schema.prisma -Json
#>
param(
    [string[]]$ChangedFiles = @(),
    [string]$RouteFile = '',
    [string]$Trigger = 'manual',
    [switch]$ExecuteAutonomy,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$ScriptDir = $PSScriptRoot

. (Join-Path $ScriptDir 'get-choreography-rules.ps1')

function Normalize-FileList {
    param([string[]]$Files)
    $normalized = @()
    foreach ($item in $Files) {
        if ($item -match ',') {
            $normalized += $item -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
        } elseif ($item) {
            $normalized += $item.Trim()
        }
    }
    return @($normalized | Select-Object -Unique)
}

function Test-PathMatchesGlob {
    param([string]$FilePath, [string]$Pattern)
    $normalized = $FilePath.Replace('\', '/')
    $glob = $Pattern.Replace('\', '/')
    if ($glob -eq '**' -or $glob -eq '**/*') { return $true }
    $re = [regex]::Escape($glob)
    $re = $re -replace '\\\*\\\*/', '(?:.*/)?'
    $re = $re -replace '\\\*\\\*', '.*'
    $re = $re -replace '\\\*', '[^/]*'
    return $normalized -match ('^' + $re + '$')
}

$files = Normalize-FileList -Files $ChangedFiles
$isPr = $Trigger -match 'pull_request'

$routePrimary = $null
$routeCo = @()
if ($RouteFile -and (Test-Path $RouteFile)) {
    $route = Get-Content $RouteFile -Raw | ConvertFrom-Json
    $routePrimary = $route.agent
    $routeCo = @($route.co_agents)
}

$rules = Get-AllChoreographyRules -Root $Root

$operational = @()
$domainConsults = @()
$skillRuns = @()
$matchedRules = @()

foreach ($rule in $rules) {
    if ($rule.when -eq 'pull_request' -and -not $isPr) { continue }

    $ruleHit = $false
    if ($rule.paths -contains '**') {
        $ruleHit = $files.Count -gt 0 -or $isPr
    } else {
        foreach ($f in $files) {
            foreach ($p in $rule.paths) {
                if (Test-PathMatchesGlob -FilePath $f -Pattern $p) { $ruleHit = $true; break }
            }
            if ($ruleHit) { break }
        }
    }

    if (-not $ruleHit) { continue }
    $matchedRules += $rule.id

    foreach ($a in $rule.agents) {
        if ($a.type -eq 'domain' -or $a.type -eq 'specialist') {
            if ($domainConsults -notcontains $a.id) { $domainConsults += $a.id }
        } else {
            if ($operational -notcontains $a.id) { $operational += $a.id }
        }
        if ($a.skills.Count -gt 0 -and ($a.autonomy -contains 'invoke_skill')) {
            foreach ($sk in $a.skills) {
                $skillRuns += [pscustomobject]@{ agent = $a.id; skill = $sk; rule = $rule.id }
            }
        }
    }
}

if ($routePrimary -and $routePrimary -ne 'orchestrator' -and $operational -notcontains $routePrimary) {
    $operational = @($routePrimary) + $operational | Select-Object -Unique
}
foreach ($c in $routeCo) {
    if ($c -and $operational -notcontains $c) { $operational += $c }
}

# co_activation: parceiros declarados na coreografia (ex.: draft-writer + compliance-guard)
$coPairs = Get-AllChoreographyCoActivationFromRoot -Root $Root
$expanded = @($operational)
foreach ($op in $operational) {
    foreach ($pair in $coPairs) {
        if ($pair.primary -ne $op) { continue }
        foreach ($w in @($pair.with)) {
            if ($w -and $expanded -notcontains $w) { $expanded += $w }
        }
    }
}
$operational = @($expanded | Select-Object -Unique)

$executedSkills = @()
if ($ExecuteAutonomy -and $skillRuns.Count -gt 0) {
    Push-Location $Root
    try {
        foreach ($sr in ($skillRuns | Select-Object -Property agent, skill, rule -Unique)) {
            try {
                & (Join-Path $ScriptDir 'invoke-skill.ps1') -Skill $sr.skill -ChangedFiles $files | Out-Host
                $executedSkills += @{ skill = $sr.skill; agent = $sr.agent; ok = $true }
            } catch {
                $executedSkills += @{ skill = $sr.skill; agent = $sr.agent; ok = $false; error = $_.Exception.Message }
            }
        }
    } finally { Pop-Location }
}

$result = [ordered]@{
    trigger           = $Trigger
    matched_rules     = $matchedRules
    operational       = @($operational | Select-Object -Unique)
    domain_consults   = @($domainConsults | Select-Object -Unique)
    skill_invocations = $skillRuns
    executed_skills   = $executedSkills
    execute_autonomy  = [bool]$ExecuteAutonomy
}

if ($Json) { $result | ConvertTo-Json -Depth 6 } else { $result | ConvertTo-Json -Depth 6 }
exit 0
