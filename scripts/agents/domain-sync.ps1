#Requires -Version 5.1
<#
.SYNOPSIS
  Gera agentes de domínio/especialistas e coreografia a partir de arah.config.yaml.
.EXAMPLE
  ./domain-sync.ps1
  ./domain-sync.ps1 -DryRun
#>
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$ScriptDir = $PSScriptRoot
$TemplatesRoot = Join-Path (Split-Path (Split-Path $ScriptDir -Parent) -Parent) 'templates'

# When running from installed project, templates may not exist — use inline fallbacks.
. (Join-Path $ScriptDir 'config-parser.ps1')

$config = Get-ArahProjectConfig -Root $Root
if (-not $config) {
    Write-Error 'arah.config.yaml not found'
    exit 1
}

$domainDir = Join-Path $Root '.agents/domain'
$specDir = Join-Path $Root '.agents/specialists'
$choreoDomains = Join-Path $Root '.agents/choreography.domains.yaml'

if (-not $DryRun) {
    foreach ($d in @($domainDir, $specDir)) {
        if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }
}

function Format-YamlList {
    param([string[]]$Items, [int]$Indent = 4)
    $pad = ' ' * $Indent
    if (-not $Items -or $Items.Count -eq 0) { return "${pad}[]" }
    return ($Items | ForEach-Object { "${pad}- $_" }) -join "`n"
}

function New-DomainAgentYaml {
    param($Domain)
    $paths = Format-YamlList -Items @($Domain.paths) -Indent 4
    $refsBlock = if ($Domain.references -and $Domain.references.Count -gt 0) {
        "references:`n" + (Format-YamlList -Items @($Domain.references) -Indent 2)
    } else { '' }
    $enrich = if ($Domain.enrich) { "enrich: |`n    $($Domain.enrich -replace "`n", "`n    ")" } 
              elseif ($Domain.description) { "enrich: $($Domain.description)" } 
              else { 'enrich: Parecer consultivo de domínio.' }
    $validate = if ($Domain.validate) { "validate: |`n    $($Domain.validate -replace "`n", "`n    ")" }
                  else { 'validate: Verificar aderência às regras de negócio deste domínio.' }

    return @"
id: $($Domain.id)
name: $($Domain.name)
mode: consult
$enrich
$validate
autonomy:
  - consult_post
scope:
  paths:
$paths
$refsBlock
guardrails:
  no_merge: true
  consult_only: true
"@
}

function New-SpecialistAgentYaml {
    param($Spec)
    $paths = Format-YamlList -Items @($Spec.paths) -Indent 4
    $name = if ($Spec.name) { $Spec.name } else { "$($Spec.stack) Specialist" }
    return @"
id: $($Spec.id)
name: $name
type: specialist
description: Especialista técnico — $($Spec.stack)
scope:
  paths:
$paths
  may_code: false
guardrails:
  no_merge: true
  consult_only: true
"@
}

$written = @()

foreach ($d in @($config.domains)) {
    if (-not $d.id) { continue }
    $content = New-DomainAgentYaml -Domain $d
    $path = Join-Path $domainDir "$($d.id).agent.yaml"
    if ($DryRun) {
        Write-Host "[dry-run] would write $path"
    } else {
        Set-Content -Path $path -Value $content.TrimEnd() -Encoding UTF8
        Write-Host "domain agent: $($d.id)"
    }
    $written += $path
}

foreach ($s in @($config.specialists)) {
    if (-not $s.id) { continue }
    $content = New-SpecialistAgentYaml -Spec $s
    $path = Join-Path $specDir "$($s.id).agent.yaml"
    if ($DryRun) {
        Write-Host "[dry-run] would write $path"
    } else {
        Set-Content -Path $path -Value $content.TrimEnd() -Encoding UTF8
        Write-Host "specialist: $($s.id)"
    }
    $written += $path
}

# choreography.domains.yaml
$rulesYaml = @(
    '# Coreografia de domínio — gerada por domain-sync.ps1 (não editar à mão)',
    'version: 1',
    "updated: $(Get-Date -Format 'yyyy-MM-dd')",
    'rules:'
)
foreach ($d in @($config.domains)) {
    if (-not $d.id -or -not $d.paths -or $d.paths.Count -eq 0) { continue }
    $rulesYaml += "  - id: domain-$($d.id)"
    $rulesYaml += '    paths:'
    foreach ($p in $d.paths) { $rulesYaml += "      - $p" }
    $rulesYaml += '    agents:'
    $rulesYaml += "      - id: $($d.id)"
    $rulesYaml += '        type: domain'
    $rulesYaml += '        autonomy: [consult_post]'
}

foreach ($s in @($config.specialists)) {
    if (-not $s.id -or -not $s.paths -or $s.paths.Count -eq 0) { continue }
    $rulesYaml += "  - id: specialist-$($s.id)"
    $rulesYaml += '    paths:'
    foreach ($p in $s.paths) { $rulesYaml += "      - $p" }
    $rulesYaml += '    agents:'
    $rulesYaml += "      - id: $($s.id)"
    $rulesYaml += '        type: specialist'
    $rulesYaml += '        autonomy: [consult_post]'
}

$choreoContent = ($rulesYaml -join "`n") + "`n"
if ($DryRun) {
    Write-Host "[dry-run] would write $choreoDomains"
} else {
    Set-Content -Path $choreoDomains -Value $choreoContent -Encoding UTF8
    $ruleCount = @($config.domains | Where-Object { $_.paths -and $_.paths.Count -gt 0 }).Count
    $ruleCount += @($config.specialists | Where-Object { $_.paths -and $_.paths.Count -gt 0 }).Count
    Write-Host "choreography: .agents/choreography.domains.yaml ($ruleCount rules: domains + specialists)"
}

Write-Host "domain-sync complete ($($written.Count) manifests)"
