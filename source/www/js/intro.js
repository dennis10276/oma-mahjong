/* Oma's Mahjong — the intro film (from 1.73): the first time a player meets a new kind of tile, a small
   film shows it on a few tiles of the real board, in the player's own theme and on their own background,
   with one line under it saying what to do. A hand taps the tiles; the tiles fly into the tray and
   react exactly as they do in the game. The first time, the button works only after the film has
   played once; seen again from the help menu it can be closed at once. It plays twice and then rests;
   a tap on it plays it again. (Replaces the tile films of coach.js; gold and the joker get no film.)
   Each film is INTRO_FILMS[kind] = { tiles, steps, line }:
     tiles: [id, face, column, row, ice layers]   one layer of tiles side by side, as on the board
     steps: [ms from the start, what happens]      at most INTRO_FILM_MS in all
     line:  the text key of the line under the film (lang.js) */
'use strict';

const INTRO_FILM_MS = 6000;      // one play of a film
const INTRO_REST_MS = 1500;      // the pause before it plays once more
const INTRO_PLAYS = 2;           // then it rests on its last picture
const INTRO_FILMS = {
  /* Ice (layouts.js obstacles): a frozen tile cannot be taken. Every touching tile that leaves the board
     melts one layer: ❄️❄️ needs two. Then the tile can be taken like any free tile. */
  ice: {
    tiles: [['a', 4, 0, 0], ['ice', 31, 1, 0, 2], ['b', 4, 2, 0]],
    steps: [
      [200, F => F.point('ice')],
      [700, F => { F.press(); F.blocked('ice', ['a', 'b']); }],   // it shakes; the tiles that thaw it light up (as in the game)
      [1900, F => F.point('a')],
      [2400, F => { F.press(); F.take('a'); }],
      [2650, F => F.thaw('ice', 1)],                                // one touching tile gone: the ice cracks
      [3150, F => F.point('b')],
      [3650, F => { F.press(); F.take('b'); }],                     // (b makes a pair with a in the tray)
      [3900, F => F.thaw('ice', 0)],                                // the second: the ice melts
      [4550, F => F.point('ice')],
      [5050, F => { F.press(); F.take('ice'); }],                   // now it is an ordinary free tile
      [5550, F => F.rest()],
    ],
    line: 'intro_ice',
  },
};

let introRun = null;
function stopIntroFilm() { if (introRun) { introRun.timers.forEach(clearTimeout); introRun.timers = []; introRun = null; } }
const introFilmHTML = kind => `<div class="intro-film" data-kind="${kind}" aria-hidden="true"></div>`;

/* The pop-up with the film. required: the first meeting (the button waits until the film has played once).
   after: what comes next once the button is pressed. why: for the dashboard (intro, manual, retry). */
function playIntroFilm(kind, opts = {}) {
  const film = INTRO_FILMS[kind], required = !!opts.required, after = opts.after || null;
  const why = opts.why || (required ? 'intro' : 'manual');
  openModal(`<h2>${required ? tx('newTile', tx('nt_' + kind)) : tx('nt_' + kind)}</h2>${introFilmHTML(kind)}<p class="intro-line">${tx(film.line)}</p>
    <button class="big-btn play" id="ntGo"${required ? ' disabled' : ''}><span class="bb-text"><b>${tx(required ? 'lessonWatch' : 'gotIt')}</b></span></button>`, false, null, 'intro-help');
  const go = $('#ntGo'), message = recordHelpMessage(kind, why);
  runIntroFilm($('#modalBox .intro-film'), film, () => {
    if (!required || !go.isConnected) return;
    go.disabled = false;
    go.querySelector('b').textContent = tx('lessonContinue');
  });
  go.onclick = () => {
    if (go.disabled) return;
    // remembered only once the player has pressed the button
    S.seenSp[kind] = true; save(); message('ack'); closeModal();
    if (after) after();
  };
}

function runIntroFilm(el, film, played) {
  stopIntroFilm();
  const run = introRun = { timers: [], plays: 0 };
  const later = (ms, fn) => {
    const id = setTimeout(() => {
      run.timers = run.timers.filter(x => x !== id);
      if (introRun !== run) return;
      if (!el.isConnected) { stopIntroFilm(); return; }
      fn();
    }, ms);
    run.timers.push(id);
  };
  const bg = BGS.find(b => b.id === S.bg && !bgLocked(b)) || BGS[0];
  el.style.background = bg.css;
  const play = () => {
    run.plays++; el.dataset.play = run.plays; el.classList.remove('intro-end');
    const F = introActor(el, film, later);
    film.steps.forEach(([ms, fn], n) => later(ms, () => { el.dataset.step = n + 1; fn(F); }));
    later(INTRO_FILM_MS, () => {
      if (run.plays === 1 && played) played();
      if (run.plays < INTRO_PLAYS) later(INTRO_REST_MS, play); else el.classList.add('intro-end');
    });
  };
  el.onclick = () => { if (introRun === run && el.classList.contains('intro-end')) play(); };
  play();
}

/* The starting picture, and what can happen in it. Positions come from the layout (offsets), so a
   pop-up that is still growing open does not throw them off. */
function introActor(el, film, later) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cols = Math.max(...film.tiles.map(t => t[2])) + 1, rows = Math.max(...film.tiles.map(t => t[3])) + 1;
  const W = el.clientWidth || 300, tw = Math.min(80, (W - 24) / (cols + 1.2)), th = tw * 1.24, d = Math.max(2, tw * 0.085);
  const sw = Math.round(tw * 0.64);
  el.dataset.step = 0;
  el.innerHTML = `<div class="intro-tray" style="--slotw:${sw}px;--sfs:${(sw * 0.62).toFixed(1)}px">${'<span class="intro-slot"></span>'.repeat(4)}</div>` +
    `<div class="intro-board${S.highlight ? ' hl' : ''}" style="--d:${d.toFixed(1)}px;--fs:${(tw * 0.66).toFixed(1)}px"></div><span class="intro-hand"><i>👆</i></span>`;
  const tray = el.querySelector('.intro-tray'), board = el.querySelector('.intro-board'), hand = el.querySelector('.intro-hand');
  const slots = [...tray.children];
  tray.style.left = ((W - tray.offsetWidth) / 2).toFixed(1) + 'px';
  const top = tray.offsetTop + tray.offsetHeight + Math.max(14, tw * 0.3);
  const left = (W - cols * tw - d) / 2;
  el.style.height = Math.ceil(top + rows * th + d * 1.6 + 14) + 'px';
  const pos = {}, faces = {}, alive = {};
  board.innerHTML = film.tiles.map(([id, face, c, r, layers = 0], n) => {
    pos[id] = { c, r, l: left + c * tw, t: top + r * th, w: tw - 1.5, h: th - 1.5 };
    faces[id] = face; alive[id] = true;
    const p = pos[id], kind = layers ? (layers > 1 ? 'ice2' : 'ice') : '';
    return `<div class="tile" data-id="${id}" style="left:${p.l.toFixed(1)}px;top:${p.t.toFixed(1)}px;width:${p.w.toFixed(1)}px;height:${p.h.toFixed(1)}px;z-index:${n + 1}"><div class="face">${Tiles.faceHTML(S.theme, face)}</div>${obHTML(kind)}</div>`;
  }).join('');
  const tile = id => board.querySelector(`.tile[data-id="${id}"]`);
  const mid = id => { const p = pos[id]; return { x: p.l + p.w / 2, y: p.t + p.h / 2 }; };
  // as on the board: a tile with tiles on both sides is not free (darker with the highlight setting)
  const paintBlocked = () => film.tiles.forEach(([id, , c, r]) => {
    const side = dc => film.tiles.some(([j, , c2, r2]) => alive[j] && r2 === r && c2 === c + dc);
    tile(id).classList.toggle('blocked', alive[id] && side(-1) && side(1));
  });
  paintBlocked();
  const sparkle = (x, y, chars) => {
    if (still) return;
    for (let k = 0; k < 6; k++) {
      const s = document.createElement('span'); s.className = 'intro-spark'; s.textContent = chars[k % chars.length];
      s.style.left = x + 'px'; s.style.top = y + 'px'; el.appendChild(s);
      const a = -Math.PI / 2 + (k - 2.5) * 0.55, dd = tw * 0.4 + (k % 2) * 10;
      try { s.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${(Math.cos(a) * dd).toFixed(1)}px), calc(-50% + ${(Math.sin(a) * dd).toFixed(1)}px)) scale(1)`, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => s.remove(); } catch (e) { s.remove(); }
    }
  };
  const slotAt = k => { const s = slots[k]; return { x: tray.offsetLeft + s.offsetLeft + s.offsetWidth / 2, y: tray.offsetTop + s.offsetTop + s.offsetHeight / 2, w: s.offsetWidth, h: s.offsetHeight }; };
  const inTray = [];
  const paintTray = () => slots.forEach((s, k) => {
    const id = inTray[k], had = s.dataset.id;
    s.dataset.id = id || '';
    s.innerHTML = id ? `<div class="tmini${had !== id ? ' land' : ''}">${Tiles.faceHTML(S.theme, faces[id])}</div>` : '';
  });
  let aim = null;
  return {
    // the hand glides to a tile
    point(id) {
      aim = mid(id);
      hand.classList.add('intro-on'); hand.classList.remove('intro-press');
      hand.style.transform = `translate(${(aim.x - tw * 0.18).toFixed(1)}px, ${(aim.y - 2).toFixed(1)}px)`;
    },
    // and taps it
    press() {
      if (!aim) return;
      hand.classList.add('intro-press'); later(150, () => hand.classList.remove('intro-press'));
      const r = document.createElement('span'); r.className = 'intro-ripple'; r.style.left = aim.x + 'px'; r.style.top = aim.y + 'px';
      el.appendChild(r); later(500, () => r.remove());
    },
    // a tap on a tile that cannot be taken: it shakes, and the tiles that free it light up (board.js tapTile, specials.js showThaw)
    blocked(id, helpers) {
      const t = tile(id); t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake');
      helpers.forEach(h => tile(h).classList.add('obhint'));
      later(1300, () => { t.classList.remove('shake'); helpers.forEach(h => tile(h).classList.remove('obhint')); });
    },
    // the tile leaves the board and glides into the next tray slot; two alike in the tray are a pair and go
    take(id) {
      const t = tile(id), k = inTray.length, to = slotAt(k), from = mid(id), sc = Math.min(to.w / pos[id].w, to.h / pos[id].h) * 0.95;
      alive[id] = false; inTray.push(id); paintBlocked();
      t.classList.remove('blocked', 'obhint', 'shake'); t.style.zIndex = 50; t.classList.add('intro-moving');
      t.style.transform = `translate(${(to.x - from.x).toFixed(1)}px, ${(to.y - from.y).toFixed(1)}px) scale(${sc.toFixed(3)})`;
      later(380, () => {
        t.classList.add('hidden'); paintTray();
        const twin = inTray.find(j => j !== id && faces[j] === faces[id]);
        if (!twin) return;
        later(200, () => {
          const a = slotAt(inTray.indexOf(twin)), b = slotAt(inTray.indexOf(id));
          [twin, id].forEach(j => { const m = slots[inTray.indexOf(j)].firstChild; if (m) m.classList.add('popout'); });
          sparkle((a.x + b.x) / 2, (a.y + b.y) / 2, ['✨']);
          later(250, () => { inTray.splice(inTray.indexOf(twin), 1); inTray.splice(inTray.indexOf(id), 1); paintTray(); });
        });
      });
    },
    // the ice gets one layer thinner (left: layers still on it), as on the board (specials.js updateObstacles)
    thaw(id, left) {
      const t = tile(id);
      const f = document.createElement('div'); f.className = 'ob-crack'; t.appendChild(f); later(600, () => f.remove());
      paintOb(t, left ? (left > 1 ? 'ice2' : 'ice') : '');
      const c = mid(id); sparkle(c.x, c.y, left ? ['❄️'] : ['❄️', '💧', '✨']);
    },
    rest() { hand.classList.remove('intro-on', 'intro-press'); },
  };
}
