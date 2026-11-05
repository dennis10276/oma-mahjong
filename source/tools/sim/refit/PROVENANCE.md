# Factory bot snapshot

This is the offline `human-g6.2` family meter and skilled planner used by the
level factory. It is not loaded by the game or dashboard.

- Base: committed dependency closure of `human_bot.js` at
  `10cee30d92f09a2540eefaed8551c496994d4bc5` (`wip/gemini-g5.1`).
- Applied: Claude's `source/tools/factory/human-g6.patch`, from level-factory
  commit `13e7ab9`. This includes clock-beside-lock learning, the 20-try cap,
  calibrated free-tray-spot habits and the route planner. Profiles are unchanged.
- `physics/hard.js` and `physics/layouts.js` come from that same base commit.
  The reference environment needs its physical-tap hooks; the published game on
  the factory branch predates them. References point to these local snapshots,
  and `hard.js` binds its own Layouts rather than the designer's global object.
- `capture: 'tail'` retains only the last five decision indices and trays in
  each attempt. Full capture is still available. Tests compare every physical
  tap, winning attempt and expected rating in both modes for both profiles.

Only committed base files were imported; local edits in the other checkout
were not copied. `snapshot.json` records normalized source hashes. The factory
measurement cache fingerprints the actual dependency sources and G51
experimental switches, as well as the board and measurement options.

Reproduce the checks from the repository root:

```powershell
node --test source/tools/factory/test_factory.js source/tools/factory/test_bot.js
```

## 2026-11-05: skilled planner, clock logic (Claude)
Dennis: "See how you would play the level and apply that logic in the bot." The planner's way to the clock now counts what
the clock still needs (cover, ice, the locks beside it, the keys and their covers) and, when no whole way shows, follows
the best partial way that keeps a tray spot free (`routeNeed`, `routeNeedTray` in the 'planner' setting only). The family
profile, the Dennis profile and the physics are unchanged, so family measurements are the same; the planner's are not.
Two-island board 329724e3: 9.8 -> 2.1 tries. Against Dennis's own tries: 24 lab boards off by 2.18 -> 2.05, wrongly over
6 on 3 -> 2; live 85-174 1.08 -> 1.10. Still too pessimistic on blind 185 (18.6 vs 6) and release 194 (20 vs 9).
