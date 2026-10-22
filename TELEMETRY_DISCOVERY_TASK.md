# Gated telemetry-discovery assignment

Read the entire original execution contract and AGENTS.md. This is the next
bounded evidence-discovery phase, not a reduction of the original personal-bot
requirements and not permission to relax G6. Confidence disclaimers are not proof.

The task contract is `tools/telemetry-audit/TASK_CONTRACT.json`. It pins all five
currently present project `source/analysis` trees and the bytes of eight registered
causal candidates. 44,913 existing source paths and sizes are pinned against omission/deletion. New files must also be inventoried. All files in those trees are inventoried, including ignored and
hidden archive files. The sibling personal-bot-review is read-only.

| Gate | Required evidence | Failure behavior |
| --- | --- | --- |
| T0_SCOPE | All five pinned roots exist and are readable, with no redirected roots | Missing/reparse roots block all descendants |
| T1_INVENTORY | Full paths, sizes and SHA256 for every file, identical before/after scan | Errors, changing files and omissions block completion |
| T2_EXTRACTION | Every source has an independently reviewed adapter or justified disposition | Unknown schema, binary/large files, incomplete raw reconstruction or derived-only provenance remains unresolved |
| T3_DEDUPLICATION | Preserve event identity, all contributing sources, pending attempts and conflicts | Different attempts cannot collapse; conflicting exports block completion |
| T4_CANDIDATE_ELIGIBILITY | Authenticate pinned candidate bytes; classify against actual freeze and frontier | Historical records never become prospective; missing openings/boards and derived outcomes remain unresolved leads |
| T5_BOUNDED_CONCLUSION | All prerequisites pass and a reproducible scoped conclusion follows from records | No “no telemetry exists” or “data exhausted” statement while sources are unresolved; never a global/server absence claim |

The first implementation deliberately leaves unresolved source-specific work open.
Each run has a pinned 120-second budget. Files over 64 MiB require a separately
reviewed streaming hash/extraction adapter; they are inventoried as unresolved,
not skipped as irrelevant. Timeout/partial inventory also blocks all descendants.
These resource limits bound the search, not the scientific evidence requirement.
Raw plays produce retained event leads, not invented campaigns. Derived outcomes
are not accepted just because they carry a `live` label. Replay channels, manifests,
screenshots and unknown JSON require further reviewed reconstruction/dispositions.
Do not respond to a blocked gate by assigning unknown sources an “irrelevant” flag.
Propose adapters with exact event/board/timestamp evidence and adversarial tests.

Implement next:

1. Use the generated per-source inventory to prioritize actual raw replay and live
   export adapters, including `realdata/plays.json`, replay channels and overlapping
   live-opening exports. Reconstruct opening/end/availability times, campaign/retry
   boundaries, exact board IDs, assisted status and pending episodes. Preserve
   unsupported or ambiguous records explicitly.
2. Independently reconcile derived outcomes against those raw inputs and manifests.
   Preserve original snapshots and source hashes. Add tests for late exports,
   duplicate snapshots, conflicting IDs, missing openings, assistance, incomplete
   games, relative replay clocks, unknown players and unresolved boards.
3. For each pinned candidate, retain the immutable first-20 cohort, including
   missing/race-opened/pending cases. The discovery verifier currently labels
   post-freeze matches as leads requiring G6 authentication, not certified outcomes.
   Complete a reviewed first-20 reconciliation before claiming actual eligibility.
4. Submit each adapter/disposition and requirement binding for independent review
   with exact commands, outputs, code and input hashes. Do not modify the protected
   authority, request admin access, or edit report flags. Continue independent
   source reconstruction while review is pending.
5. Complete the finite scan before claiming available evidence is exhausted. If
   no eligible evidence exists within the fully reconciled scope, state exactly
   the roots, timestamps and limits, then resume meaningful dataset/policy work.
   Do not repeat identical scans indefinitely to appear active.

No report from this task can satisfy G6, authenticate server origin by itself,
change a cohort, or approve simulator correctness. Historical evidence remains
useful for development and must not be discarded because it is not prospective.

## Protected installation

Protected v1 is unchanged. A separate v2 package is prepared by
`tools/telemetry-audit/build_release.py` from the validated v1 release plus this
task's code, contract and tests. It uses the protected Python interpreter with
`-I -S`, reads data without executing candidate code, and verifies package hashes.
Its CLI cannot accept a substitute scope contract. Administrator installation is
still required; repository copies and editable JSON outputs are not authority.

The final prepared manifest SHA256 is
`39323bba74c12e5a71cf0e52753c3f250673713cbb24888621014fb9a4124ce1`.
Install only after reviewing the task/contract/code. In an administrator PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\den_k\Idea\OmasMahjong\agy-personal-bots\tools\telemetry-audit\Finish-Setup.ps1"
```

Close that administrator window. Verify ACL denial without elevation using
`tools/acceptance-protection/Test-Protection.ps1 -Directory C:\ProgramData\OmasMahjongAcceptance\v2`.
The prepared package is not yet an installed protected authority.

After installation, run without elevation:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\OmasMahjongAcceptance\v2\Run-TelemetryAudit.ps1" -Output "C:\Users\den_k\.codex\telemetry-audit\protected-run-001.json"
```

Use a new output path per run; reports cannot overwrite inputs or prior reports.
The remaining trust limit is unchanged: administrator access or same-account
process interference can defeat local protection. Independent ownership/CI is
needed for stronger adversarial isolation; no local verifier is “uncheatable.”
