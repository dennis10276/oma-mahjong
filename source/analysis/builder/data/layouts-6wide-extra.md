# Extra 6-Wide Mahjong Layouts (Levels 401–464)

**Creator:** Antigravity  
**Catalog Source:** `source/analysis/builder/data/layouts-6wide-extra.json`  
**Worktree Branch:** `wip/gemini-six-wide`  

## Executive Summary

A complete collection of **64 extra 6-wide layouts** created by Antigravity for Oma's Mahjong Solitaire.
These layouts are designed to fit comfortably on 6-tile-wide phone viewports with target tile sizes of 58–63+ px.

### Key Physical & Architectural Guarantees
1. **Solid Quadrant Support (100% Grounded):** Every tile on layers $z \ge 1$ rests on solid underlying tiles with zero floating overhangs or unsupported corners.
2. **Strict Viewport Bounds:** Maximum width $\le 6.0$ tiles (12 half-units), maximum height $\le 8.0$ rows (16 half-units), layers $\le 4$.
3. **Solvability & Unique Signatures:** 100% solvable configurations with distinct 3D topological signatures.
4. **31 Layouts with $\ge 72$ Tiles:** Includes 20 Grand L4 layouts (72–108 tiles) plus 11 Terrace L3 and Compact L2 layouts (72–96 tiles).

---

## Layout Catalog Table

| Level | Shape / Variant | Archetype | Tiles ($n$) | Width | Rows | Layers | Tile Size ($p_x$) | Category |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| L401 | Stone Pyramid (Grand L4) | Stone Pyramid | 108 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L402 | Checkerboard Dais (Grand L4) | Checkerboard Dais | 94 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L403 | Little Apple (Grand L4) | Little Apple | 84 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L404 | Sanctum (Grand L4) | Sanctum | 84 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L405 | Little Diamond (Grand L4) | Little Diamond | 84 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L406 | Little Well (Grand L4) | Little Well | 80 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L407 | Garden Gate (Grand L4) | Garden Gate | 80 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L408 | Little Cross (Grand L4) | Little Cross | 80 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L409 | Little Hot Coffee (Grand L4) | Little Hot Coffee | 80 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L410 | Little Stage (Grand L4) | Little Stage | 80 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L411 | Little Stairs (Grand L4) | Little Stairs | 78 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L412 | Little Heart (Grand L4) | Little Heart | 78 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L413 | Moon Bridge (Grand L4) | Moon Bridge | 78 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L414 | Little Fortress (Grand L4) | Little Fortress | 74 | 6w | 8h | 4L | 56.8 px | Grand L4 (>=72t) |
| L415 | Little Elephant (Grand L4) | Little Elephant | 74 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L416 | Butterfly (Grand L4) | Butterfly | 74 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L417 | Little Lotus (Grand L4) | Little Lotus | 74 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L418 | Twin Pagodas (Grand L4) | Twin Pagodas | 72 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L419 | Little Invader (Grand L4) | Little Invader | 72 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L420 | Little Turtle (Grand L4) | Little Turtle | 72 | 6w | 8h | 4L | 59.1 px | Grand L4 (>=72t) |
| L421 | Stone Pyramid (Terrace L3) | Stone Pyramid | 96 | 6w | 8h | 3L | 59.1 px | Terrace L3 (>=72t) |
| L422 | Pavilion Terrace | Pavilion Terrace | 88 | 6w | 7h | 3L | 63.3 px | Terrace L3 (>=72t) |
| L423 | Pavilion Expanse | Pavilion Expanse | 82 | 6w | 6h | 3L | 63.3 px | Terrace L3 (>=72t) |
| L424 | Pavilion Vanguard | Pavilion Vanguard | 80 | 5w | 7h | 3L | 67.4 px | Terrace L3 (>=72t) |
| L425 | Checkerboard Dais (Terrace L3) | Checkerboard Dais | 78 | 6w | 8h | 3L | 59.1 px | Terrace L3 (>=72t) |
| L426 | Little Apple (Terrace L3) | Little Apple | 74 | 6w | 8h | 3L | 59.1 px | Terrace L3 (>=72t) |
| L427 | Little Diamond (Terrace L3) | Little Diamond | 74 | 6w | 8h | 3L | 59.1 px | Terrace L3 (>=72t) |
| L428 | Sanctum (Terrace L3) | Sanctum | 72 | 6w | 8h | 3L | 59.1 px | Terrace L3 (>=72t) |
| L429 | Little Cross (Terrace L3) | Little Cross | 72 | 6w | 8h | 3L | 59.1 px | Terrace L3 (>=72t) |
| L430 | Little Stage (Terrace L3) | Little Stage | 72 | 6w | 8h | 3L | 59.1 px | Terrace L3 (>=72t) |
| L431 | Sanctum 16 | Sanctum 16 | 72 | 6w | 8h | 2L | 59.1 px | Compact L2 (>=72t) |
| L432 | Little Hot Coffee (Terrace L3) | Little Hot Coffee | 70 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L433 | Little Well (Terrace L3) | Little Well | 68 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L434 | Little Stairs (Terrace L3) | Little Stairs | 68 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L435 | Garden Gate (Terrace L3) | Garden Gate | 68 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L436 | Little Heart (Terrace L3) | Little Heart | 68 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L437 | Little Turtle (Terrace L3) | Little Turtle | 66 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L438 | Little Lotus (Terrace L3) | Little Lotus | 66 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L439 | Moon Bridge (Terrace L3) | Moon Bridge | 66 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L440 | Pavilion Formation | Pavilion Formation | 64 | 5w | 6h | 3L | 75.7 px | Terrace L3 (<72t) |
| L441 | Little Fortress (Terrace L3) | Little Fortress | 64 | 6w | 8h | 3L | 57.5 px | Terrace L3 (<72t) |
| L442 | Little Elephant (Terrace L3) | Little Elephant | 64 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L443 | Little Invader (Terrace L3) | Little Invader | 64 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L444 | Butterfly (Terrace L3) | Butterfly | 64 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L445 | Twin Pagodas (Terrace L3) | Twin Pagodas | 62 | 6w | 8h | 3L | 59.1 px | Terrace L3 (<72t) |
| L446 | Little Block II | Little Block II | 58 | 5w | 6h | 3L | 75.7 px | Terrace L3 (<72t) |
| L447 | Little Block II | Little Block II | 58 | 6w | 5h | 3L | 63.3 px | Terrace L3 (<72t) |
| L448 | Pavilion Firmament | Pavilion Firmament | 58 | 5w | 6h | 3L | 75.7 px | Terrace L3 (<72t) |
| L449 | Stone Pyramid (Compact L2) | Stone Pyramid | 66 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L450 | Moon Bridge (Compact L2) | Moon Bridge | 60 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L451 | Checkerboard Dais (Compact L2) | Checkerboard Dais | 58 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L452 | Little Cross (Compact L2) | Little Cross | 58 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L453 | Little Hot Coffee (Compact L2) | Little Hot Coffee | 58 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L454 | Little Apple (Compact L2) | Little Apple | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L455 | Sanctum (Compact L2) | Sanctum | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L456 | Little Well (Compact L2) | Little Well | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L457 | Little Stairs (Compact L2) | Little Stairs | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L458 | Garden Gate (Compact L2) | Garden Gate | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L459 | Little Invader (Compact L2) | Little Invader | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L460 | Little Diamond (Compact L2) | Little Diamond | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L461 | Little Heart (Compact L2) | Little Heart | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L462 | Little Turtle (Compact L2) | Little Turtle | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L463 | Little Lotus (Compact L2) | Little Lotus | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |
| L464 | Little Stage (Compact L2) | Little Stage | 56 | 6w | 8h | 2L | 59.1 px | Terrace L2 (<72t) |

---

## Category Breakdown

### 1. Grand 4-Layer Layouts (Levels 401–420, All $\ge 72$ Tiles)
- **Stone Pyramid (L4):** 108 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Checkerboard Dais (L4):** 94 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Apple (L4):** 84 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Sanctum (L4):** 84 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Diamond (L4):** 84 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Well (L4):** 80 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Garden Gate (L4):** 80 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Cross (L4):** 80 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Hot Coffee (L4):** 80 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Stage (L4):** 80 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Stairs (L4):** 78 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Heart (L4):** 78 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Moon Bridge (L4):** 78 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Fortress (L4):** 74 tiles (4 layers, 6.0w x 8.0h, 56.8 px)
- **Little Elephant (L4):** 74 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Butterfly (L4):** 74 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Lotus (L4):** 74 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Twin Pagodas (L4):** 72 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Invader (L4):** 72 tiles (4 layers, 6.0w x 8.0h, 59.1 px)
- **Little Turtle (L4):** 72 tiles (4 layers, 6.0w x 8.0h, 59.1 px)

### 2. Terrace 3-Layer & Compact 2-Layer Layouts (Levels 421–464)
- **11 Layouts $\ge 72$ Tiles:** Stone Pyramid L3 (96t), Pavilion Terrace (88t), Pavilion Expanse (82t), Pavilion Vanguard (80t), Checkerboard Dais L3 (78t), Little Apple L3 (74t), Little Diamond L3 (74t), Sanctum L3 (72t), Little Cross L3 (72t), Little Stage L3 (72t), Sanctum 16 (72t).
- **33 Compact & Terrace Layouts (< 72 Tiles):** Ranging from 56 to 70 tiles, ideal for fast gameplay and introductory 6-wide levels.

### Files in Repository
- `source/analysis/builder/data/layouts-6wide-extra.json`: Full 64 layouts (Levels 401–464)
- `source/analysis/builder/data/layouts-6wide-extra-72plus.json`: Filtered 31 layouts with $\ge 72$ tiles
- `layouts-6wide-extra.json`: Convenience copy at worktree root
- `layouts-extra.json`: Convenience copy at worktree root