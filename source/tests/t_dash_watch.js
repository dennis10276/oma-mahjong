'use strict';
const path = require('path'), fs = require('fs');
const SITE = fs.existsSync(path.join(__dirname, '..', 'site')) ? path.join(__dirname, '..', 'site') : path.join(__dirname, '..', '..');
const { read } = require(path.join(SITE, 'dash', 'replay-state'));
const Playback = require(path.join(SITE, 'dash', 'playback'));
const clone = v => JSON.parse(JSON.stringify(v));
function sample(aid = 'attempt-a', now = Date.now()) {
  const state = { a: Array(8).fill(1), d: [0, 0, 0, 1, 0, 0, 0, 0], f: [0, 0, 1, 2, 1, 2, 3, 3], tr: [], p: -1, m: 0,
    ob: { need: { 4: 2 }, left: { 4: 2 }, locks: [5], keys: [6, 7], unlocked: false }, ck: { i: 2, n: 8 } };
  const init = { key: 'L39', at: 2, partial: false, gold: [0, 1], tiles: [[0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0], [0, 2, 0], [2, 2, 0], [4, 2, 0], [1, 1, 1]], state };
  const chunk = (seq, events, extra = {}) => ({ v: 1, aid, seq, t: now + seq, code: '1.51', data: JSON.stringify({ events, ...extra }) });
  return { createdAt: now, first: chunk(0, [[0, 'begin', null], [0, 'view', [390, 844, 300, 500, 40, 'fruit', true]]], { init }),
    next: chunk(1, [[1000, 'tap', [0, 0, '', null]], [1000, 'state', { a: [[0, 0]], tr: [0], p: 3, m: 1 }]]) };
}
module.exports = [
  {
    name: 'dashboard: replay decoder reconstructs recorded states and refuses gaps, conflicts and corrupt edits',
    async run(t) {
      const s = sample(), aid = 'attempt-a';
      let r = read({ createdAt: s.createdAt, a: s.first, b: s.next }, aid);
      t.eq(r.state.tr, [0], 'tray reconstructed'); t.eq(r.state.a[0], 0, 'tile removed'); t.eq(r.state.p, 3, 'peek preserved');
      t.eq(r.view[5], 'fruit', 'theme recorded'); t.eq(r.state.ob.left[4], 2, 'ice preserved'); t.eq(r.state.ck.i, 2, 'clock preserved');
      const shuffled = { v: 1, aid, seq: 2, t: Date.now(), code: '1.51', data: JSON.stringify({ events: [[2000, 'state', { f: [[5, 20]], d: [[3, 0]], tr: [], p: -1, m: 2, ob: null, ck: null }], [2000, 'end', { r: 'win' }]] }) };
      r = read({ a: s.first, b: s.next, c: shuffled }, aid);
      t.eq(r.state.f[5], 20, 'shuffle identities restored'); t.eq(r.state.d[3], 0, 'reveal restored'); t.eq(r.state.ob, null, 'removed obstacles restored'); t.eq(r.result, 'win', 'ending restored');
      r = read({ a: s.first, c: shuffled }, aid);
      t.eq(r.gap, true, 'gap flagged'); t.eq(r.state.a[0], 1, 'never applies later state across a missing chunk');
      t.eq(read({ b: s.next }, aid).initial, null, 'no invented initial board');
      const identical = read({ a: s.first, copy: clone(s.first) }, aid); t.ok(identical.initial, 'identical duplicate accepted');
      for (const records of [
        { a: s.first, conflict: { ...s.first, data: s.next.data } },
        { a: { ...s.first, aid: 'different-attempt' } },
        { a: s.first, bad: { ...s.next, data: JSON.stringify({ events: [[1, 'state', { a: [[999, 0]] }]] }) } },
        { a: s.first, bad: { ...s.next, data: JSON.stringify({ events: [[1, 'state', { f: [[0, '<script>']] }]] }) } },
      ]) { let failed = false; try { read(records, aid); } catch (e) { failed = true; } t.ok(failed, 'invalid or conflicting recording rejected'); }
    },
  },
  {
    name: 'dashboard: buffered replay preserves event timing, pauses and upload-independent clocks',
    async run(t) {
      const born = 1000000, s = sample('timed', born), summaries = [{ k: 'start', aid: 'timed', t: born }];
      s.next.t = born + 90000;
      const r = read({ createdAt: born, first: s.first, next: s.next }, 'timed');
      let line = Playback.timeline(r, summaries, 'timed');
      t.eq(line.frames.find(f => f.kind === 'tap').wall, born + 1000, 'move uses recorded milliseconds, not batch arrival');
      t.eq(line.coverage, born + 1000, 'a partial batch cannot advertise unseen moves as idle time');
      t.eq(line.frames[Playback.frameAt(line.frames, born + 999)].state.tr, [], 'move not visible early');
      t.eq(line.frames[Playback.frameAt(line.frames, born + 1000)].state.tr, [0], 'move visible at original timestamp');
      const paused = { ...s.next, seq: 2, data: JSON.stringify({ events: [[2000, 'pause', null], [2000, 'resume', null], [3000, 'tap', [1, 0, '', null]]] }) };
      line = Playback.timeline(read({ createdAt: born, first: s.first, next: s.next, paused }, 'timed'), [...summaries, { k: 'show', scr: 'game', t: born + 22000 }], 'timed');
      t.eq(line.frames.find(f => f.kind === 'resume').wall, born + 22000, 'background pause retains its real twenty-second gap');
      t.eq(line.frames.at(-1).wall, born + 23000, 'subsequent moves keep timing after resume');
      t.eq(line.frames[Playback.frameAt(line.frames, born + 15000)].paused, true, 'pause remains visible during its original interval');
      const missing = Playback.timeline(read({ createdAt: born, first: s.first, next: s.next, paused }, 'timed'), summaries, 'timed');
      t.eq(missing.timingMissing, true, 'missing wall-clock resume is not guessed');
      const clock = new Playback.Clock(); clock.reset(born);
      t.eq(clock.cursor, born - 60000, 'starts a minute behind');
      clock.advance(born + 16); t.eq(clock.cursor, born - 60000 + 16, 'normal speed is one-to-one');
      clock.advance(born + 32, born - 60000 + 20); t.eq(clock.cursor, born - 60000 + 20, 'late data stops playback at its known horizon');
      clock.advance(born + 1032); t.eq(clock.cursor, born - 60000 + 120, 'new data does not seek or fast-forward past recorded actions');
    },
  },
  {
    name: 'dashboard: one-minute stream plays every move and level change instead of painting arriving batches',
    async run(t, { serve, FakeDB, browser, WWW }) {
      const site = await serve(SITE, { '/play/': WWW }), now = Date.now(), born = now - 60000;
      const a = sample('attempt-a', born), b = sample('attempt-b', born + 2000), other = sample('other-player', born);
      b.first = clone(b.first); const bInit = JSON.parse(b.first.data); bInit.init.key = 'L40'; b.first.data = JSON.stringify(bInit);
      const finish = { ...a.next, seq: 2, data: JSON.stringify({ events: [[1500, 'end', { r: 'win' }]] }) };
      const future = { ...b.next, seq: 2, data: JSON.stringify({ events: [[4000, 'state', { a: [[1, 0]], tr: [], m: 2 }]] }) };
      const db = new FakeDB({ scores: { pA: { name: 'Anna', level: 40 }, pB: { name: 'Bram', level: 39 }, pOld: { name: 'Oudere versie', level: 2 } },
        plays: { pA: { s: { k: 'start', aid: 'attempt-a', lv: 39, t: born }, e: { k: 'end', aid: 'attempt-a', r: 'win', lv: 39, t: born + 1500 }, n: { k: 'start', aid: 'attempt-b', lv: 40, t: born + 2000 } }, pB: { s: { k: 'start', aid: 'other-player', lv: 39, t: born } }, pOld: { s: { k: 'start', lv: 2, t: born - 1000 } } } });
      const ctx = await browser.newContext({ viewport: { width: 2546, height: 1200 } });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      await ctx.addInitScript(value => {
        window.__watchNow = value; Date.now = () => window.__watchNow;
        const Native = window.EventSource; window.__replayStreams = [];
        window.EventSource = class {
          constructor(url) { if (!url.includes('/replays/')) return new Native(url); this.url = url; this.closed = false; this.listeners = {}; window.__replayStreams.push(this); }
          addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
          close() { this.closed = true; }
          emit(type, data) { for (const callback of this.listeners[type] || []) callback({ data: JSON.stringify({ path: '/', data }) }); }
        };
      }, now);
      const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
      const emit = async (aid, data) => p.evaluate(({ aid, data }) => window.__replayStreams.findLast(s => s.url.endsWith('/' + aid + '.json')).emit('put', data), { aid, data });
      const advance = async ms => { for (let n = 0; n < ms; n += 50) { await p.evaluate(v => window.__watchNow += v, Math.min(50, ms - n)); await p.waitForTimeout(25); } };
      try {
        await p.goto(site.url + 'dash/#pA'); await p.waitForFunction(() => window.__replayStreams.length === 2);
        await emit('attempt-a', { createdAt: born, first: a.first, next: a.next, finish });
        await emit('attempt-b', { createdAt: born + 2000, first: b.first, next: b.next });
        await p.waitForSelector('#watchBoard .watch-tile');
        t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'arrival of a finished batch does not jump to its final board');
        t.ok((await p.locator('#watchStats').innerText()).startsWith('Level 39'), 'future level is preloaded but not displayed early');
        t.eq(await p.locator('#watchBoard .back svg').count(), 0, 'unknown tile identity remains hidden');
        t.eq(await p.locator('#watchBoard').getAttribute('viewBox'), '0 0 390 844', 'uses recorded player screen proportions');
        await advance(900); t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'no move before its scheduled time');
        await advance(100); t.eq(await p.locator('#watchBoard .watch-tile').count(), 7, 'move played at its original one-second offset');
        t.eq(await p.locator('#watchTray .watch-slot:not(.vacant)').count(), 1, 'tray changes with that move');
        await advance(600); t.ok((await p.locator('#watchStatus').innerText()).startsWith('Level gehaald'), 'ending is broadcast at its delayed time');
        await advance(400); t.ok((await p.locator('#watchStats').innerText()).startsWith('Level 40'), 'next attempt follows at its original delayed start');
        t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'next attempt begins at its initial state');
        await advance(1000); t.eq(await p.locator('#watchBoard .watch-tile').count(), 7, 'next level streams its own first move');
        await emit('attempt-b', { createdAt: born + 2000, first: b.first, next: b.next, future });
        await p.waitForTimeout(40); t.eq(await p.locator('#watchBoard .watch-tile').count(), 7, 'newly uploaded future state does not refresh the visible board');
        await advance(3000); t.eq(await p.locator('#watchBoard .watch-tile').count(), 6, 'future move eventually appears at its own timestamp');
        await advance(500); t.ok((await p.locator('#watchStatus').innerText()).startsWith('Bufferen'), 'playback buffers at the last known event instead of inventing progress');
        await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        t.ok(await p.evaluate(() => window.__replayStreams.every(s => s.closed)), 'background tab closes replay streams');
        await advance(1000);
        await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
        await emit('attempt-b', { createdAt: born + 2000, first: b.first, next: b.next, future });
        await p.waitForTimeout(40);
        t.eq(await p.locator('#watchBoard .watch-tile').count(), 6, 'returning to tab preserves playback position');
        await p.locator('#ranking a[href="#pB"]').click();
        t.ok(await p.evaluate(() => window.__replayStreams.filter(s => s.url.includes('/pA/')).every(s => s.closed)), 'old player streams closed');
        await emit('other-player', { createdAt: born, first: other.first, next: other.next });
        await p.waitForFunction(() => document.querySelector('#watchName').textContent === 'Bram' && document.querySelectorAll('#watchBoard .watch-tile').length === 7);
        await emit('attempt-a', { createdAt: born, first: a.first }); await p.waitForTimeout(40);
        t.eq(await p.locator('#watchBoard .watch-tile').count(), 7, 'late old-player callback cannot paint over the stream');
        await p.locator('#ranking a[href="#pOld"]').click(); await p.waitForTimeout(40);
        t.ok(await p.locator('#watchScreen').isHidden(), 'unsupported legacy attempt has no invented video');
        for (const width of [2048, 1500, 1200, 390]) { await p.setViewportSize({ width, height: 1000 }); t.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'fits viewport ' + width); }
        t.ok(await p.evaluate(() => window.__replayStreams.every(s => /\/replays\/p[AB]\/(attempt-[ab]|other-player)\.json$/.test(s.url))), 'only selected-player attempts are subscribed');
        t.eq(db.log.filter(e => e.m !== 'GET').length, 0, 'broadcast never writes to the game database');
        t.eq(errors, [], 'no dashboard errors');
      } finally { await ctx.close(); site.close(); }
    },
  },
];
module.exports.push({
  name: 'dashboard: offline attempts are selectable and replay independently of live updates',
  async run(t, { serve, FakeDB, browser, WWW }) {
    const site = await serve(SITE, { '/play/': WWW }), now = Date.now(), born = now - 3600000;
    const a = sample('recorded-one', born), b = sample('recorded-two', born + 3000);
    for (const [s, at] of [[a, 1], [b, 2]]) { const data = JSON.parse(s.first.data); data.init.at = at; s.first.data = JSON.stringify(data); }
    const finish = s => ({ ...s.next, seq: 2, data: JSON.stringify({ events: [[1500, 'end', { r: 'stuck' }]] }) });
    const db = new FakeDB({ scores: { pA: { name: 'Anna', level: 39 }, pB: { name: 'Bram', level: 2 } },
      plays: { pA: {
        s: { k: 'start', aid: 'recorded-one', lv: 39, at: 1, t: born }, e: { k: 'end', aid: 'recorded-one', lv: 39, at: 1, r: 'stuck', t: born + 1500 },
        n: { k: 'start', aid: 'recorded-two', lv: 39, at: 2, t: born + 3000 }, f: { k: 'end', aid: 'recorded-two', lv: 39, at: 2, r: 'stuck', t: born + 4500 },
        missing: { k: 'end', aid: 'missing-recording', lv: 40, at: 1, r: 'stuck', t: born + 5000 },
        expired: { k: 'end', aid: 'expired-recording', lv: 2, at: 1, r: 'stuck', t: now - 31 * 86400000 },
        legacy: { k: 'end', lv: 3, at: 1, r: 'win', t: born - 5000 },
      } }, replays: { pA: { 'recorded-one': { createdAt: born, first: a.first, next: a.next, finish: finish(a) }, 'recorded-two': { createdAt: born + 3000, first: b.first, next: b.next, finish: finish(b) } } } });
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
    await ctx.addInitScript(value => { window.__archiveNow = value; Date.now = () => window.__archiveNow; }, now);
    const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
    const advance = async ms => { for (let n = 0; n < ms; n += 50) { await p.evaluate(v => window.__archiveNow += v, Math.min(50, ms - n)); await p.waitForTimeout(25); } };
    try {
      await p.goto(site.url + 'dash/#pA'); await p.waitForSelector('#tbl button[data-aid="recorded-one"]');
      t.eq(await p.locator('#tbl button[data-aid^="recorded-"]').count(), 2, 'two attempts of one level have separate buttons without duplicate starts');
      t.eq(await p.locator('#tbl button[data-aid="expired-recording"]').count(), 0, 'expired attempts cannot request deleted recordings');
      await p.locator('#tbl button[data-aid="recorded-one"]').click();
      await p.waitForSelector('#watchBoard .watch-tile');
      t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'old attempt starts from initial board, without one-minute waiting');
      t.ok((await p.locator('#watchStats').innerText()).includes('poging 1'), 'chosen attempt is identified');
      await advance(900); t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'historical move is not early');
      await p.locator('#watchPause').click(); await advance(1000);
      t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'manual pause stops the replay clock');
      await p.evaluate(() => render());
      t.ok(await p.locator('#watchControls').isVisible(), 'regular dashboard render preserves archive selection');
      await p.locator('#watchPause').click(); await advance(100);
      t.eq(await p.locator('#watchBoard .watch-tile').count(), 7, 'resume plays move at its original offset');
      await advance(500); t.ok((await p.locator('#watchStatus').innerText()).startsWith('Opname afgelopen'), 'recording stops at its own end');
      await p.locator('#watchRestart').click(); await p.waitForTimeout(40);
      t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'restart returns to beginning');
      await p.locator('#tbl button[data-aid="recorded-two"]').click(); await p.waitForFunction(() => document.querySelector('#watchStats').textContent.includes('poging 2'));
      t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'another attempt starts independently');
      await advance(1700); await p.evaluate(() => render());
      t.ok((await p.locator('#watchStatus').innerText()).startsWith('Opname afgelopen'), 'completed playback stays selected after data refresh');
      await p.locator('#watchLive').click(); await p.waitForTimeout(40);
      t.ok(await p.locator('#watchControls').isHidden(), 'explicit return restores delayed live mode');
      await p.locator('#tbl button[data-aid="missing-recording"]').click(); await p.waitForFunction(() => document.querySelector('#watchStatus').textContent.includes('geen spelopname'));
      t.ok(await p.locator('#watchScreen').isHidden(), 'missing recording shows a clear unavailable state');
      await p.locator('#ranking a[href="#pB"]').click();
      t.ok(await p.locator('#watchControls').isHidden(), 'switching player clears the old recording');
      t.eq(db.log.filter(e => e.m !== 'GET').length, 0, 'historical playback only reads data');
      t.eq(errors, [], 'no replay errors');
    } finally { await ctx.close(); site.close(); }
  },
});
module.exports.sample = sample;
