// uses: layouts, lang, core/*, board, specials
/* Oma's Mahjong — the intro film (from 1.73): the first time a player meets a new kind of tile, a tiny level is
   played for them in a pop-up over the level that is about to start, by the game's own code: the board and its
   tiles, the tray, the taps (board.js onTap), the flight into the tray, the pair, the ice that cracks and melts, the
   shake and the hints of a blocked tap. The pop-up holds a small board and tray of its own (#board, #tray), and while
   the film plays the game's code finds those (core.js filmRoot), so the player's own level stays on the screen
   behind the pop-up, untouched. Everything that moves on the board is what the game does for that tap (the owner asked that the film behave like the game); the film's own is only the caption under the board. The game's texts for a tap
   (the top bar while playing, core.js gameMsg/toast) show in a top bar of the film's own, above its tray. Meanwhile the player's
   own level (G) is put aside and comes back exactly as it was; the film's level carries G.film, so nothing of it is
   saved, logged or counted (board.js saveCur, afterLogic, afterLand, onMatch, fitGeo). The first time, the button
   works only after one full play; seen again from the help menu it closes at once. It plays twice and then rests; a
   tap on the board plays it again.
   Each film is INTRO_FILMS[kind] = { tiles, taps, ms, line }, and what its kind needs:
     tiles: [id, face, x, y, z, ice layers]   x, y in half tiles and z the layer, as in layouts.js
     locks, keys: ids of the locked tiles and the two key tiles; down: ids of the face-down tiles;
     tray: the faces already waiting in the tray; clock: [id, moves] the alarm clock's tile and its number
     taps:  [ms from the start, id, caption]  each one an ordinary tap of the game; a step that is the lesson has a
            caption (a text key in lang.js) under the board, shown with its result, and a short pause after it; it
            goes before the next tap, the last one stays until the film plays again
     ms:    one play; line: the text key of the line in the pop-up (lang.js)
     parts: instead of tiles, taps and ms, a film may play several tiny levels one after the other (each with its own
            tiles, taps and ms; the board drops in anew for each); plays: how often it plays before it rests (2)
     count: (a part) under each caption the clock's number before → after the tap; a tap without id only says its caption
   The film's tiles are no bigger than those of the level behind it (G.film.maxTw, board.js fitGeo). */
'use strict';

const INTRO_REST_MS = 1500;      // the pause before it plays once more
const INTRO_PLAYS = 2;           // then it rests on its last picture
const INTRO_CAP_IN = 200;        // a caption comes this long after its tap (with the result: a pair pops after its flight, board.js FLY_MS)
const INTRO_CAP_OUT = 220;       // and starts to fade this long before the next tap (.intro-cap fades in .18 s)
const INTRO_FILMS = {
  /* Ice (layouts.js iceNeighbors / frozenIn): a frozen tile cannot be taken until enough of the tiles touching it
     have left the board. For a skilled player it shows only what is not obvious (the owner 2026-11-22): a tap on a
     frozen tile lights up the tiles that thaw it; a diagonal tile (two across and two down) does not count; a tile
     that touches it only a little does: one half above it, one lying on just a corner of it. ❄️❄️ needs two. It ends
     on the melt (taking a free tile is obvious). The tile on the next layer rests on 4 tiles, as in a real pile (the owner
   2026-11-22: no towers), the ice is one of them. The board first rests a moment (the player takes it in), a tap
     every 0.7 s, after a step with a caption a pause so it can be read (shown fully about 0.85 s), at most 7 s
     (the owner 2026-11-22: 0.7 s; start a bit slower before popping up, the player needs time to take it in; 7 s is fine). */
  ice: {
    tiles: [
      ['up', 8, 3, 0, 0],               // half above it (half a tile to the right): touching (a pair with top)
      ['side', 12, 0, 2, 0],            // beside it: touching (it stays, under top)
      ['ice', 31, 2, 2, 0, 2],          // the tile under thick ice
      ['far', 20, 6, 2, 0],             // further along its row: not touching (a pair with corner)
      ['sup', 2, 0, 4, 0],              // diagonal, under top: not touching (it stays)
      ['low', 27, 2, 4, 0],             // below it: touching (it stays, under top)
      ['corner', 20, 4, 4, 0],          // diagonal, two across and two down: not touching
      ['top', 8, 1, 3, 1],              // one layer up on side, ice, sup and low, as in a real pile: on just the ice's lower left corner (its ❄️ shows)
    ],
    taps: [
      [1300, 'ice', 'ic_tap'],          // frozen (and covered): it shakes, the four tiles that thaw it light up
      [2750, 'far'],                    // a pair that does not touch it leaves: the ice stays as it is
      [3450, 'corner', 'ic_diagonal'],  // (the diagonal one last, so the caption comes with its own tap)
      [4900, 'up', 'ic_half'],          // the tile half above it leaves: ❄️❄️ cracks to ❄️
      [6350, 'top', 'ic_corner'],       // the tile on just its corner leaves (a pair with up): the ice melts
    ],
    ms: 7000,
    line: 'intro_ice',
  },
  /* Lock (specials.js lockedT / unlockAll): a locked tile cannot be taken, even when free, until both key tiles have
     left the board. A tap on a lock makes the keys wiggle, and the tiles lying on a buried key turn see-through
     (specials.js showKeys). One key gone: still locked; both gone: every lock opens at once. */
  lock: {
    tiles: [
      ['l1', 12, 0, 0, 0],              // a free locked tile
      ['k1', 4, 2, 0, 0],               // a key, free
      ['l2', 8, 6, 0, 0],               // a second lock: it opens with the first
      ['d', 20, 0, 2, 0],               // a pair with c
      ['e', 27, 2, 2, 0],               // under c (it stays)
      ['k2', 4, 4, 2, 0],               // the other key, half under c
      ['c', 20, 3, 2, 1],               // a bridge over e and k2, one layer up
    ],
    locks: ['l1', 'l2'], keys: ['k1', 'k2'],
    taps: [
      [1300, 'l1', 'lc_tap'],           // locked: it shakes, both keys wiggle, c turns see-through over the buried key
      [2750, 'k1', 'lc_one'],           // one key off the board: the locks stay shut
      [4200, 'd'],
      [4900, 'c'],                      // a pair: the key under it is free now
      [5600, 'k2', 'lc_both'],          // the second key (a pair with k1): both locks spring open
    ],
    ms: 7000,
    line: 'intro_lock',
  },
  /* Tray pair (board.js tapTile, peekPair): with 3 tiles waiting, a free face-down tile that is turned over and a free
     tile with the same picture leave together, without a slot. Only one face-down tile is open at a time (turning
     another closes it); its twin may be face down too (it turns over as it goes). */
  trayPair: {
    tiles: [
      ['d1', 20, 0, 0, 0],              // face down (a pair with d3)
      ['m1', 27, 2, 0, 0],              // between two: not free
      ['d2', 31, 4, 0, 0],              // face down (a pair with t2)
      ['t2', 31, 0, 2, 0],
      ['m2', 2, 2, 2, 0],
      ['d3', 20, 4, 2, 0],              // face down
    ],
    down: ['d1', 'd2', 'd3'], tray: [4, 8, 12],
    taps: [
      [1300, 'd1'],                     // turned over: it stays on the board
      [2000, 'd2', 'tp_one'],           // another one turned over: d1 closes again
      [3450, 't2', 'tp_twin'],          // its open twin: they go together, the tray keeps its 3
      [4900, 'd1'],
      [5600, 'd3', 'tp_down'],          // a face-down twin: it turns over as they go together
    ],
    ms: 7000,
    line: 'intro_trayPair',
  },
  /* Clock (board.js clockMove / checkClock): the number is the moves left, and a move is a tile taken off the board.
     Two parts (the owner 2026-11-23: show first how the clock runs out and is lost, since the clock must be
     clear to a first-time viewer; take the time there). First the clock is lost: every tile taken
     counts 1, and at 0 with the clock tile still there the alarm goes off, as in the game. Then what is not obvious:
     a tap on a blocked tile and turning a face-down tile over cost nothing; the clock tile only has to leave the
     board (into the tray, its twin may wait), with the last move still in time. 16.5 s: it plays once, then rests. */
  clock: {
    parts: [{
      tiles: [
        ['a1', 4, 0, 0, 0],             // a pair with a2
        ['b1', 8, 2, 0, 0],
        ['a2', 4, 6, 0, 0],
        ['a', 27, 0, 2, 0],             // under t
        ['ck', 12, 2, 2, 0],            // the clock tile, held by t
        ['t', 20, 1, 2, 1],             // a bridge over a and the clock tile's left half
      ],
      clock: ['ck', 3], count: true,
      // a tap every 1.3 s, so each step of the number is seen on its own (the owner 2026-11-23: taking a tile costs
      // a move, and it must be clear that the timer runs down with every move); the caption stays up meanwhile
      taps: [
        [1300, 'a1', 'ck_take'],        // 3 → 2
        [2600, 'a2', 'ck_take'],        // a pair: 2 → 1
        [3900, 'b1', 'ck_take'],        // 1 → 0, the clock tile still there: the alarm goes off (the game's own message, on the board)
        [5300, null, 'ck_out'],
      ],
      ms: 8500,
    }, {
      tiles: [
        ['dn', 31, 0, 0, 0],            // face down
        ['a', 8, 0, 2, 0],              // under t (it stays)
        ['ck', 12, 2, 2, 0],            // the clock tile
        ['x', 20, 4, 2, 0],             // beside it: a pair with t
        ['t', 20, 1, 2, 1],             // a bridge over a and the clock tile's left half (the clock's number sits at the upper right)
      ],
      down: ['dn'], clock: ['ck', 3], count: true,
      // as in part 1, every tap with the clock's number under its caption (the owner 2026-11-23: part 2 should be as
      // clear as part 1)
      taps: [
        [1300, 'ck', 'ck_blocked'],     // covered: it shakes, the game points at t; 3 → 3
        [2750, 'dn', 'ck_peek'],        // turned over: 3 → 3
        [4200, 't', 'ck_take'],         // 3 → 2
        [5500, 'x', 'ck_take'],         // a pair: 2 → 1
        [6950, 'ck', 'ck_last'],        // the last move, into the tray without its twin: 1 → 0, the clock stops
      ],
      ms: 8000,
    }],
    plays: 1,
    line: 'nt_clock_text',
  },
};

let introRun = null;
const introFailed = new Set();   // kinds whose film failed to start this session: not asked again (not saved as seen)

/* required: the first meeting (the button waits until the film has played once). after: what comes next once the
   button is pressed. why: for the dashboard (intro, manual). */
function playIntroFilm(kind, opts = {}) {
  stopIntroFilm();
  if (G && G.flights) { setTimeout(() => playIntroFilm(kind, opts), 40); return; }   // a tile in the air lands first (board.js afterFlight works on G)
  const film = INTRO_FILMS[kind], parts = film.parts || [film], required = !!opts.required, after = opts.after || null;
  const why = opts.why || (required ? 'intro' : 'manual');
  // the pop-up: title, the film's own top bar (the game's texts, core.js gameMsg), tray and board (core.js filmRoot), the line, the button
  openModal(`<div id="introPanel" data-kind="${kind}"><h2>${required ? tx('newTile', tx('nt_' + kind)) : tx('nt_' + kind)}</h2>
    <div class="intro-stage"><div class="title-wrap intro-bar"><div id="gameMsg"></div></div><div id="tray">${'<div class="slot"></div>'.repeat(SLOTS)}</div><div id="boardWrap"><div id="board"></div></div><div class="intro-cap chip"></div>${parts.some(q => q.count) ? '<div class="intro-count chip"></div>' : ''}
      <div hidden><div id="progressBar"></div><div id="toast"></div></div></div>
    <p class="intro-line">${tx(film.line)}</p>
    <button class="big-btn play" id="ntGo"${required ? ' disabled' : ''}><span class="bb-text"><b>${tx(required ? 'lessonWatch' : 'gotIt')}</b></span></button></div>`, false, null, 'intro-help');
  const stage = $('#modalBox .intro-stage'), cap = stage.querySelector('.intro-cap'), count = stage.querySelector('.intro-count'), go = $('#ntGo'), message = recordHelpMessage(kind, why);
  stage.style.background = (BGS.find(b => b.id === S.bg && !bgLocked(b)) || BGS[0]).css;
  // the player's own level waits: its clock stops (G.introducing), its board stays as it is behind the pop-up
  const real = G, run = introRun = { real, stage, blockedTaps, introducing: real && real.introducing, ticking: !!(real && real.tStart), timers: [], plays: 0, log: [] };
  const later = (ms, fn) => { const id = setTimeout(() => { run.timers = run.timers.filter(x => x !== id); if (introRun === run) fn(); }, ms); run.timers.push(id); };
  // every tap of every part, on one clock: [ms, part, id, caption]; a part starts where the one before ended
  const start = parts.map((_, p) => parts.slice(0, p).reduce((a, q) => a + q.ms, 0)), ms = start[start.length - 1] + parts[parts.length - 1].ms;
  const taps = parts.flatMap((part, p) => part.taps.map(([t, id, text]) => [start[p] + t, p, id, text]));
  const quiet = () => { cap.classList.remove('on'); if (count) count.classList.remove('on'); };
  const begin = p => { introLevel(parts[p], real); renderBoard(true); renderTray(); updateProgress(); clearGameMsg(); quiet(); };
  const play = () => {
    run.plays++; run.log = []; stage.classList.remove('intro-end'); blockedTaps = 0;
    begin(0);
    parts.forEach((_, p) => { if (p) later(start[p], () => begin(p)); });
    taps.forEach(([at, p, id, text], k) => {
      let was = 0;
      if (id) later(at, () => { const i = parts[p].tiles.findIndex(t => t[0] === id); was = clockLeft(); onTap(i, true); run.log.push([id, !G.alive[i]]); });
      if (!text) return;
      // the step says what it did, while its result shows (with count: under it the clock's number, before → after)
      later(at + INTRO_CAP_IN, () => {
        cap.textContent = tx(text); cap.classList.add('on');
        if (count) { count.textContent = parts[p].count && id ? `⏰ ${was} → ${clockLeft()}` : ''; count.classList.toggle('on', !!count.textContent); }
      });
      // it goes before the next tap, or before the next part (the last one stays: the film ends on it); the same
      // caption on the next tap stays up
      const next = taps[k + 1];
      if (next && !(next[3] === text && next[1] === p)) later(Math.min(next[0], start[p + 1] ?? ms) - INTRO_CAP_OUT, quiet);
    });
    later(ms, () => {
      if (run.plays === 1 && required) { go.disabled = false; go.querySelector('b').textContent = tx('lessonContinue'); }
      if (run.plays < (film.plays || INTRO_PLAYS)) later(INTRO_REST_MS, play); else stage.classList.add('intro-end');
    });
  };
  stage.onclick = () => { if (introRun === run && stage.classList.contains('intro-end')) play(); };
  go.onclick = () => {
    if (go.disabled) return;
    // remembered only once the player has pressed the button
    S.seenSp[kind] = true; if (kind === 'clock') S.seenSp.clockMoves = true;    // (the clock's old note: clockIntro)
    save(); message('ack');
    stopIntroFilm(after);
  };
  try {
    if (real) { syncClock(); real.tStart = 0; real.introducing = true; }
    clearGameMsg();                  // (a text of the level waiting to be shown does not come up in the film)
    filmRoot = stage;
    play();
  } catch (e) { logErr(e, 'intro'); introFailed.add(kind); stopIntroFilm(after); }   // a film that fails to start gives the level back
}

// the film's tiny level, as the game's own G (board.js begin), marked as a film
function introLevel(film, real) {
  const ix = id => film.tiles.findIndex(t => t[0] === id), [, , x0, y0] = film.tiles[0];
  // (the tiles waiting in the tray are off the board: where the first tile lies, so the board keeps its size)
  const tiles = [...film.tiles, ...(film.tray || []).map(face => [, face, x0, y0, 0])].map(([, face, x, y, z]) => ({ x, y, z, face, el: null })), n = tiles.length;
  const tray = (film.tray || []).map((_, k) => film.tiles.length + k);
  // (G.film.maxTw: its tiles no bigger than the level's, board.js fitGeo)
  G = { film: { maxTw: (real && real.tw) || 150 }, mode: real ? real.mode : 'level', level: real ? real.level : S.level, date: real && real.date, key: 'film',
    tiles, nb: Layouts.neighbors(tiles), gold: new Set(), lucky: null, alive: new Uint8Array(n).fill(1).fill(0, film.tiles.length), down: new Uint8Array(n), peek: -1,
    tray, arriving: new Set(), flights: 0, score: real ? real.score : 0, combo: 0, lastMatch: 0, elapsed: 0, tStart: 0, mile: 0,
    done: false, busy: false, mv: 0, clock: film.clock ? { i: ix(film.clock[0]), n: film.clock[1] } : null, rp: null, st: { tp: 0, bt: 0, fl: 0, mc: 0, tm: 0 } };
  (film.down || []).forEach(id => G.down[ix(id)] = 1);
  setObstacles({ need: Object.fromEntries(film.tiles.map((t, i) => [i, t[5] || 0]).filter(x => x[1])), locks: (film.locks || []).map(ix), keys: (film.keys || []).map(ix) });
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
