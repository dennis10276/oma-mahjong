# Clock spare: twenty paired boards

Only clock.n changes: exact spare 1 versus 3. Two layouts per story; all twenty boards and both variants fixed before this completed study. Selection did not use bot ratings. Both frozen profiles get forty seeded campaigns per variant. All eighty measurements valid; 75 calls, 5 cache hits.

| profile | easier | tied | harder | non-increasing | strict improvement |
|---|---:|---:|---:|---:|---:|
| family | 15 | 3 | 2 | 18/20 (90%) | 75% |
| skilled (planner) | 9 | 10 | 1 | 19/20 (95%) | 45% |

The original plan's 80% monotone-direction benchmark is met for both profiles. The additional, stricter criterion in plan.json (80% strictly improve; ties do not count) is not met. These are separate checks; summary.json retains the original strict result without changing its preregistered rule.

Keep this as a secondary control. It changes the family mean by -0.95 tries in this sample and the skilled mean by -0.1805, but effects vary sharply and several boards do not respond. These means are not a conversion formula. The family reversals are +0.11 and +0.03 tries; one skilled reversal is +1.05. A single seeded campaign comparison cannot resolve sampling noise or guarantee a direction on an individual board.

| board | family 1 / 3 spare | skilled 1 / 3 spare |
|---|---:|---:|
| keysFarSide-hourglass-14-s1 | 5.42 / 3.88 | 10.93 / 10.45 |
| keysFarSide-arch-0-s1 | 6.28 / 5.5 | 2.27 / 2.25 |
| keysOnIsland-frame-7-s1 | 1.27 / 1.27 | 1 / 1 |
| keysOnIsland-hourglass-41-s1 | 1.2 / 1.1 | 1.02 / 1.02 |
| clockInSight-star-21-s1 | 15.6 / 11.5 | 1.8 / 2.85 |
| clockInSight-heart-9-s1 | 3.77 / 3.88 | 1.07 / 1.07 |
| iceLockClock-arch-28-s1 | 1.4 / 1.07 | 1.02 / 1 |
| iceLockClock-moon-16-s1 | 2.7 / 2.3 | 1.15 / 1.1 |
| lockBeside-hourglass-35-s1 | 3.38 / 2.02 | 1 / 1 |
| lockBeside-twins-24-s1 | 4.7 / 4.45 | 2.05 / 2 |
| frozenGuards-hourglass-42-s1 | 20 / 20 | 16.75 / 14.7 |
| frozenGuards-oval-31-s1 | 20 / 20 | 20 / 20 |
| chainReaction-frame-38-s2 | 9.32 / 2.77 | 3 / 1.05 |
| chainReaction-castle-20-s1 | 1.2 / 1.23 | 1.02 / 1 |
| roomInTrayLocked-cross-8-s1 | 2.95 / 2.52 | 2.23 / 2.23 |
| roomInTrayLocked-frame-45-s1 | 2.63 / 1.95 | 1.1 / 1.1 |
| roomInTrayFrozen-pyramid-15-s1 | 4.83 / 2.88 | 1.2 / 1.18 |
| roomInTrayFrozen-twins-4-s1 | 1.2 / 1.13 | 1 / 1 |
| deepClock-vase-11-s1 | 2.13 / 1.98 | 1.07 / 1.07 |
| deepClock-hourglass-43-s1 | 2.6 / 2.15 | 1.05 / 1.05 |

Next controls: isolate tray pressure and hidden/luck placement, keeping the rest of the planned puzzle fixed. Production's first-check curve hit rate remains untested. No study board has been assigned to a player level.
