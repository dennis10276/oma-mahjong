# Smoother start and matching, clearer lessons (branch `wip/smooth-play`, planned for 1.58)

Dennis, 2026-10-18: "laggy on start of the level and when matching; the clock and lock & key
animations feel laggy and are not very clear."

## How it was measured

`node tests/perf_probe.js [levels]` (frames and work at level start and per tap; `WARM=1`: the next
level, `HOMEWAIT=2500`: first level after the home screen, `NOFX=1`: without sparkles) and
`node tests/perf_trace.js <level> start|taps` (a Chrome trace summarised by kind of work). Both slow
the CPU down 6× (a budget Android phone), 393 × 852 screen. Neither is part of `run.js`.

## What was slow, and what changed

| | before (1.57) | after |
|---|---|---|
| starting a level (the start itself, next level) | 320–390 ms | 34–44 ms |
| worst frame while the pile comes in (next level) | 370–450 ms | 117–133 ms |
| first level after opening the app (2.5 s on the home screen) | 450–470 ms start, 530–630 ms frame | 60–90 ms start, 200 ms frame |
| work per tap, without sparkles | 3.2–3.8 s per 16 taps | 2.1 s (layout halved) |

(6× slowed CPU; on a real phone divide by roughly 2–4.)

1. **Tile faces were live SVG**: ~15 elements per tile, ~1500 for a pile of 96, all styled and laid
   out on every start. Now each classic face is one shared picture (`Tiles.boardFace` /
   `Tiles.useFaces`, one style rule per face, a data-URL SVG). The corner numbers are Nunito Black
   outlines inside the picture (`CORNER` in `tiles.js`, a picture cannot use the page's fonts);
   `body.nonum` swaps to the picture without them. The pictures are prepared on the home screen
   (`Tiles.warm`, 1.2 s after start). Board: ~300 elements instead of ~1500. Pixel-identical
   (compared side by side in Dutch, English and numbers off).
2. **The pile was built and then measured and moved several times** (add, measure, move, mark
   blocked, measure the tray): the phone redid the whole pile 3–4 times per start. Now positions are
   computed first (`boardGeo`) and the whole pile is inserted once with its classes, overlays and
   positions (`renderBoard`). `layoutBoard` is only for a change of screen size.
3. **The entrance moved 96 tiles separately** (each a moving picture of its own for the phone, then
   96 timers putting them back). Now the tiles of each layer sit in one group (`.lyr`) and the pile
   drops in layer by layer: 3–5 moving pictures. A glowing tile (lucky moment, the helper) must rise
   above the whole pile, so `glow(i, cls, on)` lifts it out of its group and puts it back.
4. **The tray measured the screen on every tap** (`sizeTray` in `renderTray`): only on layout now.
5. **Sparkles and emoji were drawn on a full-screen canvas 60 times a second**: about half of all
   the work while matching (trace). Now each sparkle is a small element whose whole flight is given
   to the graphics chip at once (Web Animations, `fly` in `fx.js`), with at most 140 in the air.
   Confetti and the sunflower rain (win screens) still use the canvas. Note: the test browser has no
   real graphics chip, so it still restyles the sparkles while other animations run; on a phone they
   cost the game nothing per frame. Same motion as before (same physics, sampled).
6. **The progress bar animated its width** (layout every frame): it slides now (transform). The score
   bump and the combo tag only animate size and see-through.

## The lessons (clock, lock & key, ice, the three-slot trick)

Before: every 2.4 s the whole little picture was replaced, so every tile popped in again (that was
the "lag"), tiles jumped into the tray, and the clock's number stood apart from its tile.

Now (`LESSON_SCENES` / `LESSON_STEPS` / `lessonActor` in `specials.js`) the scene is built once and
only what changes moves: a hand glides to the tile and taps it (with a ripple), the tile glides into
the tray like in the game, a key pair pops, the locks rattle while one key is missing and spring
open (🔓) when the second key goes, ice cracks and melts, the face-down tile turns over. The clock
badge sits on the clock tile as in the game (⏰ 3 → 2 with a "−1"; peeking only wiggles it; ✓ when
the clock tile is taken). Same captions, same 4 steps of 2.4 s, pause/replay/reduced motion as before.

In the game: unlocking shows the 🔓 springing open on each locked tile, and the clock's number hops
on every move.

`tests/t_smooth.js` keeps these properties.
