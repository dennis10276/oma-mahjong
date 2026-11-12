'use strict';
const seen = { gold: 1, joker2: 1, ice: 1, lock: 1, clock: 1, clockMoves: 1, trayPair: 1 };
const finish = async p => {
  await p.waitForFunction(() => !document.querySelector('#ntGo').disabled, null, { timeout: 60000 });
  await p.locator('#ntGo').click();
};
module.exports = [
  { name: 'level instructions: required ice and lock examples run in order, block play and back, survive reopening and persist only after acknowledgment', async run(t, { click, modal }) {
    const p = await t.phone({ size: [360, 640], state: { name: 'Dennis', level: 45, sunSeen: true, seenSp: { ...seen, ice: 0, lock: 0 } } });
    await p.evaluate(() => startLevel(45));
    t.eq(await p.locator('.lesson-demo').getAttribute('data-lesson'), 'lock', 'introduce a present lock first');
    t.ok(await p.locator('#ntGo').isDisabled(), 'cannot acknowledge an unfinished example');
    t.ok(await p.evaluate(() => $('#modalBox').scrollHeight <= $('#modalBox').clientHeight + 1), 'required instructions fit a small phone');
    await click(p, '#ntGo');
    await p.evaluate(() => {
      handleBack(); $('#modal').click();
      const i = G.tiles.findIndex((_, i) => canTake(i)); onTap(i);
      resumeClock();
    });
    t.eq(await p.evaluate(() => [modalFree(), G.mv, !!G.tStart, !!S.seenSp.lock]), [false, 0, false, false], 'back, backdrop, early confirmation and taps cannot bypass instructions');
    await p.reload(); await p.waitForFunction(() => window.__mjReady);
    await p.evaluate(() => startLevel(45));
    t.eq(await p.locator('.lesson-demo').getAttribute('data-lesson'), 'lock', 'unfinished instruction returns on resume');
    await finish(p);
    t.eq(await p.locator('.lesson-demo').getAttribute('data-lesson'), 'ice', 'second new tile is explained before play');
    t.eq(await p.evaluate(() => [!!S.seenSp.lock, !!S.seenSp.ice, G.mv]), [true, false, 0], 'only the acknowledged kind is remembered');
    t.ok(await p.evaluate(() => $('#modalBox').scrollHeight <= $('#modalBox').clientHeight + 1), 'required ice explanation fits');
    await finish(p);
    t.eq(await modal(p), null, 'play starts after both instructions');
    t.eq(await p.evaluate(() => [G.introducing, !!G.tStart, !!JSON.parse(localStorage.getItem(STORE)).seenSp.ice]), [false, true, true], 'timer resumes and completion is saved');
    await p.evaluate(() => restart());
    t.eq(await modal(p), null, 'retry does not repeat completed introductions');
    t.eq(p.errors, [], 'no browser errors');
  }},
  { name: 'level instructions: reduced motion waits for play and a complete example; manual help remains immediately dismissible', async run(t, { click, startLevel, sleep }) {
    const p = await t.phone({ size: [360, 640], state: { name: 'Dennis', level: 35, sunSeen: true, lang: 'en', seenSp: { ...seen, ice: 0 } } });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.evaluate(() => startLevel(35));
    t.ok(await p.locator('#ntGo').isDisabled(), 'English introduction starts locked');
    await sleep(1600);
    t.eq(await p.locator('.lesson-demo').getAttribute('data-step'), '0', 'reduced motion does not auto-play');
    t.ok(await p.locator('#ntGo').isDisabled(), 'elapsed time alone does not unlock');
    await click(p, '.lesson-toggle');
    await finish(p);
    await startLevel(p, 35);
    await p.evaluate(() => showTileLesson('ice', null, false, 'manual'));
    t.ok(await p.locator('#ntGo').isEnabled(), 'manual explanation can be closed immediately');
    await click(p, '#ntGo');
    t.eq(p.errors, [], 'no browser errors');
  }},
  { name: 'level instructions: gold and joker explanations require confirmation and face-down tiles cannot be dismissed with back', async run(t, { click, modal }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 45, sunSeen: true, seenSp: { ...seen, gold: 0, joker2: 0 } } });
    await p.evaluate(() => startLevel(20));
    t.ok((await modal(p)).title.includes('Gouden'), 'first golden pair has instructions');
    t.eq(await p.evaluate(() => [!!S.seenSp.gold, modalClosable]), [false, false], 'gold waits for confirmation');
    await click(p, '#ntGo');
    await p.evaluate(() => { G.tiles[0].face = JOKER; G.o.faces[0] = JOKER; newTileIntro(); });
    t.eq(await p.evaluate(() => [!!S.seenSp.joker2, modalClosable]), [false, false], 'joker also waits for confirmation');
    await click(p, '#ntGo');
    t.ok(await p.evaluate(() => S.seenSp.joker2), 'joker confirmation is saved');
    await p.evaluate(() => { S.seenDown = false; startLevel(35); });
    t.ok((await modal(p)).buttons.includes('mGo'), 'face-down instructions appear before play');
    await p.evaluate(() => handleBack());
    t.eq(await p.evaluate(() => [modalFree(), S.seenDown]), [false, false], 'back cannot dismiss face-down instructions');
    await click(p, '#mGo');
    t.eq(await p.evaluate(() => [modalFree(), S.seenDown, G.introducing]), [true, true, false], 'confirmation starts the level');
  }},
  { name: 'level instructions: no automatic tips after losses or restarts at any old reminder threshold', async run(t, { startLevel, click, modal, sleep }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 100, sunSeen: true, seenSp: seen } });
    for (const lv of [55, 100]) for (const losses of [3, 9, 21]) {
      await p.evaluate(([lv, losses]) => { S.fails['L' + lv] = losses; S.czLoss['L' + lv] = { n: losses, shown: 0 }; }, [lv, losses]);
      await startLevel(p, lv);
      t.eq(await modal(p), null, `no retry reminder at ${lv}/${losses}`);
      await click(p, '#btnRestart');
      t.eq(await p.locator('.coach-demo').count(), 0, 'restart confirmation has no tip');
      await click(p, '#rYes');
      t.eq(await modal(p), null, 'confirmed restart starts directly');
      await p.evaluate(() => { G.tray = [0, 1, 2, 3]; checkStuck(); });
      await sleep(600);
      t.eq((await modal(p)).buttons, ['sRetry', 'sMenu'], 'loss has only retry and menu');
      t.eq(await p.locator('.coach-demo').count(), 0, 'tray loss has no tip');
      await click(p, '#sRetry');
      t.eq(await modal(p), null, 'lost try restarts without a tip');
    }
    await startLevel(p, 80);
    await p.evaluate(() => { G.clock.n = G.mv; checkClock(); });
    await sleep(800);
    t.eq(await p.locator('.coach-demo').count(), 0, 'clock timeout has no automatic tip');
    t.eq((await modal(p)).buttons, ['sRetry', 'sMenu'], 'clock loss keeps normal actions');
    t.eq(p.errors, [], 'no browser errors');
  }},
];
