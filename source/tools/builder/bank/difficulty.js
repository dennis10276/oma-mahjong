'use strict';
/* difficulty.js: a bot-free difficulty score for a chain-trap board, 1.0 (easiest) to 10.0, computed ONLY from proven or exactly measured facts.
   (Dennis 2026-11-13: "Drop the bot ratings ... You decide how difficult they are based on some minor input I already gave and your own brain.")

     const Df = require('./difficulty.js');
     Df.score(design, card)  -> { score, parts, needle, facts, weights }     (card = the build card: card.trap.* of trap_stories.js, or the examples file card)
     Df.facts(design, card)  -> the raw facts (computed from the engine when the card does not carry them; cached on card.difficultyFacts)

   WHAT MAKES A BOARD HARD, in Dennis's words and in the facts he rated (lab 5, 2026-11-13):
     291 (5 stars, 3 tries, "AHA moment"), 292 (4 stars, 2 tries), 293 (4 stars, 1 try), 294 / 295 / 296 (2 stars, won in 1-2 tries: "two-link chains are too
     easy to see the right route"; 292/293/294 "a bit too easy after"; "make it smarter or a bit more tray pressure").
   Each part below is a number between 0 (nothing to find) and 1 (as hard as boards get); score = 1 + 9 * (sum of weight * part) / (sum of weights).

     part         weight (final)  what it measures (all exact or engine-proven, no bot anywhere)
     links          0.20  links in the chain: 2 -> 0.0, 3 -> 0.55, 4 -> 0.85, 5+ -> 1.0.  The biggest single lever (Dennis: 2-link chains "too easy to see the right route"). 'links' is the shape's own count (CHAIN_DEFS length: lock, frozen cover,
                          frozen/locked thaw-neighbour, each frozen key cover or way tile each count one).
     baits          0.04  proven baits (a free move that provably costs more than any unrelated move): 1 -> 0.0, 2 -> 1.0 (more places to go wrong).
     firstMoves     0.03  share of the first moves that keep the board winnable: 1.0 (all) -> 0, 0.15 or less -> 1 (a wrong start is likely). Fewer than 3 winning first
                          moves is a "needle" (flag in the result): the board is allowed only in the hardest third of a batch.
     pressure       0.20  tray pressure on the RIGHT route before the clock: share of the moves with 2 or more tiles waiting, the longest run of those moves, the moves
                          at 3 waiting (every tap that does not match then loses). 0.5 share + 0.3 run + 0.2 at3, each scaled against 100% / 12 moves / 6 moves.
     lateness       0.14  how late a wrong start shows: moves the stored route can still go on after the wrong first move before it is stuck (share of the clock move
                          count k). A loss that shows at once is easy to learn from; one that shows 8 moves later hides the cause.
     spare          0.04  clock spare: 1 (the clock tile must come at the proven minimum + 1) -> 1.0, 2 -> 0.35, 3+ -> 0.
     tail           0.30  tailGreedyWin: share of careless-greedy playouts that clear the board AFTER the clock (bank/tail.js). 0.40 and above -> 0 (easy after),
                          0.15 -> 0.75, 0.08 or below -> 1. Dennis: "a bit too easy after".
     tiles          0.02  tiles on the board: 72 -> 0, 96 -> 1 (more pictures repeat, longer game; a small factor).
     faceDown       0.03  face-down share, a SMALL factor and capped at 0.30 (Dennis: many face-down tiles feel like luck): share / 0.30, capped at 1; a board above 0.30
                          scores no extra (and is refused by the batch builder).
   firstMoves is weighted low on purpose: on the lab-5 boards the 2-star 294-296 have FEWER winning first moves (2-4 of 7-19) than the 5-star 291 (7 of 11), because a
   spare-1 clock punishes any wasted move; so the share measures clock tightness more than the trap, and tail + pressure carry the 'smarter / tighter after' wishes.
   The weights sum to 1.00. The mapping of a part to 0..1 is linear between the stated end points (clamped), so every part can be explained in one line.
   FIT: the six lab-5 boards (source/build/traps/examples2/chain-*.json, key in source/build/bank/try-5-key.json) must order 294, 295 < 296 < 293 < 292 < 291; run
     node source/tools/builder/bank/difficulty.js            prints the fit (facts, parts, score and the rank order against the target).
   The weights were chosen against that order by a random search over rounded weights (links at least 0.20, every weight in a plausible range, the sum exactly 1.00), taking the set
   whose smallest gap between neighbouring ranks is the largest. Nothing was fitted to bot ratings (there are none). Result: 294 (3.25) < 295 (3.35) < 296 (3.41) < 293 (3.51) < 292 (4.61) < 291 (4.79), all
   six ranks as Dennis rated them, the smallest gap 0.06. Two honest remarks: (1) there are only six boards, so the fit proves the weights are not absurd, not that they are right; (2) 291 (5 stars, "AHA") is
   above 292 only by 0.18: 292 has 4 links and 88 tiles, and the engine cannot count the AHA itself. The tail weight (0.30) is the largest part because three of Dennis's remarks are about the board
   AFTER the trap ("a bit too easy after", "smarter", "tray pressure"); a two-link board scores about 3.3-3.5 whatever else it has, a good three-link board 4.5-6, and a four-link, spare-1, low-tail board 7-8.   */
const E = require('../engine.js');
const D = require('../loop/detour.js');
const Tl = require('./tail.js');

const WEIGHTS = { links: 0.20, baits: 0.04, firstMoves: 0.03, pressure: 0.20, lateness: 0.14, spare: 0.04, tail: 0.30, tiles: 0.02, faceDown: 0.03 };
const clamp = x => Math.max(0, Math.min(1, x));
const lin = (x, a, b) => b === a ? 0 : clamp((x - a) / (b - a));   // 0 at a, 1 at b (either direction)

// the stored route continued after the wrong first move: at each step the earliest stored tile that is legal and does not lose; the number of moves until nothing
// of the stored order is playable any more (stuck / overflow / clock gone) or the clock is taken. Share of k.
function lateness(design, card, bait) {
  const C = D.clockGames(design), n = design.clock.n, g = C.at(n), sol = design.solution, ci = sol.indexOf(design.clock.i), k = ci + 1;
  let s = E.start(g); const first = Array.isArray(bait) ? bait : [bait];
  for (const t of first) { s = s && E.step(g, s, t); if (!s) return { moves: 0, share: 0, k, ended: 'at once' }; }
  let moves = first.length, ended = 'clock';
  const left = new Set(sol.slice(0, ci + 1).filter(t => !first.includes(t)));
  for (;;) {
    if (s.clockTaken) { ended = 'clockTaken'; break; }
    const legal = new Set(E.legal(g, s).filter(a => typeof a === 'number')); let moved = false;
    for (const t of sol) {
      if (!left.has(t) || !legal.has(t)) continue;
      const s2 = E.step(g, s, t); if (!s2) continue;
      s = s2; left.delete(t); moves++; moved = true; break;
    }
    if (!moved) { ended = 'stuck'; break; }
  }
  return { moves, share: +Math.min(1, moves / (k + 3)).toFixed(3), k, ended };
}

function facts(design, card, opts = {}) {
  card = card || {};
  if (card.difficultyFacts && !opts.fresh) return card.difficultyFacts;
  const tr = card.trap || card, T = require('../trap_stories.js');
  const links = tr.chainLength ?? (typeof tr.links === 'number' ? tr.links : null) ?? 2, baits = (tr.baits || []).length;
  const fm = opts.press ? null : (tr.firstMoves || card.firstMoves), press = opts.press || T.pressureFacts(design, { firstNodes: opts.firstNodes ?? 1.5e6 }), fmv = fm && fm.legal ? fm : press.firstMoves;
  const win = fm && fm.winning != null ? fm.winning : fmv.winning, legal = fm && fm.legal ? fm.legal : fmv.legal;
  const k = press.k, spare = design.clock.n - k;
  let late = null; const b0 = (tr.baits || [])[0]; if (b0 && b0.tiles && b0.tiles.length) late = lateness(design, card, b0.tiles.length > 1 && b0.name === 'lonelyNeighbour' ? [b0.tiles[0]] : b0.tiles.slice(0, 1));
  const tailW = (card.tail && card.tail.after && card.tail.after.tailGreedyWin != null && !opts.fresh) ? card.tail.after.tailGreedyWin : Tl.measure(design, { seed: 977, playouts: opts.playouts ?? 800 }).tailGreedyWin;
  const n = design.tiles.length, down = (design.down || []).length;
  const out = { links, baits, firstMoves: { winning: win, legal, unknown: fmv.unknown || 0, share: legal ? +(win / legal).toFixed(3) : 1 }, needle: win < 3,
    pressure: { k, moves2plus: press.moves2plus, share2plus: +(press.moves2plus / k).toFixed(3), run2: press.run2, at3: press.at3, peak: press.peak, waiters: press.waiters, occ: press.occ },
    lateness: late, spare, tailGreedyWin: tailW, tiles: n, faceDownShare: +(down / n).toFixed(3) };
  if (!opts.fresh) card.difficultyFacts = out;
  return out;
}

// parts of the score, each 0..1
function partsOf(f) {
  const linkPart = f.links <= 2 ? 0 : f.links === 3 ? 0.55 : f.links === 4 ? 0.85 : 1;
  const pr = f.pressure;
  return {
    links: linkPart,
    baits: f.baits >= 2 ? 1 : 0,
    firstMoves: lin(f.firstMoves.share, 1, 0.15),
    pressure: 0.5 * lin(pr.share2plus, 0, 1) + 0.3 * lin(pr.run2, 0, 12) + 0.2 * lin(pr.at3, 0, 6),
    lateness: f.lateness ? lin(f.lateness.share, 0.1, 0.9) : 0,
    spare: f.spare <= 1 ? 1 : f.spare === 2 ? 0.35 : 0,
    tail: f.tailGreedyWin >= 0.40 ? 0 : f.tailGreedyWin >= 0.15 ? 0.75 * lin(f.tailGreedyWin, 0.40, 0.15) : 0.75 + 0.25 * lin(f.tailGreedyWin, 0.15, 0.08),
    tiles: lin(f.tiles, 72, 96),
    faceDown: lin(Math.min(f.faceDownShare, 0.30), 0, 0.30),
  };
}
function score(design, card, opts = {}) {
  const f = opts.facts || facts(design, card, opts), p = partsOf(f), sum = Object.keys(WEIGHTS).reduce((a, k) => a + WEIGHTS[k] * p[k], 0), tot = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  return { score: +(1 + 9 * sum / tot).toFixed(2), parts: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, +v.toFixed(3)])), needle: f.needle, facts: f, weights: WEIGHTS };
}
module.exports = { score, facts, partsOf, lateness, WEIGHTS };

if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const root = path.resolve(__dirname, '../../../build'), key = JSON.parse(fs.readFileSync(path.join(root, 'bank/try-5-key.json'), 'utf8')), rows = [];
  for (const e of key) {
    const j = JSON.parse(fs.readFileSync(path.join(root, 'traps/examples2', e.file), 'utf8')), s = score(j.design, j.card || j, { fresh: true });
    rows.push({ level: e.level, file: e.file, score: s.score, parts: s.parts, f: s.facts });
  }
  const target = [[294, 295], [296], [293], [292], [291]];
  for (const r of rows.slice().sort((a, b) => a.score - b.score)) console.log(r.level, String(r.score).padStart(5), JSON.stringify(r.parts), 'fm', r.f.firstMoves.winning + '/' + r.f.firstMoves.legal, 'press', r.f.pressure.share2plus + '/' + r.f.pressure.run2 + '/' + r.f.pressure.at3, 'late', r.f.lateness && r.f.lateness.share, 'spare', r.f.spare, 'tail', r.f.tailGreedyWin, 'tiles', r.f.tiles, 'down', r.f.faceDownShare, 'links', r.f.links, 'baits', r.f.baits);
  const sc = Object.fromEntries(rows.map(r => [r.level, r.score])); let bad = 0;
  for (let i = 0; i < target.length - 1; i++) for (const a of target[i]) for (const b of target[i + 1]) if (!(sc[a] < sc[b])) { bad++; console.log('ORDER VIOLATED:', a, '<', b, sc[a], sc[b]); }
  console.log('target 294,295 < 296 < 293 < 292 < 291:', bad ? bad + ' violations' : 'fits');
}
