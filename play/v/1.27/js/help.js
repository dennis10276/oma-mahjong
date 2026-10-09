/* Oma's Mahjong — extra help, switched on per kind of player in HELP (rules.js); grandma has it all:
   a gentler deal that follows her own results, easier retries, putting the tray back once per
   level, the helper that makes a pair glow, and no shuffling right at the start. */
'use strict';

// ---------- how gentle the deal is (Layouts.ease) ----------
function easeFor(key) {
  const h = help();
  const base = Math.max(0, h.gentle + (h.adapt && key[0] === 'L' ? adaptFor(key) * 0.5 : 0));
  const f = S.fails[key] || 0;
  return h.easierAfterFails && f >= h.easierAfterFails ? Math.min(3, base + 1) : base;
}

/* The difficulty follows her own results: her last tries on levels are kept (a win 1, a win after
   putting tiles back 0.5, stuck 0). It only changes when a NEW level starts (never during a level
   or its retries), by half a step; see HELP.care.adapt for the numbers. */
const adaptState = () => (S.adapt = S.adapt || { step: 0, hist: [], since: 0, key: '' });
const adaptRate = a => a.hist.length ? a.hist.reduce((x, y) => x + y, 0) / a.hist.length : null;
// the step to show in the play log when a level starts
const adaptStepFor = o => help().adapt && o.mode === 'level' ? adaptState().step : undefined;
function adaptFor(key) {
  const A = help().adapt, a = adaptState();
  if (a.key !== key) {
    if (a.hist.length >= A.min && a.since >= A.min) {
      const rate = adaptRate(a);
      const to = rate < A.low ? Math.min(A.maxStep, a.step + 1) : rate > A.high ? Math.max(A.minStep, a.step - 1) : a.step;
      if (to !== a.step) { logEvt('adapt', { from: a.step, to, rate: Math.round(rate * 100), n: a.hist.length, lv: +key.slice(1) || undefined }); a.step = to; a.since = 0; }
    }
    a.key = key; save();
  }
  return a.step;
}
// a try on a level ended: remember how it went
function adaptNote(r) {
  const A = help().adapt;
  if (!A || !G || G.o.mode !== 'level') return;
  if (r === 'restart' && G.elapsed < A.quickRestartS) return;     // starting over right away is not a failed try
  const v = r === 'win' ? (G.rescued ? 0.5 : 1) : r === 'stuck' || r === 'restart' ? 0 : null;
  if (v === null) return;
  const a = adaptState();
  a.hist = a.hist.concat(v).slice(-A.n); a.since++; save();
}

// ---------- a full tray: put the tiles back once per level (costs one star) ----------
function offerRescue() {
  if (!G || G.done) return;
  Sound.stuck(); buzz([40, 80, 40]);
  openModal(`<h2>${tx('fullTitle')}</h2>
    <p>${tx('rescueText')}</p>
    <button class="big-btn play" id="rsBack"><span class="bb-text"><b>${tx('rescueBack')}</b></span></button>
    <p class="note small">${tx('rescueCost')}</p>
    <button class="link-btn" id="rsRetry">${tx('startAgain')}</button>`, false);
  $('#rsBack').onclick = rescueTray;
  $('#rsRetry').onclick = () => { closeModal(); failTry(); restart(); };
}
function rescueTray() {
  if (!G || G.done) return;
  closeModal();
  G.rescued = true; G.overShown = false; G.combo = 0; clearNudge();
  logLvl('rescue', { ez: G.ez || undefined });
  bumpStat('rescues');
  const back = G.tray.slice(), slots = $('#tray').children, MS = 420;
  const from = back.map((t, k) => slots[k].getBoundingClientRect());
  G.tray = [];
  back.forEach((t, k) => {
    G.alive[t] = 1;
    const el = G.tiles[t].el;
    el.classList.remove('hidden'); el.classList.add('returning');
    const f = flyTile(faceOf(t), from[k], el.getBoundingClientRect(), MS);
    setTimeout(() => { f.remove(); el.classList.remove('returning'); }, MS + 40);
  });
  renderTray(); updateBlocked(); updateProgress(); saveCur();
  Sound.shuffle(); buzz([10, 30, 10]);
  setTimeout(() => { if (G) G.busy = false; toast(tx('tilesBack'), 2600); }, MS);
}

// ---------- no shuffling right at the start: it would throw away a good deal (and a star) ----------
function shuffleTooEarly() {
  const w = help().shuffleAfter;
  if (!w || G.tiles.length - aliveCount() >= w.taken || G.tray.length >= w.tray) return false;
  toast(tx('keepShuffle'), 2600); Sound.blocked();
  logLvl('shufno');
  return true;
}

/* ---------- the helper ----------
   When nothing has moved for a while and a pair can be matched, the pair starts to glow and keeps
   glowing until it is matched. A face-down tile in such a pair is turned face up (after downS
   seconds); a pair that can already be seen glows after upS seconds. Free, no star lost. */
function findNudge(downOnly) {
  const fr = [];
  for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && canTake(i)) fr.push(i);
  const hidden = i => G.down[i] && G.peek !== i;
  const cands = [];
  // a free tile whose twin waits in the tray, then two free twins on the board
  for (const i of fr) if (trayHas(faceOf(i))) cands.push([i]);
  const byFace = new Map();
  for (const i of fr) { const f = faceOf(i); if (!byFace.has(f)) byFace.set(f, []); byFace.get(f).push(i); }
  for (const l of byFace.values()) if (l.length >= 2) { const h = l.find(hidden); cands.push(h !== undefined ? [h, l.find(i => i !== h)] : [l[0], l[1]]); }
  return cands.find(c => c.some(hidden)) || (downOnly ? null : cands[0]) || null;
}
function nudgeTick() {
  const N = help().nudge;
  if (!N || !G || G.done || G.busy || G.flights || !inPlay() || document.hidden || !G.tStart) return;
  if (G.nudge && G.nudge.length) return;                 // already glowing: until it is matched
  const idle = (performance.now() - (G.lastMove || 0)) / 1000;
  if (idle < N.downS) return;
  const pair = findNudge(idle < N.upS);
  if (pair) startNudge(pair);
}
function startNudge(pair) {
  G.nudge = pair.slice();
  let turned = 0;
  for (const i of pair) {
    if (G.down[i]) { G.down[i] = 0; if (G.peek === i) G.peek = -1; else turn(i, false); turned++; }
    G.tiles[i].el.classList.add('nudge');
  }
  markTrayNudge();
  Sound.hint(); buzz(12);
  saveCur();
  logLvl('nudge', { down: turned || undefined });
}
function updateNudge() {
  if (!G || !G.nudge) return;
  G.nudge.filter(i => !G.alive[i]).forEach(i => G.tiles[i].el.classList.remove('nudge'));
  G.nudge = G.nudge.filter(i => G.alive[i]);
  // done when the pair is matched (nothing left, or nothing left to match it with)
  if (!G.nudge.length || !(trayHas(faceOf(G.nudge[0])) || G.nudge.length > 1)) clearNudge();
  else markTrayNudge();
}
function markTrayNudge() {
  const face = G.nudge && G.nudge.length ? faceOf(G.nudge[0]) : null;
  [...$('#tray').children].forEach((s, k) => s.classList.toggle('nudge', face !== null && G.tray[k] !== undefined && faceOf(G.tray[k]) === face));
}
function clearNudge() {
  if (!G) return;
  (G.nudge || []).forEach(i => G.tiles[i].el && G.tiles[i].el.classList.remove('nudge'));
  G.nudge = null; G.lastMove = performance.now();
  [...$('#tray').children].forEach(s => s.classList.remove('nudge'));
}
setInterval(nudgeTick, 1000);
