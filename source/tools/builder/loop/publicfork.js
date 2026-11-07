/* publicfork.js: fair lose-forks (gate A6) and luck under re-deals of the face-down pictures (gate A7).
   Process design section 4, table A (analysis/builder/process-design-synthesis.md). Claude, 2026-11-07.

   A lose-fork is a tempting move (detour.js) that loses at every shippable spare. It is fair, i.e. a puzzle the
   player can read and learn, when all of these hold:
     - public: under K re-deals of the pictures of the face-down tiles the player could not have seen yet (never
       free so far on the witness: a free face-down tile can be turned over for free), the identity included, the
       tempting move still loses and a goal-directed alternative (obvious.js) still wins. A re-deal under which the
       board is lost from that state whatever the player does is not the fork's fault: it is counted as luck
       (checks.dealsLostAnyway) and reported, not failed. A re-deal under which the tempting move WINS makes the
       fork a guess, not a readable choice: unfair;
     - prompt: the loss shows within `forcedWithin` (6) more removals (engine.longest at the loosest deadline);
     - early: it is offered while at least 60% of the tiles are left.
   'unknown' (budget) anywhere makes the fork 'unknown': a warning, never a loss and never 'unfair'.

   Re-deal: the pictures of the chosen tiles are shuffled among those tiles, so every picture keeps its count
   (pairs stay pairs). Deterministic: a fixed-seed LCG.

     const P = require('./publicfork.js');
     P.permuteHidden(design, tiles, rng)        -> design copy with the pictures of `tiles` shuffled among them
     P.redeals(design, tiles, K, seed)          -> up to K distinct deals, the identity first
     P.fairFork(C, s, t, { unseen, perms, seed, nShipMax, w, nodes, boardNodes, forcedWithin, minLeft, memo })
                                                -> { fair, unfair, unknown, why, luck, checks }
   Engine only, no bots. */
'use strict';
const E = require('../engine.js');
const O = require('./obvious.js');
const D = require('./detour.js');

const rngOf = seed => { let x = (seed >>> 0) || 1; return () => (x = (x * 1103515245 + 12345) >>> 0) / 4294967296; };
const takesOf = t => t.act && typeof t.act === 'object' ? t.act.pair : t.take;

function permuteHidden(design, tiles, rng) {
  const faces = design.faces.slice(), pics = tiles.map(i => faces[i]);
  for (let i = pics.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pics[i], pics[j]] = [pics[j], pics[i]]; }
  tiles.forEach((i, k) => { faces[i] = pics[k]; });
  return { ...design, faces };
}
// K distinct re-deals (the identity first); fewer when the hidden pictures allow fewer
function redeals(design, tiles, perms, seed) {
  const rng = rngOf(seed), out = [design], seen = new Set([tiles.map(i => design.faces[i]).join(',')]);
  for (let tries = 0; out.length < perms && tries < perms * 8 && tiles.length > 1; tries++) {
    const d = permuteHidden(design, tiles, rng), key = tiles.map(i => d.faces[i]).join(',');
    if (!seen.has(key)) { seen.add(key); out.push(d); }
  }
  return out;
}
// does engine action a take exactly what tempting move t takes?
const sameTake = (a, t) => {
  const tk = typeof a === 'object' ? a.pair : [a], tt = takesOf(t);
  if (tk.length === 1) return !t.act && tt.includes(tk[0]);       // a single that starts the tempting pair/match
  return !!t.act && tk[0] === tt[0] && tk[1] === tt[1];
};

function fairFork(C, s, t, o = {}) {
  const nShipMax = o.nShipMax, w = o.w || D.work(), nodes = o.nodes ?? 60000, boardNodes = o.boardNodes ?? 150000;
  const forcedWithin = o.forcedWithin ?? 6, minLeft = o.minLeft ?? 0.6, maxAlts = o.maxAlts ?? 8;
  const n = C.design.tiles.length, left = s.alive.reduce((a, b) => a + b, 0), checks = { tilesLeft: +(left / n).toFixed(3) };
  const why = [];
  let unknown = false, luck = 0;
  if (left / n < minLeft) why.push(`offered with ${Math.round(100 * left / n)}% of tiles left (< ${Math.round(100 * minLeft)}%)`);
  // how soon the loss shows: the most removals a player can still make after the move (cap forcedWithin + 1)
  const gMax = C.at(nShipMax), s2 = D.playMove(gMax, s, t);
  if (s2) {
    const d = w.longest(gMax, s2, forcedWithin + 1, o.depthNodes ?? 20000);
    checks.forcedDepth = d.depth; if (!d.exact) checks.depthMin = true;
    if (d.budget) unknown = true;
    else if (d.depth > forcedWithin) why.push(`the loss shows only after ${d.depth}+ more removals (> ${forcedWithin})`);
  } else checks.forcedDepth = 0;
  // the same fork under re-deals of the pictures nobody has seen yet
  const dealt = redeals(C.design, o.unseen || [], o.perms ?? 4, o.seed ?? 1);
  checks.perms = dealt.length; checks.permResults = [];
  const memo = o.memo || new Map(), stateKey = Array.from(s.alive).join('') + '|' + s.tray.join(',') + '|' + s.moves;
  for (const d of dealt) {
    const dealKey = d.faces.join(',');
    if (!memo.has('g' + dealKey)) memo.set('g' + dealKey, d === C.design ? gMax : E.game({ ...d, clock: { ...d.clock, n: nShipMax } }));
    const gp = memo.get('g' + dealKey);
    const cached = (key, f) => { const k2 = dealKey + '#' + stateKey + '#' + key; if (!memo.has(k2)) memo.set(k2, f()); return memo.get(k2); };
    const t2 = D.playMove(gp, s, t), tr = t2 ? (E.won(gp, t2) ? 'win' : w.win(gp, t2, nodes).result) : 'lose';
    const set = cached('set', () => O.obviousMoves(gp, s));
    const alts = E.legal(gp, s).filter(a => !sameTake(a, t) && O.isObvious(gp, s, a, { set }).obvious);
    let alt = null, altUnknown = false;
    for (const a of alts.slice(0, maxAlts)) {
      const r = cached(JSON.stringify(a), () => { const x = E.step(gp, s, a); return !x ? 'lose' : E.won(gp, x) ? 'win' : w.win(gp, x, nodes).result; });
      if (r === 'win') { alt = a; break; }
      if (r === 'unknown') altUnknown = true;
    }
    // no obvious winning alternative found: is the board still winnable from here under this deal at all?
    let board = null;
    if (alt == null) {
      const r = cached('board', () => w.win(gp, s, boardNodes));
      board = r.result === 'win' && r.path ? { win: r.path[0] } : r.result;
    }
    checks.permResults.push({ tempting: tr, alternative: alt != null ? alt : altUnknown ? 'unknown' : null, ...(board != null ? { board } : {}) });
    if (tr === 'win') why.push('the tempting move wins under another deal of the hidden pictures (a guess, not a readable fork)');
    if (tr === 'unknown') unknown = true;
    if (alt != null) continue;
    if (board === 'lose') luck++;
    else if (board === 'unknown') unknown = true;
    else {
      const first = board.win, firstObvious = !sameTake(first, t) && O.isObvious(gp, s, first, { set }).obvious;
      if (firstObvious) { checks.permResults[checks.permResults.length - 1].alternative = first; continue; }
      // unfair only when every obvious alternative was tried and proven lost
      if (altUnknown || alts.length > maxAlts) unknown = true;
      else why.push('the only winning moves are not goal-directed (obvious.js) under some deal');
    }
  }
  if (luck) checks.dealsLostAnyway = luck;
  const uniq = [...new Set(why)];
  return { fair: uniq.length === 0 && !unknown, unfair: uniq.length > 0, unknown: uniq.length === 0 && unknown, why: uniq, luck, checks };
}

/* luckFromStart (A7): under K re-deals of ALL face-down pictures (identity first), is the board winnable from the
   start within clock.n = nn? -> ['win' | 'lose' | 'unknown', ...] */
function luckFromStart(design, nn, o = {}) {
  const w = o.w || D.work(), nodes = o.nodes ?? 300000;
  return redeals(design, [...(design.down || [])], o.perms ?? 4, o.seed ?? 101).map(d => {
    const g = E.game({ ...d, clock: { ...d.clock, n: nn } });
    return w.win(g, E.start(g), nodes).result;
  });
}
module.exports = { permuteHidden, redeals, fairFork, luckFromStart, sameTake, rngOf };
