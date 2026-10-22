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
  { name: 'game tips: from level 90 the tips replace the tile lessons in the menu and the retry reminders', async run(t, { startLevel, click, modal }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 80, sunSeen: true, seenSp: seen } });
    await p.evaluate(() => showLessonMenu());
    t.eq(await p.locator('.lesson-pick:not(.cz-pick)').count(), 4, 'below 90: the tile lessons');
    await p.evaluate(() => { closeModal(); S.level = 95; save(); showLessonMenu(); });
    t.eq(await p.locator('.cz-pick').count(), 8, 'from 90: the game tips');
    await click(p, '.cz-pick[data-kind="remember"]');
    t.ok(await p.evaluate(() => !!$('#modalBox .coach-demo')), 'a tip opens from the menu');
    await click(p, '#ntGo');
    await p.evaluate(() => { S.fails.L95 = 3; save(); });
    await startLevel(p, 95);
    t.ok(await p.evaluate(() => !!$('#modalBox .coach-demo') && !$('#modalBox .lesson-demo:not(.coach-demo)')), 'third failure at 95: a game tip instead of a tile lesson');
    await click(p, '#ntGo');
    t.eq(await modal(p), null, 'play goes on after the tip');
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
      const i = await p.evaluate(fr => fr.find(i => trayHas(faceOf(i))) ?? (G.peek >= 0 ? fr.find(i => i !== G.peek && faceOf(i) === faceOf(G.peek)) : undefined) ?? fr.find(i => G.down[i] && i !== G.peek) ?? fr.find(i => fr.some(j => j !== i && faceOf(j) === faceOf(i))) ?? fr[0], fr);
      if (i === undefined) break;
      await p.evaluate(i => onTap(i), i); n++;
      await sleep(80);
      const same = await p.evaluate(() => {
        const z = G.cz; if (!z) return true;
        const faces = G.tiles.map((t, i) => faceOf(i)); let s = czState(z.start);
        for (const i of z.taps) s = czApply(s, faces, czStep(s, faces, i));
        return s.a.every((v, i) => v === G.alive[i]) && s.tray.join() === G.tray.map(faceOf).join() && s.p === G.peek;
      });
      if (!t.ok(same, `little game equals the real one: level ${lv}, tap ${n}`)) break;
    }
    await p.evaluate(() => { if ($('#modal:not(.hidden)')) closeModal(); });
    }
    t.ok(n > 30, 'enough taps were checked', n);
  }},
  { name: 'game tips: a lost try shows the player\'s own last moves and the better move', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ size: [360, 640], state: { name: 'Dennis', level: 111, sunSeen: true, theme: 'animals', seenSp: seen } });
    await startLevel(p, 110);
    // one free tile of an open pair lies face down; three single tiles fill the tray; then the peeked tile is tapped again
    const [x, y] = await p.evaluate(() => {
      const fr = []; for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && canTake(i)) fr.push(i);
      const x = fr.find(i => !G.down[i] && fr.some(j => j !== i && !G.down[j] && faceOf(j) === faceOf(i)));
      G.down[x] = 1; renderBoard(false); updateBlocked();
      return [x, fr.find(j => j !== x && faceOf(j) === faceOf(x))];
    });
    for (let k = 0; k < 3; k++) {
      const c = await p.evaluate(([x, y]) => { const fr = []; for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && canTake(i)) fr.push(i);
        return fr.find(i => i !== x && i !== y && !G.down[i] && !trayHas(faceOf(i)) && !fr.some(j => j !== i && faceOf(j) === faceOf(i)) && (!G.clock || i !== G.clock.i)); }, [x, y]);
      t.ok(c !== undefined, 'a single tile to fill the tray'); await p.evaluate(i => onTap(i), c); await sleep(500);
    }
    await p.evaluate(x => onTap(x), x); await sleep(400);
    await p.evaluate(x => onTap(x), x); await sleep(1400);
    t.ok(await p.evaluate(() => !!$('#modalBox .coach-own')), 'the loss shows the own film');
    t.eq(await p.evaluate(() => coachReview('tray') && coachReview('tray').kind), 'twin', 'the right tip: tap the twin');
    t.ok(await p.evaluate(() => $('#modalBox').scrollHeight <= $('#modalBox').clientHeight + 1), 'the own film fits a small phone');
    t.ok(await p.evaluate(() => !!$('.cz-board .tile .emo')), 'in the player\'s own tiles');
    await sleep(200);
    await p.evaluate(() => $('#sRetry').click()); await sleep(600);
    t.eq(await p.evaluate(() => [G.mv, G.tray.length, !!G.cz]), [0, 0, false], 'trying again starts a fresh try and fresh notes');
  }},
];
