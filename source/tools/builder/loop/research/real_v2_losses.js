'use strict';
/* What do real players lose to on live levels 170-239? Light script (seconds of CPU), no network, no ratings.
   Input : source/build/real-v2/plays-export.json (plays/ events), source/build/real-v2/replays/full-<pid>.json (replays/ per player, GET only)
           source/analysis/builder/process-v2/real-170-239.json (per-level table with D20, S, Y, tries)
   Output: source/analysis/builder/process-v2/real-losses-170-239.json (the .md is written by hand from it)
   usage : node source/tools/builder/loop/research/real_v2_losses.js                                                          */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'source/www/levels-hard.js'), 'utf8') + ';HARD_LEVELS');
const Layouts = require(path.join(ROOT, 'source/www/layouts.js'));
const Hard = require(path.join(ROOT, 'source/www/hard.js'));
const { readReplay } = require(path.join(ROOT, 'source/tools/replays.js'));
const RV = path.join(ROOT, 'source/build/real-v2');
const PL = { pmuy78xu6tsths9: 'Dennis', pmv6yhzz3x9oxs8: 'Gerda', pmv16kj3jr35750: 'MrsD' };
const LO = 170, HI = 239;
const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'source/analysis/builder/process-v2/real-170-239.json'), 'utf8')).rows;
const ver = v => { const [a, b] = String(v).split('.').map(Number); return a * 1000 + b; };

// ---------- board features from the level table ----------
const lvData = {}, feat = {};
function needSet(i, alive, nb, seen) {              // upper estimate of the tiles that must leave before tile i is free
  const out = new Set();
  const add = j => { if (seen.has(j)) return; seen.add(j); out.add(j); for (const q of needSet(j, alive, nb, seen)) out.add(q); };
  for (const j of nb.above[i]) if (alive[j]) add(j);
  const l = nb.left[i].filter(j => alive[j]), r = nb.right[i].filter(j => alive[j]);
  if (l.length && r.length) {
    const side = js => { const s2 = new Set(seen); const o = new Set(); for (const j of js) { if (!s2.has(j)) { s2.add(j); o.add(j); for (const q of needSet(j, alive, nb, s2)) o.add(q); } } return o; };
    const a = side(l), b = side(r); for (const j of (a.size <= b.size ? a : b)) { out.add(j); seen.add(j); }
  }
  return out;
}
for (let lv = LO; lv <= HI; lv++) {
  const d = Hard.get(lv); lvData[lv] = d;
  const tl = d.tiles.map(([x, y, z]) => ({ x, y, z })), nb = Layouts.neighbors(tl), n = tl.length, alive = new Array(n).fill(1);
  const ice = d.obst ? Object.keys(d.obst.ice || {}).length : 0, locks = d.obst ? (d.obst.locks || []).length : 0, keys = d.obst ? (d.obst.keys || []).length : 0;
  const free = []; for (let i = 0; i < n; i++) if (Layouts.isFree(i, alive, nb)) free.push(i);
  const byF = new Map(); d.faces.forEach((f, i) => { if (!byF.has(f)) byF.set(f, []); byF.get(f).push(i); });
  const freeSet = new Set(free);
  let faceGroupsWithTwoFree = 0; for (const [, l] of byF) if (l.filter(i => freeSet.has(i)).length >= 2) faceGroupsWithTwoFree++;
  let buriedTwin = 0;   // tiles whose copies are ALL not free at the start, i.e. nothing of that face can be taken right away
  for (const [, l] of byF) if (!l.some(i => freeSet.has(i))) buriedTwin += l.length;
  const z = tl.map(t => t.z), meanAbove = nb.above.reduce((s, a) => s + a.length, 0) / n;
  const need = i => needSet(i, alive, { above: nb.above, left: nb.left, right: nb.right }, new Set([i])).size;
  const ck = d.clock;
  let clockPos = null, clockDig = null, clockFreeAtStart = null;
  if (ck) { clockPos = d.solution ? d.solution.indexOf(ck.i) : null; clockDig = need(ck.i) + 1; clockFreeAtStart = freeSet.has(ck.i); }
  feat[lv] = {
    tiles: n, faces: byF.size, copiesMax: Math.max(...[...byF.values()].map(l => l.length)),
    downShare: +(d.down.reduce((s, v) => s + v, 0) / n).toFixed(3), clockN: ck ? ck.n : null, clockRatio: ck ? +(ck.n / n).toFixed(3) : null,
    clockSlack: ck && clockPos != null && clockPos >= 0 ? ck.n - 1 - clockPos : null,   // moves to spare when the stored solution reaches the clock tile
    clockDig, clockSlackDig: ck ? ck.n - clockDig : null, clockFreeAtStart,
    ice, locks, keys, maxLayer: Math.max(...z) + 1, layer3: +(z.filter(v => v >= 2).length / n).toFixed(3),
    freeStart: free.length, freeShare: +(free.length / n).toFixed(3), faceGroupsTwoFree: faceGroupsWithTwoFree, faceGroupsTwoFreeShare: +(faceGroupsWithTwoFree / byF.size).toFixed(3),
    buriedTwinShare: +(buriedTwin / n).toFixed(3), meanAbove: +meanAbove.toFixed(3),
  };
}

// ---------- tries: plays end events, tied to replays by aid ----------
const plays = JSON.parse(fs.readFileSync(path.join(RV, 'plays-export.json'), 'utf8'));
const replayBy = {}, replayStats = {};
for (const pid of Object.keys(PL)) {
  const D = JSON.parse(fs.readFileSync(path.join(RV, 'replays', 'full-' + pid + '.json'), 'utf8'));
  const st = replayStats[PL[pid]] = { attempts: 0, inRange: 0, incomplete: 0, noEnd: 0, oldBoard: 0 };
  for (const rec of Object.values(D)) {
    st.attempts++;
    let r; try { r = readReplay(rec); } catch (e) { continue; }
    const lv = r.initial && /^L\d+$/.test(r.initial.key) ? +r.initial.key.slice(1) : 0;
    if (lv < LO || lv > HI) continue; st.inRange++;
    const code = Object.values(rec)[0].code;
    if (!r.complete) st.incomplete++; if (!r.result) st.noEnd++;
    r.lv = lv; r.code = code; replayBy[PL[pid] + ':' + r.aid] = r;
  }
}
const lastInitialOK = (r, d) => JSON.stringify(r.initial.tiles) === JSON.stringify(d.tiles) && (!d.clock || (r.initial.state.ck && r.initial.state.ck.n === d.clock.n));

const tries = [];      // one per end event on the current board
for (const pid of Object.keys(PL)) {
  const ev = Object.values(plays[pid] || {}).filter(e => e.k === 'end' && e.lv >= LO && e.lv <= HI && ver(e.v) >= 1054 && e.n === lvData[e.lv].tiles.length);
  ev.sort((a, b) => a.t - b.t);
  for (const e of ev) {
    const rep = replayBy[PL[pid] + ':' + e.aid];
    tries.push({ who: PL[pid], lv: e.lv, at: e.at, t: e.t, r: e.r, ck: !!e.ck, left: e.left, n: e.n, mc: e.mc, dur: e.dur, hint: !!e.h, shuf: !!e.sh, v: e.v, aid: e.aid,
      rep: rep && rep.complete && lastInitialOK(rep, lvData[e.lv]) ? rep : null, repAny: !!rep });
  }
}
// a play whose board does not match the table is not a try on the current board
// ---------- situation at the loss, from the replay ----------
function analyseReplay(tr) {
  const rep = tr.rep, d = lvData[tr.lv], tl = d.tiles.map(([x, y, z]) => ({ x, y, z })), nb = Layouts.neighbors(tl), n = tl.length;
  const frames = rep.frames, endIdx = frames.map(f => f.kind).lastIndexOf('end');
  const out = { taps: frames.filter(f => f.kind === 'tap').length, miss: frames.filter(f => f.kind === 'miss').length, shuffle: frames.filter(f => f.kind === 'shuffle').length, ignoredCovered: frames.filter(f => f.kind === 'tap' && f.data[2]).length };
  let li = -1; for (let i = endIdx - 1; i >= 0; i--) if (frames[i].kind === 'tap' && !frames[i].data[2]) { li = i; break; }
  out.firstTaps = frames.filter(f => f.kind === 'tap' && !f.data[2]).slice(0, 12).map(f => f.data[0]);
  const can = (s, i) => Layouts.isFree(i, s.a, nb) && !(s.ob && s.ob.left && s.ob.left[i] > 0) && !(s.ob && !s.ob.unlocked && s.ob.locks && s.ob.locks.includes(i));
  const fin = rep.state; out.lastTile = li >= 0 ? frames[li].data[0] : null;
  const before = li > 0 ? frames[li - 1].state : null;
  if (tr.r === 'stuck' && !tr.ck && fin && fin.tr.length >= 4) {
    const s = fin, fr = [];
    out.tray = s.tr.map(i => {
      const f = s.f[i], twins = []; for (let j = 0; j < n; j++) if (s.a[j] && j !== i && s.f[j] === f) twins.push(j);
      return { face: f, twins: twins.map(j => ({ free: can(s, j), down: !!s.d[j], above: nb.above[j].filter(q => s.a[q]).length, frozen: !!(s.ob && s.ob.left && s.ob.left[j] > 0), locked: !!(s.ob && !s.ob.unlocked && s.ob.locks && s.ob.locks.includes(j)), sideBlocked: !!(nb.left[j].some(q => s.a[q]) && nb.right[j].some(q => s.a[q])) })) };
    });
    out.trayTwinsLeft = out.tray.map(t => t.twins.length);
    out.trayNoTwin = out.tray.filter(t => !t.twins.length).length;   // twins already in the tray cannot be (all pairs taken) - should not happen
    out.trayTwinsFree = out.tray.reduce((s2, t) => s2 + t.twins.filter(w => w.free).length, 0);
    const all = out.tray.flatMap(t => t.twins);
    out.twinsBuried = all.filter(w => !w.free).length; out.twinsTotal = all.length;
    out.twinsUnderTiles = all.filter(w => w.above > 0).length; out.twinsDown = all.filter(w => w.down).length; out.twinsIceLock = all.filter(w => w.frozen || w.locked).length; out.twinsSide = all.filter(w => w.above === 0 && w.sideBlocked).length;
    out.meanAbove = all.length ? +(all.reduce((s2, w) => s2 + w.above, 0) / all.length).toFixed(2) : 0;
    if (before) {                                         // what could the player have done with the 3-tile tray before the fatal tap
      const frs = []; for (let i = 0; i < n; i++) if (before.a[i] && can(before, i)) frs.push(i);
      const trayFaces = new Set(before.tr.map(i => before.f[i]));
      out.beforeTray = before.tr.length;
      out.missedMatch = frs.some(i => trayFaces.has(before.f[i]) && i !== out.lastTile);     // a free tile matching a waiting tile existed but the player took another
      const cnt = new Map(); for (const i of frs) cnt.set(before.f[i], (cnt.get(before.f[i]) || 0) + 1);
      out.freePairExisted = [...cnt.values()].some(c => c >= 2);
      out.freeTilesBefore = frs.length;
      out.lastWasFreshFace = li >= 0 && !trayFaces.has(before.f[out.lastTile]);
      out.lastDown = li >= 0 ? !!before.d[out.lastTile] : null;     // the fatal tile was a face-down tile turned over
    }
    // the last time the tray grew from 2 to 3 waiting tiles: could a free match or a free pair have kept it at 2?
    let k3 = -1; for (let i = frames.length - 1; i > 0; i--) { const a0 = frames[i - 1].state && frames[i - 1].state.tr, a1 = frames[i].state && frames[i].state.tr; if (a0 && a1 && a0.length === 2 && a1.length === 3) { k3 = i; break; } }
    if (k3 > 0) {
      let kt = k3; while (kt > 0 && frames[kt].kind !== 'tap') kt--;
      const s0 = frames[k3 - 1].state, fr0 = []; for (let i = 0; i < n; i++) if (s0.a[i] && can(s0, i)) fr0.push(i);
      const tf = new Set(s0.tr.map(i => s0.f[i])), cnt = new Map(); for (const i of fr0) cnt.set(s0.f[i], (cnt.get(s0.f[i]) || 0) + 1);
      let tapsSince = 0; for (let i = k3; i < frames.length; i++) if (frames[i].kind === 'tap' && !frames[i].data[2]) tapsSince++;
      out.at3 = { matchFree: fr0.some(i => tf.has(s0.f[i])), pairFree: [...cnt.values()].some(c => c >= 2), tileFaceDown: frames[kt].kind === 'tap' ? !!s0.d[frames[kt].data[0]] : null, nFree: fr0.length, tapsSince };
    }
  } else if (tr.ck && fin) {
    const ck = fin.ck || rep.initial.state.ck;
    out.clockAlive = !!(ck && fin.a[ck.i]);
    if (ck) { out.clockN = ck.n; out.clockFreeAtLoss = can(fin, ck.i); out.clockDigAtLoss = needSet(ck.i, fin.a, nb, new Set([ck.i])).size + 1; }
  }
  return out;
}
for (const t of tries) { t.share = +(1 - t.left / t.n).toFixed(3); if (t.rep) t.sit = analyseReplay(t); }

// ---------- aggregate helpers ----------
const rankAvg = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; };
const pearson = (a, b) => { const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let x = 0, y = 0, z = 0; for (let i = 0; i < n; i++) { x += (a[i] - ma) * (b[i] - mb); y += (a[i] - ma) ** 2; z += (b[i] - mb) ** 2; } return y && z ? x / Math.sqrt(y * z) : NaN; };
const spearman = (a, b) => pearson(rankAvg(a), rankAvg(b));
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const quant = (a, q) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
function spBand(a, b) { const n = a.length, r = spearman(a, b), bs = []; for (let k = 0; k < 1000; k++) { const ix = Array.from({ length: n }, () => Math.floor(rnd() * n)); bs.push(spearman(ix.map(i => a[i]), ix.map(i => b[i]))); } return { rho: +r.toFixed(2), lo: +quant(bs, 0.05).toFixed(2), hi: +quant(bs, 0.95).toFixed(2), n }; }
const median = a => quant(a, 0.5), mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
function auc(hard, easy) { if (!hard.length || !easy.length) return NaN; let s = 0; for (const h of hard) for (const e of easy) s += h > e ? 1 : h === e ? 0.5 : 0; return s / (hard.length * easy.length); }
function aucBand(vals, isHard) { const H = vals.filter((_, i) => isHard[i]), E = vals.filter((_, i) => !isHard[i]), bs = []; for (let k = 0; k < 1000; k++) { const h = H.map(() => H[Math.floor(rnd() * H.length)]), e = E.map(() => E[Math.floor(rnd() * E.length)]); bs.push(auc(h, e)); } return { auc: +auc(H, E).toFixed(2), lo: +quant(bs, 0.05).toFixed(2), hi: +quant(bs, 0.95).toFixed(2), nHard: H.length, nEasy: E.length, medHard: +median(H).toFixed(3), medEasy: +median(E).toFixed(3) }; }
const pct = (a, f) => a.length ? +(100 * a.filter(f).length / a.length).toFixed(0) : null;

// ---------- 1. per player ----------
const cause = t => t.r === 'win' ? 'win' : t.r === 'restart' ? 'restart' : t.ck ? 'clock' : 'tray';
const bucket = s => s < 1 / 3 ? 'early' : s < 2 / 3 ? 'middle' : 'late';
const perPlayer = {};
for (const who of Object.values(PL)) {
  const T = tries.filter(t => t.who === who), L = T.filter(t => t.r !== 'win');
  const o = { tries: T.length, wins: T.length - L.length, lost: L.length, replayOfLost: L.filter(t => t.rep).length, repAnyOfLost: L.filter(t => t.repAny).length };
  o.cause = {}; for (const c of ['tray', 'clock', 'restart']) o.cause[c] = L.filter(t => cause(t) === c).length;
  o.timing = {}; for (const c of ['tray', 'clock', 'restart']) { const S = L.filter(t => cause(t) === c); o.timing[c] = { n: S.length, medShare: S.length ? +median(S.map(t => t.share)).toFixed(2) : null, medMoves: S.length ? median(S.map(t => t.mc)) : null, medSec: S.length ? median(S.map(t => t.dur)) : null, early: S.filter(t => bucket(t.share) === 'early').length, middle: S.filter(t => bucket(t.share) === 'middle').length, late: S.filter(t => bucket(t.share) === 'late').length }; }
  o.hintOrShuffleUsedInLost = L.filter(t => t.hint || t.shuf).length; o.hintOrShuffleUsedInWins = T.filter(t => t.r === 'win' && (t.hint || t.shuf)).length;
  o.clockLossesByClockLevel = (() => { const x = {}; for (const t of L.filter(t => cause(t) === 'clock')) x[t.lv] = (x[t.lv] || 0) + 1; return x; })();
  // tray situation (replays only)
  const R = L.filter(t => t.sit && t.sit.tray);
  if (R.length) {
    const s = R.map(t => t.sit);
    o.at3 = (() => { const q = s.filter(x => x.at3); return { n: q.length, matchFree: q.filter(x => x.at3.matchFree).length, pairFreeNoMatch: q.filter(x => !x.at3.matchFree && x.at3.pairFree).length, neither: q.filter(x => !x.at3.matchFree && !x.at3.pairFree).length, faceDownTile: q.filter(x => x.at3.tileFaceDown).length, medTapsSince: median(q.map(x => x.at3.tapsSince)) }; })();
    o.traySituation = { n: R.length, twinsBuriedShare: +(100 * s.reduce((a, x) => a + x.twinsBuried, 0) / s.reduce((a, x) => a + x.twinsTotal, 0)).toFixed(0), twinsUnderTilesShare: +(100 * s.reduce((a, x) => a + x.twinsUnderTiles, 0) / s.reduce((a, x) => a + x.twinsTotal, 0)).toFixed(0), twinsFaceDownShare: +(100 * s.reduce((a, x) => a + x.twinsDown, 0) / s.reduce((a, x) => a + x.twinsTotal, 0)).toFixed(0), twinsIceLockShare: +(100 * s.reduce((a, x) => a + x.twinsIceLock, 0) / s.reduce((a, x) => a + x.twinsTotal, 0)).toFixed(0), meanTilesAboveTwin: +mean(s.map(x => x.meanAbove)).toFixed(2), withFreeTwinAtLoss: s.filter(x => x.trayTwinsFree > 0).length, missedMatchBeforeFatalTap: s.filter(x => x.missedMatch).length, freePairExistedBeforeFatalTap: s.filter(x => x.freePairExisted).length, fatalTileWasFaceDown: s.filter(x => x.lastDown).length, shuffleUsed: s.filter(x => x.shuffle).length, medianTaps: median(s.map(x => x.taps)) };
  }
  perPlayer[who] = o;
}

// repeated tries on the same level: same spot or scattered
const seqs = {};
for (const t of tries) { const k = t.who + ':' + t.lv; (seqs[k] = seqs[k] || []).push(t); }
const repeat = {};
for (const who of Object.values(PL)) {
  const pairs = []; let seqCount = 0;
  for (const [k, S] of Object.entries(seqs)) {
    if (!k.startsWith(who + ':')) continue;
    S.sort((a, b) => a.t - b.t);
    const lost = S.filter(t => t.r !== 'win'); if (lost.length >= 2) seqCount++;
    for (let i = 0; i + 1 < S.length; i++) if (S[i].r !== 'win' && S[i + 1].r !== 'win') pairs.push([S[i], S[i + 1]]);
  }
  const both = pairs.filter(([a, b]) => a.rep && b.rep && a.sit && b.sit);
  const prefix = (a, b) => { let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++; return k; };
  repeat[who] = { levelsWithTwoPlusLosses: seqCount, consecutiveLossPairs: pairs.length, sameCause: pairs.filter(([a, b]) => cause(a) === cause(b)).length,
    clockClockPairs: pairs.filter(([a, b]) => cause(a) === 'clock' && cause(b) === 'clock').length, trayTrayPairs: pairs.filter(([a, b]) => cause(a) === 'tray' && cause(b) === 'tray').length,
    shareAbsDiffMedian: pairs.length ? +median(pairs.map(([a, b]) => Math.abs(a.share - b.share))).toFixed(2) : null,
    trayPairsWithReplay: both.filter(([a, b]) => a.sit.tray && b.sit.tray).length,
    sameFatalTile: both.filter(([a, b]) => a.sit.tray && b.sit.tray && a.sit.lastTile === b.sit.lastTile).length,
    sameTrayFaces: both.filter(([a, b]) => a.sit.tray && b.sit.tray && JSON.stringify(a.sit.tray.map(x => x.face).sort((x, y) => x - y)) === JSON.stringify(b.sit.tray.map(x => x.face).sort((x, y) => x - y))).length,
    medianSharedOpeningTaps: both.length ? median(both.map(([a, b]) => prefix(a.sit.firstTaps, b.sit.firstTaps))) : null,
    openingIdentical12: both.filter(([a, b]) => prefix(a.sit.firstTaps, b.sit.firstTaps) >= Math.min(12, a.sit.firstTaps.length, b.sit.firstTaps.length) && a.sit.firstTaps.length >= 6).length, openingPairs: both.length };
}

// per-level loss mix (all players)
const perLevel = {};
for (let lv = LO; lv <= HI; lv++) {
  const row = {};
  for (const who of Object.values(PL)) { const L = tries.filter(t => t.who === who && t.lv === lv && t.r !== 'win'); row[who] = { lost: L.length, tray: L.filter(t => cause(t) === 'tray').length, clock: L.filter(t => cause(t) === 'clock').length, restart: L.filter(t => cause(t) === 'restart').length }; }
  perLevel[lv] = row;
}

// ---------- 2 + 3. level features vs real difficulty ----------
const rowOf = {}; for (const r of table) rowOf[r.lv] = r;
const hardGerda = lv => rowOf[lv].Gerda != null && rowOf[lv].Gerda >= 10;
const hardDennis = lv => rowOf[lv].Dennis >= 3;
const FE = ['tiles', 'downShare', 'clockN', 'clockRatio', 'clockSlack', 'clockDig', 'clockSlackDig', 'ice', 'locks', 'keys', 'maxLayer', 'layer3', 'freeStart', 'freeShare', 'faceGroupsTwoFreeShare', 'buriedTwinShare', 'meanAbove'];
const lvls = [...Array(HI - LO + 1)].map((_, i) => LO + i);
const get = (lv, f) => f === 'D20' ? rowOf[lv].D20 : f === 'S' ? rowOf[lv].S : feat[lv][f];
const corr = {};
for (const f of FE.concat(['D20', 'S'])) {
  const out = {};
  for (const [name, key, set] of [['Gerda', 'Gerda', lvls.filter(l => rowOf[l].Gerda != null)], ['Dennis', 'Dennis', lvls], ['Y', 'Y', lvls], ['Dennis200_239', 'Dennis', lvls.filter(l => l >= 200)]]) {
    const s = set.filter(l => get(l, f) != null);
    if (s.length < 10 || new Set(s.map(l => get(l, f))).size < 3) { out[name] = null; continue; }
    out[name] = spBand(s.map(l => get(l, f)), s.map(l => rowOf[l][key]));
  }
  corr[f] = out;
}
// clock-loss share per level vs features not used; also real "clock-lost tries" per level
const clockLossLevel = {}; for (const l of lvls) clockLossLevel[l] = Object.values(PL).reduce((s, w) => s + perLevel[l][w].clock, 0);
const groups = {};
for (const [gname, setLv, isHard] of [['Gerda 10+ tries (n of 40 levels)', lvls.filter(l => rowOf[l].Gerda != null), hardGerda], ['Dennis 3+ tries (n of 70 levels)', lvls, hardDennis], ['Dennis 3+ tries within the 40 Gerda levels', lvls.filter(l => rowOf[l].Gerda != null), hardDennis]]) {
  const g = {}; groups[gname] = { hardLevels: setLv.filter(isHard), g };
  for (const f of FE.concat(['D20', 'S'])) { const s = setLv.filter(l => get(l, f) != null); if (s.length < 10) continue; g[f] = aucBand(s.map(l => get(l, f)), s.map(isHard)); }
}
const gl = lvls.filter(l => rowOf[l].Gerda != null), gClock = l => perLevel[l].Gerda.clock, gTray = l => perLevel[l].Gerda.tray;
const clockCorr = {};
for (const f of ['clockN', 'clockRatio', 'clockSlack', 'clockDig', 'clockSlackDig', 'tiles', 'faceGroupsTwoFreeShare', 'downShare', 'freeStart']) clockCorr[f] = { gerdaClockLosses: spBand(gl.map(l => feat[l][f]), gl.map(gClock)), gerdaTrayLosses: spBand(gl.map(l => feat[l][f]), gl.map(gTray)) };
const gerdaLostCorr = {}; for (const f of FE.concat(['D20', 'S'])) { const q = gl.filter(l => get(l, f) != null); if (new Set(q.map(l => get(l, f))).size > 2) gerdaLostCorr[f] = spBand(q.map(l => get(l, f)), q.map(l => perLevel[l].Gerda.lost)); }
const sumOver = (ls, k) => ls.reduce((s, l) => s + perLevel[l].Gerda[k], 0);
const gerdaHardMix = { hardLevels: gl.filter(hardGerda), hard: { clock: sumOver(gl.filter(hardGerda), 'clock'), tray: sumOver(gl.filter(hardGerda), 'tray'), restart: sumOver(gl.filter(hardGerda), 'restart') }, easy: { clock: sumOver(gl.filter(l => !hardGerda(l)), 'clock'), tray: sumOver(gl.filter(l => !hardGerda(l)), 'tray'), restart: sumOver(gl.filter(l => !hardGerda(l)), 'restart') } };
const clockLevelsTable = lvls.filter(l => feat[l].clockN != null).map(l => ({ lv: l, clockN: feat[l].clockN, tiles: feat[l].tiles, slack: feat[l].clockSlack, dig: feat[l].clockDig, Dennis: rowOf[l].Dennis, Gerda: rowOf[l].Gerda, clockLossesAll: clockLossLevel[l] }));
const lostTable = lvls.map(l => ({ lv: l, Dennis: rowOf[l].Dennis, Gerda: rowOf[l].Gerda, MrsD: rowOf[l].MrsD, mix: perLevel[l] }));

// coverage versus the ledger
const ledger = JSON.parse(fs.readFileSync(path.join(RV, 'ledger-170-239.json'), 'utf8'));
const ledgerLost = {}; for (const s of ledger.sequences) ledgerLost[s.who] = (ledgerLost[s.who] || 0) + s.res.filter(x => x === 0).length;

const result = { generated: new Date().toISOString(), replayStats, triesOnCurrentBoard: tries.length, ledgerLostTriesByPlayer: ledgerLost, perPlayer, repeat, features: feat, corr, groups, clockCorr, gerdaLostCorr, gerdaHardMix, clockLevelsTable, lostTable };
fs.writeFileSync(path.join(ROOT, 'source/analysis/builder/process-v2/real-losses-170-239.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify({ replayStats, tries: tries.length, ledgerLost, perPlayer, repeat }, null, 1));
for (const f of Object.keys(corr)) console.log(f.padEnd(24), ['Gerda', 'Dennis', 'Y', 'Dennis200_239'].map(k => corr[f][k] ? `${k} ${corr[f][k].rho} (${corr[f][k].lo},${corr[f][k].hi}) n${corr[f][k].n}` : `${k} -`).join(' | '));
for (const [g, v] of Object.entries(groups)) { console.log('\n' + g, v.hardLevels.join(',')); for (const [f, a] of Object.entries(v.g)) console.log(' ', f.padEnd(24), JSON.stringify(a)); }
console.log(JSON.stringify({ gerdaLostCorr, lostPerLevelGerda: gl.map(l => [l, perLevel[l].Gerda.lost]) }));
