'use strict';
// Apply the forced-tail target to existing placed/batch boards, leaving the
// level table untouched. Invoke through heavy.js; each child has a wall cap.
// node .../pressure_retune.js --levels 302,303 --workers 2 [--ms 60000]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../../../..'), BANK = path.join(ROOT, 'source/analysis/builder/bank');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const OUT = path.resolve(ROOT, arg('results', 'codex-tasks/results/builder-continue-v1/retune-work'));
const folders = ['placed-250-retuned', 'batch-303-342'];
function findLevel(lv) {
  for (const dir of folders) for (const extra of ['', 'rejected']) {
    const f = path.join(BANK, dir, extra, `level-${lv}.json`);
    if (fs.existsSync(f)) return f;
  }
  throw new Error('missing level ' + lv);
}
function metadata(j) {
  if (j.card) return j.card;
  if (j.pressureCard) return j.pressureCard;
  const m = /^batch (\d+)/.exec(j.source || '');
  if (!m) return null;
  for (const sub of ['', 'rejected']) {
    const f = path.join(BANK, 'batch-250-289', sub, `level-${m[1]}.json`);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).card;
  }
  throw new Error('batch metadata missing for ' + j.level);
}
function poolJob(card) {
  const tier = card.poolId.split('-').pop(), file = card.poolId.slice(0, -tier.length - 1) + '.json';
  for (const dir of ['batch-pool', 'batch-pool-2']) {
    const f = path.join(ROOT, 'source/build/traps', dir, file);
    if (fs.existsSync(f)) return { job: JSON.parse(fs.readFileSync(f, 'utf8')).job, tier };
  }
  throw new Error('missing pool job ' + file);
}
const factsOnly = f => { const { solution, path: acts, ...rest } = f; return rest; };
function one(lv) {
  const Tl = require('./tail.js'), F = require('./force_tail.js'), T = require('../trap_stories.js'), R = require('./retune.js'), E = require('../engine.js'), Df = require('./difficulty.js'), SEP = require('./separate.js'), PS = require('../../factory/placement_score.js');
  const f = findLevel(lv), j = JSON.parse(fs.readFileSync(f, 'utf8')), card0 = metadata(j), d = j.design, ms = +arg('ms', 60000);
  const queryNodes = +arg('nodes', d.tiles.length > 88 ? 1500000 : 250000), queryMs = +arg('query-ms', d.tiles.length > 88 ? 4000 : 1200);
  const before = Tl.forcedPressure(d, { scope: 'board', nodes: queryNodes, ms: queryMs });
  const base = { level: lv, file: path.relative(ROOT, f), before: factsOnly(before), downBefore: d.down.length / d.tiles.length, tailBefore: Tl.measure(d, { seed: 977, playouts: 800 }).tailGreedyWin };
  if (!card0) return { ...base, ok: false, kept: 'liked older board kept unchanged' };
  const { job, tier } = poolJob(card0), band = R.BANDS[tier] || R.BANDS.std;
  if (before.targetMet && base.tailBefore >= band[0] && base.tailBefore <= band[1]) {
    j.forcedTail = factsOnly(before); fs.writeFileSync(f, JSON.stringify(j, null, j.card ? 1 : 0));
    return { ...base, ok: true, changed: false, after: factsOnly(before), tailAfter: base.tailBefore, downAfter: base.downBefore, score: j.score || j.difficulty?.score };
  }
  const rb = R.rebuild(job, d); if (!rb.r) return { ...base, ok: false, why: rb.why };
  const r = rb.r, k = r.card.clock.fewestMoves, spare = r.card.clock.spare;
  let lastProof = null;
  const validate = design => {
    if (!E.replay(design, design.solution, { strict: true }).ok) return { ok: false, why: 'replay' };
    const cs = E.clockShortest(E.game(design), { nodes: 300000, ms: 3000, finishNodes: 100000, finishMs: 1000 });
    if (!cs || cs.unsure || cs.k !== k) return { ok: false, why: 'clock:' + (cs && cs.k) };
    if (!PS.readable(design)) return { ok: false, why: 'readable' };
    const rp = T.reprove('chain', design, r.roles, r.brief, spare, k);
    if (rp.ok) lastProof = rp.proof.card;
    return rp;
  };
  const res = F.tune(d, { ms, seed: +arg('seed', 1), band, freeze: r.roles.bait.tiles, validate, queryMs, nodes: queryNodes, escalate: process.argv.includes('--escalate') });
  const stats = { proposals: res.proposals, checked: res.checked, openedFreeze: res.openedFreeze, failures: res.failures, ms: res.ms };
  if (!res.ok) {
    if (res.candidate) { const dir = path.join(OUT, 'candidates'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `level-${lv}.json`), JSON.stringify(res.candidate)); }
    return { ...base, ok: false, why: 'forced target not reached within budget', stats };
  }
  const fin = res.design, press = T.pressureFacts(fin), card = structuredClone(card0);
  delete card.difficultyFacts;
  card.trap = lastProof;
  card.baits = lastProof.baits.map(b => ({ name: b.name, tiles: b.tiles, provenResult: b.result, provenCost: b.cost, value: b.value, controlValue: lastProof.control.value }));
  card.control = lastProof.control;
  card.boardKey = require('../../factory/meter.js').boardKey(fin);
  card.tail = { ...card.tail, band, inBand: true, after: Tl.measure(fin, { seed: 977, playouts: 800 }) };
  card.firstMoves = { winning: press.firstMoves.winning, legal: press.firstMoves.legal, losingOrUnknownTiles: press.firstMoves.rows, unknown: press.firstMoves.unknown, atLeast3: press.firstMoves.atLeast3 };
  card.forcedTail = factsOnly(res.after); card.tailPressure = Tl.occupancy(fin);
  card.closeTwins = { ...card.closeTwins, final: SEP.summary(SEP.closeTwins(fin)) };
  const df = Df.score(fin, card, { facts: Df.facts(fin, card, { press, fresh: true }) });
  card.difficulty = df; const nj = { ...j, design: fin, forcedTail: factsOnly(res.after) };
  if (j.card) { nj.card = card; nj.difficulty = df; } else { nj.score = df.score; nj.pressureCard = card; }
  fs.writeFileSync(f, JSON.stringify(nj, null, nj.card ? 1 : 0));
  return { ...base, ok: true, changed: res.edits.length > 0, after: factsOnly(res.after), edits: res.edits, stats, tailAfter: res.tail, downAfter: fin.down.length / fin.tiles.length, score: df.score };
}
function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (arg('one', null)) {
    const lv = +arg('one'); let res;
    try { res = one(lv); } catch (e) { res = { level: lv, ok: false, why: String(e.stack || e) }; }
    fs.writeFileSync(path.join(OUT, `level-${lv}.json`), JSON.stringify(res, null, 1));
    console.log(lv, res.ok ? (res.changed ? 'retuned' : 'already meets target') : res.why || res.kept, JSON.stringify(res.stats || {})); return;
  }
  const levels = String(arg('levels', Array.from({ length: 65 }, (_, i) => i + 250).join(','))).split(',').map(Number), workers = +arg('workers', 2);
  let next = 0, running = 0;
  const go = () => {
    while (running < workers && next < levels.length) {
      const lv = levels[next++], out = path.join(OUT, `level-${lv}.json`);
      if (fs.existsSync(out) && !process.argv.includes('--retry')) continue;
      running++;
      const c = cp.spawn(process.execPath, [__filename, ...process.argv.slice(2), '--one', String(lv)], { stdio: 'inherit' });
      const timer = setTimeout(() => { c.kill(); fs.writeFileSync(out, JSON.stringify({ level: lv, ok: false, why: 'board wall limit' })); }, +arg('child-ms', +arg('ms', 60000) + 180000));
      c.on('exit', () => { clearTimeout(timer); running--; go(); });
    }
  }; go();
}
if (require.main === module) main();
module.exports = { metadata, poolJob, findLevel, one };
