#Requires -Version 5.1
<#
.SYNOPSIS
  Verifica se o pin `.arah-version` está atrás do release mais recente do harness.
.DESCRIPTION
  Padrão de mercado para harness/template distribuído por git (não npm):
  1) GitHub Releases como fonte de verdade
  2) Check agendado no consumidor (workflow) abre issue de atualização
  3) Opcional: Renovate regex manager em `.arah-version`

  Exit codes: 0 up-to-date · 2 outdated · 1 error · 10 usage
.EXAMPLE
  ./check-harness-update.ps1
  ./check-harness-update.ps1 -LatestVersion 0.5.0   # offline / test
  ./check-harness-update.ps1 -Notify                # cria/atualiza issue (GITHUB_TOKEN)
  ./check-harness-update.ps1 -FailIfOutdated
#>
param(
    [string]$Target = '',
    [string]$Repository = '',
    [string]$LatestVersion = '',
    [switch]$Notify,
    [switch]$FailIfOutdated,
    [switch]$Json,
    [string]$IssueLabel = 'arah-harness-update',
    [string]$GithubApi = 'https://api.github.com'
)

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
    param([string]$Start)
    if ($Start) { return (Resolve-Path -LiteralPath $Start).Path }
    return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Get-PinVersion {
    param([string]$Root)
    $pin = Join-Path $Root '.arah-version'
    if (-not (Test-Path -LiteralPath $pin)) { return $null }
    $raw = Get-Content -LiteralPath $pin -Raw
    if ($raw -match '(?m)^\s*version:\s*["'']?([0-9]+\.[0-9]+\.[0-9]+)') {
        return $Matches[1]
    }
    return $null
}

function Get-ConfiguredRepo {
    param([string]$Root, [string]$Override)
    if ($Override) { return $Override }
    $cfg = Join-Path $Root 'arah.config.yaml'
    if (Test-Path -LiteralPath $cfg) {
        $raw = Get-Content -LiteralPath $cfg -Raw
        if ($raw -match '(?ms)^update_check:\s*\r?\n(.*?)(?=^[A-Za-z_]|\z)') {
            $block = $Matches[1]
            if ($block -match '(?m)^\s+repository:\s*["'']?([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)') {
                return $Matches[1]
            }
        }
        if ($raw -match '(?ms)^harness:\s*\r?\n(.*?)(?=^[A-Za-z_]|\z)') {
            $h = $Matches[1]
            if ($h -match '(?m)^\s+source:\s*["'']?([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)') {
                return $Matches[1]
            }
            if ($h -match '(?m)^\s+repository:\s*https://github.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)') {
                return $Matches[1]
            }
        }
    }
    return 'sraphaz/arah-harness'
}

function ConvertTo-VersionObject {
    param([string]$Version)
    $v = $Version.Trim().TrimStart('v', 'V')
    if ($v -notmatch '^(\d+)\.(\d+)\.(\d+)') {
        throw "invalid semver: $Version"
    }
    return [pscustomobject]@{
        Raw = $v
        Major = [int]$Matches[1]
        Minor = [int]$Matches[2]
        Patch = [int]$Matches[3]
    }
}

function Compare-SemVer {
    param([string]$A, [string]$B)
    $va = ConvertTo-VersionObject $A
    $vb = ConvertTo-VersionObject $B
    if ($va.Major -ne $vb.Major) { return $va.Major - $vb.Major }
    if ($va.Minor -ne $vb.Minor) { return $va.Minor - $vb.Minor }
    return $va.Patch - $vb.Patch
}

function Get-LatestReleaseVersion {
    param(
        [string]$Repo,
        [string]$ApiBase,
        [string]$Override
    )
    if ($Override) { return (ConvertTo-VersionObject $Override).Raw }

    $headers = @{
        Accept = 'application/vnd.github+json'
        'User-Agent' = 'arah-harness-update-check'
    }
    $token = $env:GITHUB_TOKEN
    if (-not $token) { $token = $env:GH_TOKEN }
    if ($token) { $headers.Authorization = "Bearer $token" }

    # 1) Latest release
    try {
        $rel = Invoke-RestMethod -Uri "$ApiBase/repos/$Repo/releases/latest" -Headers $headers -Method Get
        if ($rel.tag_name) {
            return (ConvertTo-VersionObject ([string]$rel.tag_name)).Raw
        }
    } catch {
        # 404 when repo has no releases — fall through to tags
    }

    # 2) Newest semver tag
    $tags = Invoke-RestMethod -Uri "$ApiBase/repos/$Repo/tags?per_page=30" -Headers $headers -Method Get
    $versions = @()
    foreach ($t in @($tags)) {
        try { $versions += (ConvertTo-VersionObject ([string]$t.name)).Raw } catch { }
    }
    if ($versions.Count -eq 0) {
        throw "no releases/tags found for $Repo — publish a GitHub Release (vX.Y.Z)"
    }
    $best = $versions[0]
    foreach ($v in $versions) {
        if ((Compare-SemVer $v $best) -gt 0) { $best = $v }
    }
    return $best
}

function Find-OpenUpdateIssue {
    param(
        [string]$Repo,
        [string]$ApiBase,
        [string]$Label,
        [hashtable]$Headers
    )
    $q = [uri]::EscapeDataString("repo:$Repo is:issue is:open label:$Label")
    $url = "$ApiBase/search/issues?q=$q&per_page=5"
    $res = Invoke-RestMethod -Uri $url -Headers $Headers -Method Get
    if ($res.total_count -gt 0) {
        return $res.items[0]
    }
    return $null
}

function Ensure-UpdateIssue {
    param(
        [string]$Repo,
        [string]$ApiBase,
        [string]$Label,
        [string]$Pinned,
        [string]$Latest,
        [string]$ReleaseUrl
    )
    $token = $env:GITHUB_TOKEN
    if (-not $token) { $token = $env:GH_TOKEN }
    if (-not $token) {
        throw 'Notify requires GITHUB_TOKEN (or GH_TOKEN) with issues:write'
    }
    $headers = @{
        Accept = 'application/vnd.github+json'
        'User-Agent' = 'arah-harness-update-check'
        Authorization = "Bearer $token"
    }

    $title = "ARAH Harness update available: v$Latest (pinned v$Pinned)"
    $body = @"
## Harness update available

| | |
|---|---|
| **Pinned** (`.arah-version`) | ``$Pinned`` |
| **Latest** | ``$Latest`` |
| **Upstream** | https://github.com/$Repo |

### How to update

``````powershell
# 1) Atualize o clone do harness
git -C `$env:ARAH_HARNESS_PATH fetch --tags
git -C `$env:ARAH_HARNESS_PATH checkout v$Latest

# 2) Reaplique o kernel no consumidor
powershell -File `$env:ARAH_HARNESS_PATH/cli/arah.ps1 update -Force
# ou: regenerate -UpdateKernel -Force

# 3) Abra PR com o diff + novo .arah-version
``````

Release: $ReleaseUrl

_Issue gerada automaticamente pelo workflow ``harness-update-check`` (padrão Releases + scheduled notify)._
"@

    $existing = Find-OpenUpdateIssue -Repo $Repo -ApiBase $ApiBase -Label $Label -Headers $headers
    if ($existing) {
        $num = $existing.number
        $patch = @{ title = $title; body = $body } | ConvertTo-Json
        Invoke-RestMethod -Uri "$ApiBase/repos/$Repo/issues/$num" -Headers $headers -Method Patch -Body $patch -ContentType 'application/json' | Out-Null
        return [pscustomobject]@{ action = 'updated'; number = $num; url = $existing.html_url }
    }

    # Ensure label exists (best-effort)
    try {
        $labelBody = @{ name = $Label; color = 'FBCA04'; description = 'ARAH harness update available' } | ConvertTo-Json
        Invoke-RestMethod -Uri "$ApiBase/repos/$Repo/labels" -Headers $headers -Method Post -Body $labelBody -ContentType 'application/json' | Out-Null
    } catch { }

    # Consumer repo = GITHUB_REPOSITORY when running in Actions
    $consumer = $env:GITHUB_REPOSITORY
    if (-not $consumer) { $consumer = $Repo }
    $create = @{
        title = $title
        body = $body
        labels = @($Label)
    } | ConvertTo-Json
    $issue = Invoke-RestMethod -Uri "$ApiBase/repos/$consumer/issues" -Headers $headers -Method Post -Body $create -ContentType 'application/json'
    return [pscustomobject]@{ action = 'created'; number = $issue.number; url = $issue.html_url }
}

# --- main ---
$Root = Get-RepoRoot -Start $Target
$pinned = Get-PinVersion -Root $Root
if (-not $pinned) {
    Write-Error '.arah-version missing or has no version — run arah init'
    exit 1
}

$repo = Get-ConfiguredRepo -Root $Root -Override $Repository
try {
    $latest = Get-LatestReleaseVersion -Repo $repo -ApiBase $GithubApi.TrimEnd('/') -Override $LatestVersion
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

$cmp = Compare-SemVer $pinned $latest
$outdated = ($cmp -lt 0)
$status = if ($outdated) { 'outdated' } elseif ($cmp -gt 0) { 'ahead' } else { 'up_to_date' }
$releaseUrl = "https://github.com/$repo/releases/tag/v$latest"

$result = [ordered]@{
    status = $status
    pinned = $pinned
    latest = $latest
    repository = $repo
    release_url = $releaseUrl
    notify = $null
}

if ($outdated -and $Notify) {
    $consumerRepo = $env:GITHUB_REPOSITORY
    if (-not $consumerRepo) {
        Write-Error 'Notify in local mode requires GITHUB_REPOSITORY=owner/name and GITHUB_TOKEN'
        exit 1
    }
    # Issues go to the consumer repo (where the workflow runs)
    $result.notify = Ensure-UpdateIssue -Repo $consumerRepo -ApiBase $GithubApi.TrimEnd('/') `
        -Label $IssueLabel -Pinned $pinned -Latest $latest -ReleaseUrl $releaseUrl
}

if ($Json) {
    $result | ConvertTo-Json -Depth 5
} else {
    Write-Host "harness-update-check: $status"
    Write-Host "  pinned:  $pinned  (.arah-version)"
    Write-Host "  latest:  $latest  ($repo)"
    if ($outdated) {
        Write-Host "  release: $releaseUrl"
        Write-Host ("  next:    git -C `$env:ARAH_HARNESS_PATH fetch --tags && checkout v{0}; arah update -Force" -f $latest)
    }
    if ($result.notify) {
        Write-Host "  issue:   $($result.notify.action) #$($result.notify.number) → $($result.notify.url)"
    }
}

if ($outdated -and $FailIfOutdated) { exit 2 }
if ($outdated) { exit 2 }
exit 0
