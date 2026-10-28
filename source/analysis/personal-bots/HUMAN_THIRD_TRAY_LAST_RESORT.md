# Third tray spot is a last resort for uncovering unknown pictures

Dennis's steering:
"the bot often fills its third tray spot to uncover an unknown tile. This is a
bad habit. You almost never want to do this only if its the only plausible path"
"And you want to go back to max 2 tray spots filled asap"

Candidate flag avoidThirdTrayInformation applies globally,independently of the
two-feature opening condition for learned Q. Default40 remains retained until
the fixed42/full159×3 repair/no-regression/<2s gates pass. No measured51 yet.

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
