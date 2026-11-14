'use strict';
// Independent acceptance checks: no trap_stories, rebuild, or story proof.
// node .../verify_pressure.js <out.json> <folder> [<folder> ...]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const E = require('../engine.js'), Tl = require('./tail.js'), SEP = require('./separate.js');
const crypto = require('crypto');
const { tileVisibility } = require('../../sim/refit/human_board_visibility.js');
const ROOT = path.resolve(__dirname, '../../../..');
function baseFile(rel) {
  try { return JSON.parse(cp.execFileSync('git', ['show', '3ee1f45b:' + rel.replace(/\\/g, '/')], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { return null; }
}
function cardOf(j) {
  if (j.card || j.pressureCard) return j.card || j.pressureCard;
  const m = /^batch (\d+)/.exec(j.source || ''); if (!m) return null;
  for (const sub of ['', 'rejected']) {
    const f = path.join(ROOT, 'source/analysis/builder/bank/batch-250-289', sub, `level-${m[1]}.json`);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).card;
  }
  return null;
}
function witness(d, p, cap) {
  const g = E.game(d); let s = E.start(g), episodes = 0, peak = 0;
  for (const a of p) {
    let t; try { t = E.step(g, s, a); } catch (e) { return { ok: false, why: e.message }; }
    if (!t) return { ok: false, why: 'witness loses' };
    if (t.clockTaken) {
      peak = Math.max(peak, t.tray.length);
      if ((!s.clockTaken || s.tray.length < 2) && t.tray.length >= 2) episodes++;
      if (t.tray.length > cap) return { ok: false, why: 'witness exceeds cap' };
    }
    s = t;
  }
  return { ok: E.won(g, s), peak, episodes };
}
function check(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8')), d = j.design, c = cardOf(j), n = d.tiles.length;
  const rel = path.relative(ROOT, file), original = baseFile(rel), errors = [], notes = [];
  const rp = E.replay(d, d.solution, { strict: true }); if (!rp.ok) errors.push('strict replay: ' + rp.why);
  const cs = E.clockShortest(E.game(structuredClone(d)), { nodes: 600000, ms: 8000, finishNodes: 200000, finishMs: 2000 });
  if (!cs || cs.unsure) errors.push('clock minimum unknown');
  else if (c && (cs.k !== c.clock.k || d.clock.n !== cs.k + c.spare)) errors.push('clock/card mismatch');
  if (original) {
    for (const prop of ['tiles', 'clock', 'obst']) if (JSON.stringify(original.design[prop]) !== JSON.stringify(d[prop])) errors.push(prop + ' changed');
    if (!c && JSON.stringify(original.design) !== JSON.stringify(d)) errors.push('liked older board changed');
  }
  let twins = null, roles = null, baits = [];
  if (c) {
    const ice = Object.keys(d.obst?.ice || {}).map(Number), specials = new Set([d.clock.i, ...ice, ...(d.obst?.locks || []), ...(d.obst?.keys || [])]);
    const down = new Set(d.down), T = E.game(d).tiles;
    const v = tileVisibility(T, { alive: new Uint8Array(n).fill(1), down: Uint8Array.from({ length: n }, (_, i) => down.has(i) ? 1 : 0), openPeek: -1 }, null).tiles;
    roles = [...specials].map(i => ({ tile: i, faceUp: !down.has(i), roleVisible: !!v[i].role, pictureVisible: !!v[i].picture }));
    if (roles.some(r => !r.faceUp || !r.roleVisible || !r.pictureVisible)) errors.push('special visibility');
    twins = SEP.summary(SEP.closeTwins(d)); if (twins.visible || twins.share > 0.05) errors.push('twins');
    if (d.down.length / n > 0.30) errors.push('face-down cap');
    // Compare additions against the original placed board, before Claude's
    // first retune. None of them may enter the special/clock route.
    const raw = j.source && baseFile('source/analysis/builder/bank/placed-250/level-' + j.level + '.json');
    if (raw) {
      const oldDown = new Set(raw.design.down), prefix = new Set(d.solution.slice(0, d.solution.indexOf(d.clock.i) + 1));
      if (d.down.some(i => !oldDown.has(i) && (specials.has(i) || prefix.has(i)))) errors.push('extra face-down on trap/route');
    }
    for (const b of c.baits || []) {
      const g = E.game(structuredClone(d)); let s = E.start(g), result;
      try { for (const i of b.tiles) { s = s && E.step(g, s, i); } result = s ? E.winnable(g, s, { nodes: 1000000, ms: 6000 }).result : 'lose'; }
      catch (e) { errors.push('bait illegal at move zero: ' + b.name); result = 'illegal'; }
      baits.push({ name: b.name, tiles: b.tiles, result }); if (result !== 'lose') errors.push('bait not proven losing: ' + b.name + '/' + result);
    }
    if (!baits.length) errors.push('no bait');
  } else notes.push('liked older board: preserved; new chain gates are not imposed');
  const f = Tl.forcedPressure(d, { nodes: n > 88 ? 2000000 : 400000, ms: n > 88 ? 7000 : 2000 }), { solution, path: acts, ...pressure } = f;
  const wp = acts ? witness(d, acts, 2) : null;
  if (wp && !wp.ok) errors.push('pressure witness invalid');
  // Failure to reach the new target is separate from a broken board.
  return { level: j.level, file: rel, boardSha256: crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex'), ok: !errors.length, newTargetMet: f.targetMet, errors, notes, clock: { n: d.clock.n, k: cs?.k, spare: cs ? d.clock.n - cs.k : null }, roles, twins, baits, pressure, witness: wp };
}
function main() {
  const [out, ...dirs] = process.argv.slice(2), rows = [], only = process.env.VERIFY_LEVELS?.split(',').map(Number);
  if (!out || !dirs.length) throw new Error('usage: verify_pressure.js <out.json> <folder> ...');
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  for (const dir of dirs) for (const f of fs.readdirSync(dir).filter(f => /^level-\d+\.json$/.test(f)).sort()) {
    if (only && !only.includes(+f.match(/\d+/)[0])) continue;
    const r = check(path.join(dir, f)); rows.push(r); fs.writeFileSync(out, JSON.stringify(rows, null, 1) + '\n');
    console.log(r.level, r.ok ? 'board verified' : 'FAIL ' + r.errors.join('; '), r.newTargetMet ? 'forced target PASS' : 'forced target not met');
  }
  if (rows.some(r => !r.ok)) process.exitCode = 1;
}
if (require.main === module) main();
module.exports = { check, witness };
