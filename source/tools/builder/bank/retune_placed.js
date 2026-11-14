'use strict';
/* retune_placed.js: apply the retune (bank/retune.js) to the chain-batch boards placed in 250-302 and write the result as source/analysis/builder/bank/placed-250-retuned/
   (level-<n>.json in the format of placed-250: { level, source, score, design }; older boards copied unchanged) plus retune.md and retune.json.
     node source/tools/builder/bank/retune_placed.js [--in placed-250] [--out placed-250-retuned] [--workers 4]                                                                  */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../../../..'), BANK = path.join(ROOT, 'source/analysis/builder/bank');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const IN = path.join(BANK, arg('in', 'placed-250')), OUT = path.join(BANK, arg('out', 'placed-250-retuned')), SCR = path.join(OUT, '_work');
const levels = () => fs.readdirSync(IN).filter(f => /^level-\d+\.json$/.test(f)).map(f => +f.match(/\d+/)[0]).sort((a, b) => a - b);
function one(lv) {
  const R = require('./retune.js'), M = require('./make_batch.js'), j = JSON.parse(fs.readFileSync(path.join(IN, `level-${lv}.json`), 'utf8')), m = /^batch (\d+)/.exec(j.source);
  const out = { level: lv, source: j.source };
  if (!m) { out.kept = 'older board, copied unchanged'; return out; }
  const bf = [path.join(BANK, 'batch-250-289', `level-${m[1]}.json`), path.join(BANK, 'batch-250-289', 'rejected', `level-${m[1]}.json`)].find(x => fs.existsSync(x)), b = JSON.parse(fs.readFileSync(bf, 'utf8')), pid = b.card.poolId, tier = pid.split('-').pop(), jobFile = pid.slice(0, pid.length - tier.length - 1) + '.json';
  let jf = null; for (const d of ['batch-pool', 'batch-pool-2']) { const f = path.join(ROOT, 'source/build/traps', d, jobFile); if (fs.existsSync(f)) { jf = f; break; } }
  if (!jf) { out.kept = 'pool record not found: ' + jobFile; return out; }
  const job = JSON.parse(fs.readFileSync(jf, 'utf8')).job, before = { score: j.score, tail: b.card.tail.after.tailGreedyWin, down: b.design.down.length, tiles: b.design.tiles.length };
  // the placed design may be the batch design (same file); use the placed design as the board to retune
  const v = { tier, design: j.design, card: b.card }; let res = null; const tried = [];
  for (const seed of [1, 2]) { res = R.retuneRecord(job, v, { level: lv, tier, seed, wallMs: 40000, totalMs: 500000 }); tried.push(seed + ': ' + (res.ok ? 'ok' : String(res.why).slice(0, 60))); if (res.ok) break; }   // another seed when the tail does not reach the band (the tuner and the face-down choice are seeded)
  out.before = before; out.job = job; out.tier = tier; out.tried = tried;
  if (!res.ok) { out.kept = 'not retuned: ' + res.why; return out; }
  out.after = { score: res.score, tail: res.tail, inBand: res.inBand, down: res.design.down.length, occ: res.card.tailPressure, retune: res.retune, needle: res.needle, pressureMiss: res.pressureMiss };
  out.design = res.design; return out;
}
function main() {
  fs.mkdirSync(SCR, { recursive: true });
  if (process.argv.includes('--one')) { const lv = +arg('one'); const o = one(lv); fs.writeFileSync(path.join(SCR, `r-${lv}.json`), JSON.stringify(o)); console.log(lv, o.kept || `tail ${o.before.tail} -> ${o.after.tail} down ${o.before.down} -> ${o.after.down} score ${o.before.score} -> ${o.after.score}`); return; }
  if (process.argv.includes('--table')) return table();
  const W = +arg('workers', 4), todo = levels().filter(lv => !fs.existsSync(path.join(SCR, `r-${lv}.json`))); let next = 0, run = 0;
  const go = () => { while (run < W && next < todo.length) { const lv = todo[next++]; run++; const c = cp.spawn(process.execPath, [__filename, '--one', String(lv), '--in', arg('in', 'placed-250'), '--out', arg('out', 'placed-250-retuned')], { stdio: 'inherit' }); c.on('exit', () => { run--; if (next >= todo.length && !run) table(); else go(); }); } };
  if (!todo.length) table(); else go();
}
function table() {
  const rows = [], placedMd = fs.readFileSync(path.join(IN, 'placed.md'), 'utf8');
  for (const lv of levels()) {
    const j = JSON.parse(fs.readFileSync(path.join(IN, `level-${lv}.json`), 'utf8')), f = path.join(SCR, `r-${lv}.json`), o = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { level: lv, kept: 'not run' };
    const nj = o.design ? { level: lv, source: j.source, score: o.after.score, design: o.design } : j; fs.writeFileSync(path.join(OUT, `level-${lv}.json`), JSON.stringify(nj));
    rows.push(o);
  }
  const fmt = x => x == null ? '' : x, pc = o => o.after && o.after.occ ? o.after.occ.share.join('/') + ' (run ' + o.after.occ.longest2plus + ')' : '';
  const md = ['# Retune of the placed levels 250-302 (the part after the trap harder)', '', 'Dennis 2026-11-14 (lab 6, level 250): "After the trap tray pressure may increase. Its too easy after. Maybe more face down as well after the trap" / "Dont overdo on tray pressure. 1 in tray is enough after a hard trap."',
    'Tail = share of careless greedy playouts that clear the board after the clock (lower = harder). Band: std 0.10-0.28 (the window moves down the ramp: 0.19-0.28 at 250, 0.10-0.17 at 302), hard tier 0.06-0.18 (was 0.15-0.40 / 0.08-0.22). Face-down = share of all tiles; the extra ones lie after the clock only.',
    'Pressure = share of tail steps of the stored route with 0/1/2/3 tiles waiting in the tray, and the longest stretch with 2+ waiting (stored route before: see retune.json). The stored tail order is re-searched to keep about one tile waiting.', '',
    '| level | source | tail before | tail after | face-down before | face-down after | score before | score after | waiting 0/1/2/3 after | note |', '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(o => o.after ? `| ${o.level} | ${o.source} | ${o.before.tail} | ${o.after.tail}${o.after.inBand ? '' : ' (out of band)'} | ${(o.before.down / o.before.tiles).toFixed(3)} | ${(o.after.down / o.before.tiles).toFixed(3)} | ${o.before.score} | ${o.after.score} | ${pc(o)} | ${(o.after.retune.notes || []).join('; ')} |` : `| ${o.level} | ${o.source} | | | | | | | | ${fmt(o.kept)} |`)];
  fs.writeFileSync(path.join(OUT, 'retune.md'), md.join('\n') + '\n'); fs.writeFileSync(path.join(OUT, 'retune.json'), JSON.stringify(rows.map(o => ({ ...o, design: undefined })), null, 1));
  // placed.md: the scores of the retuned boards
  let pm = placedMd; for (const o of rows) if (o.after) pm = pm.replace(new RegExp(`^\\| ${o.level} \\| ([^|]*)\\| ([^|]*)\\| ([^|]*)\\| ${o.before.score.toFixed ? o.before.score.toFixed(2) : o.before.score} \\|`, 'm'), (m, a, b, c) => `| ${o.level} | ${a}| ${b}| ${c}| ${o.after.score} |`);
  fs.writeFileSync(path.join(OUT, 'placed.md'), pm.replace('# Levels 250-302', '# Levels 250-302 (retuned: harder after the trap)'));
  console.log('written', OUT, rows.filter(o => o.after).length, 'retuned,', rows.filter(o => o.kept).length, 'kept');
}
if (require.main === module) main();
