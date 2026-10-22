param([Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run telemetry discovery without elevation'}
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'MANIFEST.json') -Raw | ConvertFrom-Json
foreach($entry in $manifest.files.PSObject.Properties){
    $target=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $entry.Name))
    if(-not $target.StartsWith($PSScriptRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid protected manifest path'}
    if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $entry.Value){throw ('Protected file changed: '+$entry.Name)}
}
Write-Output ('Protected telemetry authority: '+$PSScriptRoot)
& (Join-Path $PSScriptRoot 'runtime\python.exe') -I -S -B (Join-Path $PSScriptRoot 'telemetry\telemetry_audit.py') --output $Output
exit $LASTEXITCODE
