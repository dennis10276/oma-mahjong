param(
    [Parameter(Mandatory=$true)][string]$Payload,
    [Parameter(Mandatory=$true)][string]$ManifestSha256,
    [string]$Destination = 'C:\ProgramData\OmasMahjongAcceptance\v1'
)
$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Installation requires administrator approval. No simulator or candidate code is run by this installer.'
}
$Payload = [IO.Path]::GetFullPath($Payload)
$Destination = [IO.Path]::GetFullPath($Destination)
if ($Destination -notmatch '^C:\\ProgramData\\OmasMahjongAcceptance\\v[1-9][0-9]*$') { throw 'Unexpected installation destination' }
if (Test-Path -LiteralPath $Destination) { throw 'Version already exists. Never overwrite a protected verifier release.' }
$manifestFile = Join-Path $Payload 'MANIFEST.json'
if ((Get-FileHash -LiteralPath $manifestFile -Algorithm SHA256).Hash -ne $ManifestSha256) { throw 'Payload manifest changed' }
$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
$entries = @($manifest.files.PSObject.Properties)
foreach ($entry in $entries) {
    $source = [IO.Path]::GetFullPath((Join-Path $Payload $entry.Name))
    if (-not $source.StartsWith($Payload + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Payload path traversal' }
    $cursor = Get-Item -LiteralPath $source
    while ($cursor -and $cursor.FullName.Length -ge $Payload.Length) {
        if ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse points are prohibited in install payload' }
        $cursorParent = Split-Path -Parent $cursor.FullName
        $cursor = if ($cursorParent) { Get-Item -LiteralPath $cursorParent } else { $null }
    }
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $entry.Value) { throw ('Payload changed: ' + $entry.Name) }
}
$administrators = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')
$system = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
$users = New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545')
function Protect-Directory([string]$Path) {
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($administrators)
    foreach ($sid in @($administrators, $system)) {
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    }
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($users, 'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    Set-Acl -LiteralPath $Path -AclObject $acl
}
$parent = Split-Path -Parent $Destination
if (Test-Path -LiteralPath $parent) {
    if ((Get-Item -LiteralPath $parent).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Installation parent is a reparse point' }
    $parentAcl = Get-Acl -LiteralPath $parent
    if ($parentAcl.Owner -notin @('BUILTIN\Administrators', 'NT AUTHORITY\SYSTEM')) { throw 'Existing installation parent is not administrator-owned' }
} else {
    New-Item -ItemType Directory -Path $parent | Out-Null
    Protect-Directory $parent
}
New-Item -ItemType Directory -Path $Destination | Out-Null
Protect-Directory $Destination
foreach ($entry in $entries) {
    $target = [IO.Path]::GetFullPath((Join-Path $Destination $entry.Name))
    if (-not $target.StartsWith($Destination + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Destination path traversal' }
    $targetParent = Split-Path -Parent $target
    if (-not (Test-Path -LiteralPath $targetParent)) { New-Item -ItemType Directory -Path $targetParent -Force | Out-Null }
    Copy-Item -LiteralPath (Join-Path $Payload $entry.Name) -Destination $target
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $entry.Value) { throw ('Copy integrity failure: ' + $entry.Name) }
}
Copy-Item -LiteralPath $manifestFile -Destination (Join-Path $Destination 'MANIFEST.json')
if ((Get-FileHash -LiteralPath (Join-Path $Destination 'MANIFEST.json') -Algorithm SHA256).Hash -ne $ManifestSha256) { throw 'Installed manifest integrity failure' }
Get-ChildItem -LiteralPath $Destination -Recurse -Force | ForEach-Object {
    $acl = Get-Acl -LiteralPath $_.FullName
    $acl.SetOwner($administrators)
    Set-Acl -LiteralPath $_.FullName -AclObject $acl
}
& "$env:SystemRoot\System32\icacls.exe" $Destination /setintegritylevel '(OI)(CI)H' /T /Q
if ($LASTEXITCODE -ne 0) { throw 'Failed to set integrity protection' }
# These probe fixtures are disposable; they allow actual denied-operation tests
# without attempting to destroy a verifier file if installation is incorrect.
foreach ($name in @('probe-write.txt', 'probe-delete.txt', 'probe-rename.txt', 'probe-acl.txt')) {
    [IO.File]::WriteAllText((Join-Path $Destination $name), 'protected-probe')
}
$receipt = [ordered]@{ installedAt=[DateTime]::UtcNow.ToString('o'); destination=$Destination;
    manifestSha256=$ManifestSha256; owner=(Get-Acl -LiteralPath $Destination).Owner;
    acl=(Get-Acl -LiteralPath $Destination).Sddl; candidateCodeExecutedAsAdministrator=$false }
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Destination 'INSTALLATION.json') -Encoding UTF8
Write-Output ('Installed protected acceptance verifier: ' + $Destination)
