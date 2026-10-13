/* Local footprint/CPU measurement using FakeDB and the archived live 1.49 boards.
   CHROME=... node tools/measure_replays.js
   Scripted winning routes and repeated legal free peeks are size examples, not human telemetry. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const lib = require('../tests/lib'), { readReplay } = require('./replays');
const source = fs.readFileSync(path.join(lib.ROOT, 'analysis/levels-1.49.js'), 'utf8');
const samples = [];
(async () => {
  await lib.setup();
  try {
    for (const level of [80, 84, 88, 90, 150]) for (const extraPeeks of [0, 100]) {
      const pid = 'test-replay-footprint', p = await lib.phone({ state: { level, name: 'Dennis', pid, sunSeen: true, seenSp: { clockMoves: 1 } },
        routes: [['**/levels-hard.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: source })]] });
      try {
        await lib.startLevel(p, level);
        const out = await p.evaluate(extraPeeks => {
          const route = Hard.get(G.level).solution;
          let inspected = 0;
          for (const i of route) {
            if (!G.alive[i]) continue;
            if (!inspected && extraPeeks) {
              const fr = G.tiles.map((t, i) => i).filter(i => G.alive[i] && canTake(i) && G.down[i] && !trayHas(faceOf(i)));
              const a = fr.find(i => i !== G.peek && fr.some(j => faceOf(j) !== faceOf(i)));
              const b = a !== undefined ? fr.find(i => faceOf(i) !== faceOf(a)) : undefined;
              if (b !== undefined) for (let k = 0; k < extraPeeks; k++) { onTap(k % 2 ? b : a); inspected++; }
            }
            onTap(i); if (G.alive[i]) onTap(i);
          }
          saveCur();
          return { aid: G.rp.id, inspected, done: G.done, savedChars: (localStorage.getItem(CUR) || '').length };
        }, extraPeeks);
        await lib.sleep(2200);
        for (let i = 0; i < 4; i++) await p.evaluate(() => flushReplay());
        const records = p.db.get(`replays/${pid}/${out.aid}`), r = readReplay(records);
        if (!r.complete || r.result !== 'win') throw Error(`Incomplete sample ${level}/${extraPeeks}: ${r.issues}`);
        const row = { level, extraPeeksRequested: extraPeeks, extraPeeksRecorded: out.inspected, bytes: r.bytes,
          chunks: Object.keys(records).filter(k => k !== 'createdAt').length, taps: r.kinds.tap, states: r.kinds.state };
        samples.push(row); console.log(JSON.stringify(row));
      } finally { await p.ctx.close(); }
    }
    const p = await lib.phone({ state: { level: 80, name: 'Dennis', pid: 'test-replay-cpu', seenSp: { clockMoves: 1 } } });
    let cpu;
    try {
      await lib.startLevel(p, 80);
      const cdp = await p.ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      cpu = await p.evaluate(() => {
        const start = performance.now(), n = 200, old = G.peek;
        for (let i = 0; i < n; i++) { replayMark('tap', [i % G.tiles.length, 0, '', null]); G.peek = i % G.tiles.length; replayCapture(); }
        const ms = performance.now() - start; G.peek = old;
        return { throttle: 6, iterations: n, totalMs: ms, averageRecorderMs: ms / n, cut: G.rp.cut };
      });
      console.log(JSON.stringify({ recorderCPU: cpu }));
    } finally { await p.ctx.close(); }
    const report = { boards: 'Archived live 1.49; current unpublished recorder', boardSHA256: crypto.createHash('sha256').update(source).digest('hex'),
      method: 'Scripted stored winning routes; optional 100 repeated legal free peeks. Bytes include replay chunk envelopes, exclude Firebase keys/protocol overhead.',
      samples, recorderCPU: cpu };
    fs.writeFileSync(path.join(lib.ROOT, 'analysis/replay-footprint.json'), JSON.stringify(report, null, 2) + '\n');
  } finally { await lib.teardown(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
