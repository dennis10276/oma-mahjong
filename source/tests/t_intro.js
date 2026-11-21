'use strict';
/* The intro film (js/intro.js): the first time a player meets a mechanic, a small film on a few tiles in the
   player's own theme and background shows it, with one line saying what to do. The first time the button
   works only after the film has played once; from the help menu it can be closed at once. */
const seen = { gold: 1, joker2: 1, ice: 1, lock: 1, clock: 1, clockMoves: 1, trayPair: 1 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const filmTiles = p => p.evaluate(() => [...document.querySelectorAll('#modalBox .intro-film .intro-board .tile')].map(e => ({
  ice: (e.querySelector('.ob') || {}).dataset?.k || '', hidden: e.classList.contains('hidden'), html: e.querySelector('.face').innerHTML })));
const helpMessages = (p, pid) => p.db.plays(pid).filter(e => e.k === 'help_msg');
const drain = p => p.evaluate(() => flushLog()).then(() => p.waitForFunction(() => !flushing && !readQ().length));

module.exports = [
  { name: 'intro: the first ice film must be watched before the button works', async run(t) {
    const pid = 'test-intro-ice';
    const p = await t.phone({ state: { name: 'Dennis', pid, level: 35, sunSeen: true, theme: 'fruit', seenSp: { ...seen, ice: 0 } } });
    await p.evaluate(() => { localStorage.removeItem('omamj.cur'); __mj.startLevel(35); });
    await p.waitForSelector('#modalBox .intro-film', { timeout: 15000 });
    const opened = Date.now();
    t.ok(await p.evaluate(() => typeof playIntroFilm === 'function' && !!INTRO_FILMS.ice), 'playIntroFilm and INTRO_FILMS exist');
    t.ok(await p.evaluate(() => $('#modalBox .intro-film').dataset.kind === 'ice'), 'the pop-up shows the ice film');
    t.ok(await p.locator('#ntGo').isDisabled(), 'the button does not work before the film has played');
    const tiles = await filmTiles(p);
    t.ok(tiles.length >= 2 && tiles.length <= 8, 'a small board of at most 8 tiles', tiles.length);
    t.eq(tiles.map(x => x.ice).filter(Boolean), ['ice2'], 'one tile lies under thick ice, drawn like the board');
    const own = await p.evaluate(() => INTRO_FILMS.ice.tiles.map(x => Tiles.faceHTML(S.theme, x[1])));
    t.eq(tiles.map(x => x.html), own, 'tiles in the player\'s own theme');
    t.ok(await p.evaluate(() => $('#modalBox .intro-film').style.background.length > 0), 'on the player\'s own background');
    t.ok(await p.evaluate(() => !!$('#modalBox p.intro-line') && $('#modalBox p.intro-line').innerHTML === tx('intro_ice')), 'one line under the film says what to do');
    t.ok(await p.evaluate(() => INTRO_FILM_MS >= 3500 && INTRO_FILM_MS <= 4500), 'a quick film: about 4 seconds');
    const taps = await p.evaluate(() => INTRO_FILMS.ice.steps.filter(([, fn]) => { let tapped = false; fn({ point() { }, rest() { }, tap() { tapped = true; } }); return tapped; }).map(([ms]) => ms));
    t.ok(taps.slice(1).every((ms, k) => ms - taps[k] >= 500 && ms - taps[k] <= 600), 'taps 0.5 to 0.6 s apart', taps);
    t.ok(await p.evaluate(() => $('#modalBox').scrollHeight <= $('#modalBox').clientHeight + 1), 'film, Dutch line and button fit the phone without scrolling');
    // back and taps on the board do not get around it
    await p.evaluate(() => { handleBack(); $('#modal').click(); });
    t.eq(await p.evaluate(() => [modalFree(), !!G.tStart, G.introducing]), [false, false, true], 'back and the backdrop do not close it; the level clock waits');
    const len = await p.evaluate(() => INTRO_FILM_MS);
    await sleep(Math.max(0, opened + len - 700 - Date.now()));
    t.ok(await p.locator('#ntGo').isDisabled(), 'still locked just before the film ends');
    await sleep(Math.max(0, opened + len + 500 - Date.now()));
    t.ok(await p.locator('#ntGo').isEnabled(), 'the button works after the film has played once');
    t.ok(await filmTiles(p).then(ts => ts.every(x => !x.ice) && ts.filter(x => !x.hidden).length === 1), 'by the end the ice melted and every tile but the one beside it was taken');
    t.eq(await p.evaluate(() => introRun.log), [['frozen', 'ice'], ['take', 'up'], ['crack', 'ice', 1], ['take', 'down'], ['melt', 'ice'], ['pair', 'up', 'down'],
      ['covered', 'ice'], ['take', 'top'], ['take', 'ice']], 'the film shows every ice rule in order: frozen, above, below, thick ice, still covered, freed');
    await drain(p);
    const shown = helpMessages(p, pid).at(-1);
    t.eq(shown && [shown.topic, shown.why, shown.action], ['ice', 'intro', 'shown'], 'the dashboard sees the intro');
    await p.locator('#ntGo').click();
    t.eq(await p.evaluate(() => [!!S.seenSp.ice, !!JSON.parse(localStorage.getItem(STORE)).seenSp.ice, modalFree(), G.introducing, !!G.tStart]), [true, true, true, false, true], 'the button saves seenSp.ice and starts the level clock');
    await drain(p);
    t.eq(helpMessages(p, pid).at(-1).action, 'ack', 'the acknowledgment reaches the dashboard');
    t.eq(await p.evaluate(() => introRun), null, 'closing stops the film');
  }},
  { name: 'intro: the ice film from the help menu can be closed at once, plays twice and stops; old lessons keep the other tiles', async run(t, { startLevel, click }) {
    const p = await t.phone({ size: [360, 640], state: { name: 'Dennis', level: 40, sunSeen: true, lang: 'en', seenSp: seen } });
    await startLevel(p, 40);
    const before = await p.evaluate(() => JSON.stringify([G.mv, G.tray, [...G.alive], obState()]));
    await p.evaluate(() => showLessonMenu());
    await click(p, '.lesson-pick[data-kind="ice"]');
    t.ok(await p.evaluate(() => $('#modalBox .intro-film').dataset.kind === 'ice'), 'the help menu opens the new ice film');
    t.ok(await p.locator('#ntGo').isEnabled(), 'seen again from the help menu: the button works at once');
    t.eq(await p.evaluate(() => $('#modalBox h2').textContent), 'Frozen tiles', 'English title');
    t.ok(await p.evaluate(() => $('#modalBox').scrollHeight <= $('#modalBox').clientHeight + 1), 'film, line and button fit a small phone');
    // two plays, then it rests
    await p.waitForFunction(() => $('#modalBox .intro-film').dataset.play === '2', null, { timeout: 15000 });
    await p.waitForFunction(() => $('#modalBox .intro-film').classList.contains('intro-end'), null, { timeout: 15000 });
    t.eq(await p.evaluate(() => introRun && introRun.timers.length), 0, 'after two plays the film rests');
    await click(p, '#modalBox .intro-film');
    t.eq(await p.evaluate(() => [$('#modalBox .intro-film').dataset.play, $('#modalBox .intro-film').classList.contains('intro-end')]), ['3', false], 'a tap on the film plays it again');
    t.eq(await p.evaluate(() => JSON.stringify([G.mv, G.tray, [...G.alive], obState()])), before, 'the film does not touch the game');
    await click(p, '#ntGo');
    t.ok(await p.evaluate(() => !!$('#modalBox .lesson-pick')), 'back to the help menu');
    await click(p, '.lesson-pick[data-kind="lock"]');
    t.ok(await p.evaluate(() => !$('#modalBox .intro-film') && !!$('#modalBox .lesson-demo')), 'the other tiles keep their old film for now');
    await p.evaluate(() => { S.lang = 'nl'; showTileLesson('ice', null, false, 'manual'); });
    t.ok(await p.evaluate(() => $('#modalBox p.intro-line').textContent.includes('erboven')), 'Dutch line');
    t.ok(await p.evaluate(() => $('#modalBox').scrollHeight <= $('#modalBox').clientHeight + 1), 'the Dutch line fits a small phone too');
    t.eq(p.errors, [], 'no browser errors');
  }},
  { name: 'intro: the ice film follows the game rules: every tap does what layouts.js takeable says', async run(t) {
    const p = await t.phone({ state: { name: 'Dennis', level: 40, sunSeen: true, seenSp: seen } });
    const r = await p.evaluate(() => {
      const film = INTRO_FILMS.ice, ids = film.tiles.map(x => x[0]), tiles = film.tiles.map(([, , x, y, z]) => ({ x, y, z }));
      const nb = Layouts.neighbors(tiles), inb = Layouts.iceNeighbors(tiles), I = ids.indexOf('ice');
      const ice = Object.fromEntries(film.tiles.filter(x => x[5]).map(x => [ids.indexOf(x[0]), x[5]]));
      const rules = { iceNb: inb, ice, locks: null, keys: [] }, alive0 = tiles.map(() => 1), alive = alive0.slice();
      // the taps of the film, in order, with what the game would do: take it, or not
      const taps = film.steps.map(([, fn]) => { let id = null; fn({ point() { }, rest() { }, tap(x) { id = x; } }); return id; }).filter(Boolean);
      const outcome = taps.map(id => { const i = ids.indexOf(id), ok = Layouts.takeable(i, alive, nb, rules, alive0); if (ok) alive[i] = 0; return [id, ok]; });
      const rel = j => { const a = tiles[I], b = tiles[j]; return a.z !== b.z ? 'layer' : a.y === b.y ? 'beside' : 'above/below'; };
      return { touching: inb[I].map(j => [ids[j], rel(j)]).sort(), onTop: nb.above[I].map(j => ids[j]), outcome, need: ice[I], tiles: tiles.length };
    });
    t.eq(r.touching, [['down', 'above/below'], ['side', 'beside'], ['top', 'layer'], ['up', 'above/below']], 'the touching tiles: one above and one below in the same layer, one beside, one in the layer on top');
    t.eq(r.onTop, ['top'], 'the tile on the next layer lies on the frozen tile');
    t.eq(r.need, 2, 'thick ice: two touching tiles must go');
    t.ok(r.tiles <= 8, 'at most 8 tiles');
    t.eq(r.outcome, [['ice', false], ['up', true], ['down', true], ['ice', false], ['top', true], ['ice', true]], 'each tap does what the game does');
  }},
];
