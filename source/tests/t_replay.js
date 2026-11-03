/* Replay tests use only FakeDB; no player data is read or written. */
'use strict';
const { readReplay } = require('../tools/replays');
const chunks = (p, pid, aid) => p.db.get(`replays/${pid}/${aid}`) || {};
const chunkValues = records => Object.entries(records).filter(([k]) => k !== 'createdAt').map(([, v]) => v);
module.exports = [
  {
    name: 'replay: total stored bytes and chunk count stop growth and stay capped across reload',
    async run(t, { startLevel, sleep }) {
      for (const mode of ['bytes', 'chunks']) {
        const pid = 'test-replay-cap-' + mode, p = await t.phone({ state: { level: 16, name: 'Dennis', pid } });
        await startLevel(p, 16); await sleep(400);
        const out = await p.evaluate(mode => {
          replayDrain(G);
          if (mode === 'bytes') REPLAY.attemptBytes = G.rp.bytes + 2200;
          else REPLAY.chunks = G.rp.seq + 4;
          for (let n = 0; n < 100 && !G.rp.cut; n++) {
            // UTF-8 emoji and JSON escaping exercise the real stored byte count.
            replayMark('test', '🐘"\\'.repeat(30)); replayDrain(G);
          }
          saveCur();
          return { aid: G.rp.id, cut: G.rp.cut, bytes: G.rp.bytes, seq: G.rp.seq,
            byteLimit: REPLAY.attemptBytes, chunkLimit: REPLAY.chunks, state: replayState() };
        }, mode);
        t.ok(out.cut && out.bytes <= out.byteLimit && out.seq <= out.chunkLimit, mode + ': recorder stopped within storage limits', out);
        await p.evaluate(() => flushReplay()); await sleep(400);
        const data = chunks(p, pid, out.aid), replay = readReplay(data);
        t.ok(Buffer.byteLength(JSON.stringify(data)) <= out.byteLimit, mode + ': actual database size within byte limit');
        t.ok(chunkValues(data).length <= out.chunkLimit, mode + ': stored chunks within count limit');
        t.eq(replay.frames.filter(f => f.kind === 'truncated').length, 1, mode + ': one explicit cutoff marker');
        t.ok(!replay.complete, mode + ': cutoff never claims to be complete');
        await p.reload(); await p.waitForFunction(() => window.__mjReady); await startLevel(p, 16, false);
        const resumed = await p.evaluate(() => {
          const before = replayState();
          replayMark('test', 'cannot grow'); replayDrain(G);
          const i = G.tiles.findIndex((tile, i) => G.alive[i] && canTake(i));
          onTap(i); if (G.alive[i]) onTap(i);
          return { before, aid: G.rp.id, cut: G.rp.cut, seq: G.rp.seq, bytes: G.rp.bytes, tp: G.st.tp };
        });
        t.eq(resumed.before, out.state, mode + ': saved board preserved');
        t.eq([resumed.aid, resumed.cut, resumed.seq, resumed.bytes], [out.aid, true, out.seq, out.bytes], mode + ': same capped recorder after reload');
        t.ok(resumed.tp > 0, mode + ': gameplay continues after recording stops');
      }
    },
  },
  {
    name: 'replay: idle time writes no new chunks and legacy saves use a conservative storage budget',
    async run(t, { startLevel }) {
      const p = await t.phone({ state: { level: 16, name: 'Dennis', pid: 'test-replay-idle' } });
      await startLevel(p, 16);
      const out = await p.evaluate(() => {
        replayDrain(G);
        const before = [G.rp.seq, G.rp.bytes];
        G.elapsed += 20 * 3600;
        for (let n = 0; n < 100; n++) { replayCapture(); replayDrain(G); }
        const after = [G.rp.seq, G.rp.bytes];
        // A pre-update save knows its event characters/sequence but not wire bytes.
        delete G.rp.bytes; G.rp.chars = REPLAY.attemptChars;
        replayMark('resume'); replayDrain(G); saveCur();
        return { before, after, cut: G.rp.cut, pending: G.rp.events.length, saved: !!loadCur() };
      });
      t.eq(out.after, out.before, 'twenty hours with no events consumes zero extra replay storage');
      t.ok(out.cut && out.pending === 0 && out.saved, 'old recordings already above conservative budget stop without losing the saved game');
    },
  },
  {
    name: 'replay: reopening after a loss starts a fresh try instead of replaying the ended board',
    async run(t, { startLevel, sleep }) {
      const pid = 'test-replay-ended', p = await t.phone({ state: { level: 158, name: 'Dennis', pid, sunSeen: true, seenSp: { clockMoves: 1 } } });
      await startLevel(p, 158);
      // The real level-158 failure was a full tray, followed by hide and reload.
      // Give four takeable tiles distinct visible faces; obstacles and peeks would
      // otherwise make an arbitrary full-tray fixture depend on the level layout.
      for (let face = 0; face < 4; face++) {
        await p.evaluate(face => {
          const i = G.tiles.findIndex((tile, i) => G.alive[i] && canTake(i) && i !== G.clock?.i);
          G.tiles[i].face = face; G.down[i] = 0; G.peek = -1;
          replayCapture(); onTap(i);
        }, face);
        await sleep(350);
      }
      await sleep(500);
      const lost = await p.evaluate(() => ({ aid: G.rp.id, at: G.attempt, fails: S.fails[G.key], logged: G.logged }));
      t.ok(lost.logged, 'fixture reached a terminal loss');
      const saved = await p.evaluate(() => {
        pauseClock(); dispatchEvent(new Event('pagehide'));
        return localStorage.getItem(CUR);
      });
      t.eq(saved, null, 'hide/pagehide cannot re-save a finished attempt');
      await p.reload(); await p.waitForFunction(() => window.__mjReady);
      await startLevel(p, 158, false);
      const fresh = await p.evaluate(() => ({ aid: G.rp.id, at: G.attempt, partial: G.rp.init?.partial, mv: G.mv, left: aliveCount(), n: G.tiles.length, fails: S.fails[G.key] }));
      t.ok(fresh.aid !== lost.aid && fresh.at === lost.at + 1, 'new replay and next attempt number');
      t.ok(fresh.mv === 0 && fresh.left === fresh.n, 'new try starts with the whole board');
      t.eq(fresh.fails, lost.fails, 'reopening does not count the same loss twice');
      await p.evaluate(() => flushReplay()); await sleep(400);
      const replay = readReplay(chunks(p, pid, fresh.aid));
      t.eq(replay.initial.partial, false, 'new try has a complete initial board');
      t.ok(!replay.result && !replay.kinds.end, 'no phantom ending before any moves');
      t.ok(readReplay(chunks(p, pid, lost.aid)).complete, 'original loss remains a complete recording');
    },
  },
  {
    name: 'replay: closed saves from older versions are ignored when starting a level',
    async run(t, { startLevel, sleep }) {
      const pid = 'test-replay-old-ended', p = await t.phone({ state: { level: 16, name: 'Dennis', pid } });
      await startLevel(p, 16);
      const old = await p.evaluate(() => {
        const c = loadCur(); c.rp.closed = true;
        localStorage.setItem(CUR, JSON.stringify(c)); G = null;
        return { aid: c.rp.id, at: c.at };
      });
      await p.reload(); await p.waitForFunction(() => window.__mjReady);
      await startLevel(p, 16, false); await p.evaluate(() => flushReplay()); await sleep(300);
      const fresh = await p.evaluate(() => ({ aid: G.rp.id, at: G.attempt }));
      t.ok(fresh.aid !== old.aid && fresh.at === old.at + 1, 'old ended save starts the next try');
      t.eq(readReplay(chunks(p, pid, fresh.aid)).initial.partial, false, 'old ended save cannot produce a partial replay');
    },
  },
  {
    name: 'replay: stalled upload times out and foreground retry sends the unchanged chunk',
    async run(t, { startLevel, sleep }) {
      const pid = 'test-replay-stall', p = await t.phone({ state: { level: 3, name: 'Dennis', pid } });
      await startLevel(p, 3); await sleep(500);
      const out = await p.evaluate(async () => {
        await flushReplay();
        replayMark('pause', 'test'); replayDrain(G); saveCur();
        const originalFetch = fetch, originalSend = dbSend;
        let aborted = false, signalSeen = false, retry = null;
        const entry = JSON.parse(localStorage.getItem(REPLAY.queue))[0];
        const raw = localStorage.getItem(REPLAY.queue + '.' + entry.cid);
        const requestMs = REPLAY.requestMs; REPLAY.requestMs = 30;
        window.fetch = (url, options) => new Promise((resolve, reject) => {
          signalSeen = !!options.signal;
          options.signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('timeout', 'AbortError')); }, { once: true });
        });
        try { await flushReplay(); } finally { window.fetch = originalFetch; REPLAY.requestMs = requestMs; }
        const retained = localStorage.getItem(REPLAY.queue + '.' + entry.cid) === raw;
        const unlocked = !replaySending;
        dbSend = (...args) => { if (args[0].startsWith('replays/')) retry = args[1]; return originalSend(...args); };
        try {
          // Simulate return to the visible app without requiring an online event.
          Object.defineProperty(document, 'hidden', { configurable: true, value: false });
          document.dispatchEvent(new Event('visibilitychange'));
          while (replaySending) await new Promise(resolve => setTimeout(resolve, 10));
        } finally { dbSend = originalSend; delete document.hidden; }
        return { aborted, signalSeen, retained, unlocked, retry, entry, raw, pending: JSON.parse(localStorage.getItem(REPLAY.queue)).length };
      });
      t.ok(out.aborted && out.signalSeen && out.unlocked, 'stalled fetch aborted and upload lock released');
      t.ok(out.retained, 'timeout preserves queued data');
      t.eq(out.retry, { createdAt: out.entry.born, [out.entry.cid]: JSON.parse(out.raw) }, 'foreground retries identical chunk ID and content');
      t.eq(out.pending, 0, 'foreground retry drains pending replay');
    },
  },
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
    name: 'replay: offline resume preserves identity/counters and reconstructs the final board after reconnect, hint and shuffle',
    async run(t, { startLevel, click, solve, sleep }) {
      const pid = 'test-replay-resume', p = await t.phone({ state: { level: 16, name: 'Dennis', pid } });
      // Drop database requests while still serving the app itself across reload.
      let offline = true;
      await p.ctx.route(/^https:\/\/[^/]*firebasedatabase\.app\//, r => offline ? r.abort() : p.db.handle(r));
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
      t.eq(chunkValues(chunks(p, pid, before.aid)).length, 0, 'recording stayed local while disconnected');
      offline = false;
      await p.evaluate(() => flushReplay());
      await click(p, '#btnHint'); await click(p, '#btnShuffle');
      await p.waitForFunction(() => G.usedShuffle && !G.busy, null, { timeout: 10000 });
      t.ok(await solve(p, 3000), 'winning route found');
      await p.waitForFunction(() => G.done && G.logged, null, { timeout: 10000 });
      await p.evaluate(async () => { await flushReplay(); await flushLog(); });
      await p.waitForFunction(() => JSON.parse(localStorage.getItem(REPLAY.queue) || '[]').length === 0 && readQ().length === 0, null, { timeout: 10000 });
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
