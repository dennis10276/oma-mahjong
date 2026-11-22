'use strict';
/* The intro film (js/intro.js): the first time a player meets a mechanic, a tiny level is played for them in a pop-up
   over the level, by the game's own code, with one line saying what to do. The first time the button works only after
   the film has played once; from the help menu it can be closed at once. The player's own level stays visible behind
   the pop-up, comes back exactly as it was, and nothing of the film is saved, logged or counted. */
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
// the pop-up: the film's board and tray inside it, the player's own level visible behind it, top to bottom title, tray, board, line, button
const popupLook = () => {
  const card = $('#modalBox'), r = el => el.getBoundingClientRect(), real = introRun.real;
  const inCard = sel => document.querySelector('#modalBox ' + sel);
  const parts = ['h2', '#tray', '#boardWrap', 'p.intro-line', '#ntGo'].map(s => r(inCard(s)));
  return {
    popup: !modalFree() && !!inCard('#introPanel') && !!G.film,
    filmTiles: document.querySelectorAll('#modalBox #board .tile').length === G.tiles.length && G.tiles.every(t => card.contains(t.el)),
    slots: document.querySelectorAll('#modalBox #tray .slot').length,
    // (laid out inside the film's board: its own positions, not the screen's, which move while the pop-up and the pile come in)
    inside: G.tiles.every(t => t.r.l >= 0 && t.r.t >= 0 && t.r.l + t.r.w <= $('#boardWrap').clientWidth && t.r.t + t.r.h <= $('#boardWrap').clientHeight),
    order: parts.every((b, k) => k === 0 || parts[k - 1].bottom <= b.top + 1),
    fits: r(card).bottom <= innerHeight && card.scrollHeight <= card.clientHeight + 1,
    behind: !real || (real.tiles.every(t => t.el.isConnected && !!t.el.closest('#game')) && document.querySelectorAll('#game #board .tile').length === real.tiles.length),
    tw: G.tw };
};

module.exports = [
  { name: 'intro: the first ice film plays in a pop-up over the level, must be watched before the button works, and leaves the level as it was', async run(t) {
    const pid = 'test-intro-ice';
    const p = await t.phone({ state: { name: 'Dennis', pid, level: 35, sunSeen: true, theme: 'fruit', seenSp: { ...seen, ice: 0 } } });
    const before = await p.evaluate(([levelOf, phoneData]) => {
      localStorage.removeItem('omamj.cur'); __mj.startLevel(35);
      window.__realG = introRun.real; window.__rp = JSON.stringify(introRun.real.rp.events); window.__el = introRun.real.elapsed;
      return [eval(levelOf)(), eval(phoneData)()];
    }, [levelOf.toString(), phoneData.toString()]);
    const opened = Date.now();
    t.ok(await p.evaluate(() => typeof playIntroFilm === 'function' && !!INTRO_FILMS.ice && $('#introPanel').dataset.kind === 'ice' && curScreen === 'game'), 'the ice film plays over the game screen');
    t.ok(await p.locator('#ntGo').isDisabled(), 'the button does not work before the film has played');
    const look = await p.evaluate(popupLook);
    t.eq([look.popup, look.filmTiles, look.slots, look.inside, look.order, look.fits], [true, true, 4, true, true, true], 'a pop-up with the film\'s own board and tray inside it: title, tray, board, line, button', look);
    t.ok(look.behind, 'the player\'s own level stays on the screen behind the pop-up');
    t.ok(look.tw >= 44, 'tiles big enough to see the ice and the faces', look.tw);
    const tiles = await p.evaluate(() => ({ n: G.tiles.length === INTRO_FILMS.ice.tiles.length, ice: [...document.querySelectorAll('#modalBox #board .tile .ob')].map(e => e.dataset.k),
      faces: [...document.querySelectorAll('#modalBox #board .tile .face')].every(e => e.innerHTML === Tiles.boardFace(S.theme, G.tiles[+e.parentNode.dataset.i].face)) }));
    t.eq([tiles.n, tiles.ice], [true, ['ice2']], 'the film\'s tiny level, one tile under thick ice');
    t.ok(tiles.faces, 'tiles drawn by the board in the player\'s own theme');
    t.ok(await p.evaluate(() => $('#introPanel p.intro-line').innerHTML === tx('intro_ice')), 'one line in the pop-up says what to do');
    // pace: a tap every 0.55 to 0.65 s, at most about 6 s in all
    const taps = await p.evaluate(() => INTRO_FILMS.ice.taps.map(x => x[0]));
    t.ok(taps.slice(1).every((ms, k) => ms - taps[k] >= 550 && ms - taps[k] <= 650), 'taps 0.55 to 0.65 s apart', taps);
    t.ok(await p.evaluate(() => INTRO_FILMS.ice.ms <= 6000 && INTRO_FILMS.ice.ms >= INTRO_FILMS.ice.taps.at(-1)[0] + 500), 'the film lasts at most about 6 s');
    // back, the backdrop and taps on the film do not get around it; the level clock waits
    await p.evaluate(() => handleBack());
    const tile = await p.evaluate(() => { const r = G.tiles[0].el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await p.mouse.click(tile[0], tile[1]); await p.mouse.click(4, 4);
    t.eq(await p.evaluate(() => [!!introRun, modalFree(), introRun.real.tStart, introRun.real.introducing]), [true, false, 0, true], 'back and taps do not end it; the level clock waits');
    // the frozen tap: only the tiles that touch it light up
    await p.waitForFunction(() => introRun.log.length >= 1, null, { polling: 10, timeout: 5000 });
    const lit = await p.evaluate(() => {
      const ids = INTRO_FILMS.ice.tiles.map(x => x[0]), I = ids.indexOf('ice');
      const touching = Layouts.iceNeighbors(G.tiles)[I].map(j => ids[j]).sort();
      return { lit: [...document.querySelectorAll('#modalBox #board .tile.obhint')].map(e => ids[+e.dataset.i]).sort(), touching, all: ids.length };
    });
    t.eq(lit.lit, lit.touching, 'on the frozen tap exactly the touching tiles light up', lit);
    t.ok(lit.all - 1 > lit.touching.length, 'tiles that do not touch it stay as they are');
    // a pair that does not touch the ice is taken: the ice stays the same
    await p.waitForFunction(() => introRun.log.length >= 3, null, { polling: 10, timeout: 5000 });
    t.eq(await p.evaluate(() => { const I = INTRO_FILMS.ice.tiles.findIndex(x => x[0] === 'ice');
      return [introRun.log.slice(1, 3).every(x => x[1]), G.ob.left[I], G.tiles[I].el.querySelector('.ob').dataset.k]; }), [true, 2, 'ice2'], 'after a pair that does not touch it the ice is unchanged');
    const len = await p.evaluate(() => INTRO_FILMS.ice.ms);
    await sleep(Math.max(0, opened + len - 700 - Date.now()));
    t.ok(await p.locator('#ntGo').isDisabled(), 'still locked just before the film ends');
    await sleep(Math.max(0, opened + len + 500 - Date.now()));
    t.ok(await p.locator('#ntGo').isEnabled(), 'the button works after the film has played once');
    t.eq(await p.evaluate(() => introRun.log), await p.evaluate(takeableOutcome), 'every tap of the film does in the game what layouts.js takeable says');
    t.eq(await p.evaluate(() => [Object.keys(G.ob.left).filter(k => G.ob.left[k]).length, INTRO_FILMS.ice.tiles.filter((x, i) => G.alive[i]).map(x => x[0])]), [0, ['side', 'corner2']], 'the ice melted; only tiles that were not needed stay');
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
    t.eq(await p.evaluate(() => [!!S.seenSp.ice, !!JSON.parse(localStorage.getItem(STORE)).seenSp.ice, G.introducing, !!G.tStart, !!$('#introPanel'), modalFree()]),
      [true, true, false, true, false, true], 'the button saves seenSp.ice, closes the pop-up and starts the level clock');
    t.eq(await p.evaluate(() => [$('#board') === document.querySelector('#game #board'), G.tiles.every(x => x.el.isConnected && !!x.el.closest('#game'))]), [true, true], 'the level\'s own board is the board again');
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
    await p.waitForFunction(() => introRun && G.film);
    await p.evaluate(() => { window.__el = introRun.real.elapsed; });
    t.ok(await p.evaluate(() => $('#introPanel').dataset.kind === 'ice' && curScreen === 'game'), 'the help menu opens the ice film over the level');
    t.ok(await p.locator('#ntGo').isEnabled(), 'seen again from the help menu: the button works at once');
    t.eq(await p.evaluate(() => $('#introPanel h2').textContent), 'Frozen tiles', 'English title');
    const look = await p.evaluate(popupLook);
    t.eq([look.popup, look.filmTiles, look.inside, look.order, look.fits, look.behind], [true, true, true, true, true, true], 'pop-up with board, tray, line and button fits a small phone, the level behind it', look);
    t.ok(look.tw >= 40, 'tiles big enough on a small phone', look.tw);
    // two plays, then it rests; a tap plays it again
    await p.waitForFunction(() => introRun && introRun.plays === 2, null, { timeout: 20000 });
    await p.waitForFunction(() => $('#modalBox .intro-stage').classList.contains('intro-end'), null, { timeout: 20000 });
    t.eq(await p.evaluate(() => introRun.timers.length), 0, 'after two plays the film rests');
    await click(p, '#modalBox .intro-stage');
    t.eq(await p.evaluate(() => [introRun.plays, $('#modalBox .intro-stage').classList.contains('intro-end'), [...G.alive].every(Boolean)]), [3, false, true], 'a tap plays it again from the start');
    // closed at once, even while a tile of the film is flying into the tray
    await p.waitForFunction(() => G.film && G.flights > 0, null, { timeout: 8000, polling: 10 });
    await p.evaluate(() => $('#ntGo').click());
    t.ok(await p.evaluate(() => !introRun && !document.querySelector('#modalBox #introPanel')), 'closed at once');
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
    t.ok(await p.evaluate(() => { const b = $('#modalBox'); return b.getBoundingClientRect().bottom <= innerHeight && b.scrollHeight <= b.clientHeight + 1; }), 'the Dutch line fits a small phone too');
    await click(p, '#ntGo');
    // from the home screen: the pop-up opens over home and home stays
    await p.evaluate(() => { show('home'); showTileLesson('ice', null, false, 'manual'); });
    t.eq(await p.evaluate(() => [curScreen, !!G.film, modalFree()]), ['home', true, false], 'from home the film opens over home');
    await click(p, '#ntGo');
    t.eq(await p.evaluate(() => [curScreen, !!G.film, modalFree()]), ['home', false, true], 'and home stays');
    t.eq(p.errors, [], 'no browser errors');
  }},
  { name: 'intro: the ice film follows the game rules: touching and not touching tiles, every tap does what layouts.js takeable says', async run(t) {
    const p = await t.phone({ state: { name: 'Dennis', level: 40, sunSeen: true, seenSp: seen } });
    const r = await p.evaluate(() => {
      const film = INTRO_FILMS.ice, ids = film.tiles.map(x => x[0]), tiles = film.tiles.map(([, , x, y, z]) => ({ x, y, z }));
      const nb = Layouts.neighbors(tiles), inb = Layouts.iceNeighbors(tiles), I = ids.indexOf('ice');
      const rel = j => { const a = tiles[I], b = tiles[j]; return a.z !== b.z ? 'layer' : a.y === b.y ? 'beside' : 'above/below'; };
      const apart = ids.map((id, j) => j).filter(j => j !== I && !inb[I].includes(j)).map(j => [ids[j], Math.abs(tiles[j].x - tiles[I].x), Math.abs(tiles[j].y - tiles[I].y), tiles[j].z - tiles[I].z]);
      const taps = film.taps.map(x => x[1]), firstTouch = taps.findIndex(id => inb[I].includes(ids.indexOf(id)));
      const early = taps.slice(1, firstTouch).map(id => ids.indexOf(id));
      return { touching: inb[I].map(j => [ids[j], rel(j)]).sort(), apart, onTop: nb.above[I].map(j => ids[j]), need: film.tiles[I][5], tiles: tiles.length, taps: taps.length,
        early: early.length === 2 && film.tiles[early[0]][1] === film.tiles[early[1]][1] && early.every(j => !inb[I].includes(j)) };
    });
    t.eq(r.touching, [['down', 'above/below'], ['side', 'beside'], ['top', 'layer'], ['up', 'above/below']], 'the touching tiles: one above and one below in the same layer, one beside, one in the layer on top');
    t.ok(r.apart.some(([, dx, dy, dz]) => dx === 2 && dy === 2 && dz === 0), 'a diagonal corner tile that does not touch it', r.apart);
    t.ok(r.apart.some(([, dx, dy, dz]) => dx >= 4 && dy === 0 && dz === 0), 'a tile further along its row that does not touch it', r.apart);
    t.ok(r.early, 'early in the film a pair that does not touch the ice is taken');
    t.eq(r.onTop, ['top'], 'the tile on the next layer lies on the frozen tile');
    t.eq(r.need, 2, 'thick ice: two touching tiles must go');
    t.ok(r.tiles <= 9 && r.taps <= 8, 'at most 9 tiles and 8 taps', r);
    t.eq(await p.evaluate(takeableOutcome), [['ice', false], ['corner', true], ['far', true], ['up', true], ['down', true], ['ice', false], ['top', true], ['ice', true]],
      'the step table: frozen, a pair that does not touch it, above, below, still covered, top, freed');
  }},
  { name: 'intro: the ice film waits for a tile in the air, ends a lucky moment that ran out, keeps its texts to itself and survives a failing start', async run(t, { startLevel }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 40, sunSeen: true, seenSp: seen } });
    await startLevel(p, 40);
    // a tile of the level is still flying into the tray, and its lucky moment runs out while the film plays
    await p.evaluate(() => {
      const i = G.tiles.findIndex((_, i) => canTake(i)), j = G.tiles.findIndex((_, j) => j !== i && canTake(j));
      G.lucky = { i: j, until: Date.now() - 1 }; glow(j, 'lucky', true);     // (its 15 s ran out: the page clock stands still in the tests)
      window.__realG = G;
      onTap(i); window.__flying = G.flights;
      playIntroFilm('ice', { why: 'manual' });
    });
    t.eq(await p.evaluate(() => window.__flying), 1, 'a tile of the level is in the air when the film is asked for');
    await p.waitForFunction(() => introRun && G.film, null, { timeout: 3000 });
    t.eq(await p.evaluate(() => [introRun.real.flights, G.flights]), [0, 0], 'the film starts once that tile has landed');
    // the film's own texts (the ice cracks, the ice melted) stay inside the film
    await p.waitForFunction(() => introRun.log.length >= 5, null, { timeout: 8000 });
    const leaked = () => { const texts = [tx('iceCrack'), tx('iceMelted'), tx('iceThick'), tx('iceThin'), tx('stillStuck')];
      const msg = document.querySelector('#game #gameMsg').textContent, toastEl = [...document.querySelectorAll('#toast')].find(e => !e.closest('#modalBox'));
      return texts.filter(s => msg.includes(s) || (toastEl.classList.contains('on') && toastEl.textContent.includes(s))); };
    t.eq(await p.evaluate(leaked), [], 'while the film plays, the level\'s top bar and the toast show nothing of the film');
    await p.evaluate(() => $('#ntGo').click());
    await p.waitForFunction(() => !G.film, null, { timeout: 3000 });
    await sleep(1600);
    t.eq(await p.evaluate(leaked), [], 'after it, no text of the film shows up');
    t.eq(await p.evaluate(() => [G === window.__realG, G.flights, G.lucky, document.querySelectorAll('#game #board .tile.lucky').length]), [true, 0, null, 0],
      'the level\'s tile that was in the air landed in the level; the lucky moment that ran out meanwhile is over');
    // a film that fails to start puts nothing aside: the level carries on
    const failed = await p.evaluate(() => {
      const real = renderTray; window.__after = 0;
      renderTray = () => { renderTray = real; throw new Error('test: the film fails to start'); };
      playIntroFilm('ice', { why: 'manual', after: () => { window.__after = 1; } });
      return [G === window.__realG, introRun, !!document.querySelector('#introPanel'), modalFree(), window.__after, G.introducing, !!G.tStart, $('#board') === document.querySelector('#game #board')];
    });
    t.eq(failed, [true, null, false, true, 1, false, true, true], 'a failing start gives the level back and carries on');
  }},
];
