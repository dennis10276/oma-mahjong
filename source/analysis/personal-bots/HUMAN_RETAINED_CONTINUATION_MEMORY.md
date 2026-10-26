# Persist exhausted known-continuation loss proofs

Default remains adopted23; trials24-27 are unadopted, consecutive count4.
Track A remains unmet. This is an optional solver-memory improvement, not an
adopted strategy or a fresh-campaign result.

## What changes

The witness search already proves some known successor positions losing, using
the full continuation analyzer. Its per-search proof cache is discarded at the
next search. Retain those fully proved child positions across decisions and
retries of the same board/salt, so later planning can prune them immediately.

rememberProvedContinuations:true requires rememberKnownLosses:true and
deadEndInformation:true. The controller binds every derivation to its exact
current observed physical state, pictures and orientations. The memory replays
the supplied path with known-only legal, non-losing transitions and verifies
the target state and unchanged known picture/orientation facts. It accepts only
an exhausted full-continuation certificate covering every target root, with
no reachable unknown, unsupported transition, win or budget boundary.

When this feature is enabled, continuation certification also checks the complete
public-information exposure projection, including back roles and orientations,
alongside existing public exposure. A reachable frontier prevents retention.
Bounded searches, sampled worlds and actual blunders without proofs teach no
loss fact. No hidden picture or role is assigned. A losing child does not make
its parent lose: a different parent action can still win.

Each retained fact stores the actual-root signature/tap witness, known path and
certificate with observedSuccessor:false. Paths/certificates are copied. New
continuation deductions stop once the cache already holds8192 positions;
existing actual-root recording remains unchanged. A full cache never invents a
loss or changes physical rules. Existing clock/arrival/relief distinctions
remain in the key. Absent the option, default23 behavior remains unchanged.

## Verification

131/131 human-reference tests pass17s(native56177 exit0). The new public key/lock
fixture has a real winning parent and a known losing child. Tests retain only
the child, reject bounded/partial/uncertain/changed-picture derivations, require
the broader exposure check, demonstrate a later remembered-loss prune and test
the actual controller callback.13 physical witness taps independently replay,
including a complete win from the parent and a real losing branch. Every fixture
picture and role used in this proof is actually visible through the observer.

Earlier unit logs are retained: the initial stacked fixture needed partial-
orientation handling, and the replacement fixture initially left a removed
tile's orientation null. Final unit04 uses the controller's removed-tile
normalization and passes; no benchmark result is edited or erased.

Current sourced64313c5b591cbf5e093dcf9771e62cbac1fce93608a2f30286ec5aa15a5473f.
Proposed profilef6f2ebd4501851269357f9829088f962fc64ca6ebed141cca412df3fb2d3ff0a:
retained23 plus rememberProvedContinuations:true and continuationTrayMin:2.
The existing supported threshold starts exact continuation checks at tray2;
persistence is intended to reuse their additional work. This is a global solver
setting, not a per-level route or hidden label. Unadopted route preferences and
inspection-successor memory are disabled. Default profile remains7a73e26d6089fbb3c8545d8921b679224da42aa38c5b7b28d4b8877619da8a72.

Next compare actual23 histories on32,11 and86/salt3, requiring zero baseline drift
and independent production replay. Count retained proofs separately from target
repairs. Freeze sources during those policy traces. No campaign28 is registered
yet. Any campaign still uses unchanged42 development boards/20 guards and the
full159/salts1-3 repair/no-passing-regression gate before adoption.

Raw .codex-runs/level-measure/: retained-continuation-losses-unit-01/02/03/04.log,
retained-continuation-losses-suite-01.log and compare-retained-continuation-losses.js.

## Live diagnostic checkpoint

Actor source is frozen while native98936(32/salt1),71840(11/salt1) and
43269(86/salt3) compare against actual23 histories. The latter uses
compare-retained-continuation-losses-full.js and full-records-for-next.json;
the lab traces use actual development records. Outputs are under
when-retained-continuation-losses-v1/ and
when-retained-continuation-losses-full-v1/. No campaign28 has been registered.
Require their terminal native results before interpreting choices or editing
the actor; partial proof counts alone establish no target gain.
