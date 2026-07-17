#Requires -Version 5.1
<#
.SYNOPSIS
  Carrega rules de todos .agents/choreography*.yaml (kernel + overlays locais).
#>
function Get-AllChoreographyRules {
    param([string]$Root)
    $parser = Join-Path $PSScriptRoot 'choreography-parser.ps1'
    if (-not (Test-Path $parser)) {
        $parser = Join-Path $Root 'scripts/agents/choreography-parser.ps1'
    }
    . $parser

    $rules = @()
    $agentsDir = Join-Path $Root '.agents'
    if (-not (Test-Path $agentsDir)) { return @() }

    Get-ChildItem $agentsDir -Filter 'choreography*.yaml' -ErrorAction SilentlyContinue |
        Sort-Object Name |
        ForEach-Object {
            $rules += Parse-ChoreographyRules -Raw (Get-Content $_.FullName -Raw)
        }
    return @($rules)
}

function Get-AllChoreographyCoActivationFromRoot {
    param([string]$Root)
    $parser = Join-Path $PSScriptRoot 'choreography-parser.ps1'
    if (-not (Test-Path $parser)) {
        $parser = Join-Path $Root 'scripts/agents/choreography-parser.ps1'
    }
    . $parser
    return Get-AllChoreographyCoActivation -Root $Root
}
