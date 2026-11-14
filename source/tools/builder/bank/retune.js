'use strict';
/* retune.js: the part AFTER the trap, harder - applied to a finished chain board (a pool variant or a placed batch board).
   (Dennis 2026-11-14, lab 6, level 250: "FUN trap. Really that AHA moment. After the trap tray pressure may increase. Its too easy after. Maybe more face down as well after the trap",
    "Not too much, but it shouldnt feel like just clicking", and right after: "Dont overdo on tray pressure. 1 in tray is enough after a hard trap.")

     const R = require('./retune.js');
     R.retuneRecord(job, variant, { level, tier })  -> { ok, why, design, card, retune }       job = the pool job (shape, layout, seed, dial ...), variant = { tier, design, card }
     R.BANDS                                         the tail bands of the retuned boards: std 0.10-0.28, hard 0.06-0.18 (before: 0.15-0.40 / 0.08-0.22)

   What it does (T.retuneTail in trap_stories.js, bank/tail.js): (1) more face-down tiles in the part after the clock only (share about 0.25-0.28, cap 0.30; never the clock, a lock, a key, ice, a bait, anything the story needs, or their
   neighbours; never one that adds a blind gamble), (2) the greedy tail win into the band by re-pairing pictures inside the tail, (3) a new stored order of the tail that keeps about ONE tile waiting in the tray (the shares of tail steps
   with 0, 1, 2, 3 waiting go on the card as card.tailPressure). Everything is re-proven: strict replay, clock minimum k, readable, story proof + static gates, twins apart. The roles come from re-running the build (deterministic: the same
   job gives the same tiles, clock and obstacles - checked). Light CPU, about 15-30 s per board.                                                                                                                              */
const path = require('path');
const BANDS = { std: [0.10, 0.28], easy: [0.10, 0.28], hard: [0.06, 0.18], deep: [0.06, 0.18] };
const sameBoard = (a, b) => JSON.stringify([a.tiles, a.clock && a.clock.i, a.obst]) === JSON.stringify([b.tiles, b.clock && b.clock.i, b.obst]);
const briefOf = (T, job) => ({ chain: T.CHAIN_SHAPES[job.si], layout: job.layout, seed: job.seed, stage: job.stage || 'edge', pressure: { run2: job.dial[0], at3: job.dial[1] }, ...(job.spare || job.frame ? { frame: { ...(job.frame || {}), ...(job.spare ? { spare: job.spare } : {}) } } : {}), ...(job.targets ? { targets: job.targets } : {}) });
function rebuild(job, design) {
  const T = require('../trap_stories.js'), r = T.build('chain', briefOf(T, job), { tries: job.tries || 20, wallMs: Math.max(job.buildWall || 20000, 120000) });
  if (!r || !r.design) return { why: 'rebuildFailed' };
  if (!sameBoard(r.design, design)) return { why: 'rebuildDiffers' };
  return { r };
}
// opts: { level (the game's level: the tail window follows the ramp inside the band), tier, seed, wallMs, hardTrap }
function retuneRecord(job, v, opts = {}) {
  const T = require('../trap_stories.js'), Df = require('./difficulty.js'), Tl = require('./tail.js'), M = require('../../factory/meter.js'), E = require('../engine.js');
  const tier = opts.tier || v.tier || 'std', band = BANDS[tier] || BANDS.std, card0 = v.card, d0 = v.design, t0 = Date.now();
  const rb = rebuild(job, d0); if (!rb.r) return { ok: false, why: rb.why };
  const r = rb.r, links = card0.links || 3, hardTrap = opts.hardTrap != null ? opts.hardTrap : (links >= 4 || (card0.difficulty && card0.difficulty.needle) || (card0.firstMoves && card0.firstMoves.winning < 3));
  let window = band; if (opts.level != null && band === BANDS.std) { const t = Math.max(0, Math.min(1, (opts.level - 250) / 52)), c = 0.24 - 0.12 * t; window = [Math.max(band[0], +(c - 0.05).toFixed(3)), Math.min(band[1], +(c + 0.05).toFixed(3))]; }
  const o = T.retuneTail('chain', r, d0, { band, window, seed: opts.seed || 1, wallMs: opts.wallMs || 30000, totalMs: opts.totalMs, gentle: hardTrap });
  if (!o.inBand) return { ok: false, why: 'tail ' + o.after.tail + ' stays outside ' + band.join('-') + ' (' + o.notes.join(' | ').slice(0, 600) + ')' };
  const fin = o.design, k = r.card.clock.fewestMoves, spare = r.card.clock.spare;
  const rp = T.reprove('chain', fin, r.roles, r.brief, spare, k); if (!rp.ok) return { ok: false, why: 'proofLost:' + rp.why };
  if (!E.replay(fin, fin.solution, { strict: true }).ok) return { ok: false, why: 'replay' };
  const SEP = require('./separate.js'), c2 = SEP.closeTwins(fin); if (c2.visible !== 0 || c2.share > 0.05) return { ok: false, why: 'twins' };
  const ds = fin.down.length / fin.tiles.length; if (ds > 0.30) return { ok: false, why: 'faceDown ' + ds.toFixed(3) };
  const press = T.pressureFacts(fin);   // the first moves are proven again on the retuned board (the finish after the clock counts in a move's price)
  const card = JSON.parse(JSON.stringify(card0)); delete card.difficultyFacts; card.boardKey = M.boardKey(fin); card.faceDownShare = +ds.toFixed(3);
  card.tail = { band, tier, window, before: { tailGreedyWin: o.before.tail }, after: { tailGreedyWin: o.after.tail }, inBand: o.inBand, swaps: o.tuneSwaps, gamble: o.after.gamble };
  card.firstMoves = { winning: press.firstMoves.winning, legal: press.firstMoves.legal, losingOrUnknownTiles: press.firstMoves.rows, unknown: press.firstMoves.unknown, atLeast3: press.firstMoves.atLeast3 };
  card.pressure = { k: press.k, occ: press.occ, peak: press.peak, run2: press.run2, at3: press.at3, moves2plus: press.moves2plus, waiters: press.waiters, twinAfterClock: press.twinAfterClock, capProof: press.capProof, needsWaiting: press.needsWaiting };
  card.tailPressure = { ...o.after.occ, gentle: !!hardTrap, before: o.before.occ };
  card.closeTwins = { ...(card.closeTwins || {}), final: SEP.summary(c2) };
  const facts = Df.facts(fin, card, { press, fresh: true }), df = Df.score(fin, card, { facts });
  card.difficulty = { score: df.score, parts: df.parts, needle: df.needle, facts: df.facts, weights: df.weights };
  card.retune = { faceDownBefore: o.before.down, faceDownAfter: o.after.down, faceDownAdded: o.faceDownAdded, tailBefore: o.before.tail, tailAfter: o.after.tail, rerouted: o.rerouted, notes: o.notes, scoreBefore: card0.difficulty && card0.difficulty.score, scoreAfter: df.score, ms: Date.now() - t0 };
  return { ok: true, inBand: o.inBand, design: fin, card, retune: card.retune, tail: o.after.tail, score: df.score, needle: df.needle, pressureMiss: o.missAfter };
}
module.exports = { retuneRecord, rebuild, BANDS, briefOf, sameBoard };
