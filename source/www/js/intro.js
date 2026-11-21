/* Oma's Mahjong — the intro film (from 1.73): the first time a player meets a new kind of tile, a tiny level is
   played for them on the real game screen, by the game's own code: the board and its tiles, the tray, the taps
   (board.js onTap), the flight into the tray, the pair, the ice that cracks and melts, the shake and the hints of a
   blocked tap. Only the soft ring where the finger taps and the panel at the bottom (title, one line, the button)
   are the film's own. Meanwhile the player's own level is put aside (G and its board) and comes back exactly as it
   was; the film's level carries G.film, so nothing of it is saved, logged or counted (board.js saveCur, afterLogic,
   afterLand, onMatch). The first time, the button works only after one full play; seen again from the help menu
   it closes at once. It plays twice and then rests; a tap on the screen plays it again.
   Each film is INTRO_FILMS[kind] = { tiles, taps, ms, line }:
     tiles: [id, face, x, y, z, ice layers]   x, y in half tiles and z the layer, as in layouts.js
     taps:  [ms from the start, id]           each one an ordinary tap of the game
     ms:    one play; line: the text key of the line in the panel (lang.js) */
'use strict';

const INTRO_REST_MS = 1500;      // the pause before it plays once more
const INTRO_PLAYS = 2;           // then it rests on its last picture
const INTRO_RING_MS = 200;       // the ring shows this long before the tap
const INTRO_FILMS = {
  /* Ice (layouts.js iceNeighbors / frozenIn): a frozen tile cannot be taken until enough of the tiles touching it
     have left the board: beside it, above or below it, lying on it or under it. ❄️❄️ needs two. A thawed tile that
     is still covered must be freed like any other tile. (A tap every 0.8 s: Dennis found 1 s "so slow" and
     0.55 s "too fast".) */
  ice: {
    tiles: [
      ['up', 8, 2, 0, 0],               // above it in the same layer
      ['ice', 31, 2, 2, 0, 2],          // the tile under thick ice
      ['down', 8, 2, 4, 0],             // below it in the same layer (same picture as up: they make a pair)
      ['side', 12, 4, 2, 0],            // beside it (also touching; it stays)
      ['top', 27, 1, 2, 1],             // lying on it (half over it, one layer up)
    ],
    taps: [
      [700, 'ice'],                     // frozen (and covered): it shakes, all four touching tiles light up
      [1500, 'up'],                     // the tile above it leaves: ❄️❄️ cracks to ❄️
      [2300, 'down'],                   // the tile below it leaves: the ice melts (up + down are a pair)
      [3100, 'ice'],                    // thawed, but a tile still lies on it: it shakes, an arrow points at that tile
      [3900, 'top'],                    // the tile on top goes
      [4700, 'ice'],                    // now it is free: it can be taken
    ],
    ms: 5600,
    line: 'intro_ice',
  },
};

let introRun = null;

/* required: the first meeting (the button waits until the film has played once). after: what comes next once the
   button is pressed. why: for the dashboard (intro, manual). */
function playIntroFilm(kind, opts = {}) {
  const film = INTRO_FILMS[kind], required = !!opts.required, after = opts.after || null;
  const why = opts.why || (required ? 'intro' : 'manual');
  stopIntroFilm();
  if (!modalFree()) closeModal();
  $('#modalBox').replaceChildren();   // (a closed pop-up keeps its content: no second #ntGo)
  const shield = document.createElement('div'), panel = document.createElement('div');
  shield.id = 'introShield';           // no taps reach the game meanwhile
  panel.id = 'introPanel'; panel.dataset.kind = kind;
  panel.innerHTML = `<h2>${required ? tx('newTile', tx('nt_' + kind)) : tx('nt_' + kind)}</h2><p class="intro-line">${tx(film.line)}</p>
    <button class="big-btn play" id="ntGo"${required ? ' disabled' : ''}><span class="bb-text"><b>${tx(required ? 'lessonWatch' : 'gotIt')}</b></span></button>`;
  // the player's own level waits: its clock stops (G.introducing), its board is kept aside as it is
  const real = G, run = introRun = { real, screen: curScreen, board: [...$('#board').childNodes], blockedTaps,
    introducing: real && real.introducing, ticking: !!(real && real.tStart), shield, panel, timers: [], plays: 0, log: [] };
  if (real) { syncClock(); real.tStart = 0; real.introducing = true; }
  $('#game').append(shield, panel);    // (the panel takes the bottom of the screen, so the pile is laid out above it)
  const message = recordHelpMessage(kind, why, panel);
  if (curScreen !== 'game') show('game');
  const go = panel.querySelector('#ntGo');
  const later = (ms, fn) => { const id = setTimeout(() => { run.timers = run.timers.filter(x => x !== id); if (introRun === run) fn(); }, ms); run.timers.push(id); };
  const ids = film.tiles.map(t => t[0]);
  const ring = id => {
    const r = G.tiles[ids.indexOf(id)].el.getBoundingClientRect(), m = document.createElement('span');
    m.className = 'intro-tap'; m.style.left = (r.left + r.width / 2) + 'px'; m.style.top = (r.top + r.height / 2) + 'px';
    shield.appendChild(m); later(800, () => m.remove());
  };
  const play = () => {
    run.plays++; run.log = []; shield.classList.remove('intro-end');
    introLevel(film, real);
    renderBoard(true); renderTray(); updateProgress();
    for (const [ms, id] of film.taps) {
      later(ms - INTRO_RING_MS, () => ring(id));
      later(ms, () => { const i = ids.indexOf(id); onTap(i, true); run.log.push([id, !G.alive[i]]); });
    }
    later(film.ms, () => {
      if (run.plays === 1 && required) { go.disabled = false; go.querySelector('b').textContent = tx('lessonContinue'); }
      if (run.plays < INTRO_PLAYS) later(INTRO_REST_MS, play); else shield.classList.add('intro-end');
    });
  };
  shield.onclick = () => { if (introRun === run && shield.classList.contains('intro-end')) play(); };
  go.onclick = () => {
    if (go.disabled) return;
    // remembered only once the player has pressed the button
    S.seenSp[kind] = true; save(); message('ack');
    stopIntroFilm(after);
  };
  play();
}

// the film's tiny level, as the game's own G (board.js begin), marked as a film
function introLevel(film, real) {
  const tiles = film.tiles.map(([, face, x, y, z]) => ({ x, y, z, face, el: null })), n = tiles.length;
  G = { film: true, mode: real ? real.mode : 'level', level: real ? real.level : S.level, date: real && real.date, key: 'film',
    tiles, nb: Layouts.neighbors(tiles), gold: new Set(), lucky: null, alive: new Uint8Array(n).fill(1), down: new Uint8Array(n), peek: -1,
    tray: [], arriving: new Set(), flights: 0, score: real ? real.score : 0, combo: 0, lastMatch: 0, elapsed: 0, tStart: 0, mile: 0,
    done: false, busy: false, mv: 0, clock: null, rp: null, st: { tp: 0, bt: 0, fl: 0, mc: 0, tm: 0 },
    cz: { taps: [] },                  // (the game tips keep no notes of the film: coach.js coachNote)
    maxTw: real && real.tw || 60,      // the tiles as big as in the player's own level, and the same top bar (board.js boardGeo)
    tall: $('#game').classList.contains('compact') };
  setObstacles({ need: Object.fromEntries(film.tiles.map((t, i) => [i, t[5] || 0]).filter(x => x[1])) });
}

// The film ends: the player's own level comes back as it was, then what comes next (after).
function stopIntroFilm(after = null) {
  const run = introRun; if (!run) return;
  introRun = null;
  run.timers.forEach(clearTimeout);
  run.shield.remove(); run.panel.remove();
  const back = () => {
    if (G && G.film && G.flights) { setTimeout(back, 40); return; }   // a tile still flying lands first (board.js afterFlight works on G)
    if (run.screen !== 'game') show(run.screen);                       // (still with the film's G: leaving the game screen saves nothing of it)
    G = run.real; blockedTaps = run.blockedTaps;
    run.board.forEach(e => e.classList && e.classList.remove('enter'));
    $('#board').replaceChildren(...run.board);
    clearGameMsg();
    if (G) { G.introducing = run.introducing; if (run.ticking) G.tStart = performance.now(); layoutBoard(); renderTray(); updateProgress(); }
    if (after) after();
  };
  back();
}
