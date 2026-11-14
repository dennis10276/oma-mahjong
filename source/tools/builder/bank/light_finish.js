#!/usr/bin/env node
'use strict';
/* light_finish.js: the lighter finish for two-idea chains (Codex's chained_six_review.revise) on a list of boards.
   Dennis 2026-11-14 on the Task 18 lab: "Good AHA trap. Part after is too hard", "too hard after the trap. tune that easier. its more
   about the traps now." Target of the revision: 0.7-1.25 pressure parks, a natural (pair-first) player finishes at least 65% of the
   time, three waiting on at most 3.5% of the decisions. The trap, the clock and every picture before the clock stay as they are;
   every revised board is re-proven and independently verified (verify_chained_v2).
     node source/tools/builder/loop/heavy.js --label light --cores 6 -- node source/tools/builder/bank/light_finish.js --files a.json,b.json [--workers 6] [--ms 150000]
   Reads source/analysis/builder/bank/new-ideas/checked/<file>, writes source/analysis/builder/bank/new-ideas-light/<file> + report.jsonl */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const OUT = path.resolve(__dirname, '../../../analysis/builder/bank/new-ideas-light');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
if (arg('one', null)) {
  let res; try { res = require('../chained_six_review.js').revise({ file: arg('one'), ms: +arg('ms', 150000), seed: +arg('seed', 1) }); } catch (e) { res = { ok: false, why: String(e.stack || e).slice(0, 300) }; }
  fs.mkdirSync(OUT, { recursive: true });
  if (res.ok) fs.writeFileSync(path.join(OUT, arg('one')), JSON.stringify(res.row));
  fs.appendFileSync(path.join(OUT, 'report.jsonl'), JSON.stringify({ file: arg('one'), ok: res.ok, why: res.why, summary: res.summary }) + '\n');
  console.log(arg('one'), res.ok ? `OK parks ${res.summary.beforePp} -> ${res.summary.pp}, natural finish ${res.summary.beforeGreedy} -> ${res.summary.greedy}` : 'no: ' + res.why);
} else {
  const files = String(arg('files', '')).split(',').filter(Boolean), W = +arg('workers', 6); let next = 0, run = 0;
  const go = () => { while (run < W && next < files.length) { const f = files[next++]; run++; const c = cp.spawn(process.execPath, [__filename, ...process.argv.slice(2), '--one', f], { stdio: 'inherit' });
    const tm = setTimeout(() => c.kill(), +arg('ms', 150000) + 120000); c.on('exit', () => { clearTimeout(tm); run--; go(); }); } }; go();
}
