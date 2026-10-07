/* Oma's Mahjong — wiring: buttons, touch, app lifecycle and start-up. */
'use strict';

// ---------- wiring ----------
/* Easy tapping: the tile under the finger wins; if that one is stuck (or the finger
   lands just next to a tile) a free tile within a few pixels is taken instead.
   Every finger is handled on its own, so two tiles can be tapped at the same time. */
function pickTile(cx, cy) {
  if (!G) return -1;
  const br = $('#board').getBoundingClientRect();
  const x = cx - br.left, y = cy - br.top, pad = Math.max(6, (G.tw || 50) * 0.16);
  let top = -1, topZ = -1, near = -1, nearZ = -1;
  G.tiles.forEach((t, i) => {
    if (!G.alive[i] || !t.r) return;
    const r = t.r;
    if (x >= r.l && x <= r.l + r.w && y >= r.t && y <= r.t + r.h) { if (r.zi > topZ) { topZ = r.zi; top = i; } }
    else if (x >= r.l - pad && x <= r.l + r.w + pad && y >= r.t - pad && y <= r.t + r.h + pad && free(i)) { if (r.zi > nearZ) { nearZ = r.zi; near = i; } }
  });
  if (top >= 0 && free(top)) return top;
  if (near >= 0) return near;
  return top;
}
$('#boardWrap').addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const i = pickTile(e.clientX, e.clientY);
  if (i >= 0) { e.preventDefault(); onTap(i); }
});
$('#btnHint').onclick = hint;
$('#btnShuffle').onclick = shuffle;
$('#btnRestart').onclick = () => {
  if (!G || G.done || G.busy) return;
  openModal(`<h2>Opnieuw beginnen?</h2>
    <p>Het level begint dan weer vanaf het begin, met dezelfde stenen. Je krijgt je hint en schudden terug.</p>
    <button class="big-btn play" id="rYes"><span class="bb-text"><b>↻ Ja, opnieuw</b></span></button>
    <button class="link-btn" id="rNo">Nee, verder spelen</button>`);
  $('#rYes').onclick = () => { closeModal(); restart(); };
  $('#rNo').onclick = closeModal;
};
$('#btnHome').onclick = () => { saveCur(); if (G && !G.done) { syncClock(); logEvt('pause', { ...lvInfo(), at: G.attempt, s: Math.round(G.elapsed), left: aliveCount() }); } show('home'); };
$('#btnPlay').onclick = () => startLevel(S.level);
$('#btnDaily').onclick = () => { selDate = todayKey(); const n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); show('daily'); };
$('#btnLevels').onclick = () => show('levels');
$('#btnThemes').onclick = () => show('themes');
$('#btnTrophies').onclick = () => show('trophies');
$('#btnRanking').onclick = () => { if (!S.name) askName(() => show('ranking')); else show('ranking'); };
$('#rankName').onclick = () => askName(() => renderRanking());
$('#rkWeek').onclick = () => { rankMode = 'week'; renderRanking(); };
$('#rkAll').onclick = () => { rankMode = 'all'; renderRanking(); };
$('#btnTasks').onclick = () => { renderTaskChip(); if (tasksDone() === 3 && !S.tasks.chest) openChest(); else openTasks(); };
$('#btnSettings').onclick = openSettings;
$('#btnPlayDaily').onclick = () => startDaily(selDate);
$('#calPrev').onclick = () => { calM--; if (calM < 0) { calM = 11; calY--; } renderDaily(); };
$('#calNext').onclick = () => { calM++; if (calM > 11) { calM = 0; calY++; } renderDaily(); };
document.querySelectorAll('.back').forEach(b => b.onclick = () => show('home'));
document.addEventListener('click', e => { if (e.target.closest('button') && !e.target.closest('.tool')) { Sound.init(); Sound.button(); } }, true);
document.addEventListener('pointerdown', () => Sound.init(), { once: true });
addEventListener('resize', () => { if (curScreen === 'game') layoutBoard(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Sound.suspend(); if (curScreen === 'game') pauseClock(); }
  else { Sound.resume(); resumeClock(); if (curScreen === 'home') { if (applyUpdate()) return; renderHome(); checkHearts(); } checkUpdate(); }
});

// Android back button (called from the native wrapper). Return true when handled.
window.handleBack = () => {
  if (!$('#modal').classList.contains('hidden')) { if (modalClosable) closeModal(); return true; }
  if (curScreen === 'game') { saveCur(); show('home'); return true; }
  if (curScreen !== 'home') { show('home'); return true; }
  return false;
};

Sound.setSfx(S.sfx); Sound.setMusic(S.music);
applyTheme();
applyBg();
ensureId();
fetchOnline().then(ok => { if (ok && curScreen === 'home') renderHome(); checkHearts(); checkSentHearts(); });
startHeartStream();
// a heart can arrive any moment: look again every minute and a half while the home curScreen is open
setInterval(() => { if (!document.hidden) { checkHearts(); if (curScreen === 'home') checkSentHearts(); } }, 30000);
document.body.classList.toggle('nonum', !S.nums);
document.body.classList.toggle('contrast', !!S.contrast);
show('home');
window.__mjReady = true;   // the boot script and the load-error banner look at this
// dashboard: app opened, and how long it stays on curScreen
let fgStart = Date.now();
logEvt('open', { lv: S.level, name: S.name || '', vw: innerWidth, vh: innerHeight });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { logEvt('hide', { fg: Math.round((Date.now() - fgStart) / 1000), scr: curScreen, ...(curScreen === 'game' && G && !G.done ? lvInfo() : {}) }); }
  else { fgStart = Date.now(); logEvt('show', { scr: curScreen }); }
});
setInterval(flushLog, 60 * 1000);
// web / iPhone version: works offline once loaded, and can be put on the home curScreen
if (location.protocol === 'https:' && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
if (isIOS && !standalone && location.protocol === 'https:' && !S.iosTip) setTimeout(() => {
  if (curScreen !== 'home' || !$('#modal').classList.contains('hidden')) return;
  S.iosTip = true; save();
  openModal(`<div class="sun-big">📱</div><h2>Zet het spel op je beginscherm</h2>
    <p style="text-align:left;font-size:19px">1. Tik onderaan op <b>Deel</b> <span style="font-size:24px">⬆️</span> (het vierkantje met de pijl).<br>2. Kies <b>Zet op beginscherm</b> ➕.<br>3. Tik op <b>Voeg toe</b>.</p>
    <p class="note small">Dan staat Oma's Mahjong als app tussen je andere apps, zonder Safari eromheen.</p>
    <button class="big-btn play" id="iosOk"><span class="bb-text"><b>Begrepen!</b></span></button>`, false);
  $('#iosOk').onclick = closeModal;
}, 1500);
// ---------- self-update (see the boot script in index.html) ----------
// this version started fine: forget earlier failed starts
try { const c = JSON.parse(localStorage.getItem(CODE_KEY) || 'null'); if (c && c.v === window.__mjCode && c.fail) { c.fail = 0; localStorage.setItem(CODE_KEY, JSON.stringify(c)); } } catch (e) { }
setTimeout(checkUpdate, 2500);
setInterval(checkUpdate, 60 * 1000);          // every minute while the app is open
// just updated between two levels: continue with the next level
if (S.afterUpdate) { const a = S.afterUpdate; S.afterUpdate = null; save(); setTimeout(() => { if (a.level) startLevel(a.level); else if (a.show && a.show !== 'home') show(a.show); toast(`✨ Bijgewerkt naar versie ${APP_VERSION}`, 2200); }, 300); }
// for the automated tests
window.__mj = { get G() { return G; }, S, startLevel, startDaily, onTap, Layouts, restart, pickTile, show, ranking, myPoints, showClimb, ensureTasks, taskProgress, openChest, openTasks, weekInfo, checkLastWeek, fetchHearts, maybeLucky, renderHome, sendHeart, pushScore };
