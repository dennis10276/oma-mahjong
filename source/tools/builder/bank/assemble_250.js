#!/usr/bin/env node
'use strict';
/* Puts the bot-free chain batch and the older boards Dennis liked into one level sequence from 250 up.
   (Dennis 2026-11-13: "Place these levels at 250+ and mix them with the already done levels", "keep the levels I
   like from the older process and interleave them with the new ones", 217's clock one move tighter.)
   - batch boards keep their own order (difficulty.js score); the two "needle" boards stay: solvable is the one hard rule.
   - liked older boards are kept as they are and get a score from Dennis's own tries; a board that is already in the
     game below 250 is skipped.
   - 96-tile boards go on levels ending in 0 where one fits the ramp; never two older boards in a row.
   Output: <out>/level-<n>.json (input for export_levels.js) and <out>/placed.md.
   Usage: node assemble_250.js [--out source/analysis/builder/bank/placed-250] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.resolve(__dirname, '../../..'), A = p => path.join(SRC, p);
const E = require(A('tools/builder/engine.js')), Hard = require(A('www/hard.js'));
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const OUT = path.resolve(arg('out', A('analysis/builder/bank/placed-250')));
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const pick = d => ({ tiles: d.tiles, faces: d.faces, down: d.down || [], gold: d.gold || [], obst: d.obst || { ice: {}, locks: [], keys: [] }, clock: d.clock || null, solution: d.solution });
const sig = d => JSON.stringify([d.tiles, d.clock, d.obst && d.obst.locks, d.obst && d.obst.keys, d.down]);   // not the pictures: the game may deal them per level
const TRY_SCORE = { 1: 3.6, 2: 4.4, 3: 5.2, 4: 6.0, 5: 6.6, 6: 7.1 };   // Dennis's tries -> place on the 3..7.5 ramp

// live boards below 250 (never reuse a board that is already in the game)
const table = vm.runInNewContext(fs.readFileSync(A('www/levels-hard.js'), 'utf8') + ';HARD_LEVELS');
const live = new Map();
for (let lv = table.from; lv < 250; lv++) { const d = Hard.unpack(lv, table.levels[lv - table.from]); live.set(sig(d), lv); }

// 1. the batch
const BD = A('analysis/builder/bank/batch-250-289'), batch = [];
for (const dir of [BD, path.join(BD, 'rejected')]) for (const f of fs.readdirSync(dir)) {
  const m = /^level-(\d+)\.json$/.exec(f); if (!m) continue;
  const j = read(path.join(dir, f));
  batch.push({ src: 'batch ' + m[1], order: +m[1], score: j.difficulty.score, design: pick(j.design), what: j.card.shape, layout: j.card.layoutName, needle: !!j.difficulty.needle });
}
batch.sort((a, b) => a.order - b.order);

// 2. the older boards Dennis liked (4 or 5 stars)
const liked = [];
const e5 = read(A('analysis/builder/process-v1/e5-boards.json'));
for (const id of ['factory4-175', 'blind1-194', 'q225-869ece', 'factory2-175', 'factory4-176', 'factory6-188', 'blind1-187', 'blind1-185', 'release163-175', 'q217-1233c8']) {
  const b = e5.find(x => x.id === id); if (!b) throw new Error('missing ' + id);
  liked.push({ src: 'older ' + id, stars: b.stars, tries: b.tries, design: pick(b.design), what: (b.recipe || []).join('+') || 'older', note: b.note });
}
for (const [key, stars, tries, lab] of [['eadb34f1069985e26b23abea27ce09307055b5de3fd7c44d34bbe8e1f0e54a35', 4, 2, 262], ['daf285e590a2bd4432f89c3b8bf39c97fc9a6ff91143ed93f8867b9c0c78649e', 4, 1, 273]]) {
  const j = read(A('analysis/builder/bank/puzzles/' + key + '.json'));
  liked.push({ src: 'bank lab-' + lab, stars, tries, design: pick(j.design), what: (j.card && (j.card.story || j.card.trapType)) || (j.spec && j.spec.story) || 'bank' });
}
for (const [file, stars, tries, lab] of [['chain-11-46', 5, 3, 291], ['chain-15-12', 4, 2, 292], ['chain-5-9', 4, 1, 293]]) {
  const j = read(A('build/traps/examples2/' + file + '.json'));
  liked.push({ src: 'chain lab-' + lab, stars, tries, design: pick(j.design), what: j.shape || j.trapType });
}
const notes = [];
const strict = d => E.replay(d, d.solution, { strict: true });
for (const b of liked) {
  b.score = TRY_SCORE[Math.min(6, Math.max(1, b.tries || 1))];
  if (b.src === 'older q217-1233c8') {                     // "Clock can be tighter": one move, only if still proven winnable
    const d2 = { ...b.design, clock: { i: b.design.clock.i, n: b.design.clock.n - 1 } };
    let ok = strict(d2).ok;
    if (!ok) {                                             // the stored route is too slow for the tighter clock: look for another
      const g = E.game(d2, { strict: true }), w = E.winnable(g, { nodes: 3000000, ms: 120000, solution: true });
      if (w && w.solution) { d2.solution = E.flatten ? E.flatten(w.solution) : w.solution; ok = strict(d2).ok; }
    }
    if (ok) { b.design = d2; b.score += 0.4; notes.push(`217: clock ${d2.clock.n + 1} -> ${d2.clock.n}, strict replay wins`); }
    else notes.push('217: clock NOT tightened (no proven win with one move less); kept at ' + b.design.clock.n);
  }
}
const keep = liked.filter(b => {
  const at = live.get(sig(b.design)); if (at) { notes.push(`${b.src}: skipped, it is already live as level ${at}`); return false; }
  const r = strict(b.design); if (!r.ok) { notes.push(`${b.src}: skipped, stored solution fails strict replay (${r.why})`); return false; }
  return true;
}).sort((a, b) => a.score - b.score);

// 3. one sequence: 96-tile boards on 10th levels, the rest merged by score, never two older boards in a row
const big = batch.filter(b => b.design.tiles.length === 96), rest = batch.filter(b => b.design.tiles.length !== 96);
const seq = []; let li = 0, lastOlder = true;                       // start with a batch board
for (const b of rest) {
  while (li < keep.length && keep[li].score <= b.score && !lastOlder) { seq.push(keep[li++]); lastOlder = true; }
  seq.push(b); lastOlder = false;
}
while (li < keep.length) seq.push(keep[li++]);
const total = seq.length + big.length, levels = {};
// a 96-tile board takes the 10th level whose neighbours are closest to its score
const tens = []; for (let n = 250; n < 250 + total; n += 10) tens.push(n);
const approx = n => seq[Math.min(seq.length - 1, Math.round((n - 250) * seq.length / total))].score;
const free = new Set(tens);
for (const b of big.sort((a, c) => a.score - c.score)) {
  let best = null; for (const n of free) if (best === null || Math.abs(approx(n) - b.score) < Math.abs(approx(best) - b.score)) best = n;
  levels[best] = b; free.delete(best);
}
let k = 0; for (let n = 250; n < 250 + total; n++) if (!levels[n]) levels[n] = seq[k++];

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const rows = [];
for (let n = 250; n < 250 + total; n++) {
  const b = levels[n], r = strict(b.design); if (!r.ok) throw new Error(`level ${n} (${b.src}) fails strict replay: ${r.why}`);
  fs.writeFileSync(path.join(OUT, `level-${n}.json`), JSON.stringify({ level: n, source: b.src, score: b.score, design: b.design }));
  rows.push(`| ${n} | ${b.src} | ${b.design.tiles.length} | ${b.what || ''} | ${b.score.toFixed(2)} | ${b.stars ? b.stars + '★, ' + b.tries + ' tries' : ''} | ${b.needle ? 'needle' : ''} |`);
}
fs.writeFileSync(path.join(OUT, 'placed.md'), `# Levels 250-${249 + total}: chain batch and the older boards Dennis liked\n\n${total} levels. Score: batch boards from difficulty.js, older boards from Dennis's tries.\n\n| level | source | tiles | trap | score | Dennis | |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Notes\n${notes.map(x => '- ' + x).join('\n')}\n`);
console.log(`${total} levels, 250-${249 + total}; older boards placed: ${keep.length}`); notes.forEach(x => console.log(' - ' + x));
