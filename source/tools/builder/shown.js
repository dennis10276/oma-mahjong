'use strict';
/* shown.js: how much of a tile's face the player sees at move 0. INFORMATION ONLY, never a placement rule (Dennis, 2026-11-13: "The tile itself
   is fine to be covered more"; the cut-off timer badge of level 281 was a UI bug, fixed in www/js/board.js clockBadge).
   Geometry exactly as the game draws it (www/js/board.js boardGeo): a tile face is 1 wide and 1.24 high (in tile widths) at
   x/2 - z*0.14, y/2*1.24 - z*0.14, so every layer shifts up-left by 0.14 and a tile directly on another hides most of it but not all.
   (Tile units, not raw layout units: in raw units a tile on the same x,y would hide everything, which the screen does not show.)
     shownShare(tiles, i)   share of tile i's face (0..1) not covered by higher tiles
     shownAll(tiles)        array of shares for all tiles
   A tile covers another when it lies higher (z, then y, x as the game orders them) and its face overlaps.                         */
const W = 1, H = 1.24, DF = 0.14;
const boxOf = t => { const x = Array.isArray(t) ? t[0] : t.x, y = Array.isArray(t) ? t[1] : t.y, z = Array.isArray(t) ? t[2] : t.z;
  const l = x / 2 - z * DF, tp = y / 2 * H - z * DF; return { l, t: tp, r: l + W, b: tp + H, order: z * 10000 + y * 100 + x }; };

// area of the union of rectangles clipped to a box (coordinate compression)
function unionArea(box, rects) {
  const cl = rects.map(r => [Math.max(box.l, r.l), Math.max(box.t, r.t), Math.min(box.r, r.r), Math.min(box.b, r.b)]).filter(r => r[0] < r[2] && r[1] < r[3]);
  if (!cl.length) return 0;
  const xs = [...new Set(cl.flatMap(r => [r[0], r[2]]))].sort((a, b) => a - b); let area = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i], x1 = xs[i + 1], iv = cl.filter(r => r[0] <= x0 && r[2] >= x1).map(r => [r[1], r[3]]).sort((a, b) => a[0] - b[0]);
    let cur = -Infinity, len = 0; for (const [a, b] of iv) { if (b <= cur) continue; len += b - Math.max(a, cur); cur = b; }
    area += len * (x1 - x0);
  }
  return area;
}
function shownAll(tiles) {
  const bx = tiles.map(boxOf);
  return bx.map((b, i) => {
    const cov = []; for (let j = 0; j < bx.length; j++) if (j !== i && bx[j].order > b.order && bx[j].l < b.r && bx[j].r > b.l && bx[j].t < b.b && bx[j].b > b.t) cov.push(bx[j]);
    return +(1 - unionArea(b, cov) / (W * H)).toFixed(4);
  });
}
const shownShare = (tiles, i) => shownAll(tiles)[i];

module.exports = { shownAll, shownShare, boxOf, W, H, DF };
