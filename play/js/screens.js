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
}

function renderHome() {
  if (applyUpdate()) return;
  setTimeout(maybeDailyGift, 900);
  const h = new Date().getHours();
  const greet = h < 6 ? 'Goedenacht, oma! 🌙' : h < 12 ? 'Goedemorgen, oma! ☀️' : h < 18 ? 'Goedemiddag, oma! 🌼' : 'Goedenavond, oma! 🌙';
  $('#greet').textContent = greet;
  const ts = totalStars();
  $('#homeStars').textContent = '⭐ ' + ts;
  const cur = loadCur();
  $('#playLabel').textContent = (cur && cur.key === 'L' + S.level ? 'Verder met level ' : 'Level ') + S.level;
  const doneToday = !!S.daily[todayKey()];
  $('#dailyLabel').textContent = doneToday ? 'Vandaag gehaald! 👑' : 'Nieuwe puzzel wacht!';
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
}
// the Zonnebloem prize: levels played so far, out of the levels needed
const sunProgress = () => { const need = RULES.sunflower.level, done = Math.min(need, S.level - 1); return { need, done, left: need - done, pct: Math.round(done / need * 100) }; };
function renderGoal(el) {
  if (!sunUnlocked()) {
    // the big prize comes first
    const { left, pct } = sunProgress();
    el.classList.add('sun');
    el.innerHTML = `<span class="g-ico">🌻</span><div>Nog <b>${left} ${left === 1 ? 'level' : 'levels'}</b> tot de hoofdprijs: het <b>Zonnebloem-thema</b>!<div class="bar"><i style="width:${pct}%"></i></div></div>`;
    return;
  }
  el.classList.remove('sun');
  const ts = totalStars();
  const next = numBgs.find(b => b.need > ts);
  if (!next) { el.innerHTML = 'Alle achtergronden vrijgespeeld! 🏆'; return; }
  const prev = [...numBgs].reverse().find(b => b.need <= ts);
  const pct = Math.round((ts - prev.need) / (next.need - prev.need) * 100);
  el.innerHTML = `Nog <b>${next.need - ts} ⭐</b> tot achtergrond “${next.name}”<div class="bar"><i style="width:${pct}%"></i></div>`;
}

function starsStr(n) { return '★'.repeat(n) + `<span class="off">${'★'.repeat(3 - n)}</span>`; }
function renderLevels() {
  $('#lvStars').textContent = '⭐ ' + totalStars();
  const N = Math.max(24, Math.ceil((S.level + 8) / 12) * 12);
  const grid = $('#levelGrid'); grid.innerHTML = '';
  for (let i = 1; i <= N; i++) {
    const b = document.createElement('button');
    const st = S.stars[i] || 0;
    b.className = 'lv' + (i === S.level ? ' current' : '') + (i > S.level ? ' locked' : '');
    b.innerHTML = i > S.level ? `🔒<small style="color:rgba(255,255,255,.6)">${i}</small>` : `${i}<small>${i === S.level && !st ? '▶' : starsStr(st)}</small>`;
    if (i === RULES.sunflower.level) { b.classList.add('prize'); b.insertAdjacentHTML('beforeend', '<span class="prize-ico">🌻</span>'); }
    if (i <= S.level) b.onclick = () => startLevel(i);
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
  $('#streakText').textContent = s === 1 ? '1 dag op rij' : `${s} dagen op rij`;
  $('#bestText').textContent = `Record: ${S.bestStreak} ${S.bestStreak === 1 ? 'dag' : 'dagen'}`;
  $('#calTitle').textContent = `${MONTHS[calM]} ${calY}`;
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
  $('#calCount').textContent = `Deze maand: ${doneCount} van ${days} 👑`;
  const sd = parseKey(selDate);
  $('#dailyDateLabel').textContent = (selDate === tk ? 'Puzzel van vandaag' : `Puzzel van ${sd.getDate()} ${MONTHS[sd.getMonth()]}`) + (S.daily[selDate] ? ' · nog eens' : '');
}

function renderThemes() {
  $('#thStars').textContent = '⭐ ' + totalStars();
  const un = sunUnlocked(), sc = $('#sunCard'), sp = sunProgress();
  sc.innerHTML = `<button class="suncard${un ? '' : ' locked'}${S.theme === 'sunflower' ? ' on' : ''}">
    <span class="sun-ico">🌻</span>
    <span class="sun-txt"><b>Zonnebloem</b><small>${un ? (S.theme === 'sunflower' ? 'In gebruik ✨' : 'Tik om te gebruiken') : `De hoofdprijs! Speel level ${sp.need} uit`}</small>
    ${un ? '<small>Zonnige stenen, zomermuziek met vogeltjes en bloemen-effecten</small>' : `<span class="bar"><i style="width:${sp.pct}%"></i></span><small>${sp.done} van de ${sp.need} levels uitgespeeld</small>`}</span>
    <span class="sun-pv">${[0, 1, 2].map(k => `<span class="mini">${Tiles.faceHTML('sunflower', k)}</span>`).join('')}</span></button>`;
  sc.firstElementChild.onclick = () => {
    if (!un) { toast(`Speel nog ${sp.left} levels uit om de Zonnebloem te winnen 🌻`); Sound.blocked(); return; }
    S.theme = 'sunflower'; S.bg = 'sunfield'; save(); applyBg(); applyTheme(); renderThemes(); Sound.sunflower(); FX.emoji(innerWidth / 2, innerHeight / 3, ['🌻', '🌼', '🐝'], 12);
  };
  const tl = $('#tileThemes'); tl.innerHTML = '';
  for (const [id, t] of Object.entries(Tiles.THEMES)) {
    if (t.prize) continue;
    const b = document.createElement('button');
    b.className = 'th' + (S.theme === id ? ' on' : '');
    const sample = id === 'classic' ? [0, 31, 22] : [0, 5, 13];
    b.innerHTML = `<div class="pv">${sample.map(k => `<div class="mini">${Tiles.faceHTML(id, k)}</div>`).join('')}</div>${t.name}`;
    b.onclick = () => { S.theme = id; save(); applyTheme(); renderThemes(); Sound.select(); };
    tl.appendChild(b);
  }
  const bl = $('#bgThemes'); bl.innerHTML = '';
  const ts = totalStars();
  for (const bg of BGS) {
    const b = document.createElement('button');
    const locked = bgLocked(bg);
    b.className = 'bgc' + (locked ? ' locked' : '') + (S.bg === bg.id ? ' on' : '');
    b.style.background = bg.css;
    b.innerHTML = locked ? `<div class="lock">🔒<br>${bg.sun ? 'level ' + RULES.sunflower.level : bg.need + ' ⭐'}</div>` : bg.name;
    b.onclick = () => {
      if (locked) { toast(bg.sun ? `Dit veld hoort bij de Zonnebloem-prijs: speel level ${RULES.sunflower.level} uit 🌻` : `Verdien nog ${bg.need - ts} ⭐ om “${bg.name}” vrij te spelen`); Sound.blocked(); return; }
      S.bg = bg.id; save(); applyBg(); renderThemes(); Sound.select();
    };
    bl.appendChild(b);
  }
}

function renderTrophies() {
  $('#statsBox').innerHTML = statsHTML();
  $('#trCount').textContent = `🏅 ${trophyCount()}/${TROPHIES.length}`;
  $('#trophyGrid').innerHTML = TROPHIES.map(t => {
    const got = S.trophies[t.id];
    const [v, n] = t.prog();
    return `<div class="trophy${got ? ' got' : ''}"><span class="t-ico">${t.ico}</span><b>${t.name}</b><small>${t.desc}</small>${got ? '<em>Gewonnen ✓</em>' : `<span class="bar"><i style="width:${Math.round(Math.min(1, v / n) * 100)}%"></i></span><em>${Math.min(v, n)} / ${n}</em>`}</div>`;
  }).join('');
}

// ---------- modal ----------
let modalClosable = true, modalOnClose = null;
function openModal(html, closable = true, onClose = null, cls = '') {
  const box = $('#modalBox');
  box.className = 'modal-box' + (cls ? ' ' + cls : '');   // 'compact': the after-level screens, they must fit without scrolling
  box.innerHTML = html; box.scrollTop = 0; $('#modal').classList.remove('hidden');
  modalClosable = closable; modalOnClose = onClose;
}
function closeModal() {
  $('#modal').classList.add('hidden');
  const f = modalOnClose; modalOnClose = null; if (f) f();
}
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && modalClosable) closeModal(); });

function openSettings() {
  const rows = [['sfx', '🔊 Geluidjes'], ['music', '🎵 Muziek'], ['vibrate', '📳 Trillen'], ['highlight', '✨ Vastzittende stenen donker'], ['nums', '🔢 Cijfers in de hoek'], ['bigTiles', '🔍 Extra grote stenen'], ['contrast', '🌓 Extra duidelijk (hoog contrast)']];
  openModal(`<h2>Instellingen</h2>${rows.map(([k, l]) => `<div class="set-row">${l}<button class="tog ${S[k] ? 'on' : ''}" data-k="${k}"></button></div>`).join('')}
    <button class="big-btn gold" id="mHow"><span class="bb-text"><b>Hoe speel je?</b></span></button>
    <button class="link-btn" id="mClose">Sluiten</button>
    <button class="reset-btn" id="mReset">🗑️ Voortgang wissen</button>
    <div class="version">Versie ${APP_VERSION}</div>`);
  $('#modalBox').querySelectorAll('.tog').forEach(t => t.onclick = () => {
    const k = t.dataset.k; S[k] = !S[k]; t.classList.toggle('on', S[k]); save();
    if (k === 'sfx') Sound.setSfx(S.sfx);
    if (k === 'music') Sound.setMusic(S.music);
    if (k === 'vibrate' && S.vibrate) buzz(40);
    if (k === 'highlight') $('#board').classList.toggle('hl', S.highlight);
    if (k === 'nums') document.body.classList.toggle('nonum', !S.nums);
    if (k === 'contrast') document.body.classList.toggle('contrast', S.contrast);
    if (k === 'bigTiles') toast(S.bigTiles ? 'Vanaf het volgende level: minder en grotere stenen 🔍' : 'Vanaf het volgende level weer gewone stenen');
  });
  $('#mHow').onclick = () => showIntro();
  $('#mReset').onclick = confirmReset;
  $('#mClose').onclick = closeModal;
}

// wipe levels, stars, daily puzzles and prizes; keep the sound/vibration/display settings
function confirmReset() {
  openModal(`<h2>Voortgang wissen?</h2>
    <p>Alle levels, sterren, dagpuzzels, prijzen en het Zonnebloem-thema worden gewist. Je begint weer bij <b>level 1</b>.</p>
    <p style="font-size:17px;color:#a33">Dit kan niet ongedaan worden gemaakt.</p>
    <button class="big-btn play" id="rsNo"><span class="bb-text"><b>Nee, bewaren</b></span></button>
    <button class="reset-btn" id="rsYes">Ja, alles wissen</button>`);
  $('#rsNo').onclick = closeModal;
  $('#rsYes').onclick = () => {
    const keep = { sfx: S.sfx, music: S.music, vibrate: S.vibrate, highlight: S.highlight, nums: S.nums, seenIntro: true, seenTray: true, seenDown: !!S.seenDown, seenSp: S.seenSp, pid: S.pid, name: S.name, avatar: S.avatar, heartsSeen: S.heartsSeen, bigTiles: S.bigTiles, contrast: S.contrast };
    const theme = Tiles.THEMES[S.theme] && !Tiles.THEMES[S.theme].prize ? S.theme : 'classic';
    Object.keys(S).forEach(k => delete S[k]);
    Object.assign(S, defaults(), keep, { theme });
    save(); clearCur(); G = null; pushScore();
    applyTheme(); applyBg();
    closeModal(); show('home');
    toast('Je voortgang is gewist. Veel plezier vanaf level 1!');
  };
}

function showIntro(after) {
  const f = Tiles.faceHTML('classic', 31), g = Tiles.faceHTML('classic', 4);
  openModal(`<h2>Zo speel je 🀄</h2>
    <p>Tik op een <b>vrije steen</b>: hij schuift naar een van de <b>4 vakjes bovenaan</b>.</p>
    <div class="how-tray"><div class="hm">${g}</div><div class="hm">${f}</div><div class="hm glow">${f}</div><div class="hm empty"></div></div>
    <p>Komen er <b>twee dezelfde</b> in de vakjes, dan verdwijnen ze! Er zijn maar <b>4 vakjes</b>: komt er een 4e steen zonder paar bij, dan is het level voorbij.</p>
    <p>Vrij = niets erbovenop, en links óf rechts open. Vanaf level ${RULES.tools.fromLevel} mag je per level één keer <b>💡 Hint</b> en één keer <b>🔀 Schudden</b>.</p>
    <button class="big-btn play" id="mGo"><span class="bb-text"><b>Begrepen!</b></span></button>`, true, after);
  $('#mGo').onclick = closeModal;
  S.seenTray = true; S.seenIntro = true; save();
}
