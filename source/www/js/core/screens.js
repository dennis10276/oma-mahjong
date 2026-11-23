// uses: tiles, core/*, rules, lang, board, specials, rewards, family/*, win
/* Oma's Mahjong — the menu screens (home, levels, calendar, themes, prizes), pop-ups and settings. */
'use strict';

// ---------- screens ----------
let curScreen = 'home';
function show(id) {
  if (curScreen === 'game' && id !== 'game') pauseClock();
  curScreen = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  if (id === 'home') renderHome();
  if (id === 'levels') renderLevels();
  if (id === 'daily') renderDaily();
  if (id === 'themes') renderThemes();
  if (id === 'trophies') renderTrophies();
  if (id === 'ranking') renderRanking();
  fitTexts(document.getElementById(id));
}

function renderHome() {
  if (applyUpdate()) return;
  setTimeout(maybeDailyGift, 900);
  $('#greet').innerHTML = fx('greet', new Date().getHours());
  homeTip();
  const ts = totalStars();
  $('#homeStars').textContent = '⭐ ' + ts;
  const cur = loadCur();
  $('#playLabel').innerHTML = levelBlocked(S.level) ? fx('levelOnHold', S.level) : cur && cur.key === 'L' + S.level ? fx('continueLevel', S.level) : fx('levelN', S.level);
  const doneToday = !!S.daily[todayKey()];
  $('#dailyLabel').innerHTML = fx(doneToday ? 'dailyDone' : 'dailyWaiting');
  $('#btnDaily').classList.toggle('pulse', !doneToday);
  $('#streakBadge').textContent = '🔥 ' + streak();
  const lt = document.querySelectorAll('.logo-tiles .lt');
  const faces = S.theme === 'classic' ? [31, 34, 32] : S.theme === 'sunflower' ? [1, 0, 2] : [0, 4, 8];
  lt.forEach((el, i) => el.innerHTML = Tiles.faceHTML(S.theme === 'classic' ? 'classic' : S.theme, faces[i]).replace('class="emo"', 'class="emo" style="font-size:46px;display:grid;place-items:center;height:100%"'));
  renderGoal($('#nextUnlock'));
  $('#trophyCount').textContent = `${trophyCount()}/${TROPHIES.length}`;
  $('#rankBadge').textContent = '#' + myRank(undefined, 'week');
  renderTaskChip();
  if (S.lastWeek) setTimeout(() => { if (curScreen === 'home') checkLastWeek(); }, 400);
  else if (S.pendingHearts.length) setTimeout(() => { if (curScreen === 'home' && modalFree() && S.pendingHearts.length) { const h = S.pendingHearts; S.pendingHearts = []; save(); showHearts(h, () => renderHome()); } }, 400);
  if (sunUnlocked() && !S.sunSeen) setTimeout(() => { if (curScreen === 'home' && modalFree()) showSunflowerUnlock(() => renderHome()); }, 500);
  fitTexts($('#home'));
}
function starsStr(n) { return '★'.repeat(n) + `<span class="off">${'★'.repeat(3 - n)}</span>`; }
function renderLevels() {
  $('#lvStars').textContent = '⭐ ' + totalStars();
  const N = Math.max(24, Math.ceil((S.level + 8) / 12) * 12);
  const grid = $('#levelGrid'); grid.innerHTML = '';
  for (let i = 1; i <= N; i++) {
    const b = document.createElement('button');
    const st = S.stars[i] || 0;
    const locked = i > S.level || levelBlocked(i);
    b.className = 'lv' + (i === S.level ? ' current' : '') + (locked ? ' locked' : '');
    b.innerHTML = locked ? `🔒<small style="color:rgba(255,255,255,.6)">${i}</small>` : `${i}<small>${i === S.level && !st ? '▶' : starsStr(st)}</small>`;
    b.disabled = locked;
    if (i === RULES.sunflower.level) { b.classList.add('prize'); b.insertAdjacentHTML('beforeend', '<span class="prize-ico">🌻</span>'); }
    if (!locked) b.onclick = () => startLevel(i);
    grid.appendChild(b);
  }
  const cur = grid.querySelector('.current');
  if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 30);
}

// daily calendar
let calY, calM, selDate;
function renderDaily() {
  const now = new Date();
  if (calY === undefined) { calY = now.getFullYear(); calM = now.getMonth(); }
  if (!selDate) selDate = todayKey();
  const s = streak();
  if (s > S.bestStreak) { S.bestStreak = s; save(); }
  $('#dStreak').textContent = '🔥 ' + s;
  $('#streakText').textContent = tx('daysInRow', s);
  $('#bestText').textContent = tx('record', tx('days', S.bestStreak));
  $('#calTitle').textContent = `${monthName(calM)} ${calY}`;
  $('#calNext').style.visibility = (calY > now.getFullYear() || (calY === now.getFullYear() && calM >= now.getMonth())) ? 'hidden' : 'visible';
  const grid = $('#calGrid'); grid.innerHTML = '';
  const first = new Date(calY, calM, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(calY, calM + 1, 0).getDate();
  for (let i = 0; i < offset; i++) grid.appendChild(document.createElement('span'));
  let doneCount = 0;
  const tk = todayKey();
  for (let d = 1; d <= days; d++) {
    const k = `${calY}-${pad(calM + 1)}-${pad(d)}`;
    const el = document.createElement('button');
    el.className = 'cd';
    el.textContent = d;
    if (S.daily[k]) { el.classList.add('done'); doneCount++; }
    if (k === tk) el.classList.add('today');
    if (k > tk) el.classList.add('future');
    else el.onclick = () => { selDate = k; renderDaily(); };
    if (k === selDate) el.classList.add('sel');
    grid.appendChild(el);
  }
  $('#calCount').textContent = tx('calCount', doneCount, days);
  const sd = parseKey(selDate);
  $('#dailyDateLabel').textContent = (selDate === tk ? tx('puzzleToday') : tx('puzzleOf', sd.getDate(), monthName(sd.getMonth()))) + (S.daily[selDate] ? tx('playAgain') : '');
}

// ---------- language ----------
function setLang(code) {
  S.lang = code; save();
  applyLang();
  // redraw what is on screen in the new language (the classic winds get other letters too)
  if (curScreen === 'game' && G) { renderBoard(false); renderTray(); $('#gameTitle').textContent = G.mode === 'level' ? tx('levelN', G.level) : $('#gameTitle').textContent; }
  else document.querySelectorAll('.screen.active').forEach(sc => show(sc.id));
}

// ---------- modal ----------
let modalClosable = true, modalOnClose = null;
function openModal(html, closable = true, onClose = null, cls = '') {
  const box = $('#modalBox');
  box.style.removeProperty('--heart-dialog-height');
  box.className = 'modal-box' + (cls ? ' ' + cls : '');   // 'compact': the after-level screens, they must fit without scrolling
  box.innerHTML = html; box.scrollTop = 0; $('#modal').classList.remove('hidden');
  fitTexts(box);
  modalClosable = closable; modalOnClose = onClose;
}
function closeModal() {
  $('#modal').classList.add('hidden');
  const f = modalOnClose; modalOnClose = null; if (f) f();
}
// Keep the actual nodes and their handlers, so a heart picker can return to a completed level.
function keepModal() {
  const box = $('#modalBox'), nodes = [...box.childNodes], cls = box.className.replace(/^modal-box\s*/, ''),
    style = box.getAttribute('style'), scroll = box.scrollTop, closable = modalClosable, onClose = modalOnClose;
  return () => {
    openModal('', closable, onClose, cls);
    box.replaceChildren(...nodes);
    if (style == null) box.removeAttribute('style'); else box.setAttribute('style', style);
    box.scrollTop = scroll;
  };
}
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && modalClosable) closeModal(); });

function openSettings() {
  const rows = ['sfx', 'music', 'vibrate', 'highlight', 'nums'];
  const cur = langOf(S);
  openModal(`<h2>${tx('settings')}</h2>
    <div class="set-row">${fx('set_lang')}<span class="lang-pick">${Object.entries(LANGS).map(([c, n]) => `<button class="lp${c === cur ? ' on' : ''}" data-lang="${c}">${n}</button>`).join('')}</span></div>
    ${rows.map(k => `<div class="set-row">${fx('set_' + k)}<button class="tog ${S[k] ? 'on' : ''}" data-k="${k}"></button></div>`).join('')}
    <button class="big-btn gold" id="mHow"><span class="bb-text"><b>${tx('howToPlay')}</b></span></button>
    <button class="link-btn" id="mClose">${tx('close')}</button>
    <button class="reset-btn" id="mReset">${tx('wipe')}</button>
    <div class="version">${tx('version', APP_VERSION)}</div>`);
  $('#modalBox').querySelectorAll('.lp').forEach(b => b.onclick = () => { setLang(b.dataset.lang); openSettings(); });
  $('#modalBox').querySelectorAll('.tog').forEach(t => t.onclick = () => {
    const k = t.dataset.k; S[k] = !S[k]; t.classList.toggle('on', S[k]); save();
    if (k === 'sfx') Sound.setSfx(S.sfx);
    if (k === 'music') Sound.setMusic(S.music);
    if (k === 'vibrate' && S.vibrate) buzz(40);
    if (k === 'highlight') $('#board').classList.toggle('hl', S.highlight);
    if (k === 'nums') document.body.classList.toggle('nonum', !S.nums);
  });
  $('#mHow').onclick = () => showIntro();
  $('#mReset').onclick = confirmReset;
  $('#mClose').onclick = closeModal;
}

// wipe levels, stars, daily puzzles and prizes; keep the sound/vibration/display settings
function confirmReset() {
  openModal(`<h2>${tx('wipeTitle')}</h2>
    <p>${tx('wipeText')}</p>
    <p style="font-size:17px;color:#a33">${tx('wipeWarn')}</p>
    <button class="big-btn play" id="rsNo"><span class="bb-text"><b>${tx('wipeNo')}</b></span></button>
    <button class="reset-btn" id="rsYes">${tx('wipeYes')}</button>`);
  $('#rsNo').onclick = closeModal;
  $('#rsYes').onclick = () => {
    const keep = { sfx: S.sfx, music: S.music, vibrate: S.vibrate, highlight: S.highlight, nums: S.nums, seenIntro: true, seenTray: true, seenDown: !!S.seenDown, seenSp: S.seenSp, pid: S.pid, name: S.name, avatar: S.avatar, heartsSeen: S.heartsSeen, lang: S.lang };
    const theme = Tiles.THEMES[S.theme] && !Tiles.THEMES[S.theme].prize ? S.theme : 'classic';
    Object.keys(S).forEach(k => delete S[k]);
    Object.assign(S, defaults(), keep, { theme });
    save(); clearCur(); G = null; pushScore();
    applyTheme(); applyBg();
    closeModal(); show('home');
    toast(tx('wiped'));
  };
}

function showIntro(after) {
  const f = Tiles.faceHTML(S.theme, 31), g = Tiles.faceHTML(S.theme, 4);
  openModal(`<h2>${fx('introTitle')}</h2>
    <p>${fx('intro1')}</p>
    <div class="how-tray"><div class="hm">${g}</div><div class="hm">${f}</div><div class="hm glow">${f}</div><div class="hm empty"></div></div>
    <p>${fx('intro2')}</p>
    <p>${fx('intro3', RULES.tools.fromLevel)}</p>
    <button class="big-btn play" id="mGo"><span class="bb-text"><b>${tx('gotIt')}</b></span></button>
    <button class="link-btn" id="mTileHelp">${tx('lessonMenu')}</button>
    <button class="link-btn" id="mLang">${tx('introLang')}</button>`, true, after);
  $('#mGo').onclick = closeModal;
  $('#mTileHelp').onclick = showLessonMenu;
  // switch the language right here (the explanation is shown again in the other language)
  $('#mLang').onclick = () => { setLang(isEn() ? 'nl' : 'en'); showIntro(after); };
  S.seenTray = true; S.seenIntro = true; save();
}
