(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const STORE = 'omamj.v1', CUR = 'omamj.cur';
  const APP_VERSION = '1.2';
  // one-time clean start for every device (all progress from the test period is wiped once)
  const RESET_MARK = 'omamj.reset', RESET_ID = '2026-10-07';
  try {
    if (localStorage.getItem(RESET_MARK) !== RESET_ID) {
      Object.keys(localStorage).filter(k => k.startsWith('omamj.')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem(RESET_MARK, RESET_ID);
    }
  } catch (e) { }

  // ---------- backgrounds (unlocked with stars) ----------
  const BGS = [
    { id: 'jade', name: 'Jade', need: 0, css: 'radial-gradient(circle at 50% 25%, #34b088 0%, #14795d 45%, #0a4a3a 100%)' },
    { id: 'sunrise', name: 'Zonsopgang', need: 8, css: 'linear-gradient(170deg, #ffc28f 0%, #ff8a7a 45%, #c4497e 100%)' },
    { id: 'lavender', name: 'Lavendel', need: 20, css: 'linear-gradient(165deg, #c9adff 0%, #8f6ce8 50%, #5a3fb5 100%)' },
    { id: 'ocean', name: 'Oceaan', need: 40, css: 'linear-gradient(170deg, #63e6dc 0%, #2b9fd8 50%, #1b56a3 100%)' },
    { id: 'blossom', name: 'Bloesem', need: 65, css: 'radial-gradient(circle at 25% 15%, #ffe4ef 0%, #ffaccb 45%, #d9638f 100%)' },
    { id: 'forest', name: 'Bos', need: 95, css: 'linear-gradient(170deg, #b3e36d 0%, #56ab2f 50%, #285f1a 100%)' },
    { id: 'night', name: 'Sterrennacht', need: 130, css: 'radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 15%, #fff, transparent), radial-gradient(2px 2px at 85% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 35% 75%, #fff, transparent), radial-gradient(1px 1px at 55% 45%, #fff, transparent), radial-gradient(circle at 50% 0%, #3d4fa8 0%, #1d2260 55%, #0c0f30 100%)' },
    { id: 'gold', name: 'Goud', need: 180, css: 'linear-gradient(160deg, #fff1a8 0%, #f5c043 45%, #b87a0a 100%)' },
    { id: 'rainbow', name: 'Regenboog', need: 250, css: 'linear-gradient(165deg, #ff9a9e 0%, #fad0c4 20%, #fbc2eb 40%, #a6c1ee 60%, #84fab0 80%, #8fd3f4 100%)' },
    // comes with the Zonnebloem prize theme
    { id: 'sunfield', name: 'Zonnebloemveld', sun: true, css: 'radial-gradient(circle at 84% 9%, #fffbe0 0 5%, #ffe979 6% 9%, rgba(255,233,121,.35) 10% 16%, transparent 17%), linear-gradient(180deg, #74c3f2 0%, #b9e3fb 36%, #fff3b8 60%, #f7cd4f 78%, #d99320 100%)' },
  ];
  const numBgs = BGS.filter(b => typeof b.need === 'number');

  const defaults = () => ({ level: 1, stars: {}, daily: {}, theme: 'classic', bg: 'jade', sfx: true, music: true, vibrate: true, highlight: true, bestStreak: 0, seenIntro: false, matches: 0, nums: true, trophies: {}, bestCombo: 0, sunSeen: false, bonusStars: 0, bonusPts: 0, stats: {}, heartsSent: {}, heartsSeen: {}, frame: 'none', weekWins: 0, bigTiles: false, contrast: false });
  let S;
  try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { S = defaults(); }
  // 1.1: the green Jade background is the standard again (the Zonnebloem field stays if chosen)
  if (!S.bgJade) { if (S.bg !== 'sunfield') S.bg = 'jade'; S.bgJade = true; }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { } };

  // ---------- dates ----------
  const pad = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dnum = k => +k.replace(/-/g, '');
  const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const todayKey = () => dkey(new Date());

  const totalStars = () => Object.values(S.stars).reduce((a, b) => a + b, 0) + Object.values(S.daily).reduce((a, b) => a + b, 0) + (S.bonusStars || 0);
  function streak() {
    const d = new Date();
    if (!S.daily[dkey(d)]) d.setDate(d.getDate() - 1);
    let n = 0;
    while (S.daily[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---------- helpers ----------
  function buzz(ms) {
    if (!S.vibrate) return;
    try {
      if (window.Android && Android.vibrate) Android.vibrate(Array.isArray(ms) ? ms.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) : ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { }
  }
  let toastT;
  function toast(msg, ms = 2400) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
  }
  function praise(text) {
    const p = $('#praise'); p.textContent = text;
    p.classList.remove('show'); void p.offsetWidth; p.classList.add('show');
  }
  function floatText(x, y, text) {
    const f = document.createElement('div'); f.className = 'float'; f.textContent = text;
    f.style.left = x + 'px'; f.style.top = y + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 950);
  }
  const sunUnlocked = () => S.level > 20;
  const bgLocked = b => b.sun ? !sunUnlocked() : totalStars() < b.need;
  function applyBg() {
    let b = BGS.find(b => b.id === S.bg) || BGS[0];
    if (bgLocked(b)) b = BGS[0];
    $('#bg').style.background = b.css;
    $('#bg').className = b.id === 'sunfield' ? 'sunfield' : '';
  }
  function applyTheme() {
    if (S.theme === 'sunflower' && !sunUnlocked()) S.theme = 'classic';
    const sunny = S.theme === 'sunflower';
    document.body.classList.toggle('sunny', sunny);
    Sound.setMood(sunny ? 'sunny' : 'calm');
  }
  function flash() { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  function bee() {
    const b = document.createElement('div'); b.className = 'bee'; b.textContent = '🐝';
    b.style.top = (18 + Math.random() * 45) + '%';
    document.body.appendChild(b); setTimeout(() => b.remove(), 2700);
  }

  // ---------- trophies ----------
  const threeStars = () => Object.values(S.stars).filter(v => v >= 3).length;
  const dailyCount = () => Object.keys(S.daily).length;
  const TROPHIES = [
    { id: 'l1', ico: '🎉', name: 'Eerste level', desc: 'Speel level 1 uit', prog: () => [S.level - 1, 1] },
    { id: 'l5', ico: '🥉', name: 'Op weg', desc: 'Speel 5 levels uit', prog: () => [S.level - 1, 5] },
    { id: 'l10', ico: '🥈', name: 'Doorzetter', desc: 'Speel 10 levels uit', prog: () => [S.level - 1, 10] },
    { id: 'l20', ico: '🌻', name: 'Zonnebloem', desc: 'Speel 20 levels uit', prog: () => [S.level - 1, 20] },
    { id: 'l30', ico: '🥇', name: 'Kampioen', desc: 'Speel 30 levels uit', prog: () => [S.level - 1, 30] },
    { id: 'l50', ico: '👑', name: 'Mahjong-koningin', desc: 'Speel 50 levels uit', prog: () => [S.level - 1, 50] },
    { id: 'p5', ico: '⭐', name: 'Perfect', desc: '5 levels met 3 sterren', prog: () => [threeStars(), 5] },
    { id: 'p20', ico: '🌟', name: 'Sterrenregen', desc: '20 levels met 3 sterren', prog: () => [threeStars(), 20] },
    { id: 's50', ico: '💫', name: 'Sterrenverzamelaar', desc: 'Verdien 50 sterren', prog: () => [totalStars(), 50] },
    { id: 'd1', ico: '📅', name: 'Dagpuzzelaar', desc: 'Speel je eerste dagpuzzel', prog: () => [dailyCount(), 1] },
    { id: 'd10', ico: '🗓️', name: 'Trouwe puzzelaar', desc: 'Speel 10 dagpuzzels', prog: () => [dailyCount(), 10] },
    { id: 'r3', ico: '🔥', name: 'Op dreef', desc: '3 dagen op rij gepuzzeld', prog: () => [S.bestStreak, 3] },
    { id: 'r7', ico: '🏆', name: 'Hele week!', desc: '7 dagen op rij gepuzzeld', prog: () => [S.bestStreak, 7] },
    { id: 'm100', ico: '🀄', name: '100 paren', desc: 'Maak 100 paren', prog: () => [S.matches, 100] },
    { id: 'm500', ico: '💎', name: '500 paren', desc: 'Maak 500 paren', prog: () => [S.matches, 500] },
    { id: 'c5', ico: '🌈', name: 'Supercombo', desc: 'Maak 5 paren vlak na elkaar', prog: () => [S.bestCombo, 5] },
    { id: 'k5', ico: '🎁', name: 'Schatzoeker', desc: 'Open 5 schatkisten', prog: () => [(S.stats || {}).chests || 0, 5] },
    { id: 'h3', ico: '💛', name: 'Geliefd', desc: 'Krijg 3 hartjes van familie', prog: () => [(S.stats || {}).hearts || 0, 3] },
    { id: 'w1', ico: '👑', name: 'Weekwinnaar', desc: 'Word 1e in de weekstrijd', prog: () => [S.weekWins || 0, 1] },
  ];
  function newTrophies() {
    const out = [];
    for (const t of TROPHIES) { const [v, n] = t.prog(); if (v >= n && !S.trophies[t.id]) { S.trophies[t.id] = todayKey(); out.push(t); } }
    if (out.length) save();
    return out;
  }
  const trophyCount = () => TROPHIES.filter(t => S.trophies[t.id]).length;

  // ---------- particles ----------
  const FX = (() => {
    const c = $('#fx'), g = c.getContext('2d');
    let parts = [], running = false, dpr = 1;
    function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
    resize(); addEventListener('resize', resize);
    const COLS = ['#ffd23f', '#ff6fa3', '#4fc3ff', '#5ee07f', '#ff9a3d', '#b48cff', '#ffffff'];
    function burst(x, y, n = 22, big = false) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = (big ? 4 : 2.5) + Math.random() * (big ? 7 : 5);
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, g: 0.18, life: 0, max: 40 + Math.random() * 25, size: (big ? 7 : 5) + Math.random() * 6, col: COLS[i % COLS.length], kind: i % 3 ? 'spark' : 'dot', rot: Math.random() * 6, vr: (Math.random() - .5) * .3 });
      }
      go();
    }
    function confetti() {
      for (let i = 0; i < 170; i++) {
        parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 3, g: 0.04, life: 0, max: 220 + Math.random() * 80, size: 7 + Math.random() * 7, col: COLS[i % 6], kind: 'paper', rot: Math.random() * 6, vr: (Math.random() - .5) * .25, sway: Math.random() * 6 });
      }
      go();
    }
    const sprites = {};
    function sprite(ch) {
      if (sprites[ch]) return sprites[ch];
      const S2 = 64, c2 = document.createElement('canvas'); c2.width = c2.height = S2;
      const x2 = c2.getContext('2d');
      x2.font = (S2 * 0.8) + "px 'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif";
      x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(ch, S2 / 2, S2 / 2 + 3);
      return (sprites[ch] = c2);
    }
    function emoji(x, y, list, n = 9) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4, sp = 3 + Math.random() * 5;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.16, life: 0, max: 55 + Math.random() * 25, size: 20 + Math.random() * 16, kind: 'emo', ch: list[i % list.length], rot: (Math.random() - .5), vr: (Math.random() - .5) * .12 });
      }
      go();
    }
    function sunRain() {
      for (let i = 0; i < 34; i++) parts.push({ x: Math.random() * innerWidth, y: -40 - Math.random() * innerHeight * 0.8, vx: (Math.random() - .5) * 1.5, vy: 2 + Math.random() * 2.5, g: 0.02, life: 0, max: 260, size: 26 + Math.random() * 22, kind: 'emo', ch: ['🌻', '🌼', '🐝', '🌻'][i % 4], rot: Math.random(), vr: (Math.random() - .5) * .06, sway: Math.random() * 6 });
      go();
    }
    function go() { if (!running) { running = true; requestAnimationFrame(loop); } }
    function spark(x, y, r) {
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill();
    }
    function loop() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter(p => p.life < p.max);
      for (const p of parts) {
        p.life++; p.vy += p.g; p.x += p.vx + (p.sway !== undefined ? Math.sin((p.life + p.sway * 10) / 12) * 1.2 : 0); p.y += p.vy; p.rot += p.vr;
        if (p.kind !== 'paper' && p.sway === undefined) { p.vx *= 0.97; p.vy *= 0.97; }
        const a = 1 - Math.max(0, (p.life - p.max * 0.6) / (p.max * 0.4));
        g.globalAlpha = Math.max(0, a); g.fillStyle = p.col;
        if (p.kind === 'spark') spark(p.x, p.y, p.size);
        else if (p.kind === 'dot') { g.beginPath(); g.arc(p.x, p.y, p.size * 0.45, 0, 7); g.fill(); }
        else if (p.kind === 'emo') { g.setTransform(dpr * Math.cos(p.rot), dpr * Math.sin(p.rot), -dpr * Math.sin(p.rot), dpr * Math.cos(p.rot), p.x * dpr, p.y * dpr); g.drawImage(sprite(p.ch), -p.size / 2, -p.size / 2, p.size, p.size); g.setTransform(dpr, 0, 0, dpr, 0, 0); }
        else { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.4 + Math.abs(Math.sin(p.life / 6)))); g.restore(); }
      }
      g.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    }
    function clear() { parts = []; }
    return { burst, confetti, clear, emoji, sunRain };
  })();

  // ---------- screens ----------
  let screen = 'home';
  function show(id) {
    if (screen === 'game' && id !== 'game') pauseClock();
    screen = id;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    if (id === 'home') renderHome();
    if (id === 'levels') renderLevels();
    if (id === 'daily') renderDaily();
    if (id === 'themes') renderThemes();
    if (id === 'trophies') renderTrophies();
    if (id === 'ranking') renderRanking();
  }

  function renderHome() {
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
    if (S.lastWeek) setTimeout(() => { if (screen === 'home') checkLastWeek(); }, 400);
    else if (S.pendingHearts && S.pendingHearts.length) { const h = S.pendingHearts; S.pendingHearts = []; save(); setTimeout(() => { if (screen === 'home' && $('#modal').classList.contains('hidden')) showHearts(h, () => renderHome()); }, 400); }
    if (sunUnlocked() && !S.sunSeen) setTimeout(() => { if (screen === 'home' && $('#modal').classList.contains('hidden')) showSunflowerUnlock(() => renderHome()); }, 500);
  }
  function renderGoal(el) {
    if (!sunUnlocked()) {
      // the big prize comes first
      const done = Math.min(20, S.level - 1), left = 20 - done;
      el.classList.add('sun');
      el.innerHTML = `<span class="g-ico">🌻</span><div>Nog <b>${left} ${left === 1 ? 'level' : 'levels'}</b> tot de hoofdprijs: het <b>Zonnebloem-thema</b>!<div class="bar"><i style="width:${Math.round(done / 20 * 100)}%"></i></div></div>`;
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
      if (i === 20) { b.classList.add('prize'); b.insertAdjacentHTML('beforeend', '<span class="prize-ico">🌻</span>'); }
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
    const un = sunUnlocked(), sc = $('#sunCard');
    const pct = Math.round(Math.min(20, S.level - 1) / 20 * 100);
    sc.innerHTML = `<button class="suncard${un ? '' : ' locked'}${S.theme === 'sunflower' ? ' on' : ''}">
      <span class="sun-ico">🌻</span>
      <span class="sun-txt"><b>Zonnebloem</b><small>${un ? (S.theme === 'sunflower' ? 'In gebruik ✨' : 'Tik om te gebruiken') : `De hoofdprijs! Speel level 20 uit`}</small>
      ${un ? '<small>Zonnige stenen, zomermuziek met vogeltjes en bloemen-effecten</small>' : `<span class="bar"><i style="width:${pct}%"></i></span><small>${Math.min(20, S.level - 1)} van de 20 levels uitgespeeld</small>`}</span>
      <span class="sun-pv">${[0, 1, 2].map(k => `<span class="mini">${Tiles.faceHTML('sunflower', k)}</span>`).join('')}</span></button>`;
    sc.firstElementChild.onclick = () => {
      if (!un) { toast(`Speel nog ${21 - S.level} levels uit om de Zonnebloem te winnen 🌻`); Sound.blocked(); return; }
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
      b.innerHTML = locked ? `<div class="lock">🔒<br>${bg.sun ? 'level 20' : bg.need + ' ⭐'}</div>` : bg.name;
      b.onclick = () => {
        if (locked) { toast(bg.sun ? 'Dit veld hoort bij de Zonnebloem-prijs: speel level 20 uit 🌻' : `Verdien nog ${bg.need - ts} ⭐ om “${bg.name}” vrij te spelen`); Sound.blocked(); return; }
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
  function openModal(html, closable = true, onClose = null) {
    $('#modalBox').innerHTML = html; $('#modal').classList.remove('hidden');
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
      const keep = { sfx: S.sfx, music: S.music, vibrate: S.vibrate, highlight: S.highlight, nums: S.nums, seenIntro: true, seenTray: true, seenDown: !!S.seenDown, seenSp: S.seenSp || {}, pid: S.pid, name: S.name, avatar: S.avatar, since: S.since, heartsSeen: S.heartsSeen || {}, bigTiles: !!S.bigTiles, contrast: !!S.contrast };
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
      <p>Vrij = niets erbovenop, en links óf rechts open. Vanaf level ${TOOLS_LEVEL} mag je per level één keer <b>💡 Hint</b> en één keer <b>🔀 Schudden</b>.</p>
      <button class="big-btn play" id="mGo"><span class="bb-text"><b>Begrepen!</b></span></button>`, true, after);
    $('#mGo').onclick = closeModal;
    S.seenTray = true; S.seenIntro = true; save();
  }

  // ---------- the game ----------
  const SLOTS = Layouts.SLOTS;
  let G = null;
  const loadCur = () => { try { const c = JSON.parse(localStorage.getItem(CUR) || 'null'); return c && c.v === 6 ? c : null; } catch (e) { return null; } };
  const clearCur = () => { try { localStorage.removeItem(CUR); } catch (e) { } };
  function saveCur() {
    if (!G || G.done) return;
    syncClock();
    try {
      localStorage.setItem(CUR, JSON.stringify({ v: 6, aspect: G.o.aspect, key: G.key, n: G.tiles.length, faces: G.tiles.map(t => t.face), alive: Array.from(G.alive), tray: G.tray, down: Array.from(G.down), peek: G.peek, gold: [...G.gold], score: G.score, elapsed: G.elapsed, usedHint: G.usedHint, usedShuffle: G.usedShuffle }));
    } catch (e) { }
  }
  function syncClock() { if (G && G.tStart) { const n = performance.now(); G.elapsed += (n - G.tStart) / 1000; G.tStart = n; } }
  function pauseClock() { syncClock(); if (G) G.tStart = 0; saveCur(); }
  function resumeClock() { if (G && !G.done && screen === 'game') G.tStart = performance.now(); }

  function startLevel(level) { begin({ mode: 'level', level, key: 'L' + level, title: 'Level ' + level, makeSpec: a => Layouts.forLevel(level, a, S.bigTiles ? 0.7 : 1) }); }
  function startDaily(k) {
    const d = parseKey(k);
    begin({ mode: 'daily', date: k, key: 'D' + k, title: `Dagpuzzel ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`, makeSpec: a => Layouts.forDate(dnum(k), a, S.bigTiles ? 0.7 : 1) });
  }

  function begin(o, restart = false) {
    $('#modal').classList.add('hidden'); modalOnClose = null;
    $('#comboTag').classList.remove('on'); $('#praise').classList.remove('show'); FX.clear();
    // shape the pile after the free space on this screen
    show('game');
    const wrap = $('#boardWrap');
    const aspect = Math.max(0.4, Math.min(2.4, Math.round(wrap.clientHeight / Math.max(1, wrap.clientWidth) * 10) / 10)) || 1.5;
    if (!o.spec) { o.spec = o.makeSpec(aspect); o.aspect = aspect; }
    const spec = o.spec;
    const tiles = spec.tiles.map(t => ({ x: t.x, y: t.y, z: t.z, face: 0, el: null }));
    const nb = Layouts.neighbors(tiles);
    const n = tiles.length;
    G = { o, ...o, tiles, nb, gold: new Set(), lucky: null, luckyDone: false, alive: new Uint8Array(n).fill(1), down: new Uint8Array(n), peek: -1, tray: [], arriving: new Set(), flights: 0, score: 0, combo: 0, lastMatch: 0, usedHint: false, usedShuffle: false, elapsed: 0, tStart: 0, done: false, busy: false, half: false };
    const cur = restart ? null : loadCur();
    if (cur && cur.key === o.key && cur.n === n && cur.aspect === o.aspect) {
      cur.faces.forEach((f, i) => tiles[i].face = f);
      cur.alive.forEach((a, i) => G.alive[i] = a);
      (cur.down || []).forEach((a, i) => G.down[i] = a);
      G.peek = cur.peek ?? -1;
      G.gold = new Set(cur.gold || []);
      Object.assign(G, { tray: cur.tray || [], score: cur.score, elapsed: cur.elapsed, usedHint: !!cur.usedHint, usedShuffle: !!cur.usedShuffle });
      G.half = aliveCount() <= n / 2;
    } else {
      if (!o.faces) { const d = Layouts.makeDeal(spec); o.faces = d.faces; o.down = d.down; } // same deal again on "Opnieuw"
      addSpecials(o, spec);
      o.faces.forEach((f, i) => tiles[i].face = f);
      G.gold = new Set(o.gold || []);
      (o.down || []).forEach(i => G.down[i] = 1);
      clearCur();
    }
    $('#gameTitle').textContent = o.title;
    show('game');
    renderBoard(!restart);
    renderTray(); updateTools();
    updateScore(false); updateProgress();
    G.tStart = performance.now();
    setTimeout(() => praise(restart ? 'Nog een keer! 💪' : o.mode === 'daily' ? '📅 Dagpuzzel' : o.title), 150);
    if (!S.seenTray) setTimeout(() => showIntro(), 700);
    else if (!S.seenDown && G.down.some(x => x)) setTimeout(showDownTip, 900);
    else { setTimeout(checkStuck, 500); setTimeout(specialTip, 1200); }
  }
  // explain a new kind of special tile the first time it shows up
  function specialTip() {
    if (!G || G.done) return;
    S.seenSp = S.seenSp || {};
    const has = { gold: G.gold.size > 0, gift: G.tiles.some(t => t.face === GIFT), joker: G.tiles.some(t => t.face === JOKER) };
    const tips = { gold: '✨ Nieuw: gouden stenen! Een gouden paar geeft dubbele punten.', gift: '🎁 Nieuw: cadeautjes! Maak het paar voor een verrassing.', joker: '🃏 Nieuw: jokers! Een joker-paar ruimt ook een steen uit je vakjes op.' };
    const k = ['gold', 'gift', 'joker'].find(k => has[k] && !S.seenSp[k]);
    if (!k) return;
    S.seenSp[k] = true; save();
    toast(tips[k], 4200);
  }
  const restart = () => { if (G) begin(G.o, true); };

  const aliveCount = () => G.alive.reduce((a, b) => a + b, 0);
  function decorate(i) {
    const t = G.tiles[i], el = t.el; if (!el) return;
    el.classList.toggle('gold', G.gold.has(i));
    el.classList.toggle('sp-gift', t.face === GIFT);
    el.classList.toggle('sp-joker', t.face === JOKER);
  }
  const free = i => Layouts.isFree(i, G.alive, G.nb);

  function renderBoard(enter) {
    const board = $('#board');
    board.innerHTML = '';
    board.classList.toggle('hl', S.highlight);
    const order = G.tiles.map((t, i) => i).sort((a, b) => G.tiles[a].z - G.tiles[b].z || G.tiles[a].y - G.tiles[b].y || G.tiles[a].x - G.tiles[b].x);
    order.forEach((i, k) => {
      const t = G.tiles[i];
      const el = document.createElement('div');
      el.className = 'tile' + (G.alive[i] ? '' : ' hidden') + (G.down[i] && G.peek !== i ? ' back' : '');
      el.dataset.i = i;
      el.innerHTML = `<div class="face">${Tiles.faceHTML(S.theme, t.face)}</div>`;
      t.el = el; decorate(i);
      if (enter && G.alive[i]) { el.classList.add('enter'); el.style.animationDelay = Math.min(900, k * 8 + t.z * 70) + 'ms'; setTimeout(() => el.classList.remove('enter'), 1700); }
      t.el = el; board.appendChild(el);
    });
    layoutBoard(); updateBlocked();
  }

  function layoutBoard() {
    if (!G) return;
    const wrap = $('#boardWrap');
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W || !H) return;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, maxZ = 0;
    for (const t of G.tiles) { minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x); minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y); maxZ = Math.max(maxZ, t.z); }
    const cols = (maxX - minX) / 2 + 1, rows = (maxY - minY) / 2 + 1;
    const ratio = 1.24, dF = 0.09;
    let tw = Math.min((W - 8) / (cols + maxZ * dF + 0.12), (H - 8) / (rows * ratio + maxZ * dF + 0.15));
    tw = Math.min(tw, 150);
    const th = tw * ratio, dz = tw * dF, d = Math.max(3, tw * 0.085);
    const bw = cols * tw + maxZ * dz + d, bh = rows * th + maxZ * dz + d * 1.4;
    const ox = (W - bw) / 2 + maxZ * dz, oy = (H - bh) / 2 + maxZ * dz;
    const board = $('#board');
    board.style.setProperty('--d', d.toFixed(1) + 'px');
    board.style.setProperty('--fs', (tw * 0.66).toFixed(1) + 'px');
    G.tw = tw;
    for (const t of G.tiles) {
      const s = t.el.style;
      s.left = (ox + (t.x - minX) / 2 * tw - t.z * dz).toFixed(1) + 'px';
      s.top = (oy + (t.y - minY) / 2 * th - t.z * dz).toFixed(1) + 'px';
      s.width = (tw - 1.5).toFixed(1) + 'px';
      s.height = (th - 1.5).toFixed(1) + 'px';
      s.zIndex = t.z * 10000 + t.y * 100 + t.x;
      t.r = { l: parseFloat(s.left), t: parseFloat(s.top), w: tw - 1.5, h: th - 1.5, zi: t.z * 10000 + t.y * 100 + t.x };
    }
    // tray slots scale with the screen but stay big
    const slot = $('#tray .slot');
    if (slot) $('#tray').style.setProperty('--sfs', (slot.clientWidth * 0.62).toFixed(1) + 'px');
  }

  function updateBlocked() {
    G.tiles.forEach((t, i) => { if (G.alive[i]) t.el.classList.toggle('blocked', !free(i)); });
  }
  function updateProgress() {
    const n = G.tiles.length;
    $('#progressBar').style.width = ((n - aliveCount() - G.tray.length) / n * 100) + '%';
  }
  function updateScore(bump = true) {
    const el = $('#score'); el.textContent = G.score;
    if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  // Hint and Schudden unlock at level 15 (daily puzzles: once you have reached level 15)
  const TOOLS_LEVEL = 15;
  const toolsOpen = () => !!G && (G.mode === 'level' ? G.level >= TOOLS_LEVEL : S.level >= TOOLS_LEVEL);
  function updateTools() {
    const open = toolsOpen();
    $('#btnHint').classList.toggle('used', open && G.usedHint);
    $('#btnShuffle').classList.toggle('used', open && G.usedShuffle);
    $('#btnHint').classList.toggle('locked', !open);
    $('#btnShuffle').classList.toggle('locked', !open);
    $('#btnHint .badge').textContent = !open ? '🔒' : G.usedHint ? '0' : '1';
    $('#btnShuffle .badge').textContent = !open ? '🔒' : G.usedShuffle ? '0' : '1';
  }
  function toolsLockedMsg() { toast(`Hint en Schudden komen vrij vanaf level ${TOOLS_LEVEL} 🔒`); Sound.blocked(); }
  function renderTray() {
    const slots = $('#tray').children;
    for (let k = 0; k < SLOTS; k++) {
      const t = G.tray[k];
      slots[k].innerHTML = t === undefined ? '' : `<div class="tmini${G.arriving.has(t) ? ' arriving' : ''}">${Tiles.faceHTML(S.theme, G.tiles[t].face)}</div>`;
    }
    const tr = $('#tray');
    tr.classList.toggle('warn', G.tray.length === SLOTS - 2);   // 2 waiting: careful
    tr.classList.toggle('full', G.tray.length >= SLOTS - 1);    // 3 waiting: the next miss ends the level
    $('#tray').style.setProperty('--sfs', (slots[0].clientWidth * 0.62).toFixed(1) + 'px');
  }
  function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function clearHint() { G.tiles.forEach(t => t.el.classList.remove('hint')); }

  // a copy of the tile that glides from the board into its tray slot
  function flyTile(face, from, to, ms) {
    const f = document.createElement('div');
    f.className = 'tile flying';
    f.innerHTML = `<div class="face">${Tiles.faceHTML(S.theme, face)}</div>`;
    Object.assign(f.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
    f.style.setProperty('--d', '3px');
    f.style.setProperty('--fs', (from.width * 0.66) + 'px');
    document.body.appendChild(f);
    const sx = to.width / from.width, sy = to.height / from.height;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      f.style.transition = `transform ${ms}ms cubic-bezier(.35,.1,.25,1)`;
      f.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${sx}, ${sy})`;
    }));
    return f;
  }

  let blockedTaps = 0, comboTimer;
  const PRAISE = ['Mooi!', 'Goed zo!', 'Prima!', 'Geweldig!', 'Fantastisch!', 'Super!', 'Knap hoor!', 'Prachtig!'];
  /* A stuck tile: arrows point at the tiles that are in the way
     (the ones lying on top of it, or its neighbours on the left and the right). */
  function blockersOf(i) {
    const nb = G.nb, alive = G.alive;
    const up = nb.above[i].filter(j => alive[j]);
    if (up.length) return up.map(j => ({ j, side: 'up' }));
    const t = G.tiles[i];
    // per side the neighbour that overlaps most in height
    const best = list => list.filter(j => alive[j]).sort((a, b) => Math.abs(G.tiles[a].y - t.y) - Math.abs(G.tiles[b].y - t.y))[0];
    return [best(nb.left[i]), best(nb.right[i])].filter(j => j !== undefined).map(j => ({ j, side: 'side' }));
  }
  function showBlockers(i) {
    if (!G) return;
    const board = $('#board');
    board.querySelectorAll('.blk-arrow').forEach(a => a.remove());
    const a = G.tiles[i].r;
    if (!a) return;
    const ac = { x: a.l + a.w / 2, y: a.t + a.h / 2 };
    const size = Math.max(26, Math.min(56, G.tw * 0.62));
    const seen = new Set();
    for (const { j } of blockersOf(i)) {
      const b = G.tiles[j].r; if (!b) continue;
      const bc = { x: b.l + b.w / 2, y: b.t + b.h / 2 };
      let dx = bc.x - ac.x, dy = bc.y - ac.y;
      if (Math.hypot(dx, dy) < a.w * 0.2) { dx = -1; dy = -1; }   // lying right on top: point up-left onto it
      const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      const ang = Math.round(Math.atan2(uy, ux) * 180 / Math.PI);
      if (seen.has(ang)) continue; seen.add(ang);
      // the arrow starts on the stuck tile and its tip touches the tile in the way
      const reach = Math.min(len, a.w * 0.62);
      const px = ac.x + ux * reach * 0.55, py = ac.y + uy * reach * 0.55;
      const ar = document.createElement('div');
      ar.className = 'blk-arrow';
      ar.style.cssText = `left:${px.toFixed(1)}px;top:${py.toFixed(1)}px;width:${size.toFixed(0)}px;height:${(size * 0.62).toFixed(0)}px;--a:${ang}deg`;
      ar.innerHTML = '<svg viewBox="0 0 50 31"><path d="M3 11h26V3l18 12.5L29 28v-8H3z" fill="#ff8a00" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>';
      board.appendChild(ar);
      const be = G.tiles[j].el;
      be.classList.remove('blocker'); void be.offsetWidth; be.classList.add('blocker');
      setTimeout(() => be.classList.remove('blocker'), 1300);
      setTimeout(() => ar.remove(), 1300);
    }
  }

  /* Taps never wait for animations: the game state changes instantly,
     the flying tiles just catch up visually. */
  function onTap(i) {
    if (!G || G.done || G.busy || !G.alive[i]) return;
    Sound.init();
    const el = G.tiles[i].el;
    if (!free(i)) {
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      showBlockers(i);
      Sound.blocked(); buzz(30);
      if (++blockedTaps === 3) toast('Deze steen zit nog vast. Kies een steen met niets erbovenop en een open zijkant.');
      return;
    }
    blockedTaps = 0;
    if (G.down[i] && G.peek !== i) {
      const pk0 = G.peek;
      const twin = pk0 >= 0 && G.alive[pk0] && free(pk0) && G.tiles[pk0].face === G.tiles[i].face;
      const inTray = G.tray.some(t => G.tiles[t].face === G.tiles[i].face);
      if (!twin && !inTray) {
        // face-down tile: first tap turns it over (only one at a time), second tap takes it
        if (pk0 >= 0 && G.alive[pk0]) turn(pk0, true);
        G.peek = i; turn(i, false);
        Sound.flip(); buzz(8); clearHint(); saveCur();
        taskProgress('flips'); bumpStat('flips');
        return;
      }
      // its twin is already in the tray, or is the open tile (which counts as picked): match at once
      G.down[i] = 0;
    }
    if (G.peek === i) { G.down[i] = 0; G.peek = -1; }
    const face = G.tiles[i].face;
    const mi = G.tray.findIndex(t => G.tiles[t].face === face);
    const pk = G.peek;
    const peekPair = mi < 0 && pk >= 0 && pk !== i && G.alive[pk] && G.tiles[pk].face === face && free(pk);
    if (mi < 0 && !peekPair && G.tray.length >= SLOTS) {
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      Sound.blocked(); toast('Alle vakjes zijn vol. Kies een steen die past!');
      return;
    }
    clearHint();
    luckyTaken(i);
    const from = el.getBoundingClientRect();
    G.alive[i] = 0;
    el.classList.add('hidden');
    Sound.select(); buzz(8);
    const MS = 230;
    G.flights++;
    const land = (fn) => setTimeout(() => { G.flights--; fn(); }, MS);

    if (peekPair) {
      // the open face-down tile and this one match straight away, no slot needed
      const pel = G.tiles[pk].el, pfrom = pel.getBoundingClientRect();
      G.alive[pk] = 0; G.down[pk] = 0; G.peek = -1;
      pel.classList.add('hidden');
      const goldP = G.gold.has(i) || G.gold.has(pk);
      if (face === JOKER) jokerEffect();
      const mid = { left: (from.left + pfrom.left) / 2, top: (from.top + pfrom.top) / 2 - from.height * 0.3, width: from.width, height: from.height };
      const f1 = flyTile(face, from, mid, MS), f2 = flyTile(face, pfrom, mid, MS);
      afterLogic();
      land(() => { f1.classList.add('popout'); f2.classList.add('popout'); onMatch({ x: mid.left + mid.width / 2, y: mid.top + mid.height / 2 }, face, goldP); setTimeout(() => { f1.remove(); f2.remove(); }, 230); afterLand(); });
      return;
    }
    if (mi >= 0) {
      const partner = G.tray[mi];
      const slotEl = $('#tray').children[mi];
      const to = slotEl.getBoundingClientRect();
      // keep a copy of the partner where it sat, then close the gap in the tray right away
      const ghost = slotEl.firstElementChild && !G.arriving.has(partner) ? slotEl.firstElementChild.cloneNode(true) : null;
      if (ghost) { ghost.classList.add('ghost'); Object.assign(ghost.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' }); ghost.style.setProperty('--sfs', $('#tray').style.getPropertyValue('--sfs')); document.body.appendChild(ghost); }
      G.tray.splice(mi, 1);
      G.arriving.delete(partner);
      const goldT = G.gold.has(i) || G.gold.has(partner);
      if (face === JOKER) jokerEffect();
      renderTray();
      const fly = flyTile(face, from, to, MS);
      afterLogic();
      land(() => {
        fly.classList.add('popout'); if (ghost) ghost.classList.add('popout');
        onMatch({ x: to.left + to.width / 2, y: to.top + to.height / 2 }, face, goldT);
        setTimeout(() => { fly.remove(); if (ghost) ghost.remove(); }, 230);
        afterLand();
      });
      return;
    }
    const slotIdx = G.tray.length;
    G.tray.push(i);
    G.arriving.add(i);
    if (G.tray.length >= SLOTS) G.busy = true;   // 4th tile without a match: level over, no more taps
    renderTray();
    const to = $('#tray').children[slotIdx].getBoundingClientRect();
    const fly = flyTile(face, from, to, MS);
    afterLogic();
    land(() => {
      fly.remove();
      G.arriving.delete(i);
      if (G.tray.includes(i)) {
        renderTray();
        const k = G.tray.indexOf(i), m = $('#tray').children[k].firstElementChild;
        if (m) m.classList.add('land');
        if (G.tray.length === SLOTS - 1) Sound.warn(); else Sound.land();
      }
      afterLand();
    });
  }
  function afterLogic() {
    updateBlocked(); updateProgress();
    if (aliveCount() === 0 && G.tray.length === 0) { G.done = true; clearCur(); return; }
    saveCur();
  }
  function afterLand() {
    if (G.done) { if (G.flights === 0 && !G.winShown) { G.winShown = true; setTimeout(win, 450); } return; }
    if (G.flights === 0) { checkStuck(); maybeLucky(); }
  }

  function turn(i, faceDown) {
    const el = G.tiles[i].el;
    el.classList.remove('turning'); void el.offsetWidth; el.classList.add('turning');
    setTimeout(() => el.classList.toggle('back', faceDown), 140);
    setTimeout(() => el.classList.remove('turning'), 300);
  }
  function showDownTip() {
    openModal(`<h2>Omgedraaide stenen</h2>
      <div class="how-tray" style="grid-template-columns:repeat(2,52px)"><div class="hm backmini"></div><div class="hm glow">${Tiles.faceHTML('classic', 32)}</div></div>
      <p>Sommige stenen liggen <b>omgedraaid</b>. Tik er één keer op om te kijken wat het is, en nog een keer om hem te pakken.</p>
      <p>Er kan maar <b>één steen tegelijk</b> open liggen. Een open steen telt alsof hij al gepakt is: draai je daarna <b>dezelfde</b> om, of tik je er een aan, dan verdwijnen ze meteen. Staat de tweeling al in een vakje? Dan verdwijnen ze ook meteen bij het omdraaien. Is het een andere, dan gaat de vorige weer dicht. Goed onthouden dus! 🧠</p>
      <button class="big-btn play" id="mGo"><span class="bb-text"><b>Begrepen!</b></span></button>`, true);
    $('#mGo').onclick = closeModal;
    S.seenDown = true; save();
  }

  function onMatch(c, face, gold) {
    const now = performance.now();
    G.combo = now - G.lastMatch < 6000 ? G.combo + 1 : 1;
    G.lastMatch = now;
    const mult = specialMatch(face, gold, c);
    const pts = 10 * Math.min(G.combo, 5) * mult;
    G.score += pts;
    S.matches++;
    taskProgress('pairs'); taskProgress('combo', G.combo, true);
    if (G.combo > (S.bestCombo || 0)) S.bestCombo = G.combo;
    const sunny = S.theme === 'sunflower';
    FX.burst(c.x, c.y - 10, sunny ? 12 : G.combo >= 3 ? 30 : 20, G.combo >= 3);
    if (sunny) { FX.emoji(c.x, c.y - 10, G.combo >= 3 ? ['🌻', '🌼', '🐝', '✨'] : ['🌻', '🌼', '✨'], G.combo >= 3 ? 8 : 5); if (G.combo >= 3 && G.combo % 2 === 1) bee(); }
    if (G.combo > 0 && G.combo % 5 === 0) {
      setTimeout(() => { Sound.supercombo(); flash(); praise('Supercombo! 🌈'); FX.burst(innerWidth / 2, innerHeight / 2.4, 46, true); if (sunny) bee(); buzz([20, 40, 20, 40, 40]); }, 120);
    }
    floatText(c.x, c.y - 50, '+' + pts);
    Sound.match(G.combo); buzz(G.combo >= 3 ? [15, 40, 25] : 18);
    updateScore();
    const tag = $('#comboTag');
    if (G.combo >= 2) { tag.textContent = `Combo x${Math.min(G.combo, 5)} 🔥`; tag.classList.add('on'); }
    clearTimeout(comboTimer); comboTimer = setTimeout(() => tag.classList.remove('on'), 6000);
    const left = aliveCount();
    if (G.combo % 5 === 0 || gold || face === GIFT || face === JOKER) { /* already celebrated */ }
    else if (left === 0 && G.tray.length === 0) { praise('Laatste paar! 🎉'); FX.burst(c.x, c.y, 40, true); }
    else if (G.combo >= 3 && G.combo % 2 === 1) praise(PRAISE[Math.min(PRAISE.length - 1, Math.floor(Math.random() * 3) + (G.combo - 3))]);
    else if (!G.half && left <= G.tiles.length / 2 && left > 0) { G.half = true; praise('Halverwege! 💪'); }
    else if (left === 4) praise('Bijna klaar!');
  }

  function trayMatchFree() {
    const tf = new Set(G.tray.map(t => G.tiles[t].face));
    for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && tf.has(G.tiles[i].face) && free(i)) return i;
    return -1;
  }
  // a free face-down tile + a free face-up tile with the same picture can still be matched without a slot
  // two free tiles with the same picture, at least one of them face down (or open), can match without a slot
  function peekPairFree() {
    const cnt = {}, hasDown = {};
    for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && free(i)) {
      const f = G.tiles[i].face;
      cnt[f] = (cnt[f] || 0) + 1;
      if (G.down[i] || G.peek === i) hasDown[f] = true;
    }
    for (const f in cnt) if (cnt[f] >= 2 && hasDown[f]) return true;
    return false;
  }
  function checkStuck() {
    if (!G || G.done || G.overShown || G.tray.length < SLOTS) return;
    G.busy = true; G.overShown = true;
    bumpStat('losses'); save();
    syncClock();
    setTimeout(() => {
      Sound.stuck(); buzz([40, 80, 40]);
      openModal(`<h2>Oei, alle vakjes zijn vol!</h2>
        <p>Alle 4 vakjes zitten vol zonder paar. Geen nood, probeer het gewoon nog eens!</p>
        <button class="big-btn play" id="sRetry"><span class="bb-text"><b>↻ Opnieuw proberen</b></span></button>
        <button class="link-btn" id="sMenu">Menu</button>`, false);
      $('#sRetry').onclick = () => { closeModal(); restart(); };
      $('#sMenu').onclick = () => { closeModal(); clearCur(); G.done = true; show('home'); };
    }, 450);
  }

  function hint() {
    if (!G || G.done || G.busy) return;
    Sound.init();
    if (!toolsOpen()) return toolsLockedMsg();
    if (G.usedHint) { toast('Je hint voor dit level is al gebruikt'); Sound.blocked(); return; }
    const faces = G.tiles.map(t => t.face);
    const path = Layouts.solve(G.tiles, G.nb, faces, G.alive, G.tray, 30000);
    if (!path || !path.length) { toast('Zo gaat het niet meer lukken… probeer 🔀 Schudden'); Sound.blocked(); return; }
    G.usedHint = true; updateTools(); saveCur();
    // show the next one or two safe taps
    const show2 = [path[0]];
    if (path[1] !== undefined && G.tiles[path[1]].face === G.tiles[path[0]].face) show2.push(path[1]);
    show2.forEach(i => G.tiles[i].el.classList.add('hint'));
    Sound.hint(); buzz(15);
  }

  function shuffle() {
    if (!G || G.done || G.busy) return;
    Sound.init();
    if (!toolsOpen()) return toolsLockedMsg();
    if (G.usedShuffle) { toast('Je hebt in dit level al geschud'); Sound.blocked(); return; }
    G.usedShuffle = true; updateTools();
    G.busy = true;
    if (G.peek >= 0) { if (G.alive[G.peek]) turn(G.peek, true); G.peek = -1; }
    const trayFaces = G.tray.map(t => G.tiles[t].face);
    const count = {};
    G.tiles.forEach((t, i) => { if (G.alive[i]) count[t.face] = (count[t.face] || 0) + 1; });
    trayFaces.forEach(f => count[f]--);
    const pf = [];
    for (const f in count) for (let k = 0; k < count[f] / 2; k++) pf.push(+f);
    const r = Layouts.rng((Math.random() * 1e9) | 0);
    // a generous re-deal: the tray pictures come free quickly
    const faces = Layouts.deal(G.tiles, G.nb, pf, r, { alive: G.alive, openFaces: trayFaces, cap: Math.max(2, trayFaces.length), open: 0.2 });
    clearHint();
    Sound.shuffle(); buzz([10, 30, 10]);
    let k = 0;
    G.tiles.forEach((t, i) => {
      if (!G.alive[i]) return;
      t.face = faces[i];
      const el = t.el, kk = k++;
      el.classList.remove('flip'); void el.offsetWidth;
      el.style.animationDelay = (kk % 12) * 15 + 'ms';
      el.classList.add('flip');
      setTimeout(() => { el.querySelector('.face').innerHTML = Tiles.faceHTML(S.theme, t.face); decorate(i); }, 200 + (kk % 12) * 15);
      setTimeout(() => { el.classList.remove('flip'); el.style.animationDelay = ''; }, 700);
    });
    setTimeout(() => { G.busy = false; updateBlocked(); saveCur(); checkStuck(); }, 520);
  }

  // ---------- statistics ----------
  function bumpStat(k, n = 1) { S.stats = S.stats || {}; S.stats[k] = (S.stats[k] || 0) + n; }
  function fmtTime(sec) { const h = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60); return h ? `${h} u ${m} min` : `${m} min`; }
  function statsHTML() {
    const st = S.stats || {};
    const items = [
      ['🧩', 'Levels uitgespeeld', S.level - 1], ['⭐', 'Sterren', totalStars()], ['🀄', 'Paren gemaakt', S.matches || 0],
      ['💰', 'Punten', myPoints().toLocaleString('nl-NL')], ['📅', 'Dagpuzzels', Object.keys(S.daily).length], ['🔥', 'Langste reeks', `${S.bestStreak || 0} ${S.bestStreak === 1 ? 'dag' : 'dagen'}`],
      ['🌈', 'Beste combo', S.bestCombo || 0], ['⏱️', 'Speeltijd', fmtTime(st.playSec || 0)], ['🎁', 'Schatkisten', st.chests || 0],
      ['💛', 'Hartjes gekregen', st.hearts || 0], ['🍀', 'Geluksmomenten', st.lucky || 0], ['🥇', 'Weken gewonnen', S.weekWins || 0],
    ];
    return `<div class="stats-card"><h3>📊 Mijn prestaties</h3><div class="stats-grid">${items.map(([i, l, v]) => `<div class="stat"><span>${i}</span><b>${v}</b><small>${l}</small></div>`).join('')}</div></div>`;
  }

  // ---------- daily tasks ----------
  const TASK_TYPES = [
    { id: 'pairs', ico: '🀄', make: r => 20 + Math.floor(r() * 3) * 10, text: g => `Maak ${g} paren` },
    { id: 'levels', ico: '🧩', make: r => 2 + Math.floor(r() * 2), text: g => `Speel ${g} levels uit` },
    { id: 'daily', ico: '📅', make: () => 1, text: () => 'Speel de dagpuzzel' },
    { id: 'combo', ico: '🔥', make: r => 3 + Math.floor(r() * 2), text: g => `Maak ${g} paren vlak na elkaar` },
    { id: 'stars3', ico: '⭐', make: () => 1, text: () => 'Haal 3 sterren in een level' },
    { id: 'flips', ico: '🔄', make: r => 5 + Math.floor(r() * 2) * 5, text: g => `Draai ${g} stenen om`, minLevel: 6 },
    { id: 'points', ico: '💰', make: r => (10 + Math.floor(r() * 6)) * 100, text: g => `Verdien ${g.toLocaleString('nl-NL')} punten` },
    { id: 'nohelp', ico: '💪', make: () => 1, text: () => 'Speel een level uit zonder hint of schudden', minLevel: 16 },
  ];
  function ensureTasks() {
    const tk = todayKey();
    if (S.tasks && S.tasks.date === tk) return S.tasks;
    const r = Layouts.rng(dnum(tk) * 3 + (S.level % 7));
    const pool = TASK_TYPES.filter(t => !t.minLevel || S.level >= t.minLevel);
    const list = Layouts.shuffleArr(r, pool.slice()).slice(0, 3).map(t => ({ id: t.id, goal: t.make(r), prog: 0, done: false }));
    S.tasks = { date: tk, list, chest: false };
    save();
    return S.tasks;
  }
  const taskType = id => TASK_TYPES.find(t => t.id === id);
  const tasksDone = () => ensureTasks().list.filter(t => t.done).length;
  // amount: add to progress; or with max=true keep the highest value (e.g. a combo)
  function taskProgress(id, amount = 1, max = false) {
    const T = ensureTasks();
    T.list.forEach(t => {
      if (t.id !== id || t.done) return;
      t.prog = max ? Math.max(t.prog, amount) : t.prog + amount;
      if (t.prog >= t.goal) {
        t.prog = t.goal; t.done = true;
        S.bonusStars = (S.bonusStars || 0) + 1;
        bumpStat('tasks');
        setTimeout(() => { toast(`✅ Taak klaar: ${taskType(t.id).text(t.goal)} (+1 ⭐)`, 2800); Sound.star(2); }, 600);
        if (T.list.every(x => x.done)) setTimeout(() => { if (!ensureTasks().chest) toast('🎁 Alle taken klaar! Open je schatkist in het menu', 3200); }, 3600);
      }
    });
    save();
  }
  function renderTaskChip() {
    const T = ensureTasks(), n = tasksDone(), ready = n === 3 && !T.chest;
    $('#taskDots').textContent = T.chest ? '✅' : ready ? '🎁' : T.list.map(t => t.done ? '●' : '○').join('');
    $('#btnTasks').classList.toggle('ready', ready);
  }
  function openTasks() {
    const T = ensureTasks(), n = tasksDone(), ready = n === 3 && !T.chest;
    openModal(`<h2>📋 Taken van vandaag</h2>
      <div class="task-list">${T.list.map(t => { const ty = taskType(t.id); return `<div class="task${t.done ? ' done' : ''}"><span class="t-ico">${t.done ? '✅' : ty.ico}</span><div><b>${ty.text(t.goal)}</b><span class="bar"><i style="width:${Math.round(t.prog / t.goal * 100)}%"></i></span><small>${t.done ? 'Klaar! +1 ⭐' : `${t.prog.toLocaleString('nl-NL')} / ${t.goal.toLocaleString('nl-NL')}`}</small></div></div>`; }).join('')}</div>
      <button class="chest-btn${ready ? ' ready' : ''}${T.chest ? ' opened' : ''}" id="chestBtn"><span class="chest-ico">${T.chest ? '📭' : '🎁'}</span><span>${T.chest ? 'Schatkist van vandaag is open. Morgen nieuwe taken!' : ready ? 'Tik om je schatkist te openen!' : `Maak alle 3 taken af voor de schatkist (${n}/3)`}</span></button>
      <button class="link-btn" id="tkClose">Sluiten</button>`);
    $('#tkClose').onclick = closeModal;
    $('#chestBtn').onclick = () => { if (ready) openChest(); else if (!T.chest) { Sound.blocked(); toast('Eerst alle 3 taken afmaken 😊'); } };
  }
  function openChest() {
    const T = ensureTasks();
    if (T.chest) return;
    T.chest = true;
    const pts = 300 + Math.min(4, Math.floor((S.level - 1) / 10)) * 100;
    S.bonusPts = (S.bonusPts || 0) + pts; S.bonusStars = (S.bonusStars || 0) + 2; ensureWeek().pts += pts;
    bumpStat('chests'); save(); pushScore();
    Sound.trophy(); FX.confetti(); buzz([30, 60, 30, 60, 80]);
    openModal(`<div class="chest-open"><span class="lid">🎁</span></div><h2>Schatkist!</h2>
      <div class="chest-loot"><div>💰<b>+${pts}</b><small>punten</small></div><div>⭐<b>+2</b><small>sterren</small></div></div>
      <p style="font-size:17px;color:#8a7448">Morgen staan er weer nieuwe taken klaar.</p>
      <button class="big-btn play" id="chOk"><span class="bb-text"><b>Hoera!</b></span></button>`, false);
    setTimeout(() => FX.emoji(innerWidth / 2, innerHeight * 0.35, ['⭐', '💰', '✨', '🎉'], 16), 250);
    $('#chOk').onclick = () => { closeModal(); renderHome(); };
  }

  // ---------- special tiles (higher levels) ----------
  const GIFT = 100, JOKER = 101;
  // turn one pair with a picture that appears exactly twice into a special pair (keeps the level solvable)
  function addSpecials(o, spec) {
    if (o.specials) return;
    const lvl = o.mode === 'level' ? o.level : Math.max(20, S.level);
    const r = Layouts.rng(spec.seed + 555);
    const cnt = {};
    o.faces.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
    const twos = Object.keys(cnt).filter(f => cnt[f] === 2 && +f < 100).map(Number);
    const relabel = (to) => { if (!twos.length) return; const f = twos.splice(Math.floor(r() * twos.length), 1)[0]; o.faces = o.faces.map(x => x === f ? to : x); };
    o.gold = [];
    if (lvl >= 20) {
      // a golden pair: double points
      const anyF = o.faces.filter(f => f < 100);
      const f = anyF[Math.floor(r() * anyF.length)];
      o.gold = o.faces.map((x, i) => x === f ? i : -1).filter(i => i >= 0).slice(0, 2);
    }
    if (o.mode === 'level' && lvl >= 25 && r() < 0.6) relabel(GIFT);
    if (o.mode === 'level' && lvl >= 30 && r() < 0.6) relabel(JOKER);
    o.specials = true;
  }
  function specialMatch(face, gold, c) {
    let mult = 1;
    if (gold) {
      mult = 2;
      praise('✨ Gouden paar! x2'); Sound.perfect(); FX.emoji(c.x, c.y, ['✨', '🌟', '💛'], 10); bumpStat('gold');
    }
    if (face === GIFT) {
      const star = Math.random() < 0.5;
      if (star) { S.bonusStars = (S.bonusStars || 0) + 1; praise('🎁 Cadeautje: +1 ⭐'); }
      else { S.bonusPts = (S.bonusPts || 0) + 150; ensureWeek().pts += 150; praise('🎁 Cadeautje: +150'); }
      Sound.unlock(); FX.emoji(c.x, c.y, ['🎁', '⭐', '✨'], 10); bumpStat('gifts'); save();
    }
    return mult;
  }
  // joker pair: also clears one picture from the tray together with its twin on the board
  function jokerEffect() {
    const k = G.tray.findIndex(t => !G.arriving.has(t));
    if (k < 0) { G.score += 100; praise('🃏 Joker! +100'); return; }
    const t = G.tray[k], face = G.tiles[t].face;
    G.tray.splice(k, 1);
    let twin = -1;
    for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && G.tiles[i].face === face && (twin < 0 || free(i))) twin = i;
    if (twin >= 0) {
      G.alive[twin] = 0; G.down[twin] = 0; if (G.peek === twin) G.peek = -1;
      const el = G.tiles[twin].el, c = centerOf(el);
      el.classList.add('popout'); setTimeout(() => el.classList.add('hidden'), 230);
      FX.emoji(c.x, c.y, ['🃏', '✨'], 8);
    }
    renderTray();
    praise('🃏 Joker! Vakje vrij'); Sound.supercombo(); bumpStat('jokers');
  }

  // ---------- lucky moment ----------
  function maybeLucky() {
    if (!G || G.done || G.lucky || G.luckyDone) return;
    const lvl = G.mode === 'level' ? G.level : S.level;
    if (lvl < 10) return;
    const n = G.tiles.length, left = G.alive.reduce((a, b) => a + b, 0);
    if (left > n * 0.8 || left < 6 || Math.random() > 0.3) return;
    const tf = new Set(G.tray.map(t => G.tiles[t].face));
    const freeUp = [];
    for (let i = 0; i < n; i++) if (G.alive[i] && !G.down[i] && free(i) && G.tiles[i].face < 100) freeUp.push(i);
    const cand = freeUp.filter(i => tf.has(G.tiles[i].face) || freeUp.some(j => j !== i && G.tiles[j].face === G.tiles[i].face));
    if (!cand.length) return;
    const i = cand[Math.floor(Math.random() * cand.length)];
    G.lucky = { i, until: Date.now() + 15000 };
    G.tiles[i].el.classList.add('lucky');
    toast('🍀 Geluksmoment! Pak de glinsterende steen binnen 15 tellen', 3000);
    Sound.hint();
    setTimeout(() => { if (G && G.lucky && G.lucky.i === i) { G.tiles[i].el.classList.remove('lucky'); G.lucky = null; G.luckyDone = true; } }, 15000);
  }
  function luckyTaken(i) {
    if (!G.lucky || G.lucky.i !== i) return;
    const ok = Date.now() <= G.lucky.until;
    G.tiles[i].el.classList.remove('lucky');
    G.lucky = null; G.luckyDone = true;
    if (!ok) return;
    G.score += 150; updateScore(); bumpStat('lucky');
    const c = centerOf(G.tiles[i].el);
    setTimeout(() => { praise('🍀 Geluk! +150'); Sound.perfect(); FX.emoji(c.x || innerWidth / 2, c.y || innerHeight / 2, ['🍀', '✨', '🌟'], 12); }, 300);
  }

  // ---------- ranking (family online + friendly computer players) ----------
  // Firebase Realtime Database address; empty = only the computer players
  const DB_URL = 'https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app';
  const LB_CACHE = 'omamj.lb';
  const BOTS = [
    ['Ria', '🧁', 0.6], ['Joke', '🚲', 1.5], ['Henk', '🧀', 2.6], ['Tante Riet', '🌷', 3.8], ['Opa Kees', '🎣', 5.2], ['Buurvrouw Ans', '🐈', 6.8],
    ['Mien', '🧶', 8.5], ['Gerrit', '🌳', 10.5], ['Truus', '☕', 12.8], ['Wim', '🎺', 15.5], ['Corrie', '🌸', 18.5],
    ['Bep', '🍰', 22], ['Jan', '⛵', 26], ['Greet', '🐦', 31], ['Klaas', '🚜', 37], ['Lies', '💐', 45], ['Juffrouw Bos', '📚', 58], ['Meester Dekker', '🎩', 80],
  ];
  const BOT_FRAMES = ['none', 'none', 'bronze', 'none', 'bronze', 'none', 'silver', 'none', 'bronze', 'silver', 'none', 'gold', 'silver', 'none', 'gold', 'sun', 'gold', 'crown'];
  // what a computer player collects in a full week (Monday to Sunday)
  const BOT_WEEK = [700, 1300, 2000, 2800, 3700, 4700, 5900, 7200, 8700, 10300, 12200, 14300, 16800, 19600, 23000, 27000, 32000, 40000];
  // rough points for playing level l (pairs × average combo points + star bonus)
  const levelPts = l => Math.round(Layouts.targetFor(Math.max(1, Math.round(Layouts.effLevel(l)))) / 2 * 24 + 120);
  const cumPts = L => { let p = 0; for (let l = 1; l <= Math.floor(L); l++) p += levelPts(l); return Math.round(p + (L % 1) * levelPts(Math.floor(L) + 1)); };

  // ---- the week (Monday 00:00 to Sunday 23:59) ----
  function weekInfo(d = new Date()) {
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    const next = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
    return { id: dkey(mon), frac: Math.min(1, Math.max(0, (d - mon) / (next - mon))), msLeft: next - d };
  }
  function ensureWeek() {
    const w = weekInfo();
    if (!S.wk || S.wk.id !== w.id) {
      if (S.wk && S.wk.pts > 0) S.lastWeek = { id: S.wk.id, pts: S.wk.pts };
      S.wk = { id: w.id, pts: 0 };
      save();
    }
    return S.wk;
  }
  function weekLeftText() {
    const ms = weekInfo().msLeft, d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5);
    return d >= 1 ? `nog ${d} ${d === 1 ? 'dag' : 'dagen'}${h ? ` en ${h} uur` : ''}` : `nog ${Math.max(1, h)} uur`;
  }

  function botEntries(mode = 'all', weekId, frac) {
    if (!S.since) { S.since = todayKey(); save(); }
    const days = Math.max(0, Math.round((parseKey(todayKey()) - parseKey(S.since)) / 864e5));
    if (mode === 'week') {
      const w = weekInfo();
      weekId = weekId || w.id; frac = frac ?? w.frac;
      const wr = Layouts.rng(dnum(weekId) % 100000 + 17);
      return BOTS.map(([name, avatar, at], k) => {
        const r = Layouts.rng(k * 977 + 3);
        const pts = Math.round(BOT_WEEK[k] * Math.pow(frac, 0.95) * (0.82 + wr() * 0.36));
        return { id: 'bot' + k, name, avatar, frame: BOT_FRAMES[k], points: pts, level: Math.max(1, Math.floor(at) + 1 + Math.floor(days / 3)), bot: true };
      });
    }
    return BOTS.map(([name, avatar, at], k) => {
      const r = Layouts.rng(k * 977 + 3);
      const pts = Math.round(cumPts(at) * (0.94 + r() * 0.12) + days * (15 + k * 3));
      return { id: 'bot' + k, name, avatar, frame: BOT_FRAMES[k], points: pts, level: Math.max(1, Math.floor(at) + 1), bot: true };
    });
  }
  const myPoints = () => Object.values(S.lvlPts || {}).reduce((a, b) => a + b, 0) + Object.values(S.dayPts || {}).reduce((a, b) => a + b, 0) + (S.bonusPts || 0);
  const myWeekPts = () => ensureWeek().pts;
  function myEntry(points, mode = 'all') { return { id: S.pid, name: S.name || 'Jij', avatar: S.avatar || '😊', frame: S.frame || 'none', points: points ?? (mode === 'week' ? myWeekPts() : myPoints()), level: S.level, me: true }; }
  function onlineEntries(mode = 'all', weekId) {
    let list = [];
    try { list = (JSON.parse(localStorage.getItem(LB_CACHE) || '[]') || []).filter(e => e.id !== S.pid); } catch (e) { }
    if (mode === 'week') { const id = weekId || weekInfo().id; list = list.map(e => ({ ...e, points: e.wk === id ? (e.wkPts || 0) : 0 })); }
    return list;
  }
  function ranking(points, mode = 'all') {
    const list = [...botEntries(mode), ...onlineEntries(mode), myEntry(points, mode)];
    // on a tie you are placed above the other player
    list.sort((a, b) => b.points - a.points || (b.me ? 1 : 0) - (a.me ? 1 : 0));
    return list;
  }
  const myRank = (points, mode = 'all') => ranking(points, mode).findIndex(e => e.me) + 1;
  function ensureId() { if (!S.pid) { S.pid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); save(); } }
  async function fetchOnline() {
    if (!DB_URL) return false;
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
      const res = await fetch(DB_URL + '/scores.json', { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(to);
      if (!res.ok) return false;
      const data = await res.json() || {};
      const list = Object.entries(data).filter(([id, v]) => v && typeof v.points === 'number' && !id.startsWith('test-') && !String(v.name || '').startsWith('test-'))
        .map(([id, v]) => ({ id, name: String(v.name || '?').slice(0, 24), avatar: String(v.avatar || '🙂').slice(0, 8), frame: String(v.frame || 'none').slice(0, 12), points: v.points, level: v.level || 1, wk: v.wk || '', wkPts: v.wkPts || 0 }));
      localStorage.setItem(LB_CACHE, JSON.stringify(list));
      S.lbOnlineAt = Date.now(); save();
      return true;
    } catch (e) { return false; }
  }
  async function pushScore() {
    if (!DB_URL || !S.name) return;
    ensureId();
    const base = { name: S.name.slice(0, 24), avatar: (S.avatar || '😊').slice(0, 8), points: myPoints(), level: S.level, t: Date.now() };
    const full = { ...base, frame: (S.frame || 'none').slice(0, 12), wk: ensureWeek().id, wkPts: S.wk.pts };
    try {
      const r = await fetch(`${DB_URL}/scores/${S.pid}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(full) });
      // older database rules only know the basic fields: fall back to those
      if (!r.ok) await fetch(`${DB_URL}/scores/${S.pid}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(base) });
    } catch (e) { }
  }

  // ---- hearts between family members ----
  async function sendHeart(pid, name, btn) {
    if (!S.name) return askName(() => sendHeart(pid, name, btn));
    S.heartsSent = S.heartsSent || {};
    if (S.heartsSent[pid] === todayKey()) { toast(`Je hebt ${name} vandaag al een hartje gestuurd 💛`); return; }
    ensureId();
    try {
      const r = await fetch(`${DB_URL}/hearts/${pid}/${S.pid}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: S.name.slice(0, 24), t: Date.now() }) });
      if (!r.ok) throw 0;
      S.heartsSent[pid] = todayKey(); bumpStat('heartsSent'); save();
      Sound.unlock(); buzz(20);
      if (btn) { btn.classList.add('sent'); btn.textContent = '💛✓'; const c = btn.getBoundingClientRect(); FX.emoji(c.left + c.width / 2, c.top, ['💛', '💛', '✨'], 8); }
      toast(`Hartje gestuurd naar ${name}! 💛`);
    } catch (e) { toast('Hartje versturen lukte niet. Is er internet?'); }
  }
  async function fetchHearts() {
    if (!DB_URL || !S.pid) return [];
    try {
      const res = await fetch(`${DB_URL}/hearts/${S.pid}.json`, { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json() || {};
      S.heartsSeen = S.heartsSeen || {};
      const fresh = Object.entries(data).filter(([from, v]) => v && v.t > (S.heartsSeen[from] || 0) && (S.pid.startsWith('test-') || !from.startsWith('test-')))
        .map(([from, v]) => ({ from, name: String(v.name || 'Iemand').slice(0, 24), t: v.t }));
      fresh.forEach(h => { S.heartsSeen[h.from] = h.t; });
      if (fresh.length) { S.stats = S.stats || {}; S.stats.hearts = (S.stats.hearts || 0) + fresh.length; save(); }
      return fresh;
    } catch (e) { return []; }
  }
  function showHearts(list, then) {
    Sound.trophy(); buzz([20, 40, 20, 40, 40]);
    heartRain();
    const names = [...new Set(list.map(h => h.name))];
    const who = names.length === 1 ? `<b>${names[0]}</b> stuurde je een hartje!` : `<b>${names.slice(0, -1).join(', ')}</b> en <b>${names.slice(-1)}</b> stuurden je een hartje!`;
    openModal(`<div class="sun-big">💛</div><h2>Een hartje voor jou!</h2><p>${who}</p>
      <button class="big-btn play" id="hOk"><span class="bb-text"><b>Wat lief! 😊</b></span></button>`, false);
    $('#hOk').onclick = () => { closeModal(); if (then) then(); };
  }
  function heartRain() { FX.emoji(innerWidth / 2, innerHeight * 0.55, ['💛', '💛', '💖', '✨'], 18); setTimeout(() => FX.emoji(innerWidth / 3, innerHeight * 0.5, ['💛', '💖'], 10), 300); setTimeout(() => FX.emoji(innerWidth * 0.66, innerHeight * 0.5, ['💛', '💖'], 10), 550); }
  async function checkHearts() {
    const fresh = await fetchHearts();
    if (fresh.length && screen === 'home' && $('#modal').classList.contains('hidden')) showHearts(fresh, () => renderHome());
    else if (fresh.length) S.pendingHearts = (S.pendingHearts || []).concat(fresh), save();
  }

  // ---- avatar frames, earned through prizes ----
  const FRAMES = [
    { id: 'none', name: 'Geen', ok: () => true, how: '' },
    { id: 'bronze', name: 'Brons', ok: () => trophyCount() >= 4, how: '4 prijzen' },
    { id: 'silver', name: 'Zilver', ok: () => trophyCount() >= 8, how: '8 prijzen' },
    { id: 'gold', name: 'Goud', ok: () => trophyCount() >= 12, how: '12 prijzen' },
    { id: 'sun', name: 'Zonnebloem', ok: () => sunUnlocked(), how: 'level 20' },
    { id: 'heart', name: 'Hartjes', ok: () => (S.stats && S.stats.hearts || 0) >= 3, how: '3 hartjes krijgen' },
    { id: 'rainbow', name: 'Regenboog', ok: () => !!S.trophies.c5, how: 'Supercombo' },
    { id: 'crown', name: 'Kroon', ok: () => (S.weekWins || 0) >= 1, how: 'win een week' },
  ];
  const frameOk = id => (FRAMES.find(f => f.id === id) || FRAMES[0]).ok();
  const avatarHTML = (e, cls = 'ra') => `<span class="${cls} fr-${e.frame && e.frame !== 'none' ? e.frame : 'none'}">${e.avatar}</span>`;

  const AVATARS = ['👵', '👴', '😊', '🌻', '🐱', '🐶', '🌷', '⭐', '🦋', '🍀', '🎩', '🚀'];
  function askName(then) {
    const cur = S.name || '';
    let av = S.avatar || '👵', fr = frameOk(S.frame || 'none') ? (S.frame || 'none') : 'none';
    openModal(`<h2>${cur ? 'Mijn profiel' : 'Hoe heet je?'}</h2>
      <p>Zo zien de anderen je op de ranglijst.</p>
      <input id="nmIn" class="name-in" maxlength="20" value="${cur.replace(/"/g, '')}" placeholder="Bijvoorbeeld: Oma Riet" autocomplete="off">
      <div class="quick-names">${['Oma', 'Opa', 'Mama', 'Papa'].map(n => `<button class="qn">${n}</button>`).join('')}</div>
      <div class="avatars">${AVATARS.map(a => `<button class="av${av === a ? ' on' : ''}">${a}</button>`).join('')}</div>
      <h3 class="fr-title">Lijstje om je plaatje</h3>
      <div class="frames">${FRAMES.map(f => `<button class="frm${fr === f.id ? ' on' : ''}${f.ok() ? '' : ' locked'}" data-f="${f.id}"><span class="ra fr-${f.id}">${av}</span><small>${f.ok() ? f.name : '🔒 ' + f.how}</small></button>`).join('')}</div>
      <button class="big-btn play" id="nmOk"><span class="bb-text"><b>Opslaan</b></span></button>`, false);
    document.querySelectorAll('.qn').forEach(b => b.onclick = () => { $('#nmIn').value = b.textContent; });
    document.querySelectorAll('.av').forEach(b => b.onclick = () => { av = b.textContent; document.querySelectorAll('.av').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.frm .ra').forEach(x => x.textContent = av); });
    document.querySelectorAll('.frm').forEach(b => b.onclick = () => {
      const f = FRAMES.find(x => x.id === b.dataset.f);
      if (!f.ok()) { toast(`Dit lijstje krijg je met: ${f.how}`); Sound.blocked(); return; }
      fr = f.id; document.querySelectorAll('.frm').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#nmOk').onclick = () => {
      const v = $('#nmIn').value.trim().replace(/[<>]/g, '').slice(0, 20);
      if (!v) { $('#nmIn').focus(); toast('Vul eerst een naam in'); return; }
      S.name = v; S.avatar = av; S.frame = fr; ensureId(); save(); closeModal(); pushScore(); if (then) then();
    };
  }

  function rowHTML(e, rank, withHeart = false) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
    const heart = withHeart && !e.me && !e.bot ? `<button class="heart-btn${(S.heartsSent || {})[e.id] === todayKey() ? ' sent' : ''}" data-pid="${e.id}" data-name="${e.name.replace(/"/g, '')}" aria-label="Stuur een hartje">${(S.heartsSent || {})[e.id] === todayKey() ? '💛✓' : '💛'}</button>` : '';
    return `<span class="rk">${medal}</span>${avatarHTML(e)}<span class="rn">${e.name}${e.me ? ' <i>(jij)</i>' : ''}${e.bot ? ' <i class="bot" title="computerspeler">🤖</i>' : ''}<small>level ${e.level}</small></span><span class="rp">${e.points.toLocaleString('nl-NL')}${heart}</span>`;
  }
  let rankMode = 'week';
  function renderRanking() {
    ensureId(); ensureWeek();
    const list = ranking(undefined, rankMode);
    const me = list.findIndex(e => e.me);
    $('#rkMine').textContent = (rankMode === 'week' ? '📅 #' : '🏆 #') + (me + 1);
    $('#rkWeek').classList.toggle('on', rankMode === 'week');
    $('#rkAll').classList.toggle('on', rankMode === 'all');
    $('#wkInfo').innerHTML = rankMode === 'week'
      ? `⏳ De weekstrijd eindigt ${weekLeftText()}. Elke maandag begint iedereen weer bij 0!`
      : `Alle punten die je ooit verdiend hebt.`;
    $('#rankList').innerHTML = list.map((e, i) => `<div class="rrow${e.me ? ' me' : ''}">${rowHTML(e, i + 1, true)}</div>`).join('');
    document.querySelectorAll('.heart-btn').forEach(b => b.onclick = ev => { ev.stopPropagation(); if (!b.classList.contains('sent')) sendHeart(b.dataset.pid, b.dataset.name, b); else toast('Vandaag al een hartje gestuurd 💛'); });
    const online = !!DB_URL;
    $('#rankNote').innerHTML = online ? `🌐 Familie online · 💛 = stuur een hartje · 🤖 = computerspeler` : `🤖 = computerspeler`;
    $('#rankName').innerHTML = `${avatarHTML(myEntry(0), 'ra small')} ${S.name || 'Naam kiezen'} ✏️`;
    setTimeout(() => { const m = document.querySelector('.rrow.me'); if (m) m.scrollIntoView({ block: 'center' }); }, 30);
    if (online && (!S.lbOnlineAt || Date.now() - S.lbOnlineAt > 20000)) fetchOnline().then(ok => { if (ok && screen === 'ranking') renderRanking(); });
  }

  // result of last week, shown once on the home screen
  function checkLastWeek() {
    if (!S.lastWeek || $('#modal').classList.contains('hidden') === false) return;
    const lw = S.lastWeek; S.lastWeek = null;
    const list = [...botEntries('week', lw.id, 1), ...onlineEntries('week', lw.id), { ...myEntry(lw.pts, 'week'), points: lw.pts }]
      .sort((a, b) => b.points - a.points || (b.me ? 1 : 0) - (a.me ? 1 : 0));
    const rank = list.findIndex(e => e.me) + 1;
    S.stats = S.stats || {}; S.stats.weeks = (S.stats.weeks || 0) + 1;
    if (rank === 1) S.weekWins = (S.weekWins || 0) + 1;
    save();
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
    if (rank <= 3) { Sound.trophy(); FX.confetti(); } else Sound.unlock();
    openModal(`<div class="sun-big">${medal}</div><h2>Vorige week werd je #${rank}!</h2>
      <p>Je haalde <b>${lw.pts.toLocaleString('nl-NL')} punten</b> in de weekstrijd.${rank === 1 ? ' Je bent de <b>weekwinnaar</b>! 👑' : rank <= 3 ? ' Wat een mooie plek!' : ''}</p>
      <p style="font-size:17px;color:#8a7448">Er is een nieuwe week begonnen: iedereen staat weer op 0. Zet hem op!</p>
      <button class="big-btn play" id="lwOk"><span class="bb-text"><b>Nieuwe week!</b></span></button>`, false);
    $('#lwOk').onclick = () => { closeModal(); renderHome(); };
  }

  /* The dopamine moment: your row climbs past the people you just overtook. */
  function showClimb(oldPts, newPts, then, mode = 'all') {
    const before = ranking(oldPts, mode), after = ranking(newPts, mode);
    const oldRank = before.findIndex(e => e.me) + 1, newRank = after.findIndex(e => e.me) + 1;
    const passed = after.slice(newRank, oldRank);          // the people you overtook (closest last)
    const above = after[newRank - 2];                       // the next target
    const show = passed.slice(-5);                          // animate at most 5 overtakes
    const rows = [...(above ? [above] : []), ...show];
    const RH = 58;
    const startIdx = (above ? 1 : 0) + show.length;         // where your row starts (below the others)
    const offset = passed.length - show.length;             // overtakes too far up to animate
    // rank shown on a row: before being overtaken it is one place higher than at the end
    const rankOf = (k, done) => {
      if (above && k === 0) return newRank - 1;
      const j = k - (above ? 1 : 0);
      const finalRank = newRank + offset + j + 1;
      return done ? finalRank : finalRank - 1;
    };
    const medalOf = r => r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : '#' + r;
    openModal(`<h2>${mode === 'week' ? 'Je klimt in de weekstrijd! 📅' : 'Je klimt op de ranglijst! 🏆'}</h2>
      <div class="climb" style="height:${(rows.length + 1) * RH}px">
        ${rows.map((e, k) => `<div class="rrow crow" data-k="${k}" style="transform:translateY(${k * RH}px)">${rowHTML(e, rankOf(k, false))}</div>`).join('')}
        <div class="rrow me crow" id="meRow" style="transform:translateY(${startIdx * RH}px)">${rowHTML(myEntry(oldPts, mode), oldRank)}</div>
      </div>
      <div class="climb-msg" id="climbMsg">&nbsp;</div>
      <button class="big-btn play" id="clOk"><span class="bb-text"><b>Verder</b></span></button>`, false);
    let stopped = false;   // tapping "Verder" early stops the animation cleanly
    $('#clOk').onclick = () => { stopped = true; closeModal(); then(); };
    const me = $('#meRow');
    const rowsEls = [...document.querySelectorAll('.crow[data-k]')];
    let pos = startIdx, k = 0;
    const steps = show.length;
    const stepTime = Math.max(380, Math.min(650, 2400 / Math.max(1, steps)));
    function step() {
      if (stopped) return;
      if (k >= steps) return finish();
      const victimIdx = startIdx - 1 - k;                  // the row right above you
      const victim = rowsEls[victimIdx];
      pos--; k++;
      me.style.transform = `translateY(${pos * RH}px) scale(1.04)`;
      victim.style.transform = `translateY(${(victimIdx + 1) * RH}px)`;
      victim.querySelector('.rk').textContent = medalOf(rankOf(victimIdx, true));
      const rank = oldRank - (passed.length - show.length) - k;
      me.querySelector('.rk').textContent = medalOf(rank);
      const pts = Math.round(oldPts + (newPts - oldPts) * k / steps);
      me.querySelector('.rp').textContent = pts.toLocaleString('nl-NL');
      Sound.pass(k); buzz(15);
      const r = me.getBoundingClientRect(); FX.burst(r.left + r.width * 0.15, r.top + r.height / 2, 10);
      setTimeout(step, stepTime);
    }
    function finish() {
      if (stopped || !$('#climbMsg')) return;
      me.style.transform = `translateY(${pos * RH}px)`;
      me.querySelector('.rp').textContent = newPts.toLocaleString('nl-NL');
      me.querySelector('.rk').textContent = medalOf(newRank);
      me.classList.add('glow');
      Sound.rankUp(); FX.confetti(); buzz([30, 50, 30, 50, 60]);
      const n = passed.length;
      const who = n === 1 ? `Je bent <b>${passed[0].name}</b> voorbij! 🎉` : `Je bent <b>${n} spelers</b> voorbij! 🎉`;
      const nxt = above ? `<br><small>Nog ${(above.points - newPts + 1).toLocaleString('nl-NL')} punten tot ${above.avatar} ${above.name}</small>` : `<br><small>Je staat bovenaan! 👑</small>`;
      const wk = mode === 'week' ? `<br><small>⏳ De week eindigt ${weekLeftText()}</small>` : '';
      $('#climbMsg').innerHTML = `<span class="climb-up">#${oldRank} → #${newRank} ⬆</span><br>${who}${nxt}${wk}`;
    }
    setTimeout(() => { if (!stopped) step(); }, 650);
  }

  // ---------- winning ----------
  function win() {
    syncClock(); G.tStart = 0;
    clearCur();
    const stars = 3 - (G.usedHint ? 1 : 0) - (G.usedShuffle ? 1 : 0);
    G.score += stars * 50;
    const before = totalStars();
    const ptsBefore = myPoints();
    ensureWeek();
    const wkBefore = S.wk.pts;
    S.wk.pts += G.score;               // every finished level counts for the weekly challenge
    const wkAfter = S.wk.pts;
    // daily tasks + statistics
    if (G.mode === 'level') taskProgress('levels'); else taskProgress('daily');
    if (stars === 3) taskProgress('stars3');
    if (!G.usedHint && !G.usedShuffle && toolsOpen()) taskProgress('nohelp');
    taskProgress('points', G.score);
    bumpStat('wins'); bumpStat('playSec', Math.round(G.elapsed));
    S.lvlPts = S.lvlPts || {}; S.dayPts = S.dayPts || {};
    if (G.mode === 'level') S.lvlPts[G.level] = Math.max(S.lvlPts[G.level] || 0, G.score);
    else S.dayPts[G.date] = Math.max(S.dayPts[G.date] || 0, G.score);
    const ptsAfter = myPoints();
    if (G.mode === 'level') {
      S.stars[G.level] = Math.max(S.stars[G.level] || 0, stars);
      if (G.level === S.level) S.level++;
    } else {
      S.daily[G.date] = Math.max(S.daily[G.date] || 0, stars);
      const s = streak(); if (s > S.bestStreak) S.bestStreak = s;
    }
    const wasSun = S.sunSeen || false;
    save();
    const after = totalStars();
    const unlocked = numBgs.filter(b => b.need > before && b.need <= after);
    const rewards = [];
    ensureId();
    // the weekly challenge moves most, so its climb comes first; otherwise the all-time list
    const wkRankBefore = myRank(wkBefore, 'week'), wkRankAfter = myRank(wkAfter, 'week');
    const rankBefore = myRank(ptsBefore), rankAfter = myRank(ptsAfter);
    if (wkRankAfter < wkRankBefore) rewards.push({ type: 'rank', mode: 'week', from: wkBefore, to: wkAfter });
    else if (rankAfter < rankBefore) rewards.push({ type: 'rank', mode: 'all', from: ptsBefore, to: ptsAfter });
    pushScore();
    const nextUp = ranking(wkAfter, 'week')[wkRankAfter - 2];
    const chase = nextUp && wkRankAfter >= wkRankBefore ? `<p class="chase">📅 Weekstrijd plek #${wkRankAfter} · nog <b>${(nextUp.points - wkAfter + 1).toLocaleString('nl-NL')}</b> punten tot ${nextUp.avatar} ${nextUp.name}</p>` : '';
    if (sunUnlocked() && !wasSun) rewards.push({ type: 'sun' });
    if (S.level >= TOOLS_LEVEL && !S.toolsSeen) rewards.push({ type: 'tools' });
    const tr = newTrophies();
    if (tr.length) rewards.push({ type: 'trophies', list: tr });
    if (unlocked.length) rewards.push({ type: 'bgs', list: unlocked });
    const mins = Math.floor(G.elapsed / 60), secs = Math.round(G.elapsed % 60);
    Sound.win(); FX.confetti(); buzz([30, 60, 30, 60, 60]);
    const titles = ['Prachtig gedaan!', 'Geweldig, oma!', 'Wat knap!', 'Fantastisch!', 'Heel goed gedaan!'];
    const title = G.mode === 'daily' ? 'Dagpuzzel gehaald! 👑' : titles[Math.floor(Math.random() * titles.length)];
    const extra = G.mode === 'daily' ? `<p>🔥 ${streak()} ${streak() === 1 ? 'dag' : 'dagen'} op rij!</p>` : stars < 3 ? `<p style="font-size:17px;color:#8a7448">Zonder hint en schudden verdien je ⭐⭐⭐</p>` : '';
    const nextLbl = G.mode === 'daily' ? 'Naar de kalender' : `Volgende: level ${G.level + 1} ▶`;
    setTimeout(() => {
      openModal(`<h2>${title}</h2>
        <div class="stars"><span class="st">★</span><span class="st">★</span><span class="st">★</span></div>
        <div class="win-stats"><div>Punten<b id="wScore">0</b></div><div>Tijd<b>${mins}:${pad(secs)}</b></div></div>
        <div class="perfect" id="wPerfect">${stars === 3 ? 'PERFECT! ✨' : ''}</div>
        ${extra}${chase}
        <div class="goal" id="wGoal" style="background:#efe2c0;color:#5c4520;margin:12px 0 4px"></div>
        <button class="big-btn play pulse" id="wNext"><span class="bb-text"><b>${nextLbl}</b></span></button>
        <button class="link-btn" id="wMenu">Menu</button>`, false);
      renderGoal($('#wGoal'));
      const sts = document.querySelectorAll('.stars .st');
      for (let i = 0; i < stars; i++) setTimeout(() => {
        sts[i].classList.add('on'); Sound.star(i); buzz(20);
        const c = centerOf(sts[i]); FX.burst(c.x, c.y, 26, true);
        if (S.theme === 'sunflower') FX.emoji(c.x, c.y, ['🌻', '✨'], 5);
      }, 450 + i * 420);
      if (stars === 3) setTimeout(() => { const p = $('#wPerfect'); if (p) { p.classList.add('on'); Sound.perfect(); } }, 450 + 3 * 420 + 150);
      const el = $('#wScore'), target = G.score, t0 = performance.now();
      (function tick() { const p = Math.min(1, (performance.now() - t0) / 1100); el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })();
      const go = (dest) => {
        closeModal();
        const finish = () => {
          if (dest === 'next') { if (G.mode === 'daily') show('daily'); else startLevel(G.level + 1); }
          else show('home');
        };
        runRewards(rewards, finish);
      };
      $('#wNext').onclick = () => go('next');
      $('#wMenu').onclick = () => go('menu');
    }, 700);
  }

  function runRewards(queue, then) {
    const r = queue.shift();
    if (!r) return then();
    const next = () => runRewards(queue, then);
    if (r.type === 'rank') { if (!S.name) askName(() => showClimb(r.from, r.to, next, r.mode)); else showClimb(r.from, r.to, next, r.mode); }
    else if (r.type === 'sun') showSunflowerUnlock(next);
    else if (r.type === 'tools') showToolsUnlock(next);
    else if (r.type === 'trophies') showTrophies(r.list, next);
    else showUnlock(r.list.slice(), next);
  }
  function showToolsUnlock(then) {
    S.toolsSeen = true; save();
    Sound.unlock(); FX.confetti(); buzz([20, 40, 20, 40, 40]);
    openModal(`<h2>Nieuw vrijgespeeld! 🎉</h2>
      <div class="tools-new"><span>💡</span><span>🔀</span></div>
      <p>Vanaf nu heb je in elk level <b>één Hint</b> en <b>één keer Schudden</b>.</p>
      <p style="font-size:17px;color:#8a7448">💡 Hint wijst een slimme zet aan. 🔀 Schudden husselt de stenen, handig als je vastzit. Zonder ze te gebruiken verdien je ⭐⭐⭐.</p>
      <button class="big-btn play" id="tlOk"><span class="bb-text"><b>Top!</b></span></button>`, false);
    $('#tlOk').onclick = () => { closeModal(); then(); };
  }
  function showSunflowerUnlock(then) {
    S.sunSeen = true; save();
    Sound.sunflower(); FX.sunRain(); buzz([30, 60, 30, 60, 30, 60, 80]);
    openModal(`<div class="sun-big">🌻</div><h2>De hoofdprijs is van jou!</h2>
      <p>Je hebt het <b>Zonnebloem-thema</b> gewonnen: zonnige stenen, een zomers zonnebloemveld, vrolijke muziek met vogeltjes en bloemen die opspringen bij elk paar!</p>
      <button class="big-btn gold" id="sunUse"><span class="bb-text"><b>🌻 Gebruik het nu</b></span></button>
      <button class="link-btn" id="sunLater">Later (staat bij Thema's)</button>`, false);
    $('#sunUse').onclick = () => { S.theme = 'sunflower'; S.bg = 'sunfield'; save(); applyBg(); applyTheme(); closeModal(); FX.emoji(innerWidth / 2, innerHeight / 2, ['🌻', '🌼', '🐝', '✨'], 16); then(); };
    $('#sunLater').onclick = () => { closeModal(); then(); };
  }
  function showTrophies(list, then) {
    Sound.trophy(); FX.confetti(); buzz([20, 40, 20, 40, 60]);
    openModal(`<h2>${list.length > 1 ? 'Nieuwe prijzen!' : 'Nieuwe prijs!'} 🏅</h2>
      <div class="tr-new">${list.map(t => `<div class="trn"><span>${t.ico}</span><div><b>${t.name}</b><small>${t.desc}</small></div></div>`).join('')}</div>
      <button class="big-btn play" id="trOk"><span class="bb-text"><b>Hoera!</b></span></button>
      <button class="link-btn" id="trSee">Bekijk de prijzenkast</button>`, false);
    $('#trOk').onclick = () => { closeModal(); then(); };
    $('#trSee').onclick = () => { closeModal(); show('trophies'); };
  }

  // new backgrounds: only a message, picking one is done in Thema's (only the Zonnebloem prize gets a 'use now' button)
  function showUnlock(list, then) {
    const bg = list.shift();
    Sound.unlock(); FX.confetti();
    const next = () => { closeModal(); if (list.length) showUnlock(list, then); else then(); };
    openModal(`<h2>Nieuwe achtergrond! 🎉</h2><p>Je hebt <b>“${bg.name}”</b> vrijgespeeld.</p>
      <div class="unlock-pv" style="background:${bg.css}"></div>
      <p style="font-size:18px">Je kunt hem kiezen bij <b>🎨 Thema's</b> in het menu.</p>
      <button class="big-btn play" id="uOk"><span class="bb-text"><b>Leuk!</b></span></button>`, false);
    $('#uOk').onclick = next;
  }

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
  $('#btnHome').onclick = () => { saveCur(); show('home'); };
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
  addEventListener('resize', () => { if (screen === 'game') layoutBoard(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Sound.suspend(); if (screen === 'game') pauseClock(); }
    else { Sound.resume(); resumeClock(); if (screen === 'home') { renderHome(); checkHearts(); } }
  });

  // Android back button (called from the native wrapper). Return true when handled.
  window.handleBack = () => {
    if (!$('#modal').classList.contains('hidden')) { if (modalClosable) closeModal(); return true; }
    if (screen === 'game') { saveCur(); show('home'); return true; }
    if (screen !== 'home') { show('home'); return true; }
    return false;
  };

  Sound.setSfx(S.sfx); Sound.setMusic(S.music);
  applyTheme();
  applyBg();
  ensureId();
  fetchOnline().then(ok => { if (ok && screen === 'home') renderHome(); checkHearts(); });
  document.body.classList.toggle('nonum', !S.nums);
  document.body.classList.toggle('contrast', !!S.contrast);
  show('home');
  // test hook
  window.__mjReady = true;
  window.__mj = { get G() { return G; }, S, startLevel, startDaily, onTap, Layouts, restart, pickTile, show, ranking, myPoints, showClimb, ensureTasks, taskProgress, openChest, openTasks, weekInfo, checkLastWeek, fetchHearts, maybeLucky, renderHome, sendHeart, pushScore };
})();
