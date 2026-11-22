/* Oma's Mahjong — the intro film (from 1.73): the first time a player meets a new kind of tile, a tiny level is
   played for them in a pop-up over the level that is about to start, by the game's own code: the board and its
   tiles, the tray, the taps (board.js onTap), the flight into the tray, the pair, the ice that cracks and melts, the
   shake and the hints of a blocked tap. The pop-up holds a small board and tray of its own (#board, #tray), and while
   the film plays the game's code finds those (core.js filmRoot), so the player's own level stays on the screen
   behind the pop-up, untouched. Only the soft ring where the finger taps is the film's own. Meanwhile the player's
   own level (G) is put aside and comes back exactly as it was; the film's level carries G.film, so nothing of it is
   saved, logged or counted (board.js saveCur, afterLogic, afterLand, onMatch, fitGeo). The first time, the button
   works only after one full play; seen again from the help menu it closes at once. It plays twice and then rests; a
   tap on the board plays it again.
   Each film is INTRO_FILMS[kind] = { tiles, taps, ms, line }:
     tiles: [id, face, x, y, z, ice layers]   x, y in half tiles and z the layer, as in layouts.js
     taps:  [ms from the start, id]           each one an ordinary tap of the game
     ms:    one play; line: the text key of the line in the pop-up (lang.js) */
'use strict';

const INTRO_REST_MS = 1500;      // the pause before it plays once more
const INTRO_PLAYS = 2;           // then it rests on its last picture
const INTRO_RING_MS = 200;       // the ring shows this long before the tap
const INTRO_FILMS = {
  /* Ice (layouts.js iceNeighbors / frozenIn): a frozen tile cannot be taken until enough of the tiles touching it
     have left the board: beside it, above or below it, lying on it or under it. ❄️❄️ needs two. A corner tile
     (two across and two down) does not touch it. A thawed tile that is still covered must be freed like any other
     tile. (A tap every 0.6 s: Dennis found 1 s "so slow" and 0.55 s "too fast" in a film that did not look like the
     game, 0.8 s on the game screen still too slow.) */
  ice: {
    tiles: [
      ['up', 8, 2, 0, 0],               // above it in the same layer: touching
      ['corner', 20, 4, 0, 0],          // diagonal, two across and two up: not touching
      ['ice', 31, 2, 2, 0, 2],          // the tile under thick ice
      ['side', 12, 4, 2, 0],            // beside it: touching (it stays)
      ['far', 20, 6, 2, 0],             // further along its row: not touching (a pair with corner)
      ['down', 8, 2, 4, 0],             // below it in the same layer: touching (a pair with up)
      ['corner2', 3, 4, 4, 0],          // the other diagonal: not touching (it stays)
      ['top', 27, 1, 2, 1],             // lying half on it, one layer up: touching
    ],
    taps: [
      [800, 'ice'],                     // frozen (and covered): it shakes, only the four touching tiles light up
      [1400, 'corner'],                 // a pair that does not touch it leaves: the ice stays as it is
      [2000, 'far'],
      [2600, 'up'],                     // the tile above it leaves: ❄️❄️ cracks to ❄️
      [3200, 'down'],                   // the tile below it leaves: the ice melts
      [3800, 'ice'],                    // thawed, but a tile still lies on it: it shakes, an arrow points at that tile
      [4400, 'top'],                    // the tile on top goes
      [5000, 'ice'],                    // now it is free: it can be taken
    ],
    ms: 5700,
    line: 'intro_ice',
  },
};

let introRun = null;

/* required: the first meeting (the button waits until the film has played once). after: what comes next once the
   button is pressed. why: for the dashboard (intro, manual). */
function playIntroFilm(kind, opts = {}) {
  stopIntroFilm();
  if (G && G.flights) { setTimeout(() => playIntroFilm(kind, opts), 40); return; }   // a tile in the air lands first (board.js afterFlight works on G)
  const film = INTRO_FILMS[kind], required = !!opts.required, after = opts.after || null;
  const why = opts.why || (required ? 'intro' : 'manual');
  // the pop-up: title, the film's own tray and board (core.js filmRoot; its top-bar texts stay hidden in it), the line, the button
  openModal(`<div id="introPanel" data-kind="${kind}"><h2>${required ? tx('newTile', tx('nt_' + kind)) : tx('nt_' + kind)}</h2>
    <div class="intro-stage"><div id="tray">${'<div class="slot"></div>'.repeat(SLOTS)}</div><div id="boardWrap"><div id="board"></div></div>
      <div hidden><div><div id="gameMsg"></div></div><div id="progressBar"></div><div id="toast"></div></div></div>
    <p class="intro-line">${tx(film.line)}</p>
    <button class="big-btn play" id="ntGo"${required ? ' disabled' : ''}><span class="bb-text"><b>${tx(required ? 'lessonWatch' : 'gotIt')}</b></span></button></div>`, false, null, 'intro-help');
  const stage = $('#modalBox .intro-stage'), go = $('#ntGo'), message = recordHelpMessage(kind, why);
  stage.style.background = (BGS.find(b => b.id === S.bg && !bgLocked(b)) || BGS[0]).css;
  // the player's own level waits: its clock stops (G.introducing), its board stays as it is behind the pop-up
  const real = G, run = introRun = { real, stage, blockedTaps, introducing: real && real.introducing, ticking: !!(real && real.tStart), timers: [], plays: 0, log: [] };
  const later = (ms, fn) => { const id = setTimeout(() => { run.timers = run.timers.filter(x => x !== id); if (introRun === run) fn(); }, ms); run.timers.push(id); };
  const ids = film.tiles.map(t => t[0]);
  const ring = id => {
    const r = G.tiles[ids.indexOf(id)].r, m = document.createElement('span');
    m.className = 'intro-tap'; m.style.left = (r.l + r.w / 2) + 'px'; m.style.top = (r.t + r.h / 2) + 'px';
    $('#board').appendChild(m); later(800, () => m.remove());
  };
  const play = () => {
    run.plays++; run.log = []; stage.classList.remove('intro-end'); blockedTaps = 0;
    introLevel(film, real);
    renderBoard(true); renderTray(); updateProgress();
    for (const [ms, id] of film.taps) {
      later(ms - INTRO_RING_MS, () => ring(id));
      later(ms, () => { const i = ids.indexOf(id); onTap(i, true); run.log.push([id, !G.alive[i]]); });
    }
    later(film.ms, () => {
      if (run.plays === 1 && required) { go.disabled = false; go.querySelector('b').textContent = tx('lessonContinue'); }
      if (run.plays < INTRO_PLAYS) later(INTRO_REST_MS, play); else stage.classList.add('intro-end');
    });
  };
  stage.onclick = () => { if (introRun === run && stage.classList.contains('intro-end')) play(); };
  go.onclick = () => {
    if (go.disabled) return;
    // remembered only once the player has pressed the button
    S.seenSp[kind] = true; save(); message('ack');
    stopIntroFilm(after);
  };
  try {
    if (real) { syncClock(); real.tStart = 0; real.introducing = true; }
    filmRoot = stage;
    play();
  } catch (e) { logErr(e, 'intro'); stopIntroFilm(after); }   // a film that fails to start gives the level back
}

// the film's tiny level, as the game's own G (board.js begin), marked as a film
function introLevel(film, real) {
  const tiles = film.tiles.map(([, face, x, y, z]) => ({ x, y, z, face, el: null })), n = tiles.length;
  G = { film: true, mode: real ? real.mode : 'level', level: real ? real.level : S.level, date: real && real.date, key: 'film',
    tiles, nb: Layouts.neighbors(tiles), gold: new Set(), lucky: null, alive: new Uint8Array(n).fill(1), down: new Uint8Array(n), peek: -1,
    tray: [], arriving: new Set(), flights: 0, score: real ? real.score : 0, combo: 0, lastMatch: 0, elapsed: 0, tStart: 0, mile: 0,
    done: false, busy: false, mv: 0, clock: null, rp: null, st: { tp: 0, bt: 0, fl: 0, mc: 0, tm: 0 },
    cz: { taps: [] } };                // (the game tips keep no notes of the film: coach.js coachNote)
  setObstacles({ need: Object.fromEntries(film.tiles.map((t, i) => [i, t[5] || 0]).filter(x => x[1])) });
}

// The film ends: the pop-up closes, the player's own level carries on as it was, then what comes next (after).
function stopIntroFilm(after = null) {
  const run = introRun; if (!run) return;
  introRun = null;
  run.timers.forEach(clearTimeout);
  if (run.stage.isConnected) { closeModal(); $('#modalBox').replaceChildren(); }   // (a closed pop-up keeps its content: no second #ntGo)
  const back = () => {
    if (G && G.film && G.flights) { setTimeout(back, 40); return; }   // a tile still flying lands first (board.js afterFlight works on G)
    filmRoot = null;
    G = run.real; blockedTaps = run.blockedTaps;
    clearGameMsg(); $('#toast').classList.remove('on');                 // (no text of the film comes after it)
    if (G) {
      G.introducing = run.introducing; if (run.ticking) G.tStart = performance.now();
      if (G.lucky && Date.now() > G.lucky.until) { glow(G.lucky.i, 'lucky', false); G.lucky = null; }   // its end (rewards.js maybeLucky) fell in the film
      if (curScreen === 'game') layoutBoard();                         // (in case the screen turned meanwhile)
    }
    if (after) after();
  };
  back();
}
