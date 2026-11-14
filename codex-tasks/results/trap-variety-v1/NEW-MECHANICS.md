# New mechanic proposals, ranked

These are design proposals for Dennis to choose from. Only number 1 is prototyped. Nothing is assigned to a level or released. None uses a joker. The goal is a visible dependency that rewards planning, rather than a hidden surprise.

## 1. First this tile — ribbon prerequisite (recommended; playable prototype)

**Rule:** “Take the tile marked 1 before you take the tile marked 1→.”

A small teal flag marks the source, and a blue arrow flag marks the waiting tile. The flags carry the same number; colour is supplementary. The arrow flag turns green and gains a tick when the source leaves. The ordinary picture remains visible. Tapping the waiting tile points to its source. Ice and locks still apply after the ribbon opens. Version 1 deliberately permits one ribbon per board, so this does not become a board full of labels.

The ribbon joins two distant parts of the pile without a tall chain of covers. A source can consume a tray slot before an iced key can be reached; taking a lookalike pair too early may then strand the clock. Conversely, putting the source on a useful matching tile gives the player an “aha” relief. This is a dependency between tile identities, not between colours or matching faces. Repeated pictures remain a real choice.

It is deterministic: both ends and the rule are visible before play. Taking the source means taking it off the board; it does not need to finish a pair. It consumes the usual move and tray space. The two full prototype boards prove that removing the ribbon shortens the exact clock route by two moves, while every original ice/lock effect still matters.

**Build cost:** small to medium. The prototype adds the same prerequisite to game takeability, reference replay and incremental engine search; a versioned optional packed extension; saved obstacle state; readable badges; a blocked-tap explanation; a four-step animated lesson; and compatibility/browser tests. The ordinary generators never emit it, and the game enables it only in explicit prototype sessions outside the care track. Later integration also needs hints/coach/replay films to depict the ribbon and an approved introduction. Those integrations are deliberately outside this local proposal; prototype replay telemetry is disabled.

## 2. Two different key pairs — separate locks

**Rule:** “The round keys open the round locks; the square keys open the square locks.”

Two key silhouettes, not colour alone, identify the groups. A round key is shown inside a circular badge, and its matching locks carry that same circle; the other group uses a square. A frozen key keeps both its ice and its key badge. The familiar two-key rule remains: each group needs both of its actual key tiles removed.

This enables a fork in which opening the first group reveals a tempting match but consumes the room needed to reach the second group. A clock can sit behind one group while the tile that relieves its picture sits behind the other. A second-act lock group could stay closed after the clock without pretending that the original shared locks have two independent meanings.

There is no random key choice: the actual pair and its locks are marked from the start. Match pictures and unlock roles stay separate, as they already are for the existing indexed keys. Four equal pictures would therefore need a clear warning that only the badged copies are keys.

**Build cost:** medium. Replace the single shared lock set with named groups in both rule engines, preserve the old group as the default, extend packing and saves, add two distinguishable badge sets, and teach the distinction in one short film. Tests must cover one group opening while the other stays closed, frozen keys, four-copy pictures, saves, old decoding and independent effects per lock. This is my second choice, but I would first ask whether two key groups feel like a fresh insight or extra bookkeeping. It is proposed, not implemented.

## 3. Cold trigger — taking one tile adds ice to another

**Rule:** “Take the snowflake tile and its marked neighbour freezes.”

The trigger carries a snowflake and a short visible connector to its target. Before it is taken, a pale outline shows exactly where the one layer of ice will appear. The target’s own picture and other badges remain readable. Taking the trigger animates that one layer travelling to the target; there is no random neighbour selection.

This creates an order trap rather than another obstruction at move zero. A tempting pair can freeze the tile that would have opened tray room, so the player must take that relief first. A lock could keep the trigger out of reach until both keys are used, or the clock could make delaying the trigger a deliberate choice. The trigger cannot affect an already removed tile, and the level must communicate that case consistently.

The dependency is fully visible, but the extra temporal rule is harder to teach than the ribbon. A player could reasonably expect all ice to be present at the start. I rank it below the two static dependencies because its surprise is also its greatest risk.

**Build cost:** high. The present engine mostly derives obstacles from which tiles remain. This mechanic requires explicit dynamic ice state in search keys, apply/undo, replay and saves; incremental counters must distinguish old and newly added ice. Game effects, shuffle, hints and lesson films all need the same timing. Tests must cover trigger order, target already gone, lock/ice combinations, peek-pair atomicity, undo and resumed games. It is proposed, not implemented.

## 4. Bound pair — two marked tiles leave together

**Rule:** “These two linked tiles can leave only when both are free.”

Both tiles have the same chain-link badge and a visible thin connector when either is tapped. Their ordinary matching picture remains the same on both. A blocked tap highlights the partner and its blockers. When both are ready, one tap sends them together to a pair celebration. The lesson must explicitly state whether the clock counts that as two moves; I recommend two, matching the existing two-tile action convention.

This can make an apparently free clock untakeable until its distant partner is ready, or make one iced tile hold back an otherwise easy pair. It is readable and deterministic, but overlaps with the existing peek-pair action and risks making the tray puzzle easier by granting a free simultaneous match. The design would need a trap whose difficulty comes from preparing both endpoints, rather than merely gifting a slot-free pair.

**Build cost:** medium to high. Add a restricted atomic action to game and engine, define clock-boundary timing, prevent a half-pair from entering the tray, extend the level format and saved state, and teach the connector. Tests need locks/ice at either end, hidden partners (which I would reject in authored boards), clock first/second ordering, repeated pictures and compatibility. I rank this last because its clearest rule adds less distinct trap space than the ribbon. It is proposed, not implemented.

## Prototype review

Run a local static server with `source/` as its root and open `tools/builder/ribbon-prototype.html`. It loads the real game renderer and tap handlers with two authored boards. The top bar switches boards, restarts the same board and opens the animated lesson. The page intercepts remote fetches, makes no Firebase writes, and disables local-session progress and telemetry writes. It does not change a numbered game level.

The prototype boards have their own [independent audit](../../../source/analysis/builder/bank/variety-v1/prototypes/ribbon/audit.json), cards and full solutions. They form a separate two-board demonstration sequence checked against the historical ledger. They are not appended to the proposed 30-board placement order. Each derives from an offline mixed-trap parent to isolate the effect of the new rule; a later level sequence must choose the parent or its prototype, never both. No already-played human level is used as a new example. Before scheduling any of these boards as levels, the lead must check the final 250–289 batch and the combined chosen order.

Screenshots: [first board](ribbon-example-1.png), [second board](ribbon-example-2.png), [animated lesson](ribbon-lesson.png). Task 13’s completed marker/hint changes are included in the prototype so the frozen key in the first board shows both badges.
