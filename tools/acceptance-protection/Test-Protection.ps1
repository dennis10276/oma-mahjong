param([string]$Directory = 'C:\ProgramData\OmasMahjongAcceptance\v1')
$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Tamper tests must run without elevation' }
if (-not (Test-Path -LiteralPath (Join-Path $Directory 'INSTALLATION.json'))) { throw 'Protected installation has not completed' }
foreach ($name in @('probe-write.txt','probe-delete.txt','probe-rename.txt','probe-acl.txt')) {
    if ([IO.File]::ReadAllText((Join-Path $Directory $name)) -ne 'protected-probe') { throw 'Missing/changed probe fixture; cannot infer protection from a missing file' }
}
$results = [Collections.Generic.List[object]]::new()
$probeHashes=@{}
foreach ($name in @('probe-write.txt','probe-delete.txt','probe-rename.txt','probe-acl.txt')) {
    $probeHashes[$name]=(Get-FileHash -LiteralPath (Join-Path $Directory $name) -Algorithm SHA256).Hash
}
function Test-Denied([string]$Name, [scriptblock]$Action) {
    try {
        & $Action
        $results.Add([pscustomobject]@{operation=$Name;denied=$false;error='UNEXPECTED SUCCESS'})
    } catch {
        $exception=$_.Exception
        $denied=($_.CategoryInfo.Category -eq 'PermissionDenied')
        while ($exception) {
            if ($exception -is [UnauthorizedAccessException] -or $exception -is [Security.AccessControl.PrivilegeNotHeldException]) { $denied=$true }
            if ($exception.HResult -eq -2147024891) { $denied=$true } # HRESULT_FROM_WIN32(ERROR_ACCESS_DENIED)
            $exception=$exception.InnerException
        }
        $results.Add([pscustomobject]@{operation=$Name;denied=$denied;error=$_.Exception.Message;
            exceptionType=$_.Exception.GetType().FullName; hresult=$_.Exception.HResult;
            category=[string]$_.CategoryInfo.Category})
    }
}
Test-Denied 'overwrite' { [IO.File]::WriteAllText((Join-Path $Directory 'probe-write.txt'),'tampered') }
# File.Delete preserves the underlying UnauthorizedAccessException. Windows
# PowerShell 5.1's Remove-Item can wrap this as an unclassified IOException.
Test-Denied 'delete' { [IO.File]::Delete((Join-Path $Directory 'probe-delete.txt')) }
Test-Denied 'rename' { Rename-Item -LiteralPath (Join-Path $Directory 'probe-rename.txt') -NewName 'renamed-by-test.txt' -ErrorAction Stop }
Test-Denied 'create-file' { [IO.File]::WriteAllText((Join-Path $Directory 'unauthorized-new-file.txt'),'tampered') }
Test-Denied 'change-permissions' {
    $path=Join-Path $Directory 'probe-acl.txt'
    $acl=Get-Acl -LiteralPath $path
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','Allow')))
    Set-Acl -LiteralPath $path -AclObject $acl -ErrorAction Stop
}
$manifestPath=Join-Path $Directory 'MANIFEST.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$badHashes=@($manifest.files.PSObject.Properties | Where-Object {
    (Get-FileHash -LiteralPath (Join-Path $Directory $_.Name) -Algorithm SHA256).Hash -ne $_.Value
} | ForEach-Object Name)
$changedProbes=@($probeHashes.Keys | Where-Object {
    $path=Join-Path $Directory $_
    -not (Test-Path -LiteralPath $path) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $probeHashes[$_]
})
$receipt=[ordered]@{ checkedAt=[DateTime]::UtcNow.ToString('o'); directory=$Directory;
    installed=$true;
    user=[Security.Principal.WindowsIdentity]::GetCurrent().Name;
    owner=(Get-Acl -LiteralPath $Directory).Owner;
    manifestSha256=(Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLower();
    tests=@($results.ToArray()); integrityFailures=$badHashes; changedProbeFiles=$changedProbes;
    protected=(@($results | Where-Object {-not $_.denied}).Count -eq 0 -and $badHashes.Count -eq 0 -and $changedProbes.Count -eq 0);
    scope='Normal unelevated file access; not elevated administrator access or same-account process interference';
    candidateCodeExecutedAsAdministrator=$false }
$receipt.agentWriteProtectionEnforced=$receipt.protected
$receipt.protectionTestsExecuted=$true
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'PROTECTION_STATUS.json') -Encoding UTF8
$receipt | ConvertTo-Json -Depth 6
if (-not $receipt.protected) { exit 1 }
