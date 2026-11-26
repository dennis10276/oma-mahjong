/* Prep A small points: Lucky Moment rules (5), tray pitch (6), level 1 intro timing (7), music shuffle (17). */
'use strict';

module.exports = [
  {
    name: 'prep a 5: Lucky waits for clock, ice and locks, skips a full tray, rolls first, stays fast',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { level: 20 } });
      await startLevel(p, 20);
      const r = await p.evaluate(() => {
        const out = {};
        // thin the board to 70% by taking free tiles, so the 80% rule lets Lucky through
        const n = G.tiles.length; let guard = 5000;
        while (aliveCount() > n * 0.7 && guard--) { const i = [...G.alive.keys()].find(k => G.alive[k] && free(k)); if (i === undefined) break; G.alive[i] = 0; }
        out.n = n; out.left = aliveCount();
        const alive = [...G.alive.keys()].filter(k => G.alive[k]);
        const base = () => { G.lucky = null; G.luckyN = 0; G.flights = 0; G.tray = []; G.clock = null; G.clockClearedAt = undefined; G.ob = null; G.busy = false; G.done = false; };
        const opts = c => ({ perLevel: 1, fromLevel: 1, chance: 1, playerLevel: 20, roll: 0, takeableFn: canTake, ...c });
        let calls = 0; const realSolve = Layouts.solve; Layouts.solve = function (...a) { calls++; return realSolve.apply(this, a); };
        try {
          base(); G.clock = { i: alive[0], n: 99 };
          out.clockOn = PrepBoard.pickSafeLuckyTile(G, opts());
          base(); G.clock = { i: alive[0], n: 99 }; G.alive[alive[0]] = 0; G.clockClearedAt = G.mv; G.alive[alive[0]] = 0;
          out.clockSameMove = PrepBoard.pickSafeLuckyTile(G, opts()); G.alive[alive[0]] = 1;
          base(); G.ob = { unlocked: true, locks: [], left: { [alive[1]]: 1 } };
          out.ice = PrepBoard.pickSafeLuckyTile(G, opts());
          base(); G.ob = { unlocked: false, locks: [alive[1]], left: {} };
          out.lock = PrepBoard.pickSafeLuckyTile(G, opts());
          base(); G.tray = alive.slice(0, 3);
          out.three = PrepBoard.pickSafeLuckyTile(G, opts());
          base(); calls = 0;
          out.failRoll = PrepBoard.pickSafeLuckyTile(G, opts({ roll: 0.99, chance: 0.3 }));
          out.failCalls = calls;
          base(); G.flights = 1;
          out.flight = PrepBoard.pickSafeLuckyTile(G, opts());
          base(); calls = 0; const t0 = performance.now();
          out.ok = PrepBoard.pickSafeLuckyTile(G, opts());
          out.ms = performance.now() - t0; out.okCalls = calls;
          out.okValid = out.ok == null || (!!G.alive[out.ok] && canTake(out.ok));
        } finally { Layouts.solve = realSolve; }
        return out;
      });
      t.log(r);
      t.ok(r.n >= 60, 'a big board', r.n);
      for (const k of ['clockOn', 'clockSameMove', 'ice', 'lock', 'three', 'failRoll', 'flight']) t.eq(r[k], null, 'no Lucky: ' + k);
      t.eq(r.failCalls, 0, 'the solver is not called when the chance roll fails');
      t.ok(r.okValid, 'a picked tile is alive and takeable', r.ok);
      t.ok(r.ms < 80, 'the check stays near the 30 ms limit', r.ms);
      // maybeLucky itself: roll fails = nothing; nothing happens during a flight
      const m = await p.evaluate(() => { G.lucky = null; G.luckyN = 0; G.flights = 1; maybeLucky(); const a = !!G.lucky; G.flights = 0; return { a, n: G.luckyN }; });
      t.eq(m, { a: false, n: 0 }, 'maybeLucky during a flight does nothing');
      // resume keeps luckyN / clockClearedAt
      const saved = await p.evaluate(() => { G.luckyN = 1; G.clockClearedAt = 7; saveCur(); const c = JSON.parse(localStorage.getItem('omamj.cur')); return { v: c.v, ln: c.ln, cc: c.cc }; });
      t.eq(saved.ln, 1, 'luckyN saved'); t.eq(saved.cc, 7, 'clockClearedAt saved');
      t.eq(p.errors, [], 'no page errors');
    },
  },
  {
    name: 'prep a 6: each waiting tile lands at its own tray pitch',
    async run(t, { startLevel, sleep }) {
      const p = await t.phone({ state: { level: 5 } });
      await startLevel(p, 5);
      const slots = await p.evaluate(async () => {
        const got = []; const real = Sound.land; Sound.land = s => { got.push(s); };
        const picks = []; const seen = new Set();
        for (let i = 0; i < G.tiles.length && picks.length < 3; i++) if (G.alive[i] && canTake(i) && !seen.has(faceOf(i)) && !G.down[i]) { seen.add(faceOf(i)); picks.push(i); }
        for (const i of picks) { onTap(i); await new Promise(r => setTimeout(r, 700)); }
        Sound.land = real; return got;
      });
      t.eq(slots, [0, 1], 'Sound.land gets the tray slot of each tile (the third waiting tile plays the warning)');
    },
  },
  {
    name: 'prep a 7: the level 1 tray intro shows when the board is ready, not 700 ms later',
    async run(t, { sleep }) {
      const p = await t.phone({ state: { level: 1, seenTray: false, seenIntro: true } });
      const d = await p.evaluate(async () => {
        const real = window.showIntro; let at = null, introducing = null;
        window.showIntro = function (...a) { at = performance.now(); introducing = G && G.introducing; return real.apply(this, a); };
        const t0 = performance.now(); __mj.startLevel(1);
        for (let k = 0; k < 40 && at === null; k++) await new Promise(r => setTimeout(r, 50));
        return { ms: at === null ? -1 : at - t0, introducing };
      });
      t.ok(d.ms >= 0 && d.ms < 650, 'intro opens without the extra 700 ms wait', d);
      t.eq(d.introducing, false, 'the board is ready when it opens');
    },
  },
  {
    name: 'prep a 17: music shuffle toggle in Instellingen and the next owned track differs',
    async run(t, { sleep }) {
      const p = await t.phone({ state: { level: 5 } });
      await p.evaluate(() => { openSettings(); });
      const row = await p.evaluate(() => { const b = document.querySelector('#modalBox .tog[data-k="musicShuffle"]'); return b ? b.parentElement.innerText : null; });
      t.ok(row && /Muziek door elkaar/.test(row), 'a shuffle row in Settings', row);
      await p.click('#modalBox .tog[data-k="musicShuffle"]');
      t.eq(await p.evaluate(() => S.musicShuffle), true, 'saved in S.musicShuffle');
      t.eq(await p.evaluate(() => JSON.parse(localStorage.getItem('omamj.v1')).musicShuffle), true, 'stored');
      const nxt = await p.evaluate(() => {
        const tracks = Sound.listMusicTracks().slice(0, 2); S.owned.music = tracks.slice(); S.musicTrack = tracks[0]; Sound.applyAudio({ musicTrack: tracks[0] });
        const seq = []; let cur = tracks[0];
        for (let k = 0; k < 12; k++) { const id = Sound.pickShuffleTrack(S.owned.music, cur); seq.push(id); cur = id; }
        return { tracks, seq, viaApi: Sound.shuffleNext() };
      });
      t.ok(nxt.seq.every((id, k) => nxt.tracks.includes(id) && id !== (k ? nxt.seq[k - 1] : nxt.tracks[0])), 'owned and never the same twice in a row', nxt);
      t.ok(nxt.tracks.includes(nxt.viaApi), 'shuffleNext picks an owned track', nxt);
      await p.evaluate(() => { openSettings(); });
      await p.click('#modalBox .tog[data-k="musicShuffle"]');
      t.eq(await p.evaluate(() => S.musicShuffle), false, 'off again');
      t.eq(p.errors, [], 'no page errors');
    },
  },
];
