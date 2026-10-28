# Third tray spot is a last resort for uncovering unknown pictures

Dennis's steering:
"the bot often fills its third tray spot to uncover an unknown tile. This is a
bad habit. You almost never want to do this only if its the only plausible path"
"And you want to go back to max 2 tray spots filled asap"

Candidate flag avoidThirdTrayInformation applies globally,independently of the
two-feature opening condition for learned Q. Default40 remains retained until
the fixed42/full159×3 repair/no-regression/<2s gates pass. Measured51 now running.

Before a prefix reaches pressure3 before unknown information,search public known
prefixes for an alternative ending at pressure<=2:a safe unknown closed inspection,
or genuine board removal without extra carry. At pressure3,search the shortest
known physical-tap route to pressure<=2 first. Known on-pile pairs can unlock that
relief;avoid unrelated pile removal when a direct waiting tray match restores
headroom. A known transient third slot followed by guaranteed relief is allowed.
Preserve proved wins,safe clock exits and necessary continuations.

Breadth-first search,512 nodes/60ms,max12 taps,shared decision deadline1900ms.
Use only public availability,remembered faces/orientations and public clock;
uncertain pictures stop the model. Never supply hypothetical pictures. If no
safer route is found within the bound,retain primary with a last-resort audit
flag. A capped lack of alternatives is not proof of impossibility. This fallback
does not claim to rule out every possible hidden continuation. Retry picture
memory stays same-board/salt only.

Guard runs after learned/legacy strategy selection,so soft Q cannot override
headroom preference. Reset stale planner/retained options when changing root;
replan from the next actual observation. The learned continuation model stays
frozen;benchmark outcomes never refit it.

Commit0b57b1c.156/156 tests pass19s(native62968 exit0). Production control avoids
a third unmatched tile to expose an unknown and clears;6 taps independently
replay. Tests require immediate tray3 relief over an unrelated closed pair,allow
a sole known information route,keep proofs and mark caps unknown.

v8 real-history comparisons now live against frozen50:10049 salt2(native35123),
10011 salt1(29656),86 salt3(60012). Source frozen. Suggestions are not wins. Then
audit and count51 only on campaign start.3/8 used,5 remain;A/B/unseen20 unmet.

Completed controls:431 taps,zero drift,83 source hashes,max1452.581ms. Native
35123/29656 exit0;the first86 comparator60012 failed because truncating a prior
attempt left its retry agenda open. Preserve failure;fixed complete-attempt86
comparison58660 exits0. No bot campaign ran during these checks. Measured51 now
running native27334,three workers,fixed42 development/salt1 then unchanged full
qualification. Protocol2ba43f8;4/8 used,4 remain. Actor frozen;default40 retained.

51 failed development(39 clears/38 targets vs41/39;102 target regression;10011
and10049 clearance regressions). No full run/adoption. Interim pair-utility
restrictionb57e145 superseded after explicit clarification:unrelated cleanup
IS useful,not a bad habit. Keep tray clean generally;clock/key routes may justify
carry. Currentd90fa66 restores cleanup and prioritizes the selected visible-clock/
remembered-key route over unrelated alternatives. Same-goal low-carry routes stay
preferred. Goal cones use public geometry/rules only and are heuristics,not proofs.
156 tests pass19s(native12290 exit0),including useful unrelated cleanup,no-clock
and clock-priority contrast,and a closed key pair that unlocks actual tray relief.
Current replays do not prove clears;no52 campaign yet.4/8 used,4 remain. Default40.

Intention memoryb3d9657 keeps useful route continuity through cleanup instead of
resetting strategy each time. Actual taps consume its prefix;new facts/rejected
taps/proof conflicts/retry reset invalidate it. Known-only steps revalidate and
stop at unknown information;no hidden face enters memory.157 tests19s,392 replayed
audit taps with zero drift and all native exits0. Measured52 now running6317,
3 workers,fixed42 then unchanged full qualification;5/8 used,3 remain. Default40.
