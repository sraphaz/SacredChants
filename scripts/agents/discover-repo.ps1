#Requires -Version 5.1
<#
.SYNOPSIS
  Observa o repositório e propõe stack, domínios e especialistas (discovery).
.DESCRIPTION
  Biocomponente ARAH - etapa de percepção. Escreve docs/_meta/discovery.proposed.yaml.
  Com -Apply, mescla candidaturas em arah.config.yaml (domains/specialists ausentes)
  sem sobrescrever entradas existentes. Merge/aplicação final permanece humana.
.EXAMPLE
  ./discover-repo.ps1
  ./discover-repo.ps1 -Apply
  ./discover-repo.ps1 -DryRun
#>
param(
    [switch]$Apply,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$MetaDir = Join-Path (Join-Path $Root 'docs') '_meta'
$OutFile = Join-Path $MetaDir 'discovery.proposed.yaml'
$ConfigPath = Join-Path $Root 'arah.config.yaml'

. (Join-Path $PSScriptRoot 'config-parser.ps1')

function Test-RepoFile {
    param([string]$Rel)
    return Test-Path (Join-Path $Root $Rel)
}

function Get-TopDirs {
    Get-ChildItem $Root -Directory -Force | Where-Object {
        $_.Name -notmatch '^\.(git|cursor|arah)$' -and
        $_.Name -notin @('node_modules', 'dist', 'build', 'coverage', '.venv', 'vendor')
    } | ForEach-Object { $_.Name }
}

$languages = New-Object System.Collections.Generic.List[string]
$frameworks = New-Object System.Collections.Generic.List[string]
$pkgManagers = New-Object System.Collections.Generic.List[string]
$evidence = New-Object System.Collections.Generic.List[string]
$proposedDomains = @()
$proposedSpecialists = @()
$notes = New-Object System.Collections.Generic.List[string]
$appRoots = New-Object System.Collections.Generic.List[string]

# --- Stack signals ---
$stackChecks = @(
    @{ file = 'package.json'; lang = 'javascript'; pm = 'npm' },
    @{ file = 'pnpm-lock.yaml'; lang = 'javascript'; pm = 'pnpm' },
    @{ file = 'yarn.lock'; lang = 'javascript'; pm = 'yarn' },
    @{ file = 'pyproject.toml'; lang = 'python'; pm = 'pip' },
    @{ file = 'requirements.txt'; lang = 'python'; pm = 'pip' },
    @{ file = 'Pipfile'; lang = 'python'; pm = 'pipenv' },
    @{ file = 'go.mod'; lang = 'go'; pm = 'go' },
    @{ file = 'Cargo.toml'; lang = 'rust'; pm = 'cargo' },
    @{ file = 'Gemfile'; lang = 'ruby'; pm = 'bundler' },
    @{ file = 'composer.json'; lang = 'php'; pm = 'composer' },
    @{ file = 'pom.xml'; lang = 'java'; pm = 'maven' },
    @{ file = 'build.gradle'; lang = 'java'; pm = 'gradle' },
    @{ file = 'build.gradle.kts'; lang = 'kotlin'; pm = 'gradle' }
)

foreach ($c in $stackChecks) {
    if (Test-RepoFile $c.file) {
        if ($c.lang -notin $languages) { [void]$languages.Add($c.lang) }
        if ($c.pm -notin $pkgManagers) { [void]$pkgManagers.Add($c.pm) }
        [void]$evidence.Add($c.file)
    }
}

Get-ChildItem $Root -Recurse -Filter '*.csproj' -File -ErrorAction SilentlyContinue |
    Select-Object -First 1 | ForEach-Object {
        if ('csharp' -notin $languages) { [void]$languages.Add('csharp') }
        if ('dotnet' -notin $pkgManagers) { [void]$pkgManagers.Add('dotnet') }
        [void]$evidence.Add($_.Name)
    }

# Framework heuristics from package.json / pyproject
if (Test-RepoFile 'package.json') {
    $pkg = Get-Content (Join-Path $Root 'package.json') -Raw
    $fwMap = @{
        '"next"' = 'nextjs'; '"react"' = 'react'; '"vue"' = 'vue'
        '"@nestjs/core"' = 'nestjs'; '"express"' = 'express'
        '"@angular/core"' = 'angular'; '"svelte"' = 'svelte'
        '"vite"' = 'vite'
    }
    foreach ($k in $fwMap.Keys) {
        if ($pkg -match [regex]::Escape($k)) {
            if ($fwMap[$k] -notin $frameworks) { [void]$frameworks.Add($fwMap[$k]) }
        }
    }
}
if (Test-RepoFile 'pyproject.toml' -or (Test-RepoFile 'requirements.txt')) {
    $py = ''
    if (Test-RepoFile 'pyproject.toml') { $py += Get-Content (Join-Path $Root 'pyproject.toml') -Raw }
    if (Test-RepoFile 'requirements.txt') { $py += Get-Content (Join-Path $Root 'requirements.txt') -Raw }
    foreach ($pair in @(
        @{ re = 'django'; fw = 'django' },
        @{ re = 'fastapi'; fw = 'fastapi' },
        @{ re = 'flask'; fw = 'flask' },
        @{ re = 'prisma'; fw = 'prisma' }
    )) {
        if ($py -match $pair.re -and $pair.fw -notin $frameworks) { [void]$frameworks.Add($pair.fw) }
    }
}
if (Test-RepoFile 'go.mod') {
    $gomod = Get-Content (Join-Path $Root 'go.mod') -Raw
    if ($gomod -match 'gin-gonic' -and 'gin' -notin $frameworks) { [void]$frameworks.Add('gin') }
    if ($gomod -match 'fiber' -and 'fiber' -notin $frameworks) { [void]$frameworks.Add('fiber') }
}

$topDirs = @(Get-TopDirs)
$monorepo = ($topDirs -contains 'apps') -or ($topDirs -contains 'packages') -or (Test-RepoFile 'pnpm-workspace.yaml') -or (Test-RepoFile 'lerna.json') -or (Test-RepoFile 'nx.json')

foreach ($d in @('apps', 'packages', 'backend', 'frontend', 'services', 'src', 'api', 'web', 'mobile', 'server', 'client')) {
    if ($topDirs -contains $d) { [void]$appRoots.Add($d) }
}

# Domain proposals from structure
$domainHints = @(
    @{ id = 'backend'; name = 'Backend'; dirs = @('backend', 'server', 'api', 'services'); paths = @('backend/**', 'server/**', 'api/**', 'services/**') },
    @{ id = 'frontend'; name = 'Frontend'; dirs = @('frontend', 'web', 'client', 'apps'); paths = @('frontend/**', 'web/**', 'client/**', 'apps/**') },
    @{ id = 'infra'; name = 'Infraestrutura'; dirs = @('infra', 'deploy', 'ops', 'terraform', '.github'); paths = @('infra/**', 'deploy/**', 'terraform/**', '.github/workflows/**') },
    @{ id = 'docs'; name = 'Documentação'; dirs = @('docs'); paths = @('docs/**') },
    @{ id = 'data'; name = 'Dados'; dirs = @('data', 'db', 'prisma', 'migrations'); paths = @('data/**', 'db/**', 'prisma/**', 'migrations/**') },
    @{ id = 'mobile'; name = 'Mobile'; dirs = @('mobile', 'android', 'ios'); paths = @('mobile/**', 'android/**', 'ios/**') }
)

$existingDomains = @()
if (Test-Path $ConfigPath) {
    $cfg = Get-ArahProjectConfig -Root $Root
    if ($cfg -and $cfg.domains) { $existingDomains = @($cfg.domains | ForEach-Object { $_.id }) }
}

foreach ($hint in $domainHints) {
    $hit = $false
    foreach ($d in $hint.dirs) {
        if ($topDirs -contains $d -or (Test-Path (Join-Path $Root $d))) { $hit = $true; break }
    }
    if (-not $hit) { continue }
    if ($hint.id -in $existingDomains) {
        [void]$notes.Add("domain already configured: $($hint.id)")
        continue
    }
    $paths = @()
    foreach ($p in $hint.paths) {
        $first = ($p -split '/')[0]
        if ($topDirs -contains $first -or (Test-Path (Join-Path $Root $first))) { $paths += $p }
    }
    if ($paths.Count -eq 0) { continue }
    $proposedDomains += [ordered]@{
        id = $hint.id
        name = $hint.name
        paths = $paths
        rationale = "Estrutura detectou diretórios alinhados a $($hint.name)."
        confidence = 'medium'
    }
}

# Specialist proposals from frameworks
$specMap = @{
    nextjs = @{ id = 'nextjs'; paths = @('apps/**', 'frontend/**', 'src/**', 'app/**') }
    react = @{ id = 'react'; paths = @('frontend/**', 'apps/**', 'src/**') }
    nestjs = @{ id = 'nestjs'; paths = @('backend/**', 'apps/**', 'src/**') }
    django = @{ id = 'django'; paths = @('backend/**', '**/*.py') }
    fastapi = @{ id = 'fastapi'; paths = @('backend/**', 'api/**', '**/*.py') }
    prisma = @{ id = 'prisma'; paths = @('prisma/**') }
}

$existingSpecs = @()
if (Test-Path $ConfigPath) {
    $cfg2 = Get-ArahProjectConfig -Root $Root
    if ($cfg2 -and $cfg2.specialists) { $existingSpecs = @($cfg2.specialists | ForEach-Object { $_.id }) }
}

foreach ($fw in $frameworks) {
    if (-not $specMap.ContainsKey($fw)) { continue }
    $s = $specMap[$fw]
    if ($s.id -in $existingSpecs) {
        [void]$notes.Add("specialist already configured: $($s.id)")
        continue
    }
    $paths = @($s.paths | Where-Object {
        $seg = ($_ -split '/')[0] -replace '\*\*', '' -replace '\*', ''
        if (-not $seg) { return $true }
        return ($topDirs -contains $seg) -or (Test-Path (Join-Path $Root $seg)) -or ($_ -match '\*\*')
    })
    if ($paths.Count -eq 0) { $paths = @($s.paths[0]) }
    $proposedSpecialists += [ordered]@{
        id = $s.id
        stack = $fw
        paths = $paths
        rationale = "Framework $fw detectado nos manifests."
        confidence = 'high'
    }
}

# Confidence
$confidence = 'low'
if ($evidence.Count -ge 2 -or $frameworks.Count -ge 1) { $confidence = 'medium' }
if ($evidence.Count -ge 3 -and ($proposedDomains.Count -ge 1 -or $frameworks.Count -ge 1)) { $confidence = 'high' }

$project = Split-Path $Root -Leaf
if (Test-Path $ConfigPath) {
    $raw = Get-Content $ConfigPath -Raw
    if ($raw -match '(?m)^\s*name:\s*(\S+)') { $project = $Matches[1].Trim('"').Trim("'") }
}

$ts = (Get-Date).ToUniversalTime().ToString('o')

function Format-YamlStringList {
    param([string[]]$Items, [int]$Indent = 4)
    $pad = ' ' * $Indent
    if (-not $Items -or $Items.Count -eq 0) { return "${pad}[]" }
    return ($Items | ForEach-Object { "${pad}- $_" }) -join "`n"
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# Generated by discover-repo.ps1 - propose only; human applies')
[void]$sb.AppendLine("schema: arah-harness/discovery")
[void]$sb.AppendLine("generated_at: $ts")
[void]$sb.AppendLine("project: $project")
[void]$sb.AppendLine("confidence: $confidence")
[void]$sb.AppendLine('stack:')
[void]$sb.AppendLine('  languages:')
[void]$sb.AppendLine((Format-YamlStringList -Items @($languages) -Indent 4))
[void]$sb.AppendLine('  frameworks:')
[void]$sb.AppendLine((Format-YamlStringList -Items @($frameworks) -Indent 4))
[void]$sb.AppendLine('  package_managers:')
[void]$sb.AppendLine((Format-YamlStringList -Items @($pkgManagers) -Indent 4))
[void]$sb.AppendLine('  evidence:')
[void]$sb.AppendLine((Format-YamlStringList -Items @($evidence) -Indent 4))
[void]$sb.AppendLine('structure:')
[void]$sb.AppendLine("  monorepo: $($monorepo.ToString().ToLower())")
[void]$sb.AppendLine('  top_dirs:')
[void]$sb.AppendLine((Format-YamlStringList -Items $topDirs -Indent 4))
[void]$sb.AppendLine('  app_roots:')
[void]$sb.AppendLine((Format-YamlStringList -Items @($appRoots) -Indent 4))
[void]$sb.AppendLine('proposed_domains:')
if ($proposedDomains.Count -eq 0) {
    [void]$sb.AppendLine('  []')
} else {
    foreach ($d in $proposedDomains) {
        [void]$sb.AppendLine("  - id: $($d.id)")
        [void]$sb.AppendLine("    name: $($d.name)")
        [void]$sb.AppendLine('    paths:')
        [void]$sb.AppendLine((Format-YamlStringList -Items @($d.paths) -Indent 6))
        [void]$sb.AppendLine("    rationale: `"$($d.rationale)`"")
        [void]$sb.AppendLine("    confidence: $($d.confidence)")
    }
}
[void]$sb.AppendLine('proposed_specialists:')
if ($proposedSpecialists.Count -eq 0) {
    [void]$sb.AppendLine('  []')
} else {
    foreach ($s in $proposedSpecialists) {
        [void]$sb.AppendLine("  - id: $($s.id)")
        [void]$sb.AppendLine("    stack: $($s.stack)")
        [void]$sb.AppendLine('    paths:')
        [void]$sb.AppendLine((Format-YamlStringList -Items @($s.paths) -Indent 6))
        [void]$sb.AppendLine("    rationale: `"$($s.rationale)`"")
        [void]$sb.AppendLine("    confidence: $($s.confidence)")
    }
}
[void]$sb.AppendLine('notes:')
[void]$sb.AppendLine((Format-YamlStringList -Items @($notes) -Indent 2))
[void]$sb.AppendLine('governance:')
[void]$sb.AppendLine('  mode: propose_only')
[void]$sb.AppendLine('  apply_flag: -Apply merges missing domains/specialists into arah.config.yaml')
[void]$sb.AppendLine('  human_gate: proposal_before_implementation')

$content = $sb.ToString()

if ($DryRun) {
    Write-Host "[dry-run] would write $OutFile"
    Write-Host $content
} else {
    if (-not (Test-Path $MetaDir)) { New-Item -ItemType Directory -Path $MetaDir -Force | Out-Null }
    Set-Content -Path $OutFile -Value $content -Encoding UTF8
    Write-Host "discover: wrote $OutFile"
    Write-Host "  languages: $($languages -join ', ')"
    Write-Host "  frameworks: $($frameworks -join ', ')"
    Write-Host "  proposed_domains: $($proposedDomains.Count)"
    Write-Host "  proposed_specialists: $($proposedSpecialists.Count)"
}

if ($Apply -and -not $DryRun) {
    if (-not (Test-Path $ConfigPath)) {
        Write-Warning "Apply skipped: arah.config.yaml not found"
        exit 0
    }
    $cfgRaw = Get-Content $ConfigPath -Raw
    $append = New-Object System.Text.StringBuilder
    $changed = $false

    if ($proposedDomains.Count -gt 0) {
        if ($cfgRaw -notmatch '(?m)^domains:\s*$' -and $cfgRaw -notmatch '(?m)^domains:\s*\r?\n') {
            [void]$append.AppendLine('')
            [void]$append.AppendLine('domains:')
        }
        foreach ($d in $proposedDomains) {
            if ($d.id -in $existingDomains) { continue }
            [void]$append.AppendLine("  - id: $($d.id)")
            [void]$append.AppendLine("    name: $($d.name)")
            [void]$append.AppendLine("    description: $($d.rationale)")
            [void]$append.AppendLine('    paths:')
            foreach ($p in $d.paths) { [void]$append.AppendLine("      - $p") }
            $changed = $true
        }
    }
    if ($proposedSpecialists.Count -gt 0) {
        if ($cfgRaw -notmatch '(?m)^specialists:') {
            [void]$append.AppendLine('')
            [void]$append.AppendLine('specialists:')
        }
        foreach ($s in $proposedSpecialists) {
            if ($s.id -in $existingSpecs) { continue }
            [void]$append.AppendLine("  - id: $($s.id)")
            [void]$append.AppendLine("    stack: $($s.stack)")
            [void]$append.AppendLine('    paths:')
            foreach ($p in $s.paths) { [void]$append.AppendLine("      - $p") }
            $changed = $true
        }
    }
    if ($changed) {
        Add-Content -Path $ConfigPath -Value $append.ToString() -Encoding UTF8
        Write-Host "discover: Apply merged proposals into arah.config.yaml"
        Write-Host "  next: arah domain sync && review PR"
    } else {
        Write-Host "discover: Apply - nothing new to merge"
    }
}

# Optional audit breadcrumb
$record = Join-Path $PSScriptRoot 'record-agent-event.ps1'
if ((Test-Path $record) -and -not $DryRun) {
    & $record -AgentId orchestrator -Action 'discover.repo' -Outcome ok -AutonomyLevel observe -Details "domains=$($proposedDomains.Count);specs=$($proposedSpecialists.Count)" 2>$null
}

exit 0
