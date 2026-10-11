/* Design the harder levels once, for everyone, and write www/levels-hard.js (HARD_LEVELS).
     node tools/sim/build_levels.js [from=70] [to=269] [jobs=2]
   Every level is designed by www/hard.js (the test player), for one screen shape (Hard.ASPECT).
   Takes a few seconds per level; the jobs run side by side. */
'use strict';
const { fork } = require('child_process');
const path = require('path'), fs = require('fs');
const Hard = require('../../www/hard.js');
if (process.argv[2] === '--worker') {
  process.on('message', ({ levels }) => {
    for (const lv of levels) process.send({ lv, row: Hard.pack(Hard.makeNow(lv, Hard.ASPECT, 1)) });
    process.send({ done: true });
  });
} else {
  const from = +(process.argv[2] || 70), to = +(process.argv[3] || 269), jobs = +(process.argv[4] || 2);
  const rows = {}, t0 = Date.now();
  let left = jobs;
  for (let j = 0; j < jobs; j++) {
    const w = fork(__filename, ['--worker']);
    const mine = []; for (let lv = from + j; lv <= to; lv += jobs) mine.push(lv);
    w.on('message', m => {
      if (m.done) { w.kill(); if (--left === 0) write(); return; }
      rows[m.lv] = m.row;
      process.stderr.write(`\r${Object.keys(rows).length}/${to - from + 1} levels, ${Math.round((Date.now() - t0) / 1000)}s `);
    });
    w.send({ levels: mine });
  }
  function write() {
    const levels = []; for (let lv = from; lv <= to; lv++) levels.push(rows[lv]);
    const c = Hard.cfg();
    const out = `/* The designed levels ${from}-${to} (tools/sim/build_levels.js, made ${new Date().toISOString().slice(0, 10)}): the same for everyone, ready at once.
   Per level: tiles, faces, face-down, gold, ice, locks, keys (packed, see hard.js), alarm clock [tile, moves], and how often the
   sensible and the strong test player win a first try. */
const HARD_LEVELS = ${JSON.stringify({ v: Hard.GENV, aspect: Hard.ASPECT, from, cycleFrom: Math.max(from, c.endLevel), levels })};
`;
    fs.writeFileSync(path.join(__dirname, '..', '..', 'www', 'levels-hard.js'), out);
    console.error(`\nwrote www/levels-hard.js: ${levels.length} levels, ${Math.round(out.length / 1024)} KB, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
}
