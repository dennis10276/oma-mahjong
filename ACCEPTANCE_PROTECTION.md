# Protected acceptance authority

The prepared authoritative gate release has this installation target outside the
editable checkout:

`C:\ProgramData\OmasMahjongAcceptance\v1`

Installation success and denied-operation tests must be confirmed in
`tools/acceptance-protection/PROTECTION_STATUS.json`. Do not infer successful
protection merely from the presence of this document or the installer sources.

Current status: **installed and verified**. The directory is owned by
`BUILTIN\Administrators`. On October 22, 2026, all five unelevated tamper operations
were denied, every package hash matched, and every probe file remained unchanged.
The diagnostic initially misclassified Windows PowerShell 5.1's delete exception;
using the underlying file API and checking probe integrity confirmed denial.
The protected verifier files and manifest were not changed to repair the diagnostic.

For a new installation only, open PowerShell **as administrator** and run (the
installer refuses to overwrite an existing protected release):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\den_k\Idea\OmasMahjong\agy-personal-bots\tools\acceptance-protection\Finish-Setup.ps1"
```

Then close that administrator window and run this from a normal PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\den_k\Idea\OmasMahjong\agy-personal-bots\tools\acceptance-protection\Test-Protection.ps1"
```

It must report `protected: true`, all five write/delete/rename/create/permission
attempts denied, and no manifest hash failures. Do not run simulator code elevated.

Run the protected verifier **without administrator privileges**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\OmasMahjongAcceptance\v1\Run-Acceptance.ps1" -Repository "C:\Users\den_k\Idea\OmasMahjong\agy-personal-bots" -Ledger "source/analysis/personal-bots/personal-source-bound-causal-forecasts-v7.jsonl"
```

The release contains its own Python interpreter and standard library, gate
definitions, requirement bindings, evidence validators, original contract,
baseline, and pinned Python/JavaScript acceptance tests. It verifies its manifest
before running. Repository copies of gate definitions, mappings, and test files
are not used as the acceptance authority. Candidate implementations and scientific
dependencies execute only without elevation.

The release comes from the independently retained snapshot with SHA256:
`20ed8ed3bd0d697e4b3c40574220b03e7e0043a3770d22b581fda7491825e66b`.

Its protected manifest SHA256 is:
`ac984d93c2fc26107ee8b629cf29a5143e82c2d1392de600e050c41272356a51`.

The audited compatibility changes are recorded in the manifest: accept a contained
candidate generator path, allow the supported trayBuffer value 1 while preserving
the measured-fidelity assertion, and distinguish missing independent verification
from missing candidate implementation. The original 10 narrow requirement bindings
remain; the candidate's expanded 188 bindings are not promoted. Unverified clauses
cannot pass just because a general unit test passes.

Only Administrators and SYSTEM may change the protected directory; ordinary users
have read/execute permissions. Ownership and high-integrity protection prevent an
unelevated agent from granting itself write permissions, overwriting, replacing,
renaming, or deleting gate files. The protected version is never updated in place
by the implementing agent. A separately reviewed new release requires an explicit
administrator installation. Administrator credentials/approval must not be given
to Gemini for changing acceptance rules.

This protects files from normal unelevated agent access. Both Codex and Antigravity
currently use the same administrator-capable Windows account with filtered tokens.
It is not a security boundary against elevated software, administrator compromise,
or arbitrary process interference under the same account. For stronger adversarial
isolation, run Gemini under a separate standard account or VM and run verification
under an independent account/CI. Installation does not silently migrate or stop
your running Antigravity session.

Generated repository reports remain editable and are not signed certificates.
Only an independently observed execution of the absolute protected command, using
the pinned release, is evidence. Gemini can still print a false claim or run its
own edited local script; that does not change the authoritative protected rules.

If a legitimate mechanism needs a new acceptance test, Gemini may propose code and
evidence in the repository. An independent reviewer must examine the test and its
requirement binding before an administrator installs a new protected version.
Freezing a verifier cannot itself prove that its criteria cover every defect or
cause the simulator to achieve the prospective target.

Recovery: an administrator may inspect/change the ACLs or remove this **new,
dedicated** protected installation. No permissions on your existing workspace,
other applications, or `personal-bot-review` are changed by the installer.
