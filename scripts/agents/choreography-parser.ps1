#Requires -Version 5.1
<#
.SYNOPSIS
  Parser compartilhado de .agents/choreography.yaml (regex, PS 5.1+).
#>
function Parse-ChoreographyRules {
    param([string]$Raw)
    $rulesSection = $Raw
    if ($Raw -match '(?ms)^rules:\s*\r?\n(.*)') {
        $rulesSection = $Matches[1]
        # Para antes de co_activation, triggers ou outra chave top-level
        if ($rulesSection -match '(?ms)^(.*?)(?=^[a-z][\w-]*:\s*|\z)') {
            $rulesSection = $Matches[1]
        }
    }
    $rules = @()
    $blocks = [regex]::Split($rulesSection, '(?m)^  - id: ')
    foreach ($block in $blocks) {
        if ($block -notmatch '^([a-z][\w-]*)\r?\n') { continue }
        $ruleId = $Matches[1].Trim()
        $paths = @()
        if ($block -match '(?m)^    paths:\s*\r?\n((?:      - [^\r\n]+\r?\n?)+)') {
            $paths = [regex]::Matches($Matches[1], '^\s+-\s+(.+)$', 'Multiline') | ForEach-Object {
                $_.Groups[1].Value.Trim().Trim('"').Trim("'")
            }
        }
        $when = if ($block -match '(?m)^    when:\s+(\S+)') { $Matches[1].Trim() } else { $null }
        $agents = @()
        if ($block -match '(?ms)^    agents:\s*\n((?:      - .+\r?\n?)+)') {
            $agentSection = $Matches[1]
            $agentChunks = [regex]::Split($agentSection, '(?m)^      - id: ')
            foreach ($chunk in $agentChunks) {
                if ($chunk -notmatch '^(\S+)') { continue }
                $aid = $Matches[1].Trim()
                $type = if ($chunk -match '(?m)^        type:\s+(\S+)') { $Matches[1] } else { 'operational' }
                $autonomy = @()
                if ($chunk -match '(?m)^        autonomy:\s*\[(.+)\]') {
                    $autonomy = $Matches[1] -split ',' | ForEach-Object { $_.Trim() }
                }
                $skills = @()
                if ($chunk -match '(?m)^        skills:\s*\[(.+)\]') {
                    $skills = $Matches[1] -split ',' | ForEach-Object { $_.Trim() }
                }
                # Exporters/validators read `.kind`; choreograph/session still use `.type`.
                $agents += @{ id = $aid; type = $type; kind = $type; autonomy = @($autonomy); skills = @($skills) }
            }
        }
        $rules += @{ id = $ruleId; when = $when; paths = @($paths); agents = @($agents) }
    }
    return $rules
}

function Parse-ChoreographyCoActivation {
    param([string]$Raw)
    $pairs = @()
    if ($Raw -notmatch '(?ms)^co_activation:\s*\r?\n(.*)') { return @() }
    $section = $Matches[1]
    $chunks = [regex]::Split($section, '(?m)^  - primary:\s*')
    foreach ($chunk in $chunks) {
        if ($chunk -notmatch '^(\S+)') { continue }
        $primary = $Matches[1].Trim()
        $with = @()
        if ($chunk -match '(?m)^    with:\s*\[(.+)\]') {
            $with = $Matches[1] -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
        } elseif ($chunk -match '(?ms)^    with:\s*\r?\n((?:      - [^\r\n]+\r?\n?)+)') {
            $with = [regex]::Matches($Matches[1], '^\s+-\s+(.+)$', 'Multiline') |
                ForEach-Object { $_.Groups[1].Value.Trim() }
        }
        $pairs += @{ primary = $primary; with = @($with) }
    }
    return @($pairs)
}

function Get-AllChoreographyCoActivation {
    param([string]$Root)
    $pairs = @()
    $agentsDir = Join-Path $Root '.agents'
    if (-not (Test-Path $agentsDir)) { return @() }

    Get-ChildItem $agentsDir -Filter 'choreography*.yaml' -ErrorAction SilentlyContinue |
        Sort-Object Name |
        ForEach-Object {
            $pairs += Parse-ChoreographyCoActivation -Raw (Get-Content $_.FullName -Raw)
        }
    return @($pairs)
}
