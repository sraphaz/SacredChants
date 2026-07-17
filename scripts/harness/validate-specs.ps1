#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$specsDir = Join-Path $Root 'docs/specs'

if (-not (Test-Path $specsDir)) {
    Write-Host "No docs/specs/ — skipping validate-specs"
    exit 0
}

$errors = @()
Get-ChildItem $specsDir -Recurse -Filter '*.spec.yaml' -ErrorAction SilentlyContinue | ForEach-Object {
    $raw = Get-Content $_.FullName -Raw
    if ($raw -notmatch '(?m)^id\s*:') { $errors += "$($_.Name): missing id" }
    if ($raw -match '(?m)^\s+status:\s*covered\s*$' -and $raw -notmatch '(?m)^\s+covered_by\s*:') {
        $errors += "$($_.Name): status covered without covered_by"
    }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host "validate-specs: OK"
