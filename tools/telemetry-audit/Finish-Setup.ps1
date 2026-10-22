#requires -RunAsAdministrator
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot '..\acceptance-protection\Install-ProtectedGates.ps1') `
    -Payload 'C:\Users\den_k\.codex\telemetry-audit\release-v2-sealed' `
    -ManifestSha256 '39323bba74c12e5a71cf0e52753c3f250673713cbb24888621014fb9a4124ce1' `
    -Destination 'C:\ProgramData\OmasMahjongAcceptance\v2'
Write-Output 'Close this administrator window. Run Test-Protection.ps1 -Directory C:\ProgramData\OmasMahjongAcceptance\v2 without elevation before trusting the installation.'
