'use strict';
/* The game tips (js/coach.js): from level RULES.coach.fromLevel they replace the tile lessons. */
const seen = { gold: 1, joker2: 1, ice: 1, lock: 1, clockMoves: 1, clock: 1, trayPair: 1 };
const freeTiles = p => p.evaluate(() => { const fr = []; for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && canTake(i)) fr.push(i); return fr; });
module.exports = [
  { name: 'game tips: every film plays in the player\'s own tiles, fits a small phone in both languages and leaves the game untouched', async run(t, { startLevel, click, sleep }) {
    for (const [lang, theme] of [['nl', 'fruit'], ['en', 'classic']]) {
      const p = await t.phone({ size: [360, 640], state: { name: 'Dennis', level: 100, sunSeen: true, lang, theme, seenSp: seen } });
      await startLevel(p, 100);
      for (const id of await p.evaluate(() => COACH_ORDER)) {
        const before = await p.evaluate(() => JSON.stringify([G.mv, G.tray, [...G.alive], [...G.down], G.peek, G.clock]));
        await p.evaluate(id => showCoachTip(id), id);
        t.ok(await p.evaluate(() => $('#modalBox').scrollHeight <= $('#modalBox').clientHeight + 1), `tip fits: ${lang} ${id}`);
        t.ok(await p.evaluate(() => document.querySelectorAll('.cz-board .tile').length > 4), 'the film shows a pile: ' + id);
        if (theme === 'fruit') t.ok(await p.evaluate(() => !!$('.cz-board .tile .emo') && !$('.cz-board .tile svg, .cz-board .tile .fi')), 'the film uses the player\'s theme');
        else t.ok(await p.evaluate(() => !!$('.cz-board .tile .fi')), 'classic pictures in the classic theme');
        t.ok(!/Dennis|Mrs|PUK|Gerda/.test(await p.locator('#modalBox').innerText()), 'no names in a tip');
        await sleep(3200);
        t.ok(+(await p.locator('.coach-demo').getAttribute('data-step')) >= 1, 'the film moves on: ' + id);
        t.eq(await p.evaluate(() => JSON.stringify([G.mv, G.tray, [...G.alive], [...G.down], G.peek, G.clock])), before, 'the film does not touch the game: ' + id);
        await click(p, '#ntGo');
        t.eq(await p.evaluate(() => coachRun), null, 'closing stops the film');
      }
    }
  }},
  { name: 'game tips: from level 60 no lesson shows on its own; the tips stay in the menu; every film starts both parts at the same moment', async run(t, { startLevel, click, modal }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 55, sunSeen: true, seenSp: seen } });
    await p.evaluate(() => showLessonMenu());
    t.eq(await p.locator('.lesson-pick:not(.cz-pick)').count(), 4, 'below 60: the tile lessons');
    await p.evaluate(() => { closeModal(); S.level = 95; save(); showLessonMenu(); });
    t.eq(await p.locator('.cz-pick[data-kind]').count(), 8, 'from 60: the game tips in the menu');
    t.eq(await p.locator('.cz-tilepick').count(), 4, 'and the explanations of the special tiles');
    await click(p, '.cz-pick[data-kind="remember"]');
    t.ok(await p.evaluate(() => !!$('#modalBox .coach-demo')), 'a tip opens from the menu');
    await click(p, '#ntGo');
    // an own film that was shown is kept with its tip: the menu marks it and the tip can play it
    await p.evaluate(() => { const c = coachTipClip('twin'); localStorage.setItem(CZ_MINE, JSON.stringify({ twin: { t: 1, lv: 95, clip: c } })); showLessonMenu(); });
    t.eq(await p.locator('.cz-pick[data-kind="twin"] .cz-mine').count(), 1, 'the menu marks a tip with an own example');
    await click(p, '.cz-pick[data-kind="twin"]');
    await click(p, '.cz-sw[data-w="mine"]');
    t.ok(await p.evaluate(() => $('#modalBox .coach-demo').classList.contains('coach-own') && !!coachRun), 'the own example plays in the tip');
    await click(p, '#ntGo');
    await p.evaluate(() => { localStorage.removeItem(CZ_MINE); closeModal(); });
    await p.evaluate(() => showLessonMenu()); await click(p, '.cz-tilepick[data-tile="ice"]');
    t.eq(await p.locator('.lesson-demo').getAttribute('data-lesson'), 'ice', 'tile explanations open from the same menu');
    await click(p, '#ntGo'); await p.evaluate(() => closeModal());
    for (const lv of [65, 95]) {
      await p.evaluate(lv => { S.fails['L' + lv] = 3; save(); }, lv);
      await startLevel(p, lv);
      t.eq(await modal(p), null, 'third failure at ' + lv + ': no lesson of its own');
    }
    // the right way starts where the wrong way started, and every tap of it is a real move
    const bad = await p.evaluate(() => COACH_ORDER.filter(id => {
      const c = coachTipClip(id); if (c.segs.length < 2) return false;
      if (JSON.stringify(c.segs[0].start) !== JSON.stringify(c.segs[1].start)) return true;
      let s = czState(c.segs[1].start);
      for (const a of c.segs[1].acts) { if (a[0] === 'end') continue; if (czStep(s, c.faces, a[1])[0] !== a[0]) return true; s = czApply(s, c.faces, a); }
      return s.tray.length >= 4;
    }));
    t.eq(bad, [], 'both parts of every tip start at the same moment and play real moves');
  }},
  { name: 'game tips: the little game follows the real one tap for tap', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 140, sunSeen: true, seenSp: seen } });
    let n = 0;
    for (const lv of [100, 92, 120, 135]) {
    await startLevel(p, lv);
    for (let k = 0; k < 40; k++) {
      const done = await p.evaluate(() => G.overShown || G.done || G.autoFin); if (done) break;
      const fr = await freeTiles(p);
      // prefer what keeps the try going, but also peeks and singles, like a player
      // a face-down tile whose twin waits in the tray first: it goes straight there, flipping open
      const i = await p.evaluate(fr => fr.find(i => G.down[i] && i !== G.peek && trayHas(faceOf(i))) ?? fr.find(i => trayHas(faceOf(i))) ?? (G.peek >= 0 ? fr.find(i => i !== G.peek && faceOf(i) === faceOf(G.peek)) : undefined) ?? fr.find(i => G.down[i] && i !== G.peek) ?? fr.find(i => fr.some(j => j !== i && faceOf(j) === faceOf(i))) ?? fr[0], fr);
      if (i === undefined) break;
      await p.evaluate(i => onTap(i), i); n++;
      await sleep(80);
      const same = await p.evaluate(() => {
        const z = G.cz; if (!z) return true;
        const faces = G.tiles.map((t, i) => faceOf(i)); let s = czState(z.start);
        for (const i of z.taps) s = czApply(s, faces, czStep(s, faces, i));
        // every tapped tile counts as seen (also a face-down tile that went straight to its twin)
        const seen = czRun(z).seen;
        return s.a.every((v, i) => v === G.alive[i]) && s.tray.join() === G.tray.map(faceOf).join() && s.p === G.peek && z.taps.every(i => seen.has(i))
          && (!s.ck || s.ck.done || s.ck.left === clockLeft());   // the clock counts exactly as in the game
      });
      if (!t.ok(same, `little game equals the real one: level ${lv}, tap ${n}`)) break;
    }
    await p.evaluate(() => { if ($('#modal:not(.hidden)')) closeModal(); });
    }
    t.ok(n > 30, 'enough taps were checked', n);
  }},
  { name: 'game tips: a better route only uses tiles the player has seen, in this try or an earlier try of the same board', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 141, sunSeen: true, seenSp: seen } });
    let checked = 0;
    for (const lv of [85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140]) {
      await startLevel(p, lv);
      const r = await p.evaluate(() => {
        if (!G.clock) return null;
        const faces = G.tiles.map((t, i) => faceOf(i)), tiles = G.tiles.map(t => [t.x, t.y, t.z]);
        const st = czState({ a: Array.from(G.alive), d: Array.from(G.down), p: -1, tray: [], ck: { i: G.clock.i, left: G.clock.n } });
        const known = new Set(); czLook(st, tiles, G.nb, known);
        const ob = G.ob ? { need: { ...G.ob.need }, locks: [...G.ob.locks], keys: G.ob.keys.slice(), unlocked: G.ob.unlocked } : null, inb = ob ? Layouts.iceNeighbors(G.tiles) : null;
        const route = czClockRoute(st, faces, tiles, G.nb, ob, inb, known);
        const none = czClockRoute(st, faces, tiles, G.nb, ob, inb, new Set());
        // replay it tap by tap with the game's own rule: after every tap, the clock tile must be gone or have moves left
        let x = st, fair = true;
        for (const a of route || []) { x = czApply(x, faces, a); if (x.tray.length >= 4 || (!x.ck.done && x.ck.left <= 0)) { fair = false; break; } }
        if (route && !x.ck.done) fair = false;
        return { route, known: [...known], none, fair };
      });
      if (!r) continue;
      checked++;
      t.eq(r.none, null, 'nothing seen: no route at ' + lv);
      t.ok(r.fair, 'the route is a real game tap by tap: never a tap after the clock ran out, the clock tile in time, at ' + lv, r.route);
      if (r.route) t.ok(r.route.every(a => a.slice(1).every(i => r.known.includes(i))), 'route uses only seen tiles at ' + lv, r.route);
    }
    t.ok(checked >= 2, 'clock levels were checked', checked);
    // what was seen in a lost try counts for the next try of the same level, not for another level
    let peeked;
    for (const lv of [110, 120, 130, 95, 100, 105, 115, 125]) {
      await startLevel(p, lv);
      // (test set-up: a free tile lies face down, as the deal on a retry still is)
      peeked = await p.evaluate(() => { const fr = []; for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && canTake(i)) fr.push(i);
        const x = fr.find(i => G.down[i]) ?? fr[0]; if (x === undefined) return undefined; if (!G.down[x]) { G.down[x] = 1; renderBoard(false); updateBlocked(); } onTap(x); return x; });
      if (peeked !== undefined) break;
    }
    t.ok(peeked !== undefined, 'a face-down tile to peek at');
    await sleep(300);
    await p.evaluate(() => restart()); await sleep(800);
    await p.evaluate(x => { G.down[x] = 1; renderBoard(false); updateBlocked(); }, peeked);
    const k = await p.evaluate(() => G.key);
    await p.evaluate(() => { const fr = []; for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && canTake(i) && !G.down[i]) fr.push(i); onTap(fr[0]); });
    t.ok(await p.evaluate(([k, i]) => !!czMemory.get(k) && czMemory.get(k).seen.has(i), [k, peeked]), 'the peeked tile is remembered for the retry');
  }},
];
