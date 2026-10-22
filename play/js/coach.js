/* Oma's Mahjong — game tips (from 1.59, from level RULES.coach.fromLevel on).
   From that level no lesson shows on its own any more. After a lost try the player sees a small film
   of their own last moves in their own tiles, background and tray: where it went wrong and what would
   have worked, tied to the game tip of that trick (coachReview). The tips themselves (a film of a real
   game, COACH_CLIPS, without names: first the move that went wrong, then the better one) open from
   that film and from the menu. Nothing here touches the real
   board: the film has its own little pile, worked out with the same rules as tapTile. */
'use strict';

const coachOn = level => !!(RULES.coach && level >= RULES.coach.fromLevel);
const coachLevelOn = () => !!(G && G.o.mode === 'level' && G.o.track !== 'care' && coachOn(G.o.level));

/* The tips: which film, the caption at the start and end of each part, and tiles to point out
   (part: [when, tiles, colour]; when = 'start' or the number of the tap after which it shows). */
const COACH_TIPS = {
  three: { clip: 'three', caps: [['czThreeA', 'czThreeA2']] },
  twin: { clip: 'twin', caps: [['czTwinA', 'czTwinA2'], ['czTwinB', 'czTwinB2']], marks: [[], [['start', [43], 'good']]] },
  lookTray: { clip: 'lookTray', caps: [['czLookA', 'czLookA2'], ['czLookB', 'czLookB2']], marks: [[], [['start', [38], 'good']]] },
  remember: { clip: 'remember', caps: [['czMemA', 'czMemA2'], ['czMemB', 'czMemB2']], marks: [[], [['start', [27, 63], 'good']]] },
  uncover: { clip: 'uncover', caps: [['czUncA', 'czUncA2']], marks: [[['start', [64], 'good'], [0, [42, 48, 49], 'info']]] },
  clockFirst: { clip: 'clockFirst', caps: [['czClockA', 'czClockA2'], ['czClockB', 'czClockB2']], marks: [[], [['start', [65, 75, 79, 73], 'cone']]] },
  clockSlot: { clip: 'clockSlot', caps: [['czSlotA', 'czSlotA2'], ['czSlotB', 'czSlotB2']] },
  retry: { clip: 'retry', caps: [['czRetryA', 'czRetryA2'], ['czRetryB', 'czRetryB2']], marks: [[], [['start', [51, 61], 'good']]] },
};
const COACH_ORDER = ['three', 'twin', 'lookTray', 'remember', 'uncover', 'clockFirst', 'clockSlot', 'retry'];
const COACH_ICO = { three: '🀄', twin: '👆', lookTray: '👀', remember: '🧠', uncover: '🔍', clockFirst: '⏰', clockSlot: '⏰', retry: '🔁' };

// ---------- the little game: the same rules as tapTile ----------
// a position: { a: alive, d: face down, p: peeked tile, tray: [pictures], ck: { i, left, done } | null }
function czState(st) {
  const bits = v => typeof v === 'string' ? [...v].map(Number) : Array.from(v);
  return { a: bits(st.a), d: bits(st.d), p: st.p ?? -1, tray: st.tray.slice(), ck: st.ck ? { ...st.ck } : null };
}
// what a tap does: ['peek', i], ['take', i] (into the tray), ['match', i] (with its twin in the tray)
// or ['pair', i, j] (with the peeked tile j, no slot needed)
function czStep(s, faces, i) {
  if (s.d[i] && s.p !== i) {
    const pk = s.p, twinOpen = pk >= 0 && s.a[pk] && faces[pk] === faces[i];
    if (!twinOpen && !s.tray.includes(faces[i])) return ['peek', i];
  }
  if (s.tray.includes(faces[i])) return ['match', i];
  if (s.p >= 0 && s.p !== i && s.a[s.p] && faces[s.p] === faces[i]) return ['pair', i, s.p];
  return ['take', i];
}
function czApply(s, faces, act) {
  const n = { a: s.a.slice(), d: s.d.slice(), p: s.p, tray: s.tray.slice(), ck: s.ck ? { ...s.ck } : null };
  const off = t => { n.a[t] = 0; n.d[t] = 0; if (n.p === t) n.p = -1; if (n.ck && !n.ck.done) { if (n.ck.i === t) n.ck.done = true; else n.ck.left--; } };
  const [k, i, j] = act;
  if (k === 'peek') n.p = i;
  else if (k === 'take') { off(i); n.tray.push(faces[i]); }
  else if (k === 'match') { off(i); n.tray.splice(n.tray.indexOf(faces[i]), 1); }
  else if (k === 'pair') { off(i); off(j); }
  return n;
}
const czRemovals = act => act[0] === 'pair' ? 2 : act[0] === 'peek' ? 0 : 1;
/* Ice and locks, as in specials.js: ob = { need: {tile: hits}, locks, keys, unlocked } from the start of
   the try, inb = Layouts.iceNeighbors. Ice melts as tiles around it leave; locks open when both keys are gone. */
function czIceLeft(s, ob, inb, i) { const n = ob && ob.need[i]; if (!n) return 0; let gone = 0; for (const j of inb[i]) if (!s.a[j]) gone++; return Math.max(0, n - gone); }
const czLocked = (s, ob, i) => !!(ob && ob.locks.includes(i) && !ob.unlocked && ob.keys.some(k => s.a[k]));
const czTakeable = (s, nb, ob, inb, i) => !!s.a[i] && Layouts.isFree(i, s.a, nb) && !czIceLeft(s, ob, inb, i) && !czLocked(s, ob, i);
function czObKind(s, ob, inb, i) {
  if (!ob) return '';
  const ice = czIceLeft(s, ob, inb, i);
  if (ice) return ice > 1 ? 'ice2' : 'ice';
  if (czLocked(s, ob, i)) return 'lock';
  if (!ob.unlocked && ob.keys.includes(i) && ob.keys.some(k => s.a[k])) return 'key';
  return '';
}

// ---------- the film ----------
let coachRun = null;
const COACH_STOP = 'coach-stop';
function stopCoach() { if (coachRun) { coachRun.dead = true; coachRun.timers.forEach(clearTimeout); coachRun = null; } }
function coachDemoHTML(own = false, lesson = '') {
  return `<div class="lesson-demo coach-demo${own ? ' coach-own' : ''}"${lesson ? ` data-lesson="${lesson}"` : ''}>
    <div class="cz-stage" aria-hidden="true"><div class="cz-tray">${'<span class="cz-slot"></span>'.repeat(4)}</div><div class="cz-board"></div><div class="cz-ov"></div><span class="lz-hand"><i>👆</i></span><div class="cz-verdict"></div></div>
    <div class="lesson-caption"></div>
    <div class="lesson-controls"><span>${tx(own ? 'czYours' : 'lessonExample')}</span><button type="button" class="lesson-toggle"></button><button type="button" class="lesson-replay">↺ ${tx('lessonReplay')}</button></div>
  </div>`;
}
// a film from a tip (COACH_TIPS): the clip with its captions and pointed-out tiles
function coachTipClip(id) {
  const tip = COACH_TIPS[id], c = COACH_CLIPS[tip.clip];
  const segs = c.segs.map((s, n) => ({ ...s, caps: (tip.caps[n] || []).map(k => tx(k)), marks: (tip.marks || [])[n] || [] }));
  // the right way starts from the same moment as the wrong one
  if (segs.length === 2 && JSON.stringify(segs[0].start) !== JSON.stringify(segs[1].start)) {
    const B = czSameStart(segs[0], segs[1].acts.filter(a => a[0] !== 'end'), c.faces, segs[1].marks.flatMap(m => m[1]));
    segs[1] = { ...segs[1], start: B.start, acts: B.acts, marks: B.marks };
  }
  return { tiles: c.tiles, faces: c.faces, segs };
}
/* The right way, from the same moment as the wrong way: the same taps up to the mistake, then the
   better move (with a peek first where the film's own taps left a different tile open). The tiles of
   the better move light up at the moment of the decision. */
function czSameStart(segA, better, faces, good, cut = null) {
  const own = segA.acts.filter(a => a[0] !== 'end'), prefix = own.slice(0, cut ?? own.length - 1);
  let st = czState(segA.start);
  for (const a of prefix) st = czApply(st, faces, a);
  const line = [];
  for (const a of better) {
    if (czStep(st, faces, a[1])[0] !== a[0] && a[0] === 'pair' && st.p !== a[2]) { line.push(['peek', a[2]]); st = czApply(st, faces, ['peek', a[2]]); }
    line.push(a); st = czApply(st, faces, a);
  }
  const when = prefix.length ? prefix.length - 1 : 'start';
  return { start: segA.start, acts: prefix.concat(line, [['end', 'ok']]), marks: good.length ? [[when, good, 'good']] : [] };
}
/* Play a film in a .coach-demo: each part starts from its position and plays its taps; between
   parts the little pile is set up again. Loops until the window closes. */
function coachPlay(demo, clip) {
  stopCoach();
  const run = coachRun = { dead: false, paused: matchMedia('(prefers-reduced-motion: reduce)').matches, timers: [] };
  const stage = demo.querySelector('.cz-stage'), boardEl = stage.querySelector('.cz-board'), ov = stage.querySelector('.cz-ov');
  const trayEl = stage.querySelector('.cz-tray'), slots = [...trayEl.children], hand = stage.querySelector('.lz-hand');
  const verdict = stage.querySelector('.cz-verdict'), capEl = demo.querySelector('.lesson-caption'), toggle = demo.querySelector('.lesson-toggle');
  const tiles = clip.tiles.map(([x, y, z]) => ({ x, y, z })), faces = clip.faces, nb = Layouts.neighbors(tiles);
  const ob = clip.ob || null, inb = ob ? Layouts.iceNeighbors(tiles) : null;
  // an own film never shows a picture the player has not seen: such a tile shows a question mark
  const knownSet = clip.known ? new Set(clip.known) : null, hidden = i => !!knownSet && !knownSet.has(i);
  const bg = BGS.find(b => b.id === S.bg && !bgLocked(b)) || BGS[0];
  stage.style.background = bg.css;
  boardEl.classList.toggle('hl', S.highlight);
  Tiles.useFaces(S.theme, faces.filter(f => f < 100));
  /* One view for the whole film, like a camera: around the tiles the film is about (tapped, pointed
     out, the clock) with a tile of room, but never closer than about five tiles across, and never
     wider than the pile. Tiles outside the view are cut off at the edge. */
  const present = tiles.map((t, i) => clip.segs.some(s => czState(s.start).a[i]));
  const focus = new Set(clip.focus || []);
  if (!clip.focus) for (const sg of clip.segs) {
    for (const a of sg.acts) if (a[0] !== 'end') a.slice(1).forEach(i => focus.add(i));
    for (const m of sg.marks || []) m[1].forEach(i => focus.add(i));
    if (sg.start.ck) focus.add(sg.start.ck.i);
  }
  const W = stage.clientWidth || 300, H = stage.clientHeight || 240, top = trayEl.offsetHeight + 12;
  const ratio = 1.24, dF = 0.14, depthF = 0.085;
  const box = pick => { let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9; tiles.forEach((t, i) => { if (!pick(i)) return; const x = t.x / 2 - t.z * dF, y = t.y / 2 * ratio - t.z * dF; l = Math.min(l, x); r = Math.max(r, x + 1); t0 = Math.min(t0, y); b = Math.max(b, y + ratio); }); return { l, r, t0, b }; };
  const all = box(i => present[i]), f = focus.size ? box(i => focus.has(i)) : all;
  const aspect = (W - 12) / (H - top - 8);
  let vl = Math.max(all.l, f.l - 0.8), vr = Math.min(all.r, f.r + 0.8), vt = Math.max(all.t0, f.t0 - 0.8), vb = Math.min(all.b, f.b + 0.8);
  // at least ~5 tiles wide (and the matching height), grown evenly where the pile allows
  const grow = (lo, hi, want, min, max) => { const need = want - (hi - lo); if (need <= 0) return [lo, hi]; lo = Math.max(min, lo - need / 2); hi = Math.min(max, lo + want); lo = Math.max(min, hi - want); return [lo, hi]; };
  [vl, vr] = grow(vl, vr, Math.max(5, (vb - vt) * aspect), all.l, all.r);
  [vt, vb] = grow(vt, vb, (vr - vl) / aspect, all.t0, all.b);
  const tw = Math.min(76, (W - 12) / (vr - vl + depthF + 0.04), (H - top - 8) / (vb - vt + depthF * 1.4 + 0.04)), th = tw * ratio, dz = tw * dF, d = Math.max(2, tw * depthF);
  // the pile has its own window below the tray (tiles outside the view are cut off there, not under the tray)
  boardEl.style.top = top + 'px';
  const ox = (W - (vr - vl) * tw - d) / 2 - vl * tw, oy = (H - top - (vb - vt) * tw - d * 1.4 - 4) / 2 - vt * tw;
  boardEl.style.setProperty('--d', d.toFixed(1) + 'px'); boardEl.style.setProperty('--fs', (tw * 0.66).toFixed(1) + 'px');
  trayEl.style.setProperty('--sfs', ((slots[0].clientWidth || 30) * 0.62).toFixed(1) + 'px');
  const rect = i => { const t = tiles[i]; return { l: ox + t.x / 2 * tw - t.z * dz, t: oy + t.y / 2 * th - t.z * dz, w: tw - 1.5, h: th - 1.5 }; };
  let s = null, els = [], marks = new Map(), badge = null;

  const sleep = ms => new Promise((res, rej) => {
    let left = ms;
    const tick = () => {
      if (run.dead || !demo.isConnected) return rej(COACH_STOP);
      if (run.paused || document.hidden) { run.timers.push(setTimeout(tick, 120)); return; }
      if (left <= 0) return res();
      const dt = Math.min(120, left); left -= dt; run.timers.push(setTimeout(tick, dt));
    };
    tick();
  });
  const at = el => { const a = el.getBoundingClientRect(), o = stage.getBoundingClientRect(); return { x: a.left - o.left + a.width / 2, y: a.top - o.top + a.height / 2, w: a.width, h: a.height }; };
  const sparkle = (x, y, chars) => {
    for (let k = 0; k < 6; k++) {
      const e = document.createElement('span'); e.className = 'lz-spark'; e.textContent = chars[k % chars.length];
      e.style.left = x + 'px'; e.style.top = y + 'px'; stage.appendChild(e);
      const a = -Math.PI / 2 + (k - 2.5) * 0.55, dd = 24 + (k % 2) * 10;
      try { e.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${(Math.cos(a) * dd).toFixed(1)}px), calc(-50% + ${(Math.sin(a) * dd).toFixed(1)}px)) scale(1)`, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => e.remove(); } catch (er) { e.remove(); }
    }
  };
  const flip = el => { try { el.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(.08)', offset: .5 }, { transform: 'scaleX(1)' }], { duration: 300, easing: 'ease-in-out' }); } catch (e) { } };
  const isFree = i => Layouts.isFree(i, s.a, nb);
  const paintBlocked = () => els.forEach((el, i) => {
    if (!el) return;
    el.classList.toggle('blocked', !!s.a[i] && !isFree(i));
    if (!ob) return;
    const k = czObKind(s, ob, inb, i), o = el.querySelector('.ob');
    if (k && !o) el.insertAdjacentHTML('beforeend', `<div class="ob" data-k="${k}"></div>`);
    else if (o && !k) o.remove(); else if (o) o.dataset.k = k;
  });
  const paintTray = (bad = -1) => slots.forEach((sl, k) => { sl.innerHTML = k < s.tray.length ? `<div class="tmini${k === bad ? ' cz-bad' : ''}">${Tiles.boardFace(S.theme, s.tray[k])}</div>` : ''; });
  const placeMark = (i, cls) => {
    const R = rect(i), m = document.createElement('div');
    m.className = 'cz-mark cz-' + cls; m.style.cssText = `left:${R.l.toFixed(1)}px;top:${(R.t + top).toFixed(1)}px;width:${R.w.toFixed(1)}px;height:${R.h.toFixed(1)}px`;
    ov.appendChild(m); marks.set(i, m);
  };
  const unmark = i => { const m = marks.get(i); if (m) { m.remove(); marks.delete(i); } };
  const paintClock = (tick = false) => {
    if (!s.ck || s.ck.done || !s.a[s.ck.i]) { if (badge) { badge.remove(); badge = null; } return; }
    const R = rect(s.ck.i);
    if (!badge) { badge = document.createElement('b'); badge.className = 'cz-ck'; ov.appendChild(badge); }
    badge.style.left = (R.l + R.w / 2).toFixed(1) + 'px'; badge.style.top = Math.max(top + 14, R.t + top - 4).toFixed(1) + 'px';
    badge.innerHTML = `⏰<i>${Math.max(0, s.ck.left)}</i>`;
    if (tick) { badge.classList.remove('lz-tick'); void badge.offsetWidth; badge.classList.add('lz-tick'); }
  };
  const build = start => {
    s = czState(start); els = []; marks.clear(); badge = null;
    ov.innerHTML = ''; verdict.className = 'cz-verdict'; verdict.textContent = ''; trayEl.classList.remove('cz-full', 'cz-ok');
    const order = tiles.map((t, i) => i).filter(i => s.a[i]).sort((p, q) => tiles[p].z - tiles[q].z || tiles[p].y - tiles[q].y || tiles[p].x - tiles[q].x);
    boardEl.innerHTML = order.map(i => {
      const R = rect(i), t = tiles[i];
      return `<div class="tile${s.d[i] && s.p !== i ? ' back' : ''}${s.p === i ? ' cz-peek' : ''}${hidden(i) ? ' cz-unseen' : ''}" data-i="${i}" style="left:${R.l.toFixed(1)}px;top:${R.t.toFixed(1)}px;width:${R.w.toFixed(1)}px;height:${R.h.toFixed(1)}px;z-index:${t.z * 10000 + t.y * 100 + t.x}"><div class="face">${hidden(i) ? '<b class="cz-q">?</b>' : Tiles.boardFace(S.theme, faces[i])}</div></div>`;
    }).join('');
    boardEl.querySelectorAll('.tile').forEach(el => { els[+el.dataset.i] = el; });
    paintBlocked(); paintTray(); paintClock();
    hand.classList.remove('lz-on', 'lz-press');
  };
  const say = html => { capEl.innerHTML = html || ''; };
  // the hand goes to a tile and taps it
  const tapHand = async i => {
    const c = at(els[i]);
    hand.classList.add('lz-on'); hand.classList.remove('lz-press');
    hand.style.transform = `translate(${(c.x - 11).toFixed(1)}px, ${(c.y - 2).toFixed(1)}px)`;
    await sleep(470);
    hand.classList.add('lz-press');
    const rp = document.createElement('span'); rp.className = 'lz-ripple'; rp.style.left = c.x + 'px'; rp.style.top = c.y + 'px';
    stage.appendChild(rp); run.timers.push(setTimeout(() => rp.remove(), 500));
    await sleep(150); hand.classList.remove('lz-press');
  };
  // a tile flies to a point (a tray slot, or between the two tiles of a pair) and lands there
  const fly = (i, to, scale = 1) => {
    const el = els[i], c = at(el);
    if (el.parentNode !== ov) { el.style.top = (parseFloat(el.style.top) + top) + 'px'; el.style.setProperty('--d', boardEl.style.getPropertyValue('--d')); el.style.setProperty('--fs', boardEl.style.getPropertyValue('--fs')); ov.appendChild(el); void el.offsetWidth; }
    el.style.zIndex = 900000; el.classList.add('cz-moving');
    el.style.transform = `translate(${(to.x - c.x).toFixed(1)}px, ${(to.y - c.y).toFixed(1)}px) scale(${scale.toFixed(3)})`;
  };
  const gone = i => { unmark(i); const el = els[i]; if (el) { el.style.opacity = '0'; run.timers.push(setTimeout(() => el.remove(), 260)); } els[i] = null; };
  const doAct = async (act, n, seg) => {
    const [k, i, j] = act, before = s;
    await tapHand(i);
    s = czApply(before, faces, act);
    if (k === 'peek') {
      const pk = before.p;
      if (pk >= 0 && els[pk] && before.d[pk]) { els[pk].classList.add('back'); els[pk].classList.remove('cz-peek'); flip(els[pk]); }
      flip(els[i]); run.timers.push(setTimeout(() => { if (els[i]) { els[i].classList.remove('back'); els[i].classList.add('cz-peek'); } }, 150));
      await sleep(320);
    } else if (k === 'take') {
      const slot = slots[before.tray.length], c = at(slot);
      if (els[i].classList.contains('back')) { flip(els[i]); els[i].classList.remove('back'); }
      fly(i, c, Math.min(c.w / els[i].offsetWidth, c.h / els[i].offsetHeight));
      await sleep(400); gone(i); paintTray(s.tray.length >= 4 ? 3 : -1);
    } else if (k === 'match') {
      const k2 = before.tray.indexOf(faces[i]), slot = slots[k2], c = at(slot);
      if (els[i].classList.contains('back')) { flip(els[i]); els[i].classList.remove('back'); }
      fly(i, c, Math.min(c.w / els[i].offsetWidth, c.h / els[i].offsetHeight));
      await sleep(400); gone(i);
      const m = slot.firstElementChild; if (m) m.classList.add('cz-pop');
      sparkle(c.x, c.y, S.theme === 'sunflower' ? ['🌻', '✨'] : ['✨']);
      await sleep(260); paintTray();
    } else if (k === 'pair') {
      if (els[i].classList.contains('back')) { flip(els[i]); els[i].classList.remove('back'); }
      const a = at(els[i]), b2 = at(els[j]), mid = { x: (a.x + b2.x) / 2, y: Math.min(a.y, b2.y) - a.h * 0.3 };
      await sleep(180);
      fly(i, mid); fly(j, mid);
      await sleep(400);
      els[i].classList.add('cz-pop'); els[j].classList.add('cz-pop');
      sparkle(mid.x, mid.y, S.theme === 'sunflower' ? ['🌻', '✨'] : ['✨']);
      await sleep(200); gone(i); gone(j);
    }
    if (k !== 'peek') {
      if (s.ck && before.ck && !before.ck.done && s.ck.done) { const c = at(els[s.ck.i] || boardEl); sparkle(c.x, c.y, ['⏰', '✨']); }
      paintBlocked(); paintClock(s.ck && !s.ck.done && s.ck.left !== before.ck.left);
    }
    for (const [when, ids, cls] of seg.marks) if (when === n) ids.forEach(t => { if (s.a[t]) placeMark(t, cls); });
  };
  const ending = async end => {
    hand.classList.remove('lz-on');
    if (end === 'lose') { trayEl.classList.add('cz-full'); verdict.className = 'cz-verdict cz-no'; verdict.textContent = '✗'; }
    else if (end === 'clock') { if (badge) badge.classList.add('cz-out'); verdict.className = 'cz-verdict cz-no'; verdict.textContent = '⏰'; }
    else if (end === 'stuck') { verdict.className = 'cz-verdict cz-no'; verdict.textContent = '✗'; }
    else if (end === 'ok') { trayEl.classList.add('cz-ok'); verdict.className = 'cz-verdict cz-yes'; verdict.textContent = '✓'; const c = at(verdict); sparkle(c.x, c.y, ['✨', '⭐']); }
    await sleep(80);
  };
  const controls = () => {
    demo.classList.toggle('lesson-paused', run.paused);
    toggle.textContent = tx(run.paused ? 'lessonPlay' : 'lessonPause');
    toggle.setAttribute('aria-pressed', String(!run.paused));
  };
  const play = async () => {
    for (let loop = 0; ; loop++) {
      for (let n = 0; n < clip.segs.length; n++) {
        const seg = clip.segs[n];
        if (n || loop) { stage.classList.add('lz-fade'); await sleep(200); }
        build(seg.start); stage.classList.remove('lz-fade');
        demo.dataset.part = n; demo.dataset.step = 0;
        say(seg.caps[0]);
        for (const [when, ids, cls] of seg.marks) if (when === 'start') ids.forEach(t => { if (s.a[t]) placeMark(t, cls); });
        await sleep(1500);
        for (let k = 0; k < seg.acts.length; k++) {
          const act = seg.acts[k];
          if (act[0] === 'end') { await ending(act[1]); continue; }
          if (act[0] === 'say') { say(tx(act[1])); await sleep(1100); continue; }
          demo.dataset.step = k + 1;
          await doAct(act, k, seg);
          await sleep(act[0] === 'peek' ? 420 : 560);
        }
        say(seg.caps[1]);
        await sleep(2800);
      }
    }
  };
  toggle.onclick = () => { run.paused = !run.paused; controls(); };
  demo.querySelector('.lesson-replay').onclick = () => { coachPlay(demo, clip); if (coachRun) { coachRun.paused = false; demo.classList.remove('lesson-paused'); toggle.textContent = tx('lessonPause'); } };
  controls();
  build(clip.segs[0].start); say(clip.segs[0].caps[0]);
  play().catch(e => { if (e !== COACH_STOP) console.error(e); });
  return run;
}

// ---------- showing a tip ----------
function showCoachTip(id, after = null, reminder = false, why = reminder ? 'retry' : 'manual') {
  const mine = why === 'manual' ? czMine()[id] : null;
  openModal(`${reminder ? `<p class="lesson-reminder">${tx('lessonReminder')}</p>` : ''}<h2>${tx('czT_' + id)}</h2>
    ${coachDemoHTML()}${mine ? `<div class="cz-switch"><button type="button" class="cz-sw on" data-w="tip">${tx('lessonExample')}</button><button type="button" class="cz-sw" data-w="mine">⭐ ${tx('czYours')}</button></div>` : ''}<details class="cz-more"><summary>${tx('czMore')}</summary><p>${tx('czX_' + id)}</p></details>
    <button class="big-btn play" id="ntGo"><span class="bb-text"><b>${tx('gotIt')}</b></span></button>`, false, after, 'tile-help coach-help');
  coachPlay($('#modalBox .coach-demo'), coachTipClip(id));
  // the player's own game with this trick, next to the real game
  if (mine) $('#modalBox').querySelectorAll('.cz-sw').forEach(b => { b.onclick = () => {
    $('#modalBox').querySelectorAll('.cz-sw').forEach(x => x.classList.toggle('on', x === b));
    const demo = $('#modalBox .coach-demo');
    demo.classList.toggle('coach-own', b.dataset.w === 'mine');
    demo.querySelector('.lesson-controls span').textContent = tx(b.dataset.w === 'mine' ? 'czYours' : 'lessonExample');
    coachPlay(demo, b.dataset.w === 'mine' ? mine.clip : coachTipClip(id));
  }; });
  replayMark('coach', [id, why]);
  const message = recordHelpMessage('coach-' + id, why);
  $('#ntGo').onclick = () => { message('ack'); closeModal(); };
}
/* The clock, explained with a real game (the route of the tip "go for the clock first"): the clock
   counts down on its own tile with every tile taken, a peek costs nothing, the clock tile in time. */
function coachClockClip() {
  const c = COACH_CLIPS.clockFirst, sg = c.segs[1], acts = [];
  sg.acts.forEach((a, k) => {
    if (a[0] === 'peek') acts.push(['say', 'czClockPeek']);
    acts.push(a);
    if (k === 0) acts.push(['say', 'czClockMove']);
  });
  return { tiles: c.tiles, faces: c.faces, segs: [{ start: sg.start, acts, caps: [tx('czClockIntro'), tx('czClockDone')], marks: [] }] };
}
/* The player's own examples: every own film shown is kept for its tip (the newest one), so the tip in
   the menu can show the player's own game next to the real game. Kept apart from the saved progress. */
const CZ_MINE = 'omamj.czmine';
const czMine = () => { try { return JSON.parse(localStorage.getItem(CZ_MINE) || '{}'); } catch (e) { return {}; } };
function czKeepMine(r) {
  if (!r || !r.tip) return;
  const m = czMine(); m[r.tip] = { t: Date.now(), lv: G && G.o.level, clip: r.clip };
  try { localStorage.setItem(CZ_MINE, JSON.stringify(m)); } catch (e) { }
}
// the game tips, the player's own examples, and the explanations of the special tiles
function showCoachMenu() {
  const mine = czMine();
  const tiles = ['ice', 'lock', 'trayPair', 'clock'];
  openModal(`<h2>${tx('czMenu')}</h2><div class="cz-picks">${COACH_ORDER.map(k => `<button class="lesson-pick cz-pick" data-kind="${k}"><span>${COACH_ICO[k]}</span><b>${tx('czT_' + k)}</b>${mine[k] ? `<i class="cz-mine">${tx('czYours')}</i>` : ''}</button>`).join('')}</div>
    <h3 class="cz-h3">${tx('lessonMenu')}</h3><div class="cz-picks cz-tilepicks">${tiles.map(k => `<button class="lesson-pick cz-pick cz-tilepick" data-tile="${k}"><span>${NEW_TILES[k] ? NEW_TILES[k].ico : '⏰'}</span><b>${tx('nt_' + k)}</b></button>`).join('')}</div>
    <button class="link-btn" id="mClose">${tx('gotIt')}</button>`, true, null, 'tile-help coach-help coach-menu');
  $('#modalBox').querySelectorAll('.cz-pick[data-kind]').forEach(b => { b.onclick = () => showCoachTip(b.dataset.kind, showCoachMenu, false, 'manual'); });
  $('#modalBox').querySelectorAll('.cz-tilepick').forEach(b => { b.onclick = () => b.dataset.tile === 'clock' ? showClockLesson(showCoachMenu, false, 'manual') : showTileLesson(b.dataset.tile, showCoachMenu, false, 'manual'); });
  $('#mClose').onclick = closeModal;
}
// ---------- the player's own last moves ----------
/* Every accepted tap of this try is noted (the position at the first tap, then only the tile
   numbers); the film is worked out from that when the try is lost. Anything the little game does
   not know (a joker, shuffling, putting the tray back, the helper turning tiles over) starts the
   notes afresh from the next tap. */
/* What the player has seen. The films never show a picture the player has not seen: not in this
   try, and not in an earlier try of the same board this session (a retry is the same deal). A tile
   counts as seen when it lay face up and not fully under another tile, was peeked at, or was tapped. */
const czMemory = new Map();          // level key -> { sig, seen: Set of tiles }
let czOpen = null;                    // the notes of the current try, with its board
const czSig = faces => faces.join(',');
function czCovered(st, tiles, nb, i) { return nb.above[i].some(j => st.a[j] && tiles[j][0] === tiles[i][0] && tiles[j][1] === tiles[i][1]); }
function czLook(st, tiles, nb, seen) { st.a.forEach((v, i) => { if (v && ((!st.d[i] && !czCovered(st, tiles, nb, i)) || st.p === i)) seen.add(i); }); }
// play the notes again in the little game: every position, every act, and what was seen before each tap
function czRun(z) {
  const { faces, tiles, nb } = z;
  let s = czState(z.start);
  const states = [s], acts = [], seen = new Set(), seenAt = [];
  czLook(s, tiles, nb, seen);
  for (const i of z.taps) {
    seenAt.push(new Set(seen));
    const a = czStep(s, faces, i); acts.push(a); s = czApply(s, faces, a); states.push(s);
    // a tapped tile was seen: a face-down tile that goes straight to its twin flips open as it goes
    a.slice(1).forEach(k => seen.add(k));
    czLook(s, tiles, nb, seen);
  }
  return { states, acts, seen, seenAt };
}
// keep what this try showed, for a next try of the same board
function czFold(z) {
  if (!z || !z.taps.length) return;
  const sig = czSig(z.faces), m = czMemory.get(z.key);
  const mem = m && m.sig === sig ? m : { sig, seen: new Set() };
  for (const i of czRun(z).seen) mem.seen.add(i);
  czMemory.set(z.key, mem);
}
const czSeenBefore = z => { const m = czMemory.get(z.key); return m && m.sig === czSig(z.faces) ? m.seen : new Set(); };
function coachNote(i) {
  if (!G) return;
  if (!G.cz) { czFold(czOpen); G.cz = czOpen = { key: G.key, faces: G.tiles.map((t, k) => faceOf(k)), tiles: G.tiles.map(t => [t.x, t.y, t.z]), nb: G.nb, start: { a: Array.from(G.alive), d: Array.from(G.down), p: G.peek, tray: G.tray.map(faceOf), ck: G.clock && G.alive[G.clock.i] ? { i: G.clock.i, left: clockLeft() } : null },
    ob: G.ob ? { need: { ...G.ob.need }, locks: [...G.ob.locks], keys: G.ob.keys.slice(), unlocked: G.ob.unlocked } : null, taps: [] }; }
  G.cz.taps.push(i);
}
const coachForget = () => { if (G && G.cz) { czFold(G.cz); G.cz = czOpen = null; } };

// only the peeks the film needs: the one right before the tile is used
function czTrim(acts) {
  return acts.filter((a, k) => {
    if (a[0] !== 'peek') return true;
    for (let j = k + 1; j < acts.length; j++) {
      if (acts[j][0] === 'peek') { if (acts[j][1] === a[1]) return false; continue; }
      return acts[j].includes(a[1]);
    }
    return false;
  });
}
/* A short route to the clock using only tiles the player has seen (known): pairs, matches with the
   tray and single tiles, never a 4th tile, the clock off the board in time. Tiles on top of and next to
   the clock are tried first. No route with known tiles: no film. */
function czClockRoute(start, faces, tiles, nb, ob, inb, known, budget = 40000) {
  const ck = start.ck; if (!ck) return null;
  const cone = new Set();
  (function dig(i, dir) {
    for (const j of nb.above[i]) if (start.a[j] && !cone.has(j)) { cone.add(j); dig(j, 0); }
    const side = (arr, dd) => arr.filter(j => start.a[j]);
    const L = side(nb.left[i]), R = side(nb.right[i]);
    const pick = dir < 0 ? L : dir > 0 ? R : (L.length <= R.length ? L : R), dd = pick === L ? -1 : 1;
    for (const j of pick) if (!cone.has(j)) { cone.add(j); dig(j, dd); }
  })(ck.i, 0);
  let nodes = 0;
  const moves = s => {
    // only tiles whose picture the player has seen (in this try or an earlier one)
    const fr = []; for (let i = 0; i < s.a.length; i++) if (known.has(i) && czTakeable(s, nb, ob, inb, i)) fr.push(i);
    const out = [];
    for (const i of fr) if (s.tray.includes(faces[i])) out.push([['match', i]]);
    for (const i of fr) for (const j of fr) if (j > i && faces[i] === faces[j] && !s.tray.includes(faces[i])) {
      if (s.d[i] || s.d[j]) { const dn = s.d[i] ? i : j, up = dn === i ? j : i; out.push([['peek', dn], ['pair', up, dn]]); }
      else if (s.tray.length <= 2) out.push([['take', i], ['match', j]]);
    }
    if (s.tray.length <= 2) for (const i of fr) if (!s.tray.includes(faces[i]) && !fr.some(j => j !== i && faces[j] === faces[i])) out.push(s.d[i] && s.p !== i ? [['peek', i], ['take', i]] : [['take', i]]);
    const score = m => m.reduce((n, a) => n + (a[1] === ck.i ? -10 : cone.has(a[1]) ? -2 : 1), 0);
    return out.sort((p, q) => score(p) - score(q));
  };
  const go = (s, depth, path, maxTray) => {
    if (++nodes > budget) throw COACH_STOP;
    if (s.ck.done) return s.tray.length <= maxTray ? path : null;
    if (s.ck.left <= 0 || depth <= 0) return null;
    for (const m of moves(s)) {
      let t = s, ok = true;
      for (const a of m) { if (czStep(t, faces, a[1])[0] !== a[0]) { ok = false; break; } t = czApply(t, faces, a); }
      if (!ok || t.tray.length >= 4) continue;
      if (!t.ck.done && t.ck.left <= 0) continue;
      const r = go(t, depth - m.length, path.concat(m), maxTray);
      if (r) return r;
    }
    return null;
  };
  try { for (const maxTray of [2, 3]) { nodes = 0; const r = go(start, 24, [], maxTray); if (r) return r; } } catch (e) { if (e !== COACH_STOP) throw e; }
  return null;
}
/* Which tip fits the try, with the film of the player's own moves and the better move.
   why: 'tray' (a 4th tile), 'clock' (the clock ran out) or 'restart' (the player starts over).
   A way out ("out") is a move that does not fill the tray, with tiles the player has seen: a tile that
   matches the tray, a pair with a face-down tile, or an open pair while the tray has room.
   - a loss: the better move at the losing tap; if there was none, the last earlier moment where the
     player still had a way out but took a single tile instead (that tap is marked);
   - a restart: the way out that was still there; if there was none, as above;
   - the clock: a route from the start of the try that reaches the clock in time.
   Returns null when nothing clear fits. */
function coachReview(why) {
  const z = G && G.cz;
  if (!z || !z.taps.length || !coachLevelOn()) return null;
  const { faces, tiles, nb } = z;
  const ob = z.ob, inb = ob ? Layouts.iceNeighbors(G.tiles) : null;
  if (faces.some(f => f >= 100)) return null;               // jokers: not in the little game
  const before = czSeenBefore(z), { states, acts, seen, seenAt } = czRun(z), s = states[states.length - 1];
  czFold(z);
  // the little game must end exactly where the real one did
  if (s.a.some((v, i) => v !== G.alive[i]) || s.tray.join() !== G.tray.map(faceOf).join()) return null;
  const free = (st, i) => czTakeable(st, nb, ob, inb, i);
  const ok = (st, line) => { let x = st; for (const a of line) { if (czStep(x, faces, a[1])[0] !== a[0]) return null; x = czApply(x, faces, a); } return x.tray.length < 4 ? line : null; };
  const knownAt = k => new Set([...(k < seenAt.length ? seenAt[k] : seen), ...before]);
  // a way out at position k (before tap k; k = acts.length is where the try ended)
  const outAt = (k, tapped = -1) => {
    const st = states[k], kn = knownAt(k), fr = st.a.map((v, i) => i).filter(i => free(st, i));
    let line;
    if (tapped >= 0 && st.p === tapped) {
      const tw = fr.find(j => j !== tapped && faces[j] === faces[tapped] && kn.has(j));
      if (tw !== undefined && (line = ok(st, [['pair', tw, tapped]]))) return { line, kind: 'twin', tip: 'twin' };
    }
    const m = fr.find(j => j !== tapped && st.tray.includes(faces[j]) && kn.has(j));
    if (m !== undefined && (line = ok(st, [['match', m]]))) return st.d[m] ? { line, kind: 'peek', tip: 'remember' } : { line, kind: 'lookTray', tip: 'lookTray' };
    for (const x of fr) for (const y of fr) if (x !== y && faces[x] === faces[y] && st.d[x] && kn.has(x) && kn.has(y) && !st.tray.includes(faces[x])) {
      line = ok(st, st.p === x ? [['pair', y, x]] : st.p === y ? [['pair', x, y]] : [['peek', x], ['pair', y, x]]);
      if (line) return { line, kind: 'remember', tip: 'remember' };
    }
    if (st.tray.length <= 2) for (const x of fr) for (const y of fr) if (x < y && faces[x] === faces[y] && !st.d[x] && !st.d[y] && kn.has(x) && kn.has(y) && !st.tray.includes(faces[x])) {
      line = ok(st, [['take', x], ['match', y]]);
      if (line) return { line, kind: 'pair', tip: 'lookTray' };
    }
    return null;
  };
  // the last earlier moment with a way out where a single tile went into the tray instead
  const mistake = last => {
    for (let k = last; k >= 0 && k >= last - 25; k--) {
      if (acts[k][0] !== 'take') continue;
      const o = outAt(k);
      if (o && JSON.stringify(o.line[0]) !== JSON.stringify(acts[k])) return { k, ...o };
    }
    return null;
  };
  const L = acts.length - 1;
  let found = null, end = why === 'clock' ? 'clock' : why === 'restart' ? 'restart' : 'lose';
  if (why === 'clock' || (why === 'tray' && states[L].ck && !states[L].ck.done && acts[L][1] === states[L].ck.i)) {
    const route = czClockRoute(states[0], faces, tiles, nb, ob, inb, new Set([...seen, ...before]));
    if (!route) return null;
    const kind = why === 'clock' ? 'clockFirst' : 'clockSlot';
    found = { k: 0, line: route, kind, tip: kind };
  } else if (why === 'tray') {
    const o = outAt(L, acts[L][1]);
    found = o ? { k: L, ...o } : mistake(L - 1);
  } else {
    const o = outAt(acts.length);
    if (o) found = { k: acts.length, ...o, still: true };
    else { found = mistake(L); end = 'stuck'; }
  }
  if (!found) return null;
  const clock = found.kind === 'clockFirst' || found.kind === 'clockSlot';
  // the replay: from the last time the tray had room before the moment that counts, at most 6 taps earlier
  let from = 0;
  if (!clock) { from = Math.min(found.k, L); while (from > 0 && found.k - from < 6 && states[from].tray.length >= 2) from--; }
  const mine = czTrim(acts.slice(from));
  // the tap that went wrong earlier glows red until it is made
  const at = found.k < acts.length ? mine.indexOf(acts[found.k]) : -1;
  const markA = !clock && found.k < L && at >= 0 ? [[at > 0 ? at - 1 : 'start', [acts[found.k][1]], 'bad']] : [];
  const enc = st => ({ a: st.a, d: st.d, p: st.p, tray: st.tray, ck: st.ck });
  const segA = { start: enc(states[from]), acts: mine.concat([['end', end]]) };
  // the right way starts at the same moment: the same taps up to that moment, then the way out
  const cutAt = found.k >= acts.length ? mine.length : at;
  const good = found.line.filter(a => a[0] !== 'peek').flatMap(a => a.slice(1));
  const B = clock ? { start: enc(states[0]), acts: found.line.concat([['end', 'ok']]), marks: [] } : czSameStart(segA, found.line, faces, good, cutAt);
  const focus = clock ? null : [...new Set(mine.slice(Math.max(0, cutAt - 3)).concat(found.line).flatMap(a => a.slice(1)))];
  const endCap = found.still ? 'czStillOut' : { lose: 'czOwnLose', clock: 'czOwnClock', restart: 'czOwnRestart', stuck: 'czOwnStuck' }[end];
  return {
    tip: found.tip, kind: found.kind, still: !!found.still,
    clip: { tiles, faces, ob, focus, known: [...new Set([...seen, ...before])], segs: [
      { ...segA, caps: [tx('czOwnA'), tx(endCap)], marks: markA },
      { ...B, caps: [tx('czOwnB', tx('czT_' + found.tip)), tx('czOwn_' + found.kind)] },
    ] },
  };
}
/* Is the film of the own try due at this loss (RULES.coach)? Counts the real lost tries of each level
   (S.czLoss, restarts included): once from the first-th loss (the next one if no film could be made then),
   and from again-th on every every-th loss, from always-th on every loss, when the try was more than
   done (share of tiles gone). */
// count a lost try (a restart counts too: decision Dennis 2026-10-22)
function coachCount() {
  if (!coachLevelOn()) return null;
  const e = S.czLoss[G.key] || (S.czLoss[G.key] = { n: 0, shown: 0 });
  e.n++; save();
  return e;
}
function coachDueAt(n, shown) {
  const C = RULES.coach, t = G.tiles.length, done = (t - aliveCount() - G.tray.length) / t;
  return (!shown && n >= C.first) || (n >= C.again && ((n - C.again) % C.every === 0 || n >= C.always) && done > C.done);
}
function coachDue() { const e = coachCount(); return !!e && coachDueAt(e.n, e.shown); }
// would the film be due if the player starts over now (nothing is counted yet)
function coachDueRestart() {
  if (!coachLevelOn()) return false;
  const e = S.czLoss[G.key] || { n: 0, shown: 0 };
  return coachDueAt(e.n + 1, e.shown);
}
const coachShown = () => { const e = S.czLoss[G.key]; if (e) { e.shown = e.n; save(); } };
/* The film of the own try, inside the window that tells the try was lost. It is tied to the tip whose
   trick would have saved the try: the better move is shown "with the tip ...", and the tip itself
   (the film of a real game and its explanation) opens from here; afterwards this window comes back. */
const coachReviewHTML = r => `${coachDemoHTML(true)}<button type="button" class="link-btn cz-tiplink" id="czTip">${COACH_ICO[r.tip]} ${tx('czSeeTip')} <b>${tx('czT_' + r.tip)}</b></button>`;
function coachReviewStart(r) {
  czKeepMine(r);
  coachPlay($('#modalBox .coach-demo'), r.clip);
  replayMark('coach', [r.tip, 'review', r.kind]);
  const link = $('#czTip');
  if (link) link.onclick = () => { const back = keepModal(); showCoachTip(r.tip, () => { back(); coachReviewStart(r); }, false, 'review'); };
}
