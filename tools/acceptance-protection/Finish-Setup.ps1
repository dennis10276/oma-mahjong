# Run this yourself from an administrator PowerShell. It never executes candidate code.
#requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Install-ProtectedGates.ps1') `
    -Payload 'C:\Users\den_k\.codex\acceptance-protection\release-v1-final' `
    -ManifestSha256 'ac984d93c2fc26107ee8b629cf29a5143e82c2d1392de600e050c41272356a51'
Write-Output 'Installation finished. Close this administrator window. Run Test-Protection.ps1 and the acceptance verifier WITHOUT elevation.'
