#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

$required = @('id', 'name')
$errors = @()

function Get-YamlListItems {
    param([string]$Raw, [string]$Key, [int]$Indent)
    $prefix = ' ' * $Indent
    $itemPrefix = ' ' * ($Indent + 2)
    $pattern = '(?m)^{0}{1}:[ \t]*\r?\n((?:{2}-[ \t]+[^\r\n]+\r?\n?)+)' -f $prefix, $Key, $itemPrefix
    if ($Raw -match $pattern) {
        return [regex]::Matches($Matches[1], '^\s+-\s+(\S+)', 'Multiline') |
            ForEach-Object { $_.Groups[1].Value.Trim() }
    }
    return @()
}

$skillIds = Get-ChildItem -Path (Join-Path $Root '.skills') -Filter '*.skill.yaml' -ErrorAction SilentlyContinue |
    ForEach-Object { $_.BaseName -replace '\.skill$', '' }

Get-ChildItem -Path (Join-Path $Root '.agents') -Recurse -Filter '*.agent.yaml' -ErrorAction SilentlyContinue | ForEach-Object {
    $raw = Get-Content $_.FullName -Raw
    foreach ($field in $required) {
        if ($raw -notmatch "(?m)^$field\s*:") {
            $errors += "$($_.FullName): missing '$field'"
        }
    }
    if ($raw -match '(?m)^checklist:\s*(.+)$') {
        $rel = $Matches[1].Trim()
        $clPath = Join-Path $Root ".agents/$rel"
        if (-not (Test-Path $clPath)) {
            $errors += "$($_.FullName): checklist not found at .agents/$rel"
        }
    }
    foreach ($skillId in (Get-YamlListItems -Raw $raw -Key 'skills' -Indent 0)) {
        if ($skillIds -notcontains $skillId) {
            $errors += "$($_.FullName): skill '$skillId' not found in .skills/"
        }
    }
}

Get-ChildItem -Path (Join-Path $Root '.skills') -Filter '*.skill.yaml' -ErrorAction SilentlyContinue | ForEach-Object {
    $raw = Get-Content $_.FullName -Raw
    if ($raw -notmatch '(?m)^id\s*:') {
        $errors += "$($_.FullName): missing 'id'"
    }
}

if (-not (Test-Path (Join-Path $Root 'AGENTS.md'))) {
    $errors += 'AGENTS.md missing at repo root'
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

$agentCount = (Get-ChildItem (Join-Path $Root '.agents') -Recurse -Filter '*.agent.yaml' -ErrorAction SilentlyContinue).Count
$skillCount = (Get-ChildItem (Join-Path $Root '.skills') -Filter '*.skill.yaml' -ErrorAction SilentlyContinue).Count
Write-Host "Validated agent/skill manifests — OK ($agentCount agents, $skillCount skills)."
exit 0
