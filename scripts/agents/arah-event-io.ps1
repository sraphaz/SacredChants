#Requires -Version 5.1
<#
.SYNOPSIS
  Helpers compartilhados: ULID, paths de estado quente, escrita arquivo-por-evento, scrub.
.NOTES
  Dot-source: . "$PSScriptRoot/arah-event-io.ps1"
#>

function Get-ArahRoot {
    param([string]$FromScriptRoot = $PSScriptRoot)
    return (Resolve-Path -LiteralPath (Join-Path $FromScriptRoot '../..')).Path
}

function New-ArahUlid {
    # ULID-like: 10 Crockford chars from ms timestamp + 16 random (26 total)
    $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    $ms = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
    $chars = New-Object char[] 26
    for ($i = 9; $i -ge 0; $i--) {
        $chars[$i] = $alphabet[[int]($ms % 32)]
        $ms = [math]::Floor($ms / 32)
    }
    $rng = New-Object System.Random
    for ($i = 10; $i -le 25; $i++) {
        $chars[$i] = $alphabet[$rng.Next(0, 32)]
    }
    return -join $chars
}

function Get-ArahLocalDir {
    param([string]$Root)
    return (Join-Path (Join-Path $Root '.arah') 'local')
}

function Get-ArahPendingDir {
    param(
        [string]$Root,
        [ValidateSet('bus', 'audit')]
        [string]$Kind
    )
    return (Join-Path (Join-Path (Get-ArahLocalDir $Root) $Kind) 'pending')
}

function Get-ArahArchiveDir {
    param(
        [string]$Root,
        [ValidateSet('bus', 'audit')]
        [string]$Kind
    )
    return (Join-Path (Join-Path (Get-ArahLocalDir $Root) $Kind) 'archive')
}

function Get-ArahLegacyJsonl {
    param(
        [string]$Root,
        [ValidateSet('bus', 'audit')]
        [string]$Kind
    )
    if ($Kind -eq 'bus') {
        return (Join-Path (Join-Path (Join-Path $Root '.arah') 'bus') 'signals.jsonl')
    }
    return (Join-Path (Join-Path (Join-Path $Root '.arah') 'audit') 'events.jsonl')
}

function Protect-ArahSecrets {
    <#
    .SYNOPSIS
      Redige padrões de secret em strings (fail-open se vazio).
    #>
    param([AllowNull()][string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return $Text }

    $patterns = @(
        # key=value, key: value, and JSON "key":"value"
        @{ re = '(?i)("?(?:api[_-]?key|apikey|secret|password|passwd|token|authorization|bearer)"?\s*[=:]\s*"?)([^"\s,]{8,})("?)'; repl = '${1}***REDACTED***${3}' },
        @{ re = '(?i)(ghp_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{20,}'; repl = '***REDACTED_GITHUB_TOKEN***' },
        @{ re = '(?i)(sk-[A-Za-z0-9]{20,})'; repl = '***REDACTED_API_KEY***' },
        @{ re = '(?i)(AKIA[0-9A-Z]{16})'; repl = '***REDACTED_AWS_KEY***' },
        @{ re = '(?i)(-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)'; repl = '***REDACTED_PRIVATE_KEY***' },
        @{ re = '(?i)(xox[baprs]-[0-9A-Za-z-]{10,})'; repl = '***REDACTED_SLACK_TOKEN***' }
    )

    $out = $Text
    foreach ($p in $patterns) {
        $out = [regex]::Replace($out, $p.re, $p.repl)
    }

    # Lone high-entropy tokens (≥48 chars) that look like secrets
    $matches = [regex]::Matches($out, '(?<![A-Za-z0-9+/=_-])[A-Za-z0-9+/=_-]{48,}(?![A-Za-z0-9+/=_-])')
    foreach ($m in $matches) {
        if ($m.Value -notmatch 'REDACTED') {
            $out = $out.Replace($m.Value, '***REDACTED_HIGH_ENTROPY***')
        }
    }

    return $out
}

function Protect-ArahObjectSecrets {
    param($Object)
    if ($null -eq $Object) { return $null }
    $json = $Object | ConvertTo-Json -Compress -Depth 8
    $scrubbed = Protect-ArahSecrets -Text $json
    try {
        return ($scrubbed | ConvertFrom-Json)
    } catch {
        return @{ scrubbed_text = $scrubbed }
    }
}

function Write-ArahEventFile {
    <#
    .SYNOPSIS
      Escrita atômica arquivo-por-evento em .arah/local/<kind>/pending/<ULID>.json
    #>
    param(
        [string]$Root,
        [ValidateSet('bus', 'audit')]
        [string]$Kind,
        $Event,
        [string]$Ulid = ''
    )
    if (-not $Ulid) { $Ulid = New-ArahUlid }
    $pending = Get-ArahPendingDir -Root $Root -Kind $Kind
    if (-not (Test-Path -LiteralPath $pending)) {
        New-Item -ItemType Directory -Path $pending -Force | Out-Null
    }
    $dest = Join-Path $pending ($Ulid + '.json')
    $tmp = Join-Path $pending ($Ulid + '.json.tmp')
    $line = ($Event | ConvertTo-Json -Compress -Depth 8)
    $line = Protect-ArahSecrets -Text $line
    Set-Content -LiteralPath $tmp -Value $line -Encoding UTF8
    Move-Item -LiteralPath $tmp -Destination $dest -Force
    return $dest
}

function Read-ArahEvents {
    <#
    .SYNOPSIS
      Lê eventos de pending/*.json + archive/*.jsonl + legado jsonl (mais recentes por último).
    #>
    param(
        [string]$Root,
        [ValidateSet('bus', 'audit')]
        [string]$Kind,
        [int]$Last = 0
    )
    $lines = New-Object System.Collections.Generic.List[string]

    $legacy = Get-ArahLegacyJsonl -Root $Root -Kind $Kind
    if (Test-Path -LiteralPath $legacy) {
        Get-Content -LiteralPath $legacy | ForEach-Object {
            if ($_.Trim()) { [void]$lines.Add($_) }
        }
    }

    $archive = Get-ArahArchiveDir -Root $Root -Kind $Kind
    if (Test-Path -LiteralPath $archive) {
        Get-ChildItem -LiteralPath $archive -Filter '*.jsonl' | Sort-Object Name | ForEach-Object {
            Get-Content -LiteralPath $_.FullName | ForEach-Object {
                if ($_.Trim()) { [void]$lines.Add($_) }
            }
        }
    }

    $pending = Get-ArahPendingDir -Root $Root -Kind $Kind
    if (Test-Path -LiteralPath $pending) {
        Get-ChildItem -LiteralPath $pending -Filter '*.json' | Sort-Object Name | ForEach-Object {
            $raw = Get-Content -LiteralPath $_.FullName -Raw
            if ($raw -and $raw.Trim()) { [void]$lines.Add($raw.Trim()) }
        }
    }

    if ($Last -gt 0 -and $lines.Count -gt $Last) {
        return @($lines | Select-Object -Last $Last)
    }
    return @($lines)
}

function Get-ArahEventCount {
    param(
        [string]$Root,
        [ValidateSet('bus', 'audit')]
        [string]$Kind
    )
    return @(Read-ArahEvents -Root $Root -Kind $Kind).Count
}
