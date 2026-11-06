/* Builder v2, the phase-2 gate (SPEC.md section 5, helper C, 2026-11-06).
     node gate.js --make-briefs                       writes briefs-v1.json (deterministic, 50 briefs)
     node gate.js [briefs.json] [--seeds 1,2,3] [--jobs 2] [--ms 15000] [--tag v1] [--only id,id]
   Builds every brief once per seed (worker_threads), then checks every built design on its own, with engine.js and
   www/hard.js, without trusting the builder's claims:
     (a) the stored solution replays (E.replay, peek pairs allowed)
     (b) honest clock: E.clockShortest k + the brief's spare = clock.n; the board is winnable with n = k and not with
         n = k - 1 (E.winnable)
     (c) no face-down tile is free at the start
     (d) no idle special: taking away a lock or an ice tile must make the fewest way to the clock shorter, unless it is
         a holder (story with locked/frozen partners: still on the board when the clock goes, and the twin of a tile
         taken on the way)
     (e) pictures: 0..35, every picture 2 or 4 times, at least 72 tiles, keys are one pair, locks have keys
     (f) Hard.validSolution (strict rules, no peek pair): reported only
   Output: analysis/builder/gate/results-<tag>.json (every build, with its design) and summary-<tag>.{json,md}.
   The plain-language report is analysis/builder/gate-report.md (written by hand from the summary). */
'use strict';
const path = require('path'), fs = require('fs');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const HERE = __dirname, ROOT = path.join(HERE, '..', '..'), OUT = path.join(ROOT, 'analysis', 'builder', 'gate');
const GATE = { buildRate: 0.9, ms: 5000 };
const CHECK_BUDGET = { nodes: 400000, ms: 10000 }, SPECIAL_BUDGET = { nodes: 300000, ms: 5000 }, WIN_BUDGET = { nodes: 400000, ms: 6000 };

// ---------- the briefs ----------
function makeBriefs() {
  const B = require('./builder.js'), { STORIES } = require('./stories.js');
  const LAY = B.LAYOUTS, ids = Object.keys(STORIES), N = 50, per = N / ids.length;
  const ctx = LAY.map(l => B.context(l.tiles));
  const depthCount = (li, [a, b]) => ctx[li].above.filter(s => s.size >= a && s.size <= b).length;
  // geometry screen: can the story's roles (clock, keys, locks, ice) be placed on the shape at all? B.fits only
  // counts peaks; placeRoles also needs keys with cover on the other peak, ice the cover cannot thaw, and so on.
  // (Only roles: the dig, the pictures and the proofs are what the gate tests.)
  const rolesFit = (id, li, frame, stage) => {
    for (let s = 1; s <= 8; s++) {
      let x = (s * 7919) >>> 0; const rng = () => (x = (x * 1103515245 + 12345) >>> 0) / 4294967296;
      if (!B.placeRoles(ctx[li], STORIES[id], { frame, stage, targets: {} }, rng).fail) return true;
    }
    return false;
  };
  const used = new Array(LAY.length).fill(0);
  // the stories with the narrowest choice of shapes first, so they get the shapes they need
  const narrow = id => LAY.filter((l, li) => B.fits(id, l.tiles) && depthCount(li, STORIES[id].spec.clockDepth || [0, 2]) >= 3).length;
  const order = ids.slice().sort((a, b) => narrow(a) - narrow(b) || ids.indexOf(a) - ids.indexOf(b));
  const pick = {}; let ptr = 0;
  for (let j = 0; j < per; j++) for (const id of order) {
    const range = STORIES[id].spec.clockDepth || [0, 2];
    const ok = li => B.fits(id, LAY[li].tiles) && depthCount(li, range) >= 3 && !(pick[id] || []).includes(li) && rolesFit(id, li, {}, null);
    // an unused shape first; within that, keep base shapes apart within a story
    const cost = li => used[li] * 10 + ((pick[id] || []).some(q => LAY[q].base === LAY[li].base) ? 1 : 0);
    let best = -1;
    for (let step = 0; step < LAY.length; step++) {
      const li = (ptr + step) % LAY.length;
      if (used[li] >= 2 || !ok(li)) continue;
      if (best < 0 || cost(li) < cost(best)) best = li;
      if (cost(li) === 0) break;
    }
    if (best < 0) for (let li = 0; li < LAY.length; li++) if (used[li] < 2 && B.fits(id, LAY[li].tiles) && !(pick[id] || []).includes(li) && rolesFit(id, li, {}, null)) { best = li; break; }
    if (best < 0) throw new Error('no layout left for ' + id);
    used[best]++; (pick[id] = pick[id] || []).push(best); ptr = (best + 7) % LAY.length;
  }
  const STAGES = ['centre', 'edge', 'top', null], DOWN = [0.2, 0.25, 0.3, 0.35, 0.4], ROOM = [0, 1, 0, 2, 1, 0];
  const briefs = [];
  ids.forEach((id, s) => pick[id].forEach((li, j) => {
    const k = s + 10 * j, story = STORIES[id], range = story.spec.clockDepth || [0, 2];
    const spare = 1 + (k + j) % 3, trayRoom = ROOM[(s + 5 * j) % ROOM.length], hiddenOnWay = (k + j) % 4;
    const maxDown = DOWN[(k + 2 * j) % 5], stage = STAGES[(k + 3 * j) % 4];
    const frame = { spare };
    // the third brief of a story pins the clock depth to the deepest value the shape offers in the story's range
    if (j === 2 && range[1] > range[0]) {
      let d = range[1]; while (d >= range[0] && (depthCount(li, [d, d]) < 2 || !rolesFit(id, li, { depth: d }, stage))) d--;
      if (d >= range[0]) frame.depth = d;
    }
    if (!rolesFit(id, li, frame, stage)) console.warn(`warning: ${id} on layout ${li}: the roles do not fit with stage ${stage}`);
    const lay = LAY[li], c = ctx[li];
    const bits = [];
    bits.push(trayRoom === 0 ? 'the tray fills to 3 on the dig (family pressure)' : trayRoom === 1 ? 'the tray fills to 2 on the dig' : 'a calm tray (fills to 1): the easy end');
    bits.push(hiddenOnWay ? `${hiddenOnWay} face-down tile${hiddenOnWay > 1 ? 's' : ''} on the dig (skilled player's luck)` : 'no face-down tile on the dig');
    bits.push(`spare ${spare}`);
    if (frame.depth != null) bits.push(`clock depth pinned to ${frame.depth}`);
    if (stage) bits.push(`clock at the ${stage}`);
    if (c.peaks >= 2) bits.push(`${c.peaks} peaks`);
    briefs.push({ id: `${id}-${lay.base}-${li}`, why: `${story.title} on ${lay.shape} (${lay.n} tiles, ${c.maxZ + 1} layers): ` + bits.join(', ') + '.',
      layout: li, shape: lay.shape, story: id, stage, frame, targets: { trayRoom, hiddenOnWay, maxDown }, seed: 1 });
  }));
  return briefs;
}

// ---------- the static checks (independent of the builder's own claims) ----------
const median = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b.length % 2 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };
const quant = (a, q) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.ceil(q * b.length) - 1)]; };

function checkDesign(designIn, brief) {
  const E = require('./engine.js'), L = global.Layouts, Hard = require('../../www/hard.js'), { STORIES } = require('./stories.js');
  const copy = () => JSON.parse(JSON.stringify(designIn));
  const d = copy(), n = d.tiles.length, spare = brief.frame?.spare ?? 1, out = { problems: [] };
  const flag = (kind, detail) => out.problems.push({ kind, detail });
  // (e) pictures and shape first: the rest assumes a sane board
  const tilesOk = n >= 72 && n % 2 === 0 && Array.isArray(d.faces) && d.faces.length === n;
  const cnt = {}; for (const f of d.faces || []) cnt[f] = (cnt[f] || 0) + 1;
  const badFace = (d.faces || []).filter(f => !Number.isInteger(f) || f < 0 || f > 35);
  const oddPic = Object.keys(cnt).filter(f => cnt[f] !== 2 && cnt[f] !== 4);
  const ob = d.obst || {}, locks = ob.locks || [], keys = ob.keys || [];
  out.faces = { ok: tilesOk && !badFace.length && !oddPic.length, tiles: n, pictures: Object.keys(cnt).length, fourTimes: Object.values(cnt).filter(c => c === 4).length };
  if (!tilesOk) flag('faces', `tiles ${n}, faces ${d.faces && d.faces.length}`);
  if (badFace.length) flag('faces', 'pictures out of 0..35: ' + badFace.slice(0, 5).join(','));
  if (oddPic.length) flag('faces', 'picture counts not 2 or 4: ' + oddPic.map(f => f + 'x' + cnt[f]).join(', '));
  if (locks.length && keys.length !== 2) flag('specials', `locks ${locks.join(',')} but keys ${JSON.stringify(keys)}`);
  if (!locks.length && keys.length) flag('specials', 'keys without a lock: ' + keys.join(','));
  if (keys.length === 2 && d.faces[keys[0]] !== d.faces[keys[1]]) flag('specials', `keys ${keys.join(',')} are not one pair (pictures ${d.faces[keys[0]]}, ${d.faces[keys[1]]})`);
  if (!d.clock || !Number.isInteger(d.clock.i) || d.clock.i < 0 || d.clock.i >= n) { flag('clock', 'no valid clock tile'); return out; }
  // (c) no face-down tile free at the start
  const tiles = d.tiles.map(t => ({ x: t[0], y: t[1], z: t[2] })), nb = L.neighbors(tiles), all = new Uint8Array(n).fill(1);
  out.downFree = (d.down || []).filter(i => L.isFree(i, all, nb));
  if (out.downFree.length) flag('downFree', 'face-down tiles free at the start: ' + out.downFree.join(','));
  // (a) the stored solution
  const rep = E.replay(d, d.solution);
  out.replay = { ok: rep.ok, why: rep.why || null, at: rep.at ?? null, pairs: rep.pairs };
  if (!rep.ok) flag('replay', `${rep.why} at move ${rep.at}`);
  // (f) strict validSolution (the game's own test helper; peek pairs unknown to it): reported, not required
  const rules = (Object.keys(ob.ice || {}).length || keys.length) ? { iceNb: L.iceNeighbors(tiles), ice: ob.ice || {}, locks: keys.length ? new Set(locks) : null, keys } : null;
  out.strict = Hard.validSolution({ tiles, nb, faces: d.faces, rules, clock: d.clock }, d.solution);
  // (b) honest clock
  const g = E.game(copy()), cs = E.clockShortest(g, CHECK_BUDGET);
  out.clock = { n: d.clock.n, k: cs ? cs.k : null, unsure: !!(cs && cs.unsure), spare: cs ? d.clock.n - cs.k : null };
  if (!cs) flag('clock', 'clockShortest unresolved within budget');
  else {
    if (cs.unsure) flag('clock', 'an earlier clock route is unresolved; minimum not proven');
    if (cs.k + spare !== d.clock.n) flag('clock', `fewest ${cs.k} + spare ${spare} = ${cs.k + spare}, clock.n ${d.clock.n}`);
    const at = nn => { const x = copy(); x.clock = { i: d.clock.i, n: nn }; const gx = E.game(x); return E.winnable(gx, E.start(gx), WIN_BUDGET).result; };
    const witnessAtK = copy(); witnessAtK.clock.n = cs.k;
    // clockShortest already supplies a complete route. Replaying it proves this without solving again.
    out.clock.winAtK = E.replay(witnessAtK, E.flatten(cs.path)).ok ? 'win' : at(cs.k);
    out.clock.winAtKProof = 'clockShortest witness replay';
    out.clock.atKminus1 = cs.k > 1 ? at(cs.k - 1) : 'lose';
    if (out.clock.winAtK !== 'win') flag('clock', `not winnable with clock.n = k = ${cs.k} (${out.clock.winAtK})`);
    if (out.clock.atKminus1 !== 'lose') flag('clock', `clock.n = k - 1 = ${cs.k - 1}: ${out.clock.atKminus1}, minimum not proven`);
    out.clock.kGame = cs.k; // engine defaults to board.js's after-action clock check
    const gp = E.game(copy(), { clockAfterAction: false }), cp = E.clockShortest(gp, CHECK_BUDGET);
    out.clock.kPerTile = cp ? cp.k : null; // diagnostic comparison, never the proof basis
  }
  // Re-measure the requested targets from the board, independently of the returned card/intents.
  const B = require('./builder.js'), targets = brief.targets || {}, tray = B.trayOnWay(d, d.solution);
  const prefix = new Set(d.solution.slice(0, d.solution.indexOf(d.clock.i) + 1));
  out.targets = { trayMax: tray.max, hiddenOnWay: (d.down || []).filter(i => prefix.has(i)).length, down: (d.down || []).length };
  if (tray.max !== 3 - (targets.trayRoom ?? 1)) flag('target', `tray max ${tray.max}, requested ${3 - (targets.trayRoom ?? 1)}`);
  if (out.targets.hiddenOnWay < (targets.hiddenOnWay ?? 0)) flag('target', `hidden on way ${out.targets.hiddenOnWay}, requested at least ${targets.hiddenOnWay}`);
  if (out.targets.down > Math.round((targets.maxDown ?? 0.3) * n)) flag('target', 'face-down share exceeds maximum');
  if (targets.three != null && Math.abs(tray.three - targets.three) > 1) flag('target', `three waiting ${tray.three}, requested ${targets.three} within 1`);
  if (targets.luck != null && Math.abs(tray.luck - targets.luck) > 1) flag('target', `luck ${tray.luck}, requested ${targets.luck} within 1`);
  if (brief.frame?.way != null && (!cs || Math.abs(cs.k - brief.frame.way) > 1)) flag('target', `clock way ${cs && cs.k}, requested ${brief.frame.way} within 1`);
  if (brief.frame?.depth != null && B.context(d.tiles).above[d.clock.i].size !== brief.frame.depth) flag('target', 'clock depth differs from brief');
  if (targets.traps > 0) {
    const gx = E.game(copy()), s = E.start(gx), faces = new Set(); let proven = 0;
    for (const i of E.legal(gx, s).filter(a => typeof a === 'number')) {
      if (faces.has(d.faces[i]) || E.kindOf(gx, s, i) !== 'pair') continue;
      faces.add(d.faces[i]); const next = E.step(gx, s, i);
      if (!next || E.winnable(gx, next, WIN_BUDGET).result === 'lose') proven++;
    }
    out.targets.traps = proven;
    if (proven < targets.traps) flag('target', `proven decision traps ${proven}, requested at least ${targets.traps}`);
  }
  // (d) idle specials
  const story = STORIES[brief.story] || { spec: {} }, holdKind = story.spec.coverPartners;
  const sol = d.solution || [], ci = sol.indexOf(d.clock.i);
  const aliveAtClock = new Uint8Array(n).fill(1); for (let p = 0; p <= ci && p < sol.length; p++) aliveAtClock[sol[p]] = 0;
  const facesOnWay = new Set(sol.slice(0, ci + 1).map(i => d.faces[i]));
  const takeable = (i, al, r) => r ? L.takeable(i, al, nb, r, all) : L.isFree(i, al, nb);
  const specials = (keys.length === 2 ? locks.map(i => ['lock', i]) : []).concat(Object.keys(ob.ice || {}).filter(i => ob.ice[i] > 0).map(i => ['ice', +i]));
  out.specials = [];
  for (const [kind, i] of specials) {
    const x = copy(); x.clock = { i: d.clock.i, n: 999 }; x.solution = null;
    if (kind === 'lock') { x.obst.locks = x.obst.locks.filter(j => j !== i); if (!x.obst.locks.length) x.obst.keys = []; }
    else delete x.obst.ice[i];
    const r = cs ? E.clockShortest(E.game(x), SPECIAL_BUDGET) : null;
    const e = { special: kind + ' ' + i, clock: i === d.clock.i, k: r ? r.k : null, unsure: !!(r && r.unsure),
      holderStory: holdKind === 'locked' && kind === 'lock' || holdKind === 'frozen' && kind === 'ice' };
    if (!r) e.verdict = 'unresolved';
    else if (r.k < cs.k) e.verdict = 'works';
    else {
      const held = !!aliveAtClock[i] && !takeable(i, aliveAtClock, rules), twin = facesOnWay.has(d.faces[i]);
      e.held = held; e.twinOnWay = twin;
      e.verdict = e.holderStory && held && twin ? 'holder' : 'idle';
    }
    out.specials.push(e);
    if (e.verdict === 'idle') flag('idle', `${e.special}${e.clock ? ' (the clock)' : ''}${e.holderStory ? ' (a holder that holds no twin of a tile taken on the way)' : ''}: fewest way stays ${r.k} without it` + (e.held !== undefined ? `, held at the clock ${e.held}, twin on the way ${e.twinOnWay}` : ''));
    if (e.verdict === 'unresolved') flag('idleUnresolved', e.special);
  }
  out.idle = out.specials.filter(e => e.verdict === 'idle').length;
  return out;
}

// one brief, one seed: build + checks
function runOne(brief, seed, opts = {}) {
  const B = require('./builder.js');
  const b = { ...brief, seed };
  const t0 = Date.now(), cpu0 = process.threadCpuUsage ? process.threadCpuUsage() : null; let r;
  try { r = B.build(b, { ms: opts.ms ?? 15000 }); } catch (e) { r = { fail: 'crash', detail: String(e && e.stack || e).split('\n').slice(0, 3).join(' | '), ms: Date.now() - t0 }; }
  const cpu = cpu0 ? process.threadCpuUsage(cpu0) : null;
  // ms: the builder's own clock (wall time: other jobs on the machine slow it); cpuMs: this thread's CPU time
  const rec = { id: brief.id, story: brief.story, layout: brief.layout, seed, ms: r.ms ?? (Date.now() - t0), cpuMs: cpu ? Math.round((cpu.user + cpu.system) / 1000) : null, wall: Date.now() - t0 };
  if (r.fail) return { ...rec, ok: false, fail: r.fail, detail: r.detail ?? null, fails: r.fails || {} };
  rec.ok = true;
  rec.intents = r.intents.map(x => ({ name: x.name, proven: !!x.proven, detail: x.detail ?? null }));
  rec.card = r.card; rec.roles = r.roles; rec.design = r.design;
  const c0 = Date.now();
  try { rec.check = checkDesign(r.design, b); } catch (e) { rec.check = { problems: [{ kind: 'checkCrash', detail: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }] }; }
  rec.checkMs = Date.now() - c0;
  return rec;
}

// ---------- the summary ----------
const intentKind = name => name.replace(/\(.*?\)/g, '').replace(/:.*$/, '').replace(/\d+/g, 'N').trim();
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
function dist(vals) {
  const v = vals.filter(x => x != null), h = {};
  for (const x of v) h[x] = (h[x] || 0) + 1;
  return { n: v.length, missing: vals.length - v.length, median: median(v), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, hist: h };
}
function summarize(recs, briefs) {
  const S = {}, ok = recs.filter(r => r.ok);
  S.builds = { ok: ok.length, total: recs.length, rate: pct(ok.length, recs.length) };
  const byBrief = {}; for (const r of recs) (byBrief[r.id] = byBrief[r.id] || []).push(r);
  const bIds = Object.keys(byBrief);
  S.briefs = { total: bIds.length, anySeed: bIds.filter(id => byBrief[id].some(r => r.ok)).length, allSeeds: bIds.filter(id => byBrief[id].every(r => r.ok)).length };
  S.briefs.anyRate = pct(S.briefs.anySeed, S.briefs.total); S.briefs.allRate = pct(S.briefs.allSeeds, S.briefs.total);
  const group = (key) => { const o = {}; for (const r of recs) { const k = key(r); const e = o[k] = o[k] || { ok: 0, total: 0 }; e.total++; if (r.ok) e.ok++; } for (const k in o) o[k].rate = pct(o[k].ok, o[k].total); return o; };
  const bmap = Object.fromEntries(briefs.map(b => [b.id, b]));
  S.byStory = group(r => r.story);
  S.byTrayRoom = group(r => 'trayRoom ' + bmap[r.id].targets.trayRoom);
  S.byHidden = group(r => 'hiddenOnWay ' + bmap[r.id].targets.hiddenOnWay);
  S.bySpare = group(r => 'spare ' + bmap[r.id].frame.spare);
  S.byStage = group(r => 'stage ' + bmap[r.id].stage);
  S.byDepthPinned = group(r => bmap[r.id].frame.depth != null ? 'depth pinned' : 'depth free');
  S.bySize = group(r => (bmap[r.id] && require('./builder.js').LAYOUTS[bmap[r.id].layout].n >= 96) ? '96 tiles' : 'under 96');
  const ms = recs.map(r => r.ms), okMs = ok.map(r => r.ms), failMs = recs.filter(r => !r.ok).map(r => r.ms);
  S.time = { all: { median: median(ms), p90: quant(ms, 0.9), max: Math.max(...ms) }, ok: { median: median(okMs), p90: quant(okMs, 0.9), max: okMs.length ? Math.max(...okMs) : null },
    fail: { median: median(failMs), p90: quant(failMs, 0.9), max: failMs.length ? Math.max(...failMs) : null }, over5s: recs.filter(r => r.ms > GATE.ms).map(r => `${r.id} s${r.seed} ${r.ms} ms ${r.ok ? 'ok' : r.fail}`),
    check: { median: median(ok.map(r => r.checkMs)), max: ok.length ? Math.max(...ok.map(r => r.checkMs)) : null } };
  const cpu = recs.map(r => r.cpuMs).filter(x => x != null);
  S.time.cpu = { median: median(cpu), p90: quant(cpu, 0.9), max: cpu.length ? Math.max(...cpu) : null, over5s: recs.filter(r => r.cpuMs > GATE.ms).map(r => `${r.id} s${r.seed} ${r.cpuMs} ms CPU (${r.ms} ms wall) ${r.ok ? 'ok' : r.fail}`) };
  // why builds fail: the last stage, and every attempt's stage
  S.failStage = {}; S.failAttempts = {};
  for (const r of recs.filter(r => !r.ok)) {
    const e = S.failStage[r.fail] = S.failStage[r.fail] || { count: 0, examples: [] }; e.count++;
    if (e.examples.length < 8) e.examples.push({ id: r.id, seed: r.seed, detail: r.detail, attempts: r.fails });
    for (const k in r.fails) S.failAttempts[k] = (S.failAttempts[k] || 0) + r.fails[k];
  }
  // intents
  S.intents = {};
  for (const r of ok) for (const it of r.intents) { const k = intentKind(it.name), e = S.intents[k] = S.intents[k] || { proven: 0, total: 0, unproven: [] }; e.total++; if (it.proven) e.proven++; else if (e.unproven.length < 30) e.unproven.push({ id: r.id, seed: r.seed, name: it.name, detail: it.detail }); }
  for (const k in S.intents) S.intents[k].rate = pct(S.intents[k].proven, S.intents[k].total);
  S.allIntentsProven = { ok: ok.filter(r => r.intents.every(i => i.proven)).length, total: ok.length };
  // static checks
  S.checks = {}; const kinds = ['replay', 'clock', 'downFree', 'idle', 'idleUnresolved', 'faces', 'specials', 'target', 'checkCrash'];
  for (const k of kinds) S.checks[k] = { builds: 0, count: 0, examples: [] };
  for (const r of ok) { const seen = new Set(); for (const p of r.check.problems) { const e = S.checks[p.kind] = S.checks[p.kind] || { builds: 0, count: 0, examples: [] }; e.count++; if (!seen.has(p.kind)) { e.builds++; seen.add(p.kind); } if (e.examples.length < 10) e.examples.push({ id: r.id, seed: r.seed, detail: p.detail }); } }
  S.clean = ok.filter(r => !r.check.problems.length).length;
  S.strictValid = { ok: ok.filter(r => r.check.strict).length, total: ok.length };
  S.peekPairsInWitness = ok.filter(r => r.check.replay && r.check.replay.pairs > 0).length;
  S.clockGameLenient = ok.filter(r => r.check.clock && r.check.clock.kPerTile != null && r.check.clock.k < r.check.clock.kPerTile).map(r => `${r.id} s${r.seed}: per-tile ${r.check.clock.kPerTile}, game ${r.check.clock.k}`);
  S.clockProofs = { winAtK: ok.filter(r => r.check.clock && r.check.clock.winAtK === 'win').length, loseAtKminus1: ok.filter(r => r.check.clock && r.check.clock.atKminus1 === 'lose').length, unknownAtKminus1: ok.filter(r => r.check.clock && r.check.clock.atKminus1 === 'unknown').length };
  const sp = ok.flatMap(r => r.check.specials || []), v = {}; for (const e of sp) v[e.verdict] = (v[e.verdict] || 0) + 1;
  S.specials = { total: sp.length, verdicts: v, idleHolders: sp.filter(e => e.verdict === 'idle' && e.holderStory).length, idleOther: sp.filter(e => e.verdict === 'idle' && !e.holderStory).length,
    holderSpecials: sp.filter(e => e.holderStory).length, idleOtherBuilds: ok.filter(r => (r.check.specials || []).some(e => e.verdict === 'idle' && !e.holderStory)).map(r => `${r.id} s${r.seed}`) };
  // the card values that matter for difficulty
  const C = ok.map(r => r.card);
  S.card = {
    fewestMoves: dist(C.map(c => c.clock.fewestMoves)), clockN: dist(C.map(c => c.clock.n)), clockDepth: dist(C.map(c => c.clock.depth)),
    three: dist(C.map(c => c.tray.three)), trayMax: dist(C.map(c => c.tray.max)), luck: dist(C.map(c => c.tray.luck)),
    forced: dist(C.map(c => c.tray.forced)), trapPoints: dist(C.map(c => c.traps ? c.traps.points : null)), tempting: dist(C.map(c => c.traps ? c.traps.tempting : null)),
    faceDown: dist(C.map(c => c.faceDown)), faceDownOnDig: dist(C.map(c => c.faceDownOnDig)), dig: dist(C.map(c => c.dig)),
  };
  S.cardByStory = {};
  for (const st of Object.keys(S.byStory)) { const cs = ok.filter(r => r.story === st).map(r => r.card); S.cardByStory[st] = cs.length ? { builds: cs.length, fewest: median(cs.map(c => c.clock.fewestMoves)), three: median(cs.map(c => c.tray.three)), luck: median(cs.map(c => c.tray.luck)), forced: cs.filter(c => c.tray.forced != null).length, trapPoints: median(cs.map(c => c.traps ? c.traps.points : 0)), tempting: median(cs.map(c => c.traps ? c.traps.tempting : 0)) } : null; }
  // what the brief asked against what came out: tray cap and face-down tiles on the dig
  S.targets = { trayCapReached: ok.filter(r => r.card.tray.max === 3 - (bmap[r.id].targets.trayRoom ?? 1)).length, hiddenOnWayMet: ok.filter(r => r.card.faceDownOnDig >= (bmap[r.id].targets.hiddenOnWay ?? 1)).length, total: ok.length };
  S.gate = {
    buildRatePerSeed: S.builds.rate >= 100 * GATE.buildRate, buildRateAnySeed: S.briefs.anyRate >= 100 * GATE.buildRate,
    under5s: S.time.over5s.length === 0, everyIntentProven: S.allIntentsProven.ok === S.allIntentsProven.total, noIdleSpecial: S.checks.idle.count === 0,
    staticClean: S.clean === ok.length,
  };
  S.gate.pass = S.gate.buildRatePerSeed && S.gate.buildRateAnySeed && S.gate.under5s && S.gate.everyIntentProven && S.gate.noIdleSpecial && S.gate.staticClean;
  return S;
}
function summaryMd(S, meta) {
  const L = [], row = (...c) => L.push('| ' + c.join(' | ') + ' |'), yes = b => b ? 'yes' : 'NO';
  L.push(`# Gate summary (${meta.tag}), generated by gate.js`, '', `Briefs: ${meta.briefs}, seeds ${meta.seeds.join(',')}, jobs ${meta.jobs}, wall ${Math.round(meta.wallMs / 1000)} s.`, '');
  L.push(`Builds: ${S.builds.ok} of ${S.builds.total} (${S.builds.rate}%). Briefs built for at least one seed: ${S.briefs.anySeed} of ${S.briefs.total} (${S.briefs.anyRate}%); for every seed: ${S.briefs.allSeeds} (${S.briefs.allRate}%).`, '');
  L.push('## Gate', '', '| test | result |', '|---|---|');
  row('>= 90% of builds (all seeds)', yes(S.gate.buildRatePerSeed) + ` (${S.builds.rate}%)`); row('>= 90% of briefs (any seed)', yes(S.gate.buildRateAnySeed) + ` (${S.briefs.anyRate}%)`);
  row('every build under 5 s', yes(S.gate.under5s) + ` (${S.time.over5s.length} over)`); row('every intent proven', yes(S.gate.everyIntentProven) + ` (${S.allIntentsProven.ok} of ${S.allIntentsProven.total} builds)`);
  row('no idle special', yes(S.gate.noIdleSpecial) + ` (${S.checks.idle.count} in ${S.checks.idle.builds} builds)`); row('static checks clean', yes(S.gate.staticClean) + ` (${S.clean} of ${S.builds.ok})`);
  L.push('', '## Build rate', '', '| group | built | of | % |', '|---|---|---|---|');
  for (const G of [S.byStory, S.byTrayRoom, S.byHidden, S.bySpare, S.byStage, S.byDepthPinned, S.bySize]) for (const k in G) row(k, G[k].ok, G[k].total, G[k].rate);
  L.push('', '## Time per build (ms)', '', `all: median ${S.time.all.median}, p90 ${S.time.all.p90}, max ${S.time.all.max}; built: median ${S.time.ok.median}, p90 ${S.time.ok.p90}, max ${S.time.ok.max}; failed: median ${S.time.fail.median}, p90 ${S.time.fail.p90}, max ${S.time.fail.max}. Checks: median ${S.time.check.median}, max ${S.time.check.max}.`, '');
  for (const x of S.time.over5s) L.push('- over 5 s: ' + x);
  L.push('', `CPU time per build (this thread only): median ${S.time.cpu.median}, p90 ${S.time.cpu.p90}, max ${S.time.cpu.max}; over 5 s of CPU: ${S.time.cpu.over5s.length}.`);
  for (const x of S.time.cpu.over5s) L.push('- over 5 s CPU: ' + x);
  L.push('', '## Why builds fail (last stage)', '');
  for (const [k, e] of Object.entries(S.failStage).sort((a, b) => b[1].count - a[1].count)) { L.push(`- **${k}**: ${e.count}`); for (const x of e.examples) L.push(`  - ${x.id} seed ${x.seed}${x.detail ? ': ' + x.detail : ''} (attempts: ${JSON.stringify(x.attempts)})`); }
  L.push('', 'Every failed attempt (16 per build): ' + JSON.stringify(S.failAttempts), '');
  L.push('## Intents', '', '| intent | proven | of | % |', '|---|---|---|---|');
  for (const k in S.intents) row(k, S.intents[k].proven, S.intents[k].total, S.intents[k].rate);
  for (const k in S.intents) for (const x of S.intents[k].unproven) L.push(`- not proven: ${x.id} seed ${x.seed}: ${x.name} (${x.detail})`);
  L.push('', '## Static checks', '', '| check | builds | problems |', '|---|---|---|');
  for (const k in S.checks) row(k, S.checks[k].builds, S.checks[k].count);
  for (const k in S.checks) for (const x of S.checks[k].examples) L.push(`- ${k}: ${x.id} seed ${x.seed}: ${x.detail}`);
  L.push('', `Idle specials: ${S.specials.idleHolders} unused holders (of ${S.specials.holderSpecials} holder specials), ${S.specials.idleOther} other` + (S.specials.idleOtherBuilds.length ? ' (' + S.specials.idleOtherBuilds.join('; ') + ')' : '') + '.');
  L.push('', `Specials checked: ${S.specials.total} ${JSON.stringify(S.specials.verdicts)}. Strict validSolution: ${S.strictValid.ok} of ${S.strictValid.total}; witnesses with a peek pair: ${S.peekPairsInWitness}.`);
  L.push(`Clock proofs: winnable at n = k ${S.clockProofs.winAtK}, lost at n = k - 1 ${S.clockProofs.loseAtKminus1}, unknown at k - 1 ${S.clockProofs.unknownAtKminus1}. Game's lenient clock (after a whole action) one move cheaper: ${S.clockGameLenient.length}` + (S.clockGameLenient.length ? ' (' + S.clockGameLenient.slice(0, 6).join('; ') + ')' : ''));
  L.push(`Targets: tray reached its cap on ${S.targets.trayCapReached} of ${S.targets.total}; face-down tiles on the dig as asked on ${S.targets.hiddenOnWayMet} of ${S.targets.total}.`, '');
  L.push('## Card values', '', '| value | median | min | max | counts |', '|---|---|---|---|---|');
  for (const k in S.card) row(k, S.card[k].median, S.card[k].min, S.card[k].max, JSON.stringify(S.card[k].hist) + (S.card[k].missing ? ` (${S.card[k].missing} none)` : ''));
  L.push('', '| story | builds | fewest | 3 waiting | luck | forced | trap points | tempting |', '|---|---|---|---|---|---|---|---|');
  for (const k in S.cardByStory) { const c = S.cardByStory[k]; if (c) row(k, c.builds, c.fewest, c.three, c.luck, c.forced, c.trapPoints, c.tempting); else row(k, 0, '', '', '', '', '', ''); }
  return L.join('\n') + '\n';
}

// ---------- worker ----------
if (!isMainThread && require.main === module) {
  parentPort.on('message', m => {
    if (m.stop) process.exit(0);
    parentPort.postMessage(runOne(m.brief, m.seed, m.opts));
  });
}

// ---------- main ----------
function arg(name, def) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; }
async function main() {
  if (process.argv.includes('--make-briefs')) {
    const briefs = makeBriefs(), file = path.join(HERE, 'briefs-v1.json');
    fs.writeFileSync(file, '[\n' + briefs.map(b => '  ' + JSON.stringify(b)).join(',\n') + '\n]\n');
    const st = {}; for (const b of briefs) st[b.story] = (st[b.story] || 0) + 1;
    const lay = {}; for (const b of briefs) lay[b.layout] = (lay[b.layout] || 0) + 1;
    console.log(`${briefs.length} briefs -> ${file}\nper story ${JSON.stringify(st)}\nlayouts used ${Object.keys(lay).length} of 48, twice: ${Object.keys(lay).filter(k => lay[k] > 1).join(',')}`);
    return;
  }
  if (process.argv.includes('--summary')) {          // node gate.js --summary results-v1.json [briefs.json]: re-summarise only
    const rf = arg('--summary'), res = JSON.parse(fs.readFileSync(fs.existsSync(rf) ? rf : path.join(OUT, rf), 'utf8'));
    const bf = process.argv.slice(2).find(a => a.endsWith('.json') && a !== rf) || path.join(HERE, 'briefs-v1.json');
    res.meta.tag = path.basename(rf, '.json').replace(/^results-/, '');      // the file name decides where it goes
    const S = summarize(res.records, JSON.parse(fs.readFileSync(bf, 'utf8'))), md = summaryMd(S, res.meta);
    fs.writeFileSync(path.join(OUT, `summary-${res.meta.tag}.json`), JSON.stringify({ meta: res.meta, summary: S }, null, 1));
    fs.writeFileSync(path.join(OUT, `summary-${res.meta.tag}.md`), md);
    console.log(md); return;
  }
  const file = process.argv.slice(2).find(a => a.endsWith('.json')) || path.join(HERE, 'briefs-v1.json');
  let briefs = JSON.parse(fs.readFileSync(file, 'utf8'));
  const only = arg('--only'); if (only) { const set = new Set(only.split(',')); briefs = briefs.filter(b => set.has(b.id)); }
  const seeds = arg('--seeds', '1,2,3').split(',').map(Number), jobs = Math.max(1, +arg('--jobs', 2)), ms = +arg('--ms', 15000);
  const tag = arg('--tag', path.basename(file, '.json').replace(/^briefs-/, ''));
  const queue = []; for (const b of briefs) for (const s of seeds) queue.push({ brief: b, seed: s, opts: { ms } });
  const total = queue.length, recs = [], t0 = Date.now();
  await new Promise((resolve, reject) => {
    let live = 0;
    for (let w = 0; w < Math.min(jobs, total); w++) {
      const wk = new Worker(__filename); live++;
      const next = () => { const job = queue.shift(); if (job) wk.postMessage(job); else { wk.postMessage({ stop: true }); } };
      wk.on('message', r => {
        recs.push(r);
        const c = r.check, probs = c ? c.problems.map(p => p.kind) : [];
        console.log(`[${recs.length}/${total}] ${r.id} s${r.seed} ${r.ok ? 'ok' : 'FAIL ' + r.fail} ${r.ms} ms` + (r.ok ? ` intents ${r.intents.filter(i => i.proven).length}/${r.intents.length}` + (probs.length ? ' problems ' + probs.join(',') : '') : ''));
        next();
      });
      wk.on('error', reject);
      wk.on('exit', () => { if (--live === 0) resolve(); });
      next();
    }
  });
  const order = new Map(briefs.map((b, k) => [b.id, k]));
  recs.sort((a, b) => order.get(a.id) - order.get(b.id) || a.seed - b.seed);
  fs.mkdirSync(OUT, { recursive: true });
  const meta = { tag, briefs: briefs.length, seeds, jobs, ms, wallMs: Date.now() - t0, date: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, `results-${tag}.json`), JSON.stringify({ meta, records: recs }));
  const S = summarize(recs, briefs);
  fs.writeFileSync(path.join(OUT, `summary-${tag}.json`), JSON.stringify({ meta, summary: S }, null, 1));
  const md = summaryMd(S, meta);
  fs.writeFileSync(path.join(OUT, `summary-${tag}.md`), md);
  console.log('\n' + md);
}
if (isMainThread && require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { makeBriefs, checkDesign, runOne, summarize, summaryMd, intentKind };
