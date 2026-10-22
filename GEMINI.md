# Mandatory project instructions

The authoritative gate definitions now reside outside this editable repository.
Read `ACCEPTANCE_PROTECTION.md` and check the actual installation status before
claiming acceptance. Use the absolute protected command documented there.
Repository gate scripts, requirement mappings, and test edits cannot change the
protected acceptance standard. Propose substantive tests/evidence for independent
review; do not request administrator elevation to change the rules yourself.

Read and follow `AGENTS.md`, `ACCEPTANCE_REVIEW.md`, and the **entire** original
contract at `source/analysis/personal-bots/acceptance/EXECUTION_CONTRACT.txt`.

The previous all-offline-gates-pass claim was retracted by an independent audit.
Current work is explicitly incomplete. Do not substitute new prose or a weaker
test for the missing behavioral evidence. The generated RTM is a dependency-aware
inventory of the original contract, not a checklist you may mark complete.

Before claiming success, run the acceptance checker and inspect all requirements,
raw measurements, and dependency failures. Exit code 1 must be reported honestly.
Preserve all older ledgers and failed variants. Continue actual engineering and
meaningful experiments under the original contract; this audit does not establish
that external human outcomes are the only remaining dependency.
