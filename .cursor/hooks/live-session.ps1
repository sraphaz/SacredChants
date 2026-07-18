#Requires -Version 5.1
# Hook ARAH Live Session — telemetria passiva para extensão (fail-open)

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet(
      'session-start', 'session-end', 'file-edit', 'subagent-start', 'subagent-stop',
        'tool-use', 'agent-edit', 'turn-stop', 'conversation-focus'
    )]
    [string]$Event,
    [switch]$PromptHook
)

$ErrorActionPreference = 'SilentlyContinue'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Telemetry = Join-Path $Root 'scripts/agents/session-telemetry.ps1'

$stdin = ''
try {
    $stdin = [Console]::In.ReadToEnd()
} catch { }

if (Test-Path $Telemetry) {
    & $Telemetry -Action $Event -HookInput $stdin
}

if ($PromptHook) {
    [Console]::Out.WriteLine('{"continue":true}')
}

exit 0
