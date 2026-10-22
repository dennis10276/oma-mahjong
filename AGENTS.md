# Personal simulator execution and evidence rules

Read the entire user contract in
`source/analysis/personal-bots/acceptance/EXECUTION_CONTRACT.txt` before continuing
this project. It is the authoritative task specification; this file adds
verification rules and does not replace any requirement.

Work only on `wip/agy-personal-bots` in this repository. Keep
`../personal-bot-review` strictly read-only.

Read `ACCEPTANCE_PROTECTION.md` and run the absolute protected verifier command
after substantive changes and before any acceptance/completion claim. Confirm
installation and ACL tests in `tools/acceptance-protection/PROTECTION_STATUS.json`.
Repository-local gate scripts and test/mapping changes are not authoritative.
The expected current exit code is 1. That is an honest incomplete result, not a
reason to weaken a check or request administrator access to change the rules.
Read every failed and UNVERIFIED row in the generated RTM, including dependencies.

- Never hand-edit PASS, targetMet, allGatesPassed, requirement coverage, cohort
  membership, or predictions to obtain a successful report. The Markdown and JSON
  RTMs and ACCEPTANCE_GATE.json are generated outputs, not evidence inputs.
- A successful test process, valid parameter bounds, a document, a human-only
  metric, or beating random on a few actions does not prove personal fidelity.
  Every behavioral requirement needs its own substantive source/input-bound
  evidence, comparison, and appropriate chronological held-out evaluation.
- Every numbered section and original requirement line must stay in the RTM.
  Compound clauses remain incomplete until all parts are verified. Do not merge
  away missing mechanisms, interpretation caveats, or process obligations.
- Keep unverified rows open. Add a genuine verifier and adversarial regression
  when implementing a missing mechanism. Do not map many unrelated requirements
  to a convenient weak test. A regression reopens all affected descendants.
- Preserve the baseline bytes and all existing forecasts. Never overwrite a
  registered candidate, move its cohort, discard seeds, or relabel an unresolved
  computation as an actual failure/clear. Use a distinct preregistered future
  candidate for an improved implementation.
- Preserve EXP-001 through EXP-005 exactly even where their claims are wrong.
  Append explicit corrections and failed variants. EXP-005's claimed Gerda
  semantic score and bot tray replication are not implemented evidence.
- Do not modify the contract, pinned baseline, verifier, or acceptance tests to
  hide a failure. A legitimate verifier repair must retain the old failure and
  demonstrate the corrected decision with independent adversarial tests. Record
  the repair and its limitations rather than silently rebaselining.
- Candidate source drift invalidates current-source reproduction of its frozen
  evidence; it never authorizes regenerating the old ledger. An independent
  reviewer may reconstruct the original sources from Git for historical audit.
- G6 must evaluate the selected candidate's own frozen predictions, all first 20
  consecutive eligible games for each person, 20 before-opening forecasts, and
  at least 16 correct per person. Pending/missing/race-opened games remain visible.
  Synthetic fixtures and stale snapshots cannot prove prospective success.
- Final reports must distinguish passed infrastructure tests from unmet behavior
  and prospective gates. Do not claim that live data is the only dependency while
  engineering rows remain open. Include the exact commands, actual failures,
  selected ledger/outcome files, source hashes, and uncommitted-source limitations.
- If delegating, give each subagent the full original contract verbatim, followed
  by its assignment, as required by the contract.

Read `ACCEPTANCE_REVIEW.md` for the audit baseline and independent verification
procedure. An agent with permission to edit both implementation and verification
can still tamper with both; independent review must pin the verifier outside the
implementing agent's write authority.
