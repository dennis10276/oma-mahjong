'use strict';
/* The intro film (js/intro.js): the first time a player meets a mechanic, a tiny level is played for them on the real
   game screen by the game's own code, with one line saying what to do. The first time the button works only after
   the film has played once; from the help menu it can be closed at once. The player's own level comes back exactly
   as it was, and nothing of the film is saved, logged or counted. */
const seen = { gold: 1, joker2: 1, ice: 1, lock: 1, clock: 1, clockMoves: 1, trayPair: 1 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const helpMessages = (p, pid) => p.db.plays(pid).filter(e => e.k === 'help_msg');
const drain = p => p.evaluate(() => flushLog()).then(() => p.waitForFunction(() => !flushing && !readQ().length));
// the player's own level, and everything kept on the phone (the play-log and replay queues are uploaded meanwhile: checked apart)
const levelOf = () => { const g = window.__realG || G; return JSON.stringify({ alive: [...g.alive], tray: g.tray, faces: g.tiles.map(t => t.face), down: [...g.down], peek: g.peek,
  ob: g.ob && { ...g.ob, locks: [...g.ob.locks] }, score: g.score, clock: g.clock, mv: g.mv, st: g.st, usedHint: g.usedHint, gold: [...g.gold] }); };
const phoneData = () => { const o = {}; for (let k = 0; k < localStorage.length; k++) { const key = localStorage.key(k); if (key !== LOGQ && !key.startsWith(REPLAY.queue)) o[key] = localStorage.getItem(key); }
  const s = JSON.parse(o[STORE]); delete s.seenSp.ice; o[STORE] = JSON.stringify(s); return o; };
// what the game would do with each tap of the film (layouts.js takeable), outside the film
const takeableOutcome = () => {
  const film = INTRO_FILMS.ice, ids = film.tiles.map(x => x[0]), tiles = film.tiles.map(([, , x, y, z]) => ({ x, y, z }));
  const nb = Layouts.neighbors(tiles), inb = Layouts.iceNeighbors(tiles);
  const ice = Object.fromEntries(film.tiles.filter(x => x[5]).map(x => [ids.indexOf(x[0]), x[5]]));
  const rules = { iceNb: inb, ice, locks: null, keys: [] }, alive0 = tiles.map(() => 1), alive = alive0.slice();
  return film.taps.map(([, id]) => { const i = ids.indexOf(id), ok = Layouts.takeable(i, alive, nb, rules, alive0); if (ok) alive[i] = 0; return [id, ok]; });
};

module.exports = [
  { name: 'intro: the first ice film plays on the real game screen, must be watched before the button works, and leaves the level as it was', async run(t) {
    const pid = 'test-intro-ice';
    const p = await t.phone({ state: { name: 'Dennis', pid, level: 35, sunSeen: true, theme: 'fruit', seenSp: { ...seen, ice: 0 } } });
    const before = await p.evaluate(([levelOf, phoneData]) => {
      localStorage.removeItem('omamj.cur'); __mj.startLevel(35);
      window.__realG = introRun.real; window.__rp = JSON.stringify(introRun.real.rp.events); window.__el = introRun.real.elapsed;
      return [eval(levelOf)(), eval(phoneData)()];
    }, [levelOf.toString(), phoneData.toString()]);
    const opened = Date.now();
    t.ok(await p.evaluate(() => typeof playIntroFilm === 'function' && !!INTRO_FILMS.ice && $('#introPanel').dataset.kind === 'ice' && curScreen === 'game'), 'the ice film plays on the game screen');
    t.ok(await p.locator('#ntGo').isDisabled(), 'the button does not work before the film has played');
    // the game's own board, tray and tiles, as big as in the player's level
    const look = await p.evaluate(() => ({ film: !!G.film, tiles: $('#board').querySelectorAll('.tile').length, ice: [...$('#board').querySelectorAll('.tile .ob')].map(e => e.dataset.k),
      tw: G.tw, realTw: introRun.real.tw, faces: [...$('#board').querySelectorAll('.tile .face')].every(e => e.innerHTML === Tiles.boardFace(S.theme, G.tiles[+e.parentNode.dataset.i].face)) }));
    t.eq([look.film, look.tiles, look.ice], [true, 5, ['ice2']], 'a tiny level of 5 tiles on the real board, one under thick ice');
    t.ok(Math.abs(look.tw - look.realTw) < 0.01, 'tiles as big as in the player\'s own level', look);
    t.ok(look.faces, 'tiles drawn by the board in the player\'s own theme');
    t.ok(await p.evaluate(() => !!$('#introPanel p.intro-line') && $('#introPanel p.intro-line').innerHTML === tx('intro_ice')), 'one line in the panel says what to do');
    // pace: a tap every 0.7 to 0.9 s, about 5 to 6 s in all
    const taps = await p.evaluate(() => INTRO_FILMS.ice.taps.map(x => x[0]));
    t.ok(taps.slice(1).every((ms, k) => ms - taps[k] >= 700 && ms - taps[k] <= 900), 'taps 0.7 to 0.9 s apart', taps);
    t.ok(await p.evaluate(() => INTRO_FILMS.ice.ms >= 5000 && INTRO_FILMS.ice.ms <= 6000), 'the film lasts 5 to 6 s');
    // the pile is laid out above the panel
    t.ok(await p.evaluate(() => { const top = $('#introPanel').getBoundingClientRect().top; return G.tiles.every(x => x.el.getBoundingClientRect().bottom < top) && $('#introPanel').getBoundingClientRect().bottom <= innerHeight; }), 'the pile shows above the panel');
    // back and taps on the board do not get around it; the level clock waits
    await p.evaluate(() => { handleBack(); const r = G.tiles[3].el.getBoundingClientRect(); window.__hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).id; });
    t.eq(await p.evaluate(() => [!!introRun, window.__hit, introRun.real.tStart, introRun.real.introducing]), [true, 'introShield', 0, true], 'back and taps do not end it; the level clock waits');
    const len = await p.evaluate(() => INTRO_FILMS.ice.ms);
    await sleep(Math.max(0, opened + len - 700 - Date.now()));
    t.ok(await p.locator('#ntGo').isDisabled(), 'still locked just before the film ends');
    await sleep(Math.max(0, opened + len + 500 - Date.now()));
    t.ok(await p.locator('#ntGo').isEnabled(), 'the button works after the film has played once');
    t.eq(await p.evaluate(() => introRun.log), await p.evaluate(takeableOutcome), 'every tap of the film does in the game what layouts.js takeable says');
    t.eq(await p.evaluate(() => [Object.keys(G.ob.left).filter(k => G.ob.left[k]).length, [...G.alive].join('')]), [0, '00010'], 'the ice melted and only the tile beside it stays');
    t.eq(await p.evaluate(() => JSON.stringify(introRun.real.rp.events) === window.__rp), true, 'no replay frames for the level while the film plays');
    await drain(p);
    const shown = helpMessages(p, pid).at(-1);
    t.eq(shown && [shown.topic, shown.why, shown.action, shown.title, shown.lv], ['ice', 'intro', 'shown', 'Nieuw: Bevroren stenen', 35], 'the dashboard sees the intro, with the level');
    const after = await p.evaluate(([levelOf, phoneData]) => {
      $('#ntGo').click();       // (synchronous: what comes next runs straight after the film has ended)
      return [eval(levelOf)(), eval(phoneData)(), G === window.__realG && G.elapsed === window.__el];
    }, [levelOf.toString(), phoneData.toString()]);
    t.ok(after[2], 'the player\'s own level is back, its clock did not run');
    t.eq(after[0], before[0], 'the level is exactly as it was: tiles, tray, ice, score, clock, moves, counters');
    t.eq(after[1], before[1], 'nothing on the phone changed but seenSp.ice');
    t.eq(await p.evaluate(() => [!!S.seenSp.ice, !!JSON.parse(localStorage.getItem(STORE)).seenSp.ice, G.introducing, !!G.tStart, !!$('#introPanel'), !!$('#introShield')]),
      [true, true, false, true, false, false], 'the button saves seenSp.ice and starts the level clock');
    t.eq(await p.evaluate(() => [$('#board').querySelectorAll('.tile').length, G.tiles.length, G.tiles.every(x => x.el.isConnected)]).then(([a, b, c]) => [a === b, c]), [true, true], 'the level\'s own board is back on the screen');
    await drain(p);
    const plays = p.db.plays(pid), start = plays.findIndex(e => e.k === 'start');
    t.eq(plays.slice(start + 1).map(e => e.k + ':' + (e.action || '')), ['help_msg:shown', 'help_msg:ack'], 'the play log gains only the intro\'s help messages');
    t.eq(await p.evaluate(() => introRun), null, 'the film has stopped');
    t.eq(p.errors, [], 'no browser errors');
  }},
  { name: 'intro: the ice film from the help menu can be closed at once, plays twice and rests, and leaves the game untouched', async run(t, { startLevel, click }) {
    const p = await t.phone({ size: [360, 640], state: { name: 'Dennis', level: 40, sunSeen: true, lang: 'en', seenSp: seen } });
    await startLevel(p, 40);
    const before = await p.evaluate(([levelOf, phoneData]) => [eval(levelOf)(), eval(phoneData)()], [levelOf.toString(), phoneData.toString()]);
    await p.evaluate(() => showLessonMenu());
    await click(p, '.lesson-pick[data-kind="ice"]');
    await p.evaluate(() => { window.__el = introRun.real.elapsed; });
    t.ok(await p.evaluate(() => $('#introPanel').dataset.kind === 'ice' && modalFree() && G.film), 'the help menu opens the ice film on the game screen');
    t.ok(await p.locator('#ntGo').isEnabled(), 'seen again from the help menu: the button works at once');
    t.eq(await p.evaluate(() => $('#introPanel h2').textContent), 'Frozen tiles', 'English title');
    t.ok(await p.evaluate(() => { const top = $('#introPanel').getBoundingClientRect().top; return G.tiles.every(x => x.el.getBoundingClientRect().bottom < top) && $('#introPanel').getBoundingClientRect().bottom <= innerHeight; }), 'pile, line and button fit a small phone');
    // two plays, then it rests; a tap plays it again
    await p.waitForFunction(() => introRun && introRun.plays === 2, null, { timeout: 20000 });
    await p.waitForFunction(() => $('#introShield').classList.contains('intro-end'), null, { timeout: 20000 });
    t.eq(await p.evaluate(() => introRun.timers.length), 0, 'after two plays the film rests');
    await click(p, '#introShield');
    t.eq(await p.evaluate(() => [introRun.plays, $('#introShield').classList.contains('intro-end'), [...G.alive].join('')]), [3, false, '11111'], 'a tap plays it again from the start');
    // closed at once, even while a tile of the film is flying into the tray
    await p.waitForFunction(() => G.film && G.flights > 0, null, { timeout: 8000, polling: 10 });
    await p.evaluate(() => $('#ntGo').click());
    t.ok(await p.evaluate(() => !introRun && !$('#introPanel')), 'closed at once');
    // (the tile in the air lands first, then the level and the help menu come back)
    t.ok(await p.waitForFunction(() => !G.film && !modalFree() && !!$('#modalBox .lesson-pick'), null, { timeout: 3000 }).then(() => true, () => false), 'mid-film: back to the help menu');
    t.eq(await p.evaluate(() => document.querySelectorAll('.tile.flying, .tmini.ghost').length), 0, 'no flying copies left behind');
    const after = await p.evaluate(([levelOf, phoneData]) => [eval(levelOf)(), eval(phoneData)()], [levelOf.toString(), phoneData.toString()]);
    t.eq(after[0], before[0], 'the film does not touch the game');
    t.ok(await p.evaluate(() => G.elapsed === window.__el && G.tStart > 0), 'the level clock waited during the film and runs again after it');
    t.eq(after[1], before[1], 'nothing on the phone changed');
    await click(p, '.lesson-pick[data-kind="lock"]');
    t.ok(await p.evaluate(() => !$('#introPanel') && !!$('#modalBox .lesson-demo')), 'the other tiles keep their old film for now');
    await p.evaluate(() => { closeModal(); S.lang = 'nl'; showTileLesson('ice', null, false, 'manual'); });
    t.ok(await p.evaluate(() => $('#introPanel p.intro-line').textContent.includes('erboven')), 'Dutch line');
    t.ok(await p.evaluate(() => $('#introPanel').getBoundingClientRect().bottom <= innerHeight), 'the Dutch line fits a small phone too');
    await click(p, '#ntGo');
    // from the home screen: the film plays on the game screen and goes back home
    await p.evaluate(() => { show('home'); showTileLesson('ice', null, false, 'manual'); });
    t.eq(await p.evaluate(() => [curScreen, !!G.film]), ['game', true], 'from home the film plays on the game screen');
    await click(p, '#ntGo');
    t.eq(await p.evaluate(() => [curScreen, !!G.film]), ['home', false], 'and goes back home');
    t.eq(p.errors, [], 'no browser errors');
  }},
  { name: 'intro: the ice film follows the game rules: every tap does what layouts.js takeable says', async run(t) {
    const p = await t.phone({ state: { name: 'Dennis', level: 40, sunSeen: true, seenSp: seen } });
    const r = await p.evaluate(() => {
      const film = INTRO_FILMS.ice, ids = film.tiles.map(x => x[0]), tiles = film.tiles.map(([, , x, y, z]) => ({ x, y, z }));
      const nb = Layouts.neighbors(tiles), inb = Layouts.iceNeighbors(tiles), I = ids.indexOf('ice');
      const rel = j => { const a = tiles[I], b = tiles[j]; return a.z !== b.z ? 'layer' : a.y === b.y ? 'beside' : 'above/below'; };
      return { touching: inb[I].map(j => [ids[j], rel(j)]).sort(), onTop: nb.above[I].map(j => ids[j]), need: film.tiles[I][5], tiles: tiles.length };
    });
    t.eq(r.touching, [['down', 'above/below'], ['side', 'beside'], ['top', 'layer'], ['up', 'above/below']], 'the touching tiles: one above and one below in the same layer, one beside, one in the layer on top');
    t.eq(r.onTop, ['top'], 'the tile on the next layer lies on the frozen tile');
    t.eq(r.need, 2, 'thick ice: two touching tiles must go');
    t.ok(r.tiles <= 8, 'at most 8 tiles');
    t.eq(await p.evaluate(takeableOutcome), [['ice', false], ['up', true], ['down', true], ['ice', false], ['top', true], ['ice', true]], 'the step table: frozen, above, below, still covered, top, freed');
  }},
];
