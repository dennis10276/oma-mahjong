param(
    [string]$Repository = 'C:\Users\den_k\Idea\OmasMahjong\agy-personal-bots',
    [Parameter(Mandatory=$true)][string]$Ledger,
    [string]$Outcomes,
    [string]$Output = 'ACCEPTANCE_GATE.json'
)
$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run acceptance WITHOUT elevation. Never execute candidate code as administrator.'
}
$arguments = @('-I', '-S', '-B', (Join-Path $PSScriptRoot 'sealed_runner.py'),
    '--repository', $Repository, '--ledger', $Ledger, '--output', $Output)
if ($Outcomes) { $arguments += @('--outcomes', $Outcomes) }
& (Join-Path $PSScriptRoot 'runtime\python.exe') @arguments
exit $LASTEXITCODE
