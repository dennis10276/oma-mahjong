# Public role-memory leads awaiting controlled experiments

These are evidence and implementation plans, not adopted strategies. The measured
actor remains frozen during experiment06. Foundation components are in7e36eb5;
119/119 reference tests pass in role-foundation-reference-tests-02.log.

The ONE observer already exposes drawn back symbols correctly. The planning
frontier currently restricts future role-exposure targets to known face-up tiles.
A geometry-only reproduction removes an overlapping tile and exposes a drawn back
symbol while keeping the picture hidden. Existing role targets remain empty;
createDrawnRoleFrontier correctly returns the newly readable role index. It uses
the existing tileVisibility function and never supplies a guessed role or picture.

Possible isolated experiment: opt into this frontier in both ordinary passive
information planning and stalled-retry exploration. Preserve the current mode and
tray/clock gates. Validate actual production routes, then the fixed development
cohort and full salts1-3 before adoption. More information targets can change route
selection; a correct visibility prediction alone does not demonstrate better play.

Integration detail found during full06: explorationWitness receives the physical
planning state, which has no roles array. Its local exposure frontier therefore
cannot discover future role targets merely by swapping the helper. The draft
adds a controller-owned publicRoleExposure callback built from current actual
role observations, forwards it through retryInformationSearch, and combines its
readability targets with the existing picture/orientation frontier. It supplies
no role value or hidden picture. Ordinary passive information uses the new helper
under the same optional global flag. The old path remains identical when disabled.

Typed key identity is a separate lead. A production replay audit covered9209
actual taps across11 lab boards from experiment04. It found17 positive key
identities first observed after opening, before a failed retry, across11 runs:
lab10011(3),10049(1),10041(1),10052(6),10045(6). No ice-to-key/lock composite
transition occurred in this audit. Do not claim evidence of such a transition.

The generic nonexclusive controller retains availability witnesses, but its
single-enum starting-role memory does not retain these late positive key identities
as typed dependencies across retries. createKeyIdentityMemory preserves actual
observed key glyphs, with attempt/tap provenance, without assuming the key had no
ice or lock. Separate controller instances isolate different boards and salts.

Possible isolated experiment: optional rememberKeyIdentities flag. Merge positive
static key identities into planning dependencies and observed-key proof inputs,
including already removed keys when retaining complete known membership. Never
overwrite the single current-role enum or infer an unobserved key's availability.
Current legality must still come from the ONE observer; hypothetical legality
still needs existing public proof. New key identity must count as actual learning
for stalled-retry detection, without changing the legacy three-field known() API.
Keep hypothesis sampling disabled until its world-history consistency checks also
account for these typed facts. Test late discovery, retry masking, removed keys,
fresh-board isolation, hidden-world invariance and physical production replay.

No simulated picture may enter trusted memory merely because every sampled world
agrees. A deduction must hold in every hidden board consistent with actual public
observations and applicable rules. Existing observed-match deduction is one such
rule-backed fact; a bounded search or sample frequency cannot certify another.

Raw evidence: .codex-runs/level-measure/back-role-frontier-repro-01.log,
observed-role-history-v1.jsonl, key-identity-memory-tests-01.log and
drawn-role-frontier-tests-01.log. Audit native28941 exited0. Neither component has
been enabled in an actual benchmark yet. They do not reset the eight-trial stop rule.

Concrete integration drafts are stored under .codex-runs/level-measure/:
key-memory-draft/integration.patch and drawn-role-draft/integration.patch, with
draft production-integration tests in the same folders. Preparation scripts
prepare-key-memory-patch.py and prepare-drawn-role-patch.py reproduce them.
Syntax checks and git apply --check pass; production integration tests have NOT
run. Nothing has been applied to the measured actor. After06's native workers
finish, apply/test the key-memory change first and preregister a separate trial;
retain the drawn-role change as its own subsequent strategy or justified combination.
