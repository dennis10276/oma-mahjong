'use strict';
const path = require('path'), fs = require('fs');
const SITE = fs.existsSync(path.join(__dirname, '..', 'site')) ? path.join(__dirname, '..', 'site') : path.join(__dirname, '..', '..');
const { read } = require(path.join(SITE, 'dash', 'replay-state'));
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
    name: 'dashboard: selected live board updates safely, hides unknown faces and closes old attempt streams',
    async run(t, { serve, FakeDB, browser, WWW }) {
      const site = await serve(SITE, { '/play/': WWW });
      const now = Date.now(), a = sample('attempt-a', now), b = sample('attempt-b', now);
      const f = { scores: { pA: { name: 'Anna', level: 39 }, pB: { name: 'Bram', level: 39 }, pOld: { name: 'Oudere versie', level: 2 } },
        plays: { pA: { s: { k: 'start', aid: 'attempt-a', lv: 39, t: now } }, pB: { s: { k: 'start', aid: 'attempt-b', lv: 39, t: now } }, pOld: { s: { k: 'start', lv: 2, t: now } } } };
      const db = new FakeDB(f), ctx = await browser.newContext({ viewport: { width: 2546, height: 1200 } });
      await ctx.route(u => u.hostname.endsWith('firebasedatabase.app'), r => db.handle(r));
      await ctx.addInitScript(() => {
        const Native = window.EventSource; window.__replayStreams = [];
        window.EventSource = class {
          constructor(url) { if (!url.includes('/replays/')) return new Native(url); this.url = url; this.closed = false; this.listeners = {}; window.__replayStreams.push(this); }
          addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
          close() { this.closed = true; }
          emit(type, path, data) { for (const callback of this.listeners[type] || []) callback({ data: JSON.stringify({ path, data }) }); }
        };
      });
      const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
      const emit = async (stream, type, eventPath, data) => p.evaluate(({ stream, type, eventPath, data }) => window.__replayStreams[stream].emit(type, eventPath, data), { stream, type, eventPath, data });
      try {
        await p.goto(site.url + 'dash/#pA'); await p.waitForFunction(() => window.__replayStreams.length === 1);
        t.ok(await p.locator('#watchEmpty').isVisible(), 'waiting state until actual recording arrives');
        const noView = clone(a.first), parsed = JSON.parse(noView.data); parsed.events = parsed.events.filter(e => e[1] !== 'view'); noView.data = JSON.stringify(parsed);
        await emit(0, 'put', '/', { first: noView });
        t.ok(await p.locator('#watchScreen').isHidden(), 'does not guess the theme before display settings arrive');
        await emit(0, 'put', '/', { createdAt: now, first: a.first });
        t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'initial board shown');
        t.eq(await p.locator('#watchBoard .back').count(), 1, 'hidden tile stays face down');
        t.eq(await p.locator('#watchBoard .back svg').count(), 0, 'hidden identity never rendered in the tile');
        t.ok((await p.locator('#watchStatus').innerText()).startsWith('Spel bezig'), 'fresh ongoing snapshot labelled as play');
        t.ok((await p.locator('.watch-note').innerText()).includes('30 seconden'), 'batch delay made clear');
        t.ok(await p.locator('.game-watch').evaluate(el => el.getBoundingClientRect().right <= document.querySelector('.analysis-details').getBoundingClientRect().left), 'game fills the left panel beside the heatmap, progress and live feed');
        await emit(0, 'patch', '/', { next: a.next });
        t.eq(await p.locator('#watchBoard .watch-tile').count(), 7, 'streamed delta removes the selected tile');
        t.eq(await p.locator('#watchTray .watch-slot:not(.vacant)').count(), 1, 'streamed tray shown');
        t.eq(await p.locator('#watchBoard .back').count(), 0, 'peek visible when player sees it');
        await p.locator('#ranking a[href="#pB"]').click(); await p.waitForFunction(() => window.__replayStreams.length === 2);
        t.eq(await p.evaluate(() => window.__replayStreams[0].closed), true, 'old stream closed on player switch');
        t.ok(await p.locator('#watchEmpty').isVisible(), 'old board immediately removed while switching');
        await emit(1, 'put', '/', { first: b.first });
        await emit(0, 'put', '/', { first: a.first, next: a.next });
        t.eq(await p.locator('#watchName').innerText(), 'Bram', 'selected identity stays current');
        t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'late old-player callback cannot overwrite current board');
        await p.evaluate(() => { render(); render(); }); t.eq(await p.evaluate(() => window.__replayStreams.length), 2, 'summary refresh does not open duplicate streams');
        const late = { ...b.next, seq: 2 };
        await emit(1, 'patch', '/', { gap: late });
        t.ok((await p.locator('#watchStatus').innerText()).startsWith('Onvolledig spelbeeld'), 'gap visibly flagged');
        t.eq(await p.locator('#watchBoard .watch-tile').count(), 8, 'gapped delta not applied');
        await emit(1, 'put', '/', { first: b.first, next: b.next });
        const ending = { ...b.next, seq: 2, data: JSON.stringify({ events: [[3000, 'pause', null]] }) };
        await emit(1, 'patch', '/', { pause: ending });
        t.ok((await p.locator('#watchStatus').innerText()).startsWith('Gepauzeerd'), 'pause not claimed as live play');
        ending.seq = 3; ending.data = JSON.stringify({ events: [[4000, 'end', { r: 'win' }]] });
        await emit(1, 'patch', '/', { finish: ending });
        t.ok((await p.locator('#watchStatus').innerText()).startsWith('Level gehaald'), 'finished attempt labelled');
        await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        t.eq(await p.evaluate(() => window.__replayStreams[1].closed), true, 'background dashboard closes its replay connection');
        await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
        t.eq(await p.evaluate(() => window.__replayStreams.length), 3, 'foreground dashboard reconnects only its selected attempt');
        const stale = sample('attempt-b', now - 120000);
        await emit(2, 'put', '/', { first: stale.first });
        t.ok((await p.locator('#watchStatus').innerText()).startsWith('Laatste spelbeeld'), 'old snapshot is never labelled as live');
        await emit(2, 'put', '/', { bad: { ...b.first, aid: 'wrong-attempt' } });
        t.ok(await p.locator('#watchScreen').isHidden(), 'unreliable recording hides the board');
        t.ok((await p.locator('#watchStatus').innerText()).includes('ongeldig'), 'unreliable recording explained');
        await p.locator('#ranking a[href="#pOld"]').click();
        t.eq(await p.evaluate(() => window.__replayStreams[2].closed), true, 'stream closed for legacy attempt');
        t.ok((await p.locator('#watchEmpty').innerText()).includes('geen spelopname'), 'missing legacy recording explained');
        t.ok(await p.locator('#watchScreen').isHidden(), 'no board invented for older recordings');
        for (const width of [2100, 2048, 1500, 1200, 390]) { await p.setViewportSize({ width, height: 1000 }); t.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'viewer fits viewport ' + width); }
        t.ok(await p.evaluate(() => window.__replayStreams.every(s => /\/replays\/p[AB]\/attempt-[ab]\.json$/.test(s.url))), 'only selected attempt is subscribed, never replay root or whole player history');
        t.eq(db.log.filter(e => e.m !== 'GET').length, 0, 'watching writes nothing');
        t.eq(errors, [], 'no dashboard errors');
      } finally { await ctx.close(); site.close(); }
    },
  },
];
module.exports.sample = sample;
