#Requires -Version 5.1
param(
    [Parameter(Mandatory)]
    [string]$Skill,
    [string]$Area = 'backend'
)

$ErrorActionPreference = 'Stop'

function Get-ArahConfig {
    param([string]$Root)
    $path = Join-Path $Root 'arah.config.yaml'
    if (-not (Test-Path $path)) { return $null }
    $raw = Get-Content $path -Raw
    $cfg = @{ project = @{}; tests = @{} }
    if ($raw -match '(?m)^  name:\s*(.+)$') { $cfg.project.name = $Matches[1].Trim() }
    if ($raw -match '(?m)^  stack:\s*(.+)$') { $cfg.project.stack = $Matches[1].Trim() }
    foreach ($area in @('backend', 'frontend', 'all')) {
        if ($raw -match "(?m)^  ${area}:\s*(.+)$") {
            $cfg.tests[$area] = $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $cfg
}

$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$SkillFile = Join-Path $Root ".skills/$Skill.skill.yaml"

if (-not (Test-Path $SkillFile)) {
    Write-Error "Skill not found: $SkillFile"
    exit 1
}

Write-Host "Skill: $Skill (area=$Area)"
$config = Get-ArahConfig -Root $Root

Push-Location $Root
try {
    switch ($Skill) {
        'run-tests' {
            $cmd = $null
            if ($config -and $config.tests.ContainsKey($Area)) {
                $cmd = $config.tests[$Area]
            }
            if (-not $cmd) {
                Write-Warning "No test command for area '$Area' in arah.config.yaml — skipping."
                exit 0
            }
            Write-Host "Running: $cmd"
            Invoke-Expression $cmd
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        default {
            $raw = Get-Content $SkillFile -Raw
            if ($raw -match '(?m)^  script:\s*(.+)$') {
                $rel = $Matches[1].Trim()
                $scriptPath = Join-Path $Root $rel
                if (Test-Path $scriptPath) {
                    & $scriptPath
                    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
                } else {
                    Write-Warning "Script not found for skill '$Skill': $scriptPath"
                }
            } else {
                Write-Host "Skill '$Skill' registered — no local runner (manifest-only)."
            }
        }
    }
} finally {
    Pop-Location
}

Write-Host "Skill '$Skill' completed."
exit 0
