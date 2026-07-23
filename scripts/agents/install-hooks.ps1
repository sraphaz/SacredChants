#Requires -Version 5.1
<#
.SYNOPSIS
  Instala git hooks ARAH (pre-commit) no repositório alvo.
.EXAMPLE
  ./install-hooks.ps1
  ./install-hooks.ps1 -Target C:\repo -Force
#>
param(
    [string]$Target = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ScriptRoot = $PSScriptRoot
$HarnessRoot = (Resolve-Path -LiteralPath (Join-Path $ScriptRoot '../..')).Path
if (-not $Target) { $Target = (Get-Location).Path }
$Target = (Resolve-Path -LiteralPath $Target).Path

$gitDir = Join-Path $Target '.git'
if (-not (Test-Path -LiteralPath $gitDir)) {
    Write-Error "install-hooks: $Target is not a git repository"
    exit 1
}

$hooksDir = Join-Path $gitDir 'hooks'
if (-not (Test-Path -LiteralPath $hooksDir)) {
    New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null
}

$tplDir = Join-Path (Join-Path $HarnessRoot 'templates') 'git-hooks'
$preCommitTpl = Join-Path $tplDir 'pre-commit'
if (-not (Test-Path -LiteralPath $preCommitTpl)) {
    Write-Error "install-hooks: template missing at $preCommitTpl"
    exit 1
}

$dest = Join-Path $hooksDir 'pre-commit'
if ((Test-Path -LiteralPath $dest) -and -not $Force) {
    Write-Host "install-hooks: pre-commit exists — use -Force to overwrite"
    exit 0
}

Copy-Item -LiteralPath $preCommitTpl -Destination $dest -Force
if ($IsLinux -or $IsMacOS -or ($env:OS -notmatch 'Windows')) {
    & chmod +x $dest 2>$null
}

Write-Host "install-hooks: installed $dest"
Write-Host "install-hooks: see docs/BRANCH_PROTECTION.md for remote enforcement"
exit 0
