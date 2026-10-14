/* Replay tests use only FakeDB; no player data is read or written. */
'use strict';
const { readReplay } = require('../tools/replays');
const chunks = (p, pid, aid) => p.db.get(`replays/${pid}/${aid}`) || {};
const chunkValues = records => Object.entries(records).filter(([k]) => k !== 'createdAt').map(([, v]) => v);
module.exports = [
  {
    name: 'replay: lost upload acknowledgment retries the same chunk and conflicting copies are flagged',
    async run(t, { startLevel, sleep }) {
      const pid = 'test-replay-ack', p = await t.phone({ state: { level: 3, name: 'Dennis', pid } });
      await startLevel(p, 3); await sleep(400);
      const out = await p.evaluate(async () => {
        const aid = G.rp.id;
        replayMark('pause', 'test'); replayDrain(G);
        const send = dbSend; let lost = false;
        dbSend = async (...args) => {
          const r = await send(...args);
          if (!lost && args[0].startsWith('replays/')) { lost = true; throw Error('simulated lost acknowledgment'); }
          return r;
        };
        try {
          await flushReplay();
          const queued = JSON.parse(localStorage.getItem(REPLAY.queue) || '[]').length;
          await flushReplay(); return { aid, lost, queued };
        } finally { dbSend = send; }
      });
      t.ok(out.lost && out.queued > 0, 'successful write with lost acknowledgment remains queued');
      const writes = p.db.log.filter(e => e.p === `/replays/${pid}/${out.aid}`);
      const counts = {};
      for (const w of writes) for (const k of Object.keys(w.body).filter(k => k !== 'createdAt')) counts[k] = (counts[k] || 0) + 1;
      t.ok(Object.values(counts).includes(2), 'retried identical chunk path');
      t.ok(writes.every(w => w.m === 'PATCH' && w.body.createdAt === writes[0].body.createdAt), 'attempt birth stays fixed on all chunk uploads and retries');
      const data = chunkValues(chunks(p, pid, out.aid));
      t.ok(!readReplay([...data, data[0]]).issues.some(s => /Conflicting/.test(s)), 'identical duplicates are harmless');
      const bad = { ...data[0], data: JSON.stringify({ ...JSON.parse(data[0].data), events: [[0, 'different', null]] }) };
      t.ok(readReplay([...data, bad]).issues.some(s => /Conflicting/.test(s)), 'conflicting sequence flagged instead of silently replayed');
    },
  },
  {
    name: 'replay: resume preserves identity/counters and reconstructs the final board after hint and shuffle',
    async run(t, { startLevel, click, solve, sleep }) {
      const pid = 'test-replay-resume', p = await t.phone({ state: { level: 16, name: 'Dennis', pid } });
      await startLevel(p, 16);
      const before = await p.evaluate(() => {
        const blocked = G.tiles.findIndex((t, i) => G.alive[i] && !free(i));
        if (blocked >= 0) onTap(blocked);
        const i = G.tiles.findIndex((t, i) => G.alive[i] && canTake(i));
        onTap(i); if (G.alive[i]) onTap(i);
        saveCur(); return { aid: G.rp.id, st: { ...G.st }, state: replayState() };
      });
      await click(p, '#btnHome'); await sleep(400);
      await p.reload(); await p.waitForFunction(() => window.__mjReady);
      await startLevel(p, 16, false);
      t.eq(await p.evaluate(() => G.rp.id), before.aid, 'same attempt after a full page reload');
      t.eq(await p.evaluate(() => G.st), before.st, 'attempt counters are not reset on resume');
      t.eq(await p.evaluate(() => replayState()), before.state, 'same board resumed');
      await click(p, '#btnHint'); await click(p, '#btnShuffle'); await sleep(850);
      t.ok(await solve(p, 3000), 'test attempt won'); await sleep(600);
      const r = readReplay(chunks(p, pid, before.aid));
      t.ok(r.complete, 'all chunks present with a recorded ending', r.issues);
      t.eq(r.result, 'win', 'win replayed');
      t.eq(r.state, await p.evaluate(() => replayState()), 'deltas reconstruct every tile, tray, peek and obstacle');
      t.ok(r.kinds.resume >= 1 && r.kinds.hint === 1 && r.kinds.shuffle === 1, 'resume and help recorded', r.kinds);
      t.eq(r.state.tr, [], 'empty tray survives storage');
      const ends = p.db.plays(pid).filter(e => e.k === 'end');
      t.eq(ends[0].aid, before.aid, 'summary linked to exact attempt without truncating the ID');
      t.ok(ends[0].tp > before.st.tp && ends[0].bt >= before.st.bt, 'end counters include the earlier session');
      t.ok(r.bytes < 40000, 'ordinary winning replay under 40 KB', r.bytes);
      t.log({ bytes: r.bytes, events: r.kinds });
    },
  },
  {
    name: 'replay: clock peeks, covered taps, automatic peek matches and timeout are distinguishable',
    async run(t, { startLevel, sleep }) {
      const pid = 'test-replay-clock', p = await t.phone({ state: { level: 80, name: 'Dennis', pid, sunSeen: true, seenSp: { clockMoves: 1 } } });
      await startLevel(p, 80);
      const out = await p.evaluate(() => {
        const [a, b] = G.tiles.map((t, i) => i).filter(i => i !== G.clock.i && canTake(i));
        const blocked = G.tiles.findIndex((t, i) => G.alive[i] && !free(i));
        // Controlled fixture: a free peek and its face-up twin. Fixture changes are recorded too.
        G.tiles[b].face = G.tiles[a].face; G.down[a] = 1; G.down[b] = 0; G.peek = -1;
        turn(a, true); turn(b, false); replayCapture();
        onTap(blocked); onTap(a);
        const peek = replayState();
        onTap(b); const pair = replayState();
        const i = G.tiles.findIndex((t, i) => G.alive[i] && i !== G.clock.i && canTake(i));
        G.down[i] = 0; G.clock.n = G.mv + 1; replayCapture(); onTap(i);
        return { aid: G.rp.id, a, b, blocked, peek, pair, state: replayState() };
      });
      await sleep(500);
      const r = readReplay(chunks(p, pid, out.aid));
      t.ok(r.complete, 'clock failure complete', r.issues);
      t.eq(r.result, 'stuck', 'clock failure result');
      t.eq(r.state, out.state, 'including terminal move recorded before failure modal');
      t.eq(r.frames.find(f => f.kind === 'end').state, out.state, 'ending frame already contains the terminal board');
      const taps = r.frames.filter(f => f.kind === 'tap');
      t.eq(taps[0].data[2], 'covered', 'covered tap identified');
      t.eq(out.peek.m, 0, 'peek did not consume a move');
      t.eq(out.pair.m, 2, 'one matching tap removed two tiles');
      t.ok(r.frames.some(f => f.kind === 'state' && f.state.p === out.a && f.state.m === 0), 'peek and visible identity can be reconstructed');
      t.ok(r.frames.some(f => f.kind === 'end' && f.data.ck === 1), 'clock reason retained');
    },
  },
  {
    name: 'replay: offline batching has no tap requests, bounds phone storage and detects missing data',
    async run(t, { startLevel, sleep }) {
      const pid = 'test-replay-offline', p = await t.phone({ state: { level: 81, name: 'Dennis', pid } });
      await startLevel(p, 81); await sleep(400);
      await p.ctx.setOffline(true);
      const out = await p.evaluate(() => {
        // Small test limits exercise eviction and truncation without thousands of real games.
        REPLAY.queueChars = 4000; REPLAY.attemptChars = 4000;
        const aid = G.rp.id;
        for (let i = 0; i < 20; i++) { replayMark('test-fill', 'x'.repeat(100)); replayDrain(G); }
        const blocked = G.tiles.findIndex((t, i) => G.alive[i] && !free(i));
        let calls = 0; const send = dbSend;
        dbSend = (...a) => { calls++; return send(...a); };
        for (let i = 0; i < 180; i++) onTap(blocked);
        const immediateCalls = calls;
        dbSend = send;
        replayDrain(G); saveCur();
        const index = JSON.parse(localStorage.getItem(REPLAY.queue) || '[]');
        const chars = Object.keys(localStorage).filter(k => k === REPLAY.queue || k.startsWith(REPLAY.queue + '.')).reduce((n, k) => n + localStorage.getItem(k).length, 0);
        return { aid, immediateCalls, chars, limit: REPLAY.queueChars, pending: G.rp.events.length, cut: G.rp.cut, index };
      });
      t.eq(out.immediateCalls, 0, 'zero network requests made inside the tap handlers');
      t.ok(out.chars <= out.limit, 'offline queue bounded including index', out);
      t.ok(out.index.length && out.index[0].seq > 1, 'old replay chunks actually evicted when the queue fills');
      t.ok(out.cut && out.pending === 0, 'extreme attempt explicitly truncated and safely queued');
      await p.ctx.setOffline(false); await p.evaluate(() => flushReplay()); await sleep(600);
      const r = readReplay(chunks(p, pid, out.aid));
      t.ok(!r.complete && r.issues.some(s => /limit/.test(s)), 'reader refuses to present truncation as complete evidence', r.issues);
      t.ok(r.issues.some(s => /Missing chunks/.test(s)), 'evicted chunks are reported as a gap');
      t.eq(await p.evaluate(() => JSON.parse(localStorage.getItem(REPLAY.queue) || '[]').length), 0, 'offline chunks eventually sent');
      // A missing chunk must never be silently treated as a complete replay.
      const data = chunks(p, pid, out.aid), values = chunkValues(data);
      if (values.length > 1) {
        const missing = values.filter(c => c.seq !== 0);
        t.ok(readReplay(missing).issues.some(s => /Missing/.test(s)), 'missing initial chunk reported');
      }
    },
  },
  {
    name: 'replay: helper reveals and rescue are recorded; older saves are explicitly partial',
    async run(t, { startLevel, sleep }) {
      const pid = 'test-replay-help', p = await t.phone({ state: { level: 40, name: 'OmaHanny', pid } });
      await startLevel(p, 40);
      const aid = await p.evaluate(() => {
        const freeTiles = G.tiles.map((t, i) => i).filter(i => canTake(i));
        G.down[freeTiles[0]] = 1; replayCapture(); startNudge(freeTiles.slice(0, 2), 5);
        const i = freeTiles[0]; onTap(i); rescueTray();
        saveCur(); replayDrain(G); saveCur(); return G.rp.id;
      });
      await sleep(600);
      const r = readReplay(chunks(p, pid, aid));
      t.ok(r.kinds.nudge === 1 && r.kinds.rescue === 1, 'helper and rescue actions recorded');
      t.eq(r.state, await p.evaluate(() => replayState()), 'helper down flags and rescued tiles reconstructed');
      await p.evaluate(() => { const c = loadCur(); delete c.rp; delete c.st; localStorage.setItem(CUR, JSON.stringify(c)); G = null; });
      await startLevel(p, 40, false); await p.evaluate(() => { replayDrain(G); }); await sleep(400);
      const partialAid = await p.evaluate(() => G.rp.id);
      const partial = readReplay(chunks(p, pid, partialAid));
      t.ok(partialAid !== aid && partial.initial.partial && !partial.complete, 'older save never claims to contain the missing first moves');
    },
  },
  {
    name: 'replay: expired offline chunks are discarded and an old saved board resumes without reviving expired history',
    async run(t, { startLevel, sleep }) {
      const pid = 'test-replay-expired', p = await t.phone({ state: { level: 16, name: 'Dennis', pid } });
      await startLevel(p, 16); await sleep(500);
      await p.ctx.setOffline(true);
      const old = await p.evaluate(() => {
        const i = G.tiles.findIndex((t, i) => canTake(i)); onTap(i); if (G.alive[i]) onTap(i);
        G.rp.born = Date.now() - 31 * 86400000;
        replayDrain(G); saveCur();
        return { aid: G.rp.id, state: replayState(), st: { ...G.st } };
      });
      const writesBefore = p.db.log.filter(e => e.p.startsWith('/replays/')).length;
      await p.ctx.setOffline(false); await p.evaluate(() => flushReplay());
      t.eq(p.db.log.filter(e => e.p.startsWith('/replays/')).length, writesBefore, 'month-old offline chunks never sent to Firebase');
      t.eq(await p.evaluate(() => JSON.parse(localStorage.getItem(REPLAY.queue) || '[]').length), 0, 'expired chunks removed from phone queue');
      await p.reload(); await p.waitForFunction(() => window.__mjReady); await startLevel(p, 16, false); await sleep(500);
      const fresh = await p.evaluate(() => ({ aid: G.rp.id, state: replayState(), st: { ...G.st }, born: G.rp.born, now: Date.now() }));
      t.ok(fresh.aid !== old.aid && fresh.born > fresh.now - 60000, 'resume creates a new recording with a fresh birth date');
      t.eq(fresh.state, old.state, 'saved board unchanged after retention expiry');
      t.eq(fresh.st, old.st, 'game counters unchanged after retention expiry');
      const replay = readReplay(chunks(p, pid, fresh.aid));
      t.ok(replay.initial.partial && !replay.complete, 'new recording explicitly reports missing earlier moves');
      t.eq(chunks(p, pid, fresh.aid).createdAt, fresh.born, 'attempt metadata stored atomically with initial chunk');
    },
  },
  {
    name: 'replay: unnamed players and storage errors cannot interrupt gameplay',
    async run(t, { startLevel, sleep }) {
      const unnamed = await t.phone({ state: { level: 3 } }); await startLevel(unnamed, 3);
      t.eq(await unnamed.evaluate(() => !!G.rp), false, 'no detailed replay collected for unnamed visitors');
      t.eq(unnamed.db.log.filter(e => e.p.startsWith('/replays')).length, 0, 'no anonymous uploads');
      const p = await t.phone({ state: { level: 3, name: 'Dennis', pid: 'test-replay-quota' } });
      await startLevel(p, 3);
      const result = await p.evaluate(() => {
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
        try {
          const i = G.tiles.findIndex((t, i) => canTake(i)); onTap(i); if (G.alive[i]) onTap(i);
          replayDrain(G); saveCur(); return G.mv;
        } finally { Storage.prototype.setItem = orig; }
      });
      t.ok(result > 0, 'play continues even with full/disabled storage'); await sleep(300);
    },
  },
];
