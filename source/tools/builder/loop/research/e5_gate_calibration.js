#!/usr/bin/env node
/* E5 gate calibration on labelled boards (process-design-synthesis.md section 7).
     node .../e5_gate_calibration.js boards            -> writes OUT/e5-boards.json (no engine)
     heavy.js --label e5-static -- node .../e5_gate_calibration.js static     -> OUT/e5-static.jsonl (one row per board, resumable)
     heavy.js --label e5-traces -- node .../e5_gate_calibration.js traces [part/of]  -> OUT/e5-traces.jsonl (resumable)
   Boards: the 24 dennis-plays boards that carry tiles (factory/blind/release), levels 200, 217, 225, the 18 qualified 200-225
   boards, and 9001-9003 (knobs-v1 study boards, never rated by Dennis). Read-only on all inputs. */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.resolve(__dirname, '..', '..', '..', '..'), OUT = path.join(SRC, 'analysis/builder/process-v1');
const rj = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const rl = f => fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l));
const BOARDS = path.join(OUT, 'e5-boards.json');

function build() {
  const plays = rj(path.join(SRC, 'analysis/factory/dennis-plays.json')).boards, labels = rj(path.join(SRC, 'analysis/factory/dennis-notes-labels.json')).labels;
  const qual = rl(path.join(SRC, 'analysis/builder/data/qualified-200-225.jsonl'));
  const lab2 = { 200: { stars: 3, tries: 5, verdict: 'right', note: 'Shape is not the most fun. Its okay.' }, 217: { stars: 4, tries: 2, verdict: 'easy', note: 'Very fun. Clock can be tighter.' }, 225: { stars: 5, tries: 4, verdict: 'right', note: 'Very fun clock seems good here.' } };
  const rows = [];
  for (const p of plays) if (p.board && p.board.tiles) rows.push({ id: p.key, set: 'dennis', level: p.level, stars: p.stars || null, tries: p.tries, verdict: p.verdict, kinds: labels[p.key] || [], recipe: p.recipe, note: p.note, design: p.board });
  const q217 = rl(path.join(SRC, 'analysis/builder/knobs-v1/closest-assignment.jsonl')).find(r => r.level === 217);
  for (const q of qual) { const l = lab2[q.level]; rows.push({ id: 'q' + q.level + '-' + q.id.slice(0, 6), set: l ? 'dennis-round2' : 'qualified', level: q.level, stars: l?.stars ?? null, tries: l?.tries ?? null, verdict: l?.verdict ?? null, kinds: [], recipe: q.recipe, note: l?.note ?? null, design: q.design }); }
  rows.push({ id: 'q217-' + q217.id.slice(0, 6), set: 'dennis-round2', level: 217, ...lab2[217], stars: 4, kinds: [], recipe: q217.recipe, boardNote: 'closest-assignment 217 (v12/v10 candidate; may not be byte-identical to the board Dennis played)', design: q217.design });
  const all = rj(path.join(SRC, 'analysis/builder/knobs-v1/boards.json')), ex = rj(path.join(SRC, 'analysis/builder/why-hard-v1/reference/examples.json'));
  for (const e of ex) { const b = all.find(x => x.id === e.id); rows.push({ id: 'study' + e.studyLevel, set: 'study', level: e.studyLevel, stars: null, tries: null, kinds: [], recipe: [b.brief.story], design: b.design }); }
  fs.writeFileSync(BOARDS, JSON.stringify(rows));
  console.log(rows.length, 'boards', rows.map(r => r.set).reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {}));
}

function loop(mode, part) {
  const rows = rj(BOARDS), file = path.join(OUT, `e5-${mode}.jsonl`), done = new Set(fs.existsSync(file) ? rl(file).map(r => r.id) : []);
  const SG = require('../static_gates.js'), TR = require('../traces.js');
  let rs = rows; if (part) { const [i, n] = part.split('/').map(Number); rs = rows.filter((_, k) => k % n === i); }
  for (const r of rs) {
    if (done.has(r.id)) continue;
    const t = Date.now(); let out;
    try {
      if (mode === 'static') {
        const g = SG.staticGates(r.design, { level: r.level, perms: 4, budget: 2.5e6, seed: 1, wallMs: 90000 });
        out = { id: r.id, ms: Date.now() - t, pass: g.pass, k: g.k, strictK: g.strictK, shipSpares: g.shipSpares, warnings: g.warnings, gates: Object.fromEntries(Object.entries(g.gates).map(([a, v]) => [a, { pass: v.pass, warn: v.warn || null, detail: v.detail }])) };
      } else {
        const g = TR.traceGates(r.design, { spare: null, campaigns: 40 });
        const { examples, wonOn, ...rest } = g; out = { id: r.id, wallMs: Date.now() - t, ...rest, thresholds: undefined, budget: undefined };
      }
    } catch (e) { out = { id: r.id, crash: String(e.message).slice(0, 300) }; }
    fs.appendFileSync(file, JSON.stringify(out) + '\n'); console.log(mode, r.id, out.crash || 'ok', Date.now() - t, 'ms');
  }
}
const [mode, part] = process.argv.slice(2);
if (mode === 'boards') build(); else if (mode === 'static' || mode === 'traces') loop(mode, part); else console.log('usage: boards | static | traces [i/n]');
