# Independent acceptance review

The original offline-complete claim is unsupported. This change hardens verification;
it does not establish faithful personal simulators or the prospective 80% target.
The original contract is preserved byte-for-byte in
`source/analysis/personal-bots/acceptance/EXECUTION_CONTRACT.txt`.

Run from this repository:

```powershell
python -B -m unittest discover -s source/tools/sim/refit -p test_acceptance_evidence.py -v
node source/tools/sim/refit/test_personal_information_boundary.js
node source/tools/sim/refit/test_personal_registration_guard.js
node source/tools/sim/refit/test_human_decision_dataset.js
python -B source/tools/sim/refit/check_acceptance_gates.py
```

The final command must exit **1** for the current implementation. It writes
`ACCEPTANCE_GATE.json`, `REQUIREMENTS_RTM.json`, and `REQUIREMENTS_RTM.md`.
The fidelity acceptance test also intentionally exits nonzero for Gerda's measured
failure; an honest failure is not a green infrastructure result.

The RTM contains 184 verbatim requirement lines plus 10 numbered section parents.
Additional AUDIT rows expose independent safeguards. It preserves the whole prompt,
including process obligations and compound clauses; it does not pretend each
compound sentence has been decomposed into fully verified behavioral evidence.
Parents derive their status from every child. All gate dependencies apply.
Unmapped requirements remain UNVERIFIED until a substantive verifier exists.
Generated reports are not accepted as evidence inputs. Each audit records actual
commands, exit codes, outputs, UTC evaluation time, Git HEAD, working-tree state,
and source/input hashes; edited sources are not called a verified implementation
commit. Tests alone do not close unrelated requirements.

Specific protections added:

- Check all four people's measured fidelity, including the evaluator's negative
  result. Neither valid parameter bounds nor an aggregate score can mask a person.
- Preserve the distinction between human tray counts and an independently simulated
  bot-versus-human comparison. The latter is missing and stays FAIL.
- Recompute distributions and point forecasts from individual campaign records.
  Missing campaigns, duplicate seeds, hand-adjusted points, and retries after
  unresolved computations are rejected. Current v3 did not retain the necessary
  records; its forecasts are preserved and fail this audit.
- Discover local import dependencies and dynamic board tables; compare actual
  hashes, not just key presence. A future candidate also needs pre-run freezing,
  unchanged-source checks, declared seeds, training provenance and convergence
  evidence. Those clauses are not closed by the source-list check.
- Pin v1/v2/v3, the original RTM, original contract and the EXP-001..005 prefix.
  New corrections append rather than rewriting failed evidence. V3 registration
  refuses an existing path before calibration/workers and uses exclusive creation.
- Pass public geometry rather than the private deal to the policy. Test equivalent
  concealed prefixes with default/explicit seeds and exactly one forgetting draw.
  These regressions do not establish exposed-edge recognition or a complete visual
  observation proof; the corresponding contract requirements remain open.
- Fix replay campaign resets and retain event-level unresolved reconstruction
  records. Production-consistent replay alone is not proof of a faithful dataset;
  legitimate memory, timing and ambiguous events still need fuller validation.
- G6 selects v3 by default and accepts explicit `--ledger` and `--outcomes` paths.
  It checks all 20 before-opening forecasts per person, uses cohort accuracy rather
  than global accuracy, rejects stale-snapshot warnings, and rebuilds outcome
  episodes in memory from the archived live manifest and plays. No outcome archive
  is rewritten during verification. The default October 20 snapshot is stale for
  v3 and cannot establish its prospective success.

All earlier model failures remain evidence. Changing code now produces source
mismatches against the frozen v3 ledger: this is expected, not permission to rewrite
that ledger or its hashes. Improvements must be a distinct candidate with a newly
preregistered future cohort and retained selection history. Reconstruction against
historical committed sources can support a separate historical audit.

Trust boundary: an implementing agent that can rewrite both code and verifier can
also remove checks. Local hashes establish consistency, not human/server authenticity
or a security sandbox. An independent reviewer should retain the original prompt,
raw live exports, and a pinned copy/commit of this verifier outside that agent's
write authority, run the audit independently, and compare changes to the verifier
as carefully as changes to the simulator. No code-only guarantee can eliminate
deliberate tampering under shared unrestricted write permissions.

Pinned baseline SHA256:
`e22d59e8eb4c26bbe219ec257cc6963c6296fe6e7ea7fa9df589bfdd88c4f199`

Original user-contract SHA256:
`f0f445635577877f122785c5504856fbba2756db113083ded7ac3de2a8ff017b`

The previous RTM and gate report are retained under
`source/analysis/personal-bots/acceptance/` with `.before-hardening` names.
The sibling `personal-bot-review` checkout is read-only throughout this work.
