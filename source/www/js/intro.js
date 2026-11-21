/* Oma's Mahjong — the intro film (from 1.73): the first time a player meets a new kind of tile, a small
   film shows it on a few tiles of a real pile, in the player's own theme and on their own background,
   with one line under it. A hand taps the tiles; what a tap does follows the game's own rules
   (layouts.js neighbors / isFree / iceNeighbors, as in board.js tapTile and specials.js updateObstacles):
   a tile that can be taken flies into the tray (two alike make a pair and go), a tile that cannot be
   taken shakes and shows what holds it. The first time, the button works only after the film has
   played once; seen again from the help menu it can be closed at once. It plays twice and then rests;
   a tap on it plays it again. (Replaces the tile films of coach.js; gold and the joker get no film.)
   Each film is INTRO_FILMS[kind] = { tiles, steps, line }:
     tiles: [id, face, x, y, z, ice layers]   x, y in half tiles and z the layer, as in layouts.js
     steps: [ms from the start, what happens]  within INTRO_FILM_MS
     line:  the text key of the line under the film (lang.js) */
'use strict';

const INTRO_FILM_MS = 4000;      // one play of a film (Dennis: quick, "it goes so slow")
const INTRO_REST_MS = 1500;      // the pause before it plays once more
const INTRO_PLAYS = 2;           // then it rests on its last picture
const INTRO_FILMS = {
  /* Ice (layouts.js iceNeighbors / frozenIn): a frozen tile cannot be taken until enough of the tiles
     touching it have left the board: beside it, above or below it, lying on it or under it. ❄️❄️ needs
     two. A thawed tile that is still covered must be freed like any other tile. */
  ice: {
    tiles: [
      ['up', 8, 2, 0, 0],               // above it in the same layer
      ['ice', 31, 2, 2, 0, 2],          // the tile under thick ice
      ['down', 8, 2, 4, 0],             // below it in the same layer (same picture as up: they make a pair)
      ['side', 12, 4, 2, 0],            // beside it (also touching; it stays)
      ['top', 27, 1, 2, 1],             // lying on it (half over it, one layer up)
    ],
    steps: [
      // (a tap every 0.55 s, the hand arriving 0.25 s before it)
      [50, F => F.point('ice')],
      [300, F => F.tap('ice')],         // frozen (and covered): it shakes, all four touching tiles light up
      [600, F => F.point('up')],
      [850, F => F.tap('up')],          // the tile above it leaves: ❄️❄️ cracks to ❄️
      [1150, F => F.point('down')],
      [1400, F => F.tap('down')],       // the tile below it leaves: the ice melts (up + down are a pair)
      [1700, F => F.point('ice')],
      [1950, F => F.tap('ice')],        // thawed, but a tile still lies on it: it shakes, that tile lights up until taken
      [2250, F => F.point('top')],
      [2500, F => F.tap('top')],        // the tile on top goes
      [2800, F => F.point('ice')],
      [3050, F => F.tap('ice')],        // now it is free: it can be taken
      [3500, F => F.rest()],
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
  const run = introRun = { timers: [], plays: 0, log: [] };
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
    run.plays++; run.log = []; el.dataset.play = run.plays; el.classList.remove('intro-end');
    const F = introActor(el, film, later, run.log);
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
   pop-up that is still growing open does not throw them off. log: what happened, for the tests. */
function introActor(el, film, later, log) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ids = film.tiles.map(t => t[0]), at = id => ids.indexOf(id);
  const tiles = film.tiles.map(([, , x, y, z]) => ({ x, y, z })), faces = film.tiles.map(t => t[1]);
  const need = film.tiles.map(t => t[5] || 0), alive = tiles.map(() => 1);
  const nb = Layouts.neighbors(tiles), inb = Layouts.iceNeighbors(tiles);
  const free = i => Layouts.isFree(i, alive, nb);
  const iceLeft = i => { let gone = 0; for (const j of inb[i]) if (!alive[j]) gone++; return Math.max(0, need[i] - gone); };
  const left = need.slice();
  // the size: the whole pile with the tray above it, small enough for the pop-up on a small phone
  const ratio = 1.24, dF = 0.24;     // (a bigger layer step than the board's, so a tile clearly lies on another on a phone)
  const ux = t => t.x / 2 - t.z * dF, uy = t => t.y / 2 * ratio - t.z * dF;
  const minX = Math.min(...tiles.map(ux)), maxX = Math.max(...tiles.map(t => ux(t) + 1));
  const minY = Math.min(...tiles.map(uy)), maxY = Math.max(...tiles.map(t => uy(t) + ratio));
  const W = el.clientWidth || 300, maxH = Math.max(200, Math.min(380, innerHeight * 0.5));
  const tw = Math.min(80, (W - 24) / (maxX - minX + 1.2), (maxH - 40) / (maxY - minY + 1.25)), d = Math.max(2, tw * 0.085), sw = Math.round(tw * 0.64);
  el.dataset.step = 0;
  el.innerHTML = `<div class="intro-tray" style="--slotw:${sw}px;--sfs:${(sw * 0.62).toFixed(1)}px">${'<span class="intro-slot"></span>'.repeat(4)}</div>` +
    `<div class="intro-board${S.highlight ? ' hl' : ''}" style="--d:${d.toFixed(1)}px;--fs:${(tw * 0.66).toFixed(1)}px"></div><span class="intro-hand"><i>👆</i></span>`;
  const tray = el.querySelector('.intro-tray'), board = el.querySelector('.intro-board'), hand = el.querySelector('.intro-hand');
  const slots = [...tray.children];
  tray.style.left = ((W - tray.offsetWidth) / 2).toFixed(1) + 'px';
  const top = tray.offsetTop + tray.offsetHeight + Math.max(12, tw * 0.25) - minY * tw;
  const ox = (W - (maxX - minX) * tw - d) / 2 - minX * tw;
  el.style.height = Math.ceil(top + maxY * tw + d * 1.6 + 12) + 'px';
  const rect = tiles.map(t => ({ l: ox + ux(t) * tw, t: top + uy(t) * tw, w: tw - 1.5, h: tw * ratio - 1.5 }));
  const obKindOf = i => left[i] ? (left[i] > 1 ? 'ice2' : 'ice') : '';
  board.innerHTML = tiles.map((t, i) => { const r = rect[i];
    return `<div class="tile${t.z ? ' intro-raised' : ''}" data-id="${ids[i]}" style="left:${r.l.toFixed(1)}px;top:${r.t.toFixed(1)}px;width:${r.w.toFixed(1)}px;height:${r.h.toFixed(1)}px;z-index:${t.z * 10000 + t.y * 100 + t.x}"><div class="face">${Tiles.faceHTML(S.theme, faces[i])}</div>${obHTML(obKindOf(i))}</div>`;
  }).join('');
  const els = ids.map(id => board.querySelector(`.tile[data-id="${id}"]`));
  const mid = i => ({ x: rect[i].l + rect[i].w / 2, y: rect[i].t + rect[i].h / 2 });
  // as on the board: a tile that is not free is darker with the highlight setting
  const paintBlocked = () => els.forEach((e, i) => e.classList.toggle('blocked', !!alive[i] && !free(i)));
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
    const i = inTray[k], had = s.dataset.i;
    s.dataset.i = i === undefined ? '' : i;
    s.innerHTML = i === undefined ? '' : `<div class="tmini${had !== String(i) ? ' land' : ''}">${Tiles.faceHTML(S.theme, faces[i])}</div>`;
  });
  const flash = (list, cls) => { list.forEach(j => { els[j].classList.remove(cls); void els[j].offsetWidth; els[j].classList.add(cls); }); later(900, () => list.forEach(j => els[j].classList.remove(cls))); };
  // the ice reacts to tiles leaving the board (specials.js updateObstacles): one layer per touching tile gone
  const thaw = () => need.forEach((n, i) => {
    if (!left[i] || !alive[i]) return;
    const now = iceLeft(i); if (now >= left[i]) return;
    left[i] = now; log.push(now ? ['crack', ids[i], now] : ['melt', ids[i]]);
    const f = document.createElement('div'); f.className = 'ob-crack'; els[i].appendChild(f); later(600, () => f.remove());
    paintOb(els[i], obKindOf(i));
    const c = mid(i); sparkle(c.x, c.y, now ? ['❄️'] : ['❄️', '💧', '✨']);
    paintBlocked();
  });
  const take = i => {
    const e = els[i], k = inTray.length, to = slotAt(k), from = mid(i), sc = Math.min(to.w / rect[i].w, to.h / rect[i].h) * 0.95;
    alive[i] = 0; inTray.push(i); paintBlocked(); log.push(['take', ids[i]]);
    e.classList.remove('blocked', 'obhint', 'blocker', 'shake'); e.style.zIndex = 900000; e.classList.add('intro-moving');
    e.style.transform = `translate(${(to.x - from.x).toFixed(1)}px, ${(to.y - from.y).toFixed(1)}px) scale(${sc.toFixed(3)})`;
    later(150, thaw);
    later(280, () => {
      e.classList.add('hidden'); paintTray();
      const twin = inTray.find(j => j !== i && faces[j] === faces[i]);
      if (twin === undefined) return;
      later(120, () => {
        const a = slotAt(inTray.indexOf(twin)), b = slotAt(inTray.indexOf(i));
        [twin, i].forEach(j => { const m = slots[inTray.indexOf(j)].firstChild; if (m) m.classList.add('popout'); });
        sparkle((a.x + b.x) / 2, (a.y + b.y) / 2, ['✨']); log.push(['pair', ids[twin], ids[i]]);
        later(230, () => { inTray.splice(inTray.indexOf(twin), 1); inTray.splice(inTray.indexOf(i), 1); paintTray(); });
      });
    });
  };
  let aim = null;
  return {
    // the hand glides to a tile
    point(id) {
      aim = mid(at(id));
      hand.classList.add('intro-on'); hand.classList.remove('intro-press');
      hand.style.transform = `translate(${(aim.x - tw * 0.18).toFixed(1)}px, ${(aim.y - 2).toFixed(1)}px)`;
    },
    // and taps it: what happens is what the game does with that tap (board.js tapTile)
    tap(id) {
      const i = at(id);
      if (aim) {
        hand.classList.add('intro-press'); later(150, () => hand.classList.remove('intro-press'));
        const r = document.createElement('span'); r.className = 'intro-ripple'; r.style.left = aim.x + 'px'; r.style.top = aim.y + 'px';
        el.appendChild(r); later(500, () => r.remove());
      }
      if (free(i) && !left[i]) { take(i); return; }
      flash([i], 'shake');
      // frozen: the touching tiles that thaw it light up (showThaw); covered: the tiles lying on it (showBlockers)
      if (left[i]) { log.push(['frozen', id]); flash(inb[i].filter(j => alive[j]), 'obhint'); }
      else { log.push(['covered', id]); flash(nb.above[i].filter(j => alive[j]), 'blocker'); }
    },
    rest() { hand.classList.remove('intro-on', 'intro-press'); },
  };
}
