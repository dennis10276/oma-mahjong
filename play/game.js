(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const STORE = 'omamj.v1', CUR = 'omamj.cur';
  const APP_VERSION = '0.7';

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

  const defaults = () => ({ level: 1, stars: {}, daily: {}, theme: 'classic', bg: 'jade', sfx: true, music: true, vibrate: true, highlight: true, bestStreak: 0, seenIntro: false, matches: 0, nums: true, trophies: {}, bestCombo: 0, sunSeen: false });
  let S;
  try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { S = defaults(); }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { } };

  // ---------- dates ----------
  const pad = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dnum = k => +k.replace(/-/g, '');
  const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const todayKey = () => dkey(new Date());

  const totalStars = () => Object.values(S.stars).reduce((a, b) => a + b, 0) + Object.values(S.daily).reduce((a, b) => a + b, 0);
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
    function emoji(x, y, list, n = 9) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4, sp = 3 + Math.random() * 5;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.16, life: 0, max: 55 + Math.random() * 25, size: 20 + Math.random() * 16, kind: 'emo', ch: list[i % list.length], rot: (Math.random() - .5), vr: (Math.random() - .5) * .12 });
      }
      go();
    }
    function sunRain() {
      for (let i = 0; i < 46; i++) parts.push({ x: Math.random() * innerWidth, y: -40 - Math.random() * innerHeight * 0.8, vx: (Math.random() - .5) * 1.5, vy: 2 + Math.random() * 2.5, g: 0.02, life: 0, max: 260, size: 26 + Math.random() * 22, kind: 'emo', ch: ['🌻', '🌼', '🐝', '🌻'][i % 4], rot: Math.random(), vr: (Math.random() - .5) * .06, sway: Math.random() * 6 });
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
        else if (p.kind === 'emo') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.font = p.size + "px 'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.ch, 0, 0); g.restore(); }
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
    $('#rankBadge').textContent = '#' + myRank();
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
    const rows = [['sfx', '🔊 Geluidjes'], ['music', '🎵 Muziek'], ['vibrate', '📳 Trillen'], ['highlight', '✨ Vastzittende stenen donker'], ['nums', '🔢 Cijfers in de hoek']];
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
      const keep = { sfx: S.sfx, music: S.music, vibrate: S.vibrate, highlight: S.highlight, nums: S.nums, seenIntro: true, seenTray: true, seenDown: !!S.seenDown, pid: S.pid, name: S.name, avatar: S.avatar, since: S.since };
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
      <p>Komen er <b>twee dezelfde</b> in de vakjes, dan verdwijnen ze! Er zijn maar <b>4 vakjes</b>. Zijn ze allemaal vol, dan zit je vast.</p>
      <p>Vrij = niets erbovenop, en links óf rechts open. Elk level mag je één keer <b>💡 Hint</b> en één keer <b>🔀 Schudden</b>.</p>
      <button class="big-btn play" id="mGo"><span class="bb-text"><b>Begrepen!</b></span></button>`, true, after);
    $('#mGo').onclick = closeModal;
    S.seenTray = true; S.seenIntro = true; save();
  }

  // ---------- the game ----------
  const SLOTS = Layouts.SLOTS;
  let G = null;
  const loadCur = () => { try { const c = JSON.parse(localStorage.getItem(CUR) || 'null'); return c && c.v === 5 ? c : null; } catch (e) { return null; } };
  const clearCur = () => { try { localStorage.removeItem(CUR); } catch (e) { } };
  function saveCur() {
    if (!G || G.done) return;
    syncClock();
    try {
      localStorage.setItem(CUR, JSON.stringify({ v: 5, aspect: G.o.aspect, key: G.key, n: G.tiles.length, faces: G.tiles.map(t => t.face), alive: Array.from(G.alive), tray: G.tray, down: Array.from(G.down), peek: G.peek, score: G.score, elapsed: G.elapsed, usedHint: G.usedHint, usedShuffle: G.usedShuffle }));
    } catch (e) { }
  }
  function syncClock() { if (G && G.tStart) { const n = performance.now(); G.elapsed += (n - G.tStart) / 1000; G.tStart = n; } }
  function pauseClock() { syncClock(); if (G) G.tStart = 0; saveCur(); }
  function resumeClock() { if (G && !G.done && screen === 'game') G.tStart = performance.now(); }

  function startLevel(level) { begin({ mode: 'level', level, key: 'L' + level, title: 'Level ' + level, makeSpec: a => Layouts.forLevel(level, a) }); }
  function startDaily(k) {
    const d = parseKey(k);
    begin({ mode: 'daily', date: k, key: 'D' + k, title: `Dagpuzzel ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`, makeSpec: a => Layouts.forDate(dnum(k), a) });
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
    G = { o, ...o, tiles, nb, alive: new Uint8Array(n).fill(1), down: new Uint8Array(n), peek: -1, tray: [], arriving: new Set(), flights: 0, score: 0, combo: 0, lastMatch: 0, usedHint: false, usedShuffle: false, elapsed: 0, tStart: 0, done: false, busy: false, half: false };
    const cur = restart ? null : loadCur();
    if (cur && cur.key === o.key && cur.n === n && cur.aspect === o.aspect) {
      cur.faces.forEach((f, i) => tiles[i].face = f);
      cur.alive.forEach((a, i) => G.alive[i] = a);
      (cur.down || []).forEach((a, i) => G.down[i] = a);
      G.peek = cur.peek ?? -1;
      Object.assign(G, { tray: cur.tray || [], score: cur.score, elapsed: cur.elapsed, usedHint: !!cur.usedHint, usedShuffle: !!cur.usedShuffle });
      G.half = aliveCount() <= n / 2;
    } else {
      if (!o.faces) { const d = Layouts.makeDeal(spec); o.faces = d.faces; o.down = d.down; } // same deal again on "Opnieuw"
      o.faces.forEach((f, i) => tiles[i].face = f);
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
    else setTimeout(checkStuck, 500);
  }
  const restart = () => { if (G) begin(G.o, true); };

  const aliveCount = () => G.alive.reduce((a, b) => a + b, 0);
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
  function updateTools() {
    $('#btnHint').classList.toggle('used', G.usedHint);
    $('#btnShuffle').classList.toggle('used', G.usedShuffle);
    $('#btnHint .badge').textContent = G.usedHint ? '0' : '1';
    $('#btnShuffle .badge').textContent = G.usedShuffle ? '0' : '1';
  }
  function renderTray() {
    const slots = $('#tray').children;
    for (let k = 0; k < SLOTS; k++) {
      const t = G.tray[k];
      slots[k].innerHTML = t === undefined ? '' : `<div class="tmini${G.arriving.has(t) ? ' arriving' : ''}">${Tiles.faceHTML(S.theme, G.tiles[t].face)}</div>`;
    }
    const tr = $('#tray');
    tr.classList.toggle('warn', G.tray.length === SLOTS - 1);
    tr.classList.toggle('full', G.tray.length >= SLOTS);
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
  /* Taps never wait for animations: the game state changes instantly,
     the flying tiles just catch up visually. */
  function onTap(i) {
    if (!G || G.done || G.busy || !G.alive[i]) return;
    Sound.init();
    const el = G.tiles[i].el;
    if (!free(i)) {
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
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
      const mid = { left: (from.left + pfrom.left) / 2, top: (from.top + pfrom.top) / 2 - from.height * 0.3, width: from.width, height: from.height };
      const f1 = flyTile(face, from, mid, MS), f2 = flyTile(face, pfrom, mid, MS);
      afterLogic();
      land(() => { f1.classList.add('popout'); f2.classList.add('popout'); onMatch({ x: mid.left + mid.width / 2, y: mid.top + mid.height / 2 }); setTimeout(() => { f1.remove(); f2.remove(); }, 230); afterLand(); });
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
      renderTray();
      const fly = flyTile(face, from, to, MS);
      afterLogic();
      land(() => {
        fly.classList.add('popout'); if (ghost) ghost.classList.add('popout');
        onMatch({ x: to.left + to.width / 2, y: to.top + to.height / 2 });
        setTimeout(() => { fly.remove(); if (ghost) ghost.remove(); }, 230);
        afterLand();
      });
      return;
    }
    const slotIdx = G.tray.length;
    G.tray.push(i);
    G.arriving.add(i);
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
    if (G.flights === 0) checkStuck();
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

  function onMatch(c) {
    const now = performance.now();
    G.combo = now - G.lastMatch < 6000 ? G.combo + 1 : 1;
    G.lastMatch = now;
    const pts = 10 * Math.min(G.combo, 5);
    G.score += pts;
    S.matches++;
    if (G.combo > (S.bestCombo || 0)) S.bestCombo = G.combo;
    const sunny = S.theme === 'sunflower';
    FX.burst(c.x, c.y - 10, sunny ? 12 : G.combo >= 3 ? 30 : 20, G.combo >= 3);
    if (sunny) { FX.emoji(c.x, c.y - 10, G.combo >= 3 ? ['🌻', '🌼', '🐝', '✨'] : ['🌻', '🌼', '✨'], G.combo >= 3 ? 11 : 7); if (G.combo >= 3 && G.combo % 2 === 1) bee(); }
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
    if (G.combo % 5 === 0) { /* supercombo already celebrates */ }
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
    if (!G || G.done || G.busy || G.tray.length < SLOTS || trayMatchFree() >= 0 || peekPairFree()) return;
    G.busy = true;
    syncClock();
    setTimeout(() => {
      Sound.stuck(); buzz([40, 80, 40]);
      openModal(`<h2>Oei, alle vakjes zijn vol!</h2>
        <p>Er ligt geen passende steen meer vrij. Geen nood, probeer het gewoon nog eens.</p>
        ${!G.usedShuffle ? `<button class="big-btn gold" id="sShuf"><span class="bb-text"><b>🔀 Schud de stenen</b><small>Je mag 1x per level schudden</small></span></button>` : ''}
        <button class="big-btn play" id="sRetry"><span class="bb-text"><b>↻ Opnieuw proberen</b></span></button>
        <button class="link-btn" id="sMenu">Menu</button>`, false);
      if ($('#sShuf')) $('#sShuf').onclick = () => { closeModal(); G.busy = false; shuffle(); };
      $('#sRetry').onclick = () => { closeModal(); restart(); };
      $('#sMenu').onclick = () => { closeModal(); clearCur(); G.done = true; show('home'); };
    }, 450);
  }

  function hint() {
    if (!G || G.done || G.busy) return;
    Sound.init();
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
      setTimeout(() => { el.querySelector('.face').innerHTML = Tiles.faceHTML(S.theme, t.face); }, 200 + (kk % 12) * 15);
      setTimeout(() => { el.classList.remove('flip'); el.style.animationDelay = ''; }, 700);
    });
    setTimeout(() => { G.busy = false; updateBlocked(); saveCur(); checkStuck(); }, 520);
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
  // rough points for playing level l (pairs × average combo points + star bonus)
  const levelPts = l => Math.round(Layouts.targetFor(Math.max(1, Math.round(Layouts.effLevel(l)))) / 2 * 24 + 120);
  const cumPts = L => { let p = 0; for (let l = 1; l <= Math.floor(L); l++) p += levelPts(l); return Math.round(p + (L % 1) * levelPts(Math.floor(L) + 1)); };
  function botEntries() {
    if (!S.since) { S.since = todayKey(); save(); }
    const days = Math.max(0, Math.round((parseKey(todayKey()) - parseKey(S.since)) / 864e5));
    return BOTS.map(([name, avatar, at], k) => {
      const r = Layouts.rng(k * 977 + 3);
      const pts = Math.round(cumPts(at) * (0.94 + r() * 0.12) + days * (15 + k * 3));
      return { id: 'bot' + k, name, avatar, points: pts, level: Math.max(1, Math.floor(at) + 1), bot: true };
    });
  }
  const myPoints = () => Object.values(S.lvlPts || {}).reduce((a, b) => a + b, 0) + Object.values(S.dayPts || {}).reduce((a, b) => a + b, 0);
  function myEntry(points = myPoints()) { return { id: S.pid, name: S.name || 'Jij', avatar: S.avatar || '😊', points, level: S.level, me: true }; }
  function onlineEntries() {
    try { return (JSON.parse(localStorage.getItem(LB_CACHE) || '[]') || []).filter(e => e.id !== S.pid); } catch (e) { return []; }
  }
  function ranking(points) {
    const list = [...botEntries(), ...onlineEntries(), myEntry(points)];
    // on a tie you are placed above the other player
    list.sort((a, b) => b.points - a.points || (b.me ? 1 : 0) - (a.me ? 1 : 0));
    return list;
  }
  const myRank = points => ranking(points).findIndex(e => e.me) + 1;
  function ensureId() { if (!S.pid) { S.pid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); save(); } }
  async function fetchOnline() {
    if (!DB_URL) return false;
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
      const res = await fetch(DB_URL + '/scores.json', { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(to);
      if (!res.ok) return false;
      const data = await res.json() || {};
      const list = Object.entries(data).filter(([id, v]) => v && typeof v.points === 'number' && !id.startsWith('test-')).map(([id, v]) => ({ id, name: String(v.name || '?').slice(0, 24), avatar: String(v.avatar || '🙂').slice(0, 8), points: v.points, level: v.level || 1 }));
      localStorage.setItem(LB_CACHE, JSON.stringify(list));
      S.lbOnlineAt = Date.now(); save();
      return true;
    } catch (e) { return false; }
  }
  async function pushScore() {
    if (!DB_URL || !S.name) return;
    ensureId();
    try {
      await fetch(`${DB_URL}/scores/${S.pid}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: S.name.slice(0, 24), avatar: (S.avatar || '😊').slice(0, 8), points: myPoints(), level: S.level, t: Date.now() }) });
    } catch (e) { }
  }

  const AVATARS = ['👵', '👴', '😊', '🌻', '🐱', '🐶', '🌷', '⭐', '🦋', '🍀', '🎩', '🚀'];
  function askName(then) {
    const cur = S.name || '';
    openModal(`<h2>Hoe heet je?</h2>
      <p>Zo zien de anderen je op de ranglijst.</p>
      <input id="nmIn" class="name-in" maxlength="20" value="${cur.replace(/"/g, '')}" placeholder="Bijvoorbeeld: Oma Riet" autocomplete="off">
      <div class="quick-names">${['Oma', 'Opa', 'Mama', 'Papa'].map(n => `<button class="qn">${n}</button>`).join('')}</div>
      <div class="avatars">${AVATARS.map(a => `<button class="av${(S.avatar || '👵') === a ? ' on' : ''}">${a}</button>`).join('')}</div>
      <button class="big-btn play" id="nmOk"><span class="bb-text"><b>Opslaan</b></span></button>`, false);
    let av = S.avatar || '👵';
    document.querySelectorAll('.qn').forEach(b => b.onclick = () => { $('#nmIn').value = b.textContent; });
    document.querySelectorAll('.av').forEach(b => b.onclick = () => { av = b.textContent; document.querySelectorAll('.av').forEach(x => x.classList.toggle('on', x === b)); });
    $('#nmOk').onclick = () => {
      const v = $('#nmIn').value.trim().replace(/[<>]/g, '').slice(0, 20);
      if (!v) { $('#nmIn').focus(); toast('Vul eerst een naam in'); return; }
      S.name = v; S.avatar = av; ensureId(); save(); closeModal(); pushScore(); if (then) then();
    };
  }

  function rowHTML(e, rank) {
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
    return `<span class="rk">${medal}</span><span class="ra">${e.avatar}</span><span class="rn">${e.name}${e.me ? ' <i>(jij)</i>' : ''}${e.bot ? ' <i class="bot" title="computerspeler">🤖</i>' : ''}<small>level ${e.level}</small></span><span class="rp">${e.points.toLocaleString('nl-NL')}</span>`;
  }
  function renderRanking() {
    ensureId();
    const list = ranking();
    const me = list.findIndex(e => e.me);
    $('#rkMine').textContent = '🏆 #' + (me + 1);
    $('#rankList').innerHTML = list.map((e, i) => `<div class="rrow${e.me ? ' me' : ''}">${rowHTML(e, i + 1)}</div>`).join('');
    const online = !!DB_URL;
    $('#rankNote').innerHTML = online ? `🌐 Familie online · 🤖 = computerspeler` : `🤖 = computerspeler · familie-ranglijst nog niet gekoppeld`;
    $('#rankName').textContent = `${S.avatar || '😊'} ${S.name || 'Naam kiezen'} ✏️`;
    setTimeout(() => { const m = document.querySelector('.rrow.me'); if (m) m.scrollIntoView({ block: 'center' }); }, 30);
    if (online && (!S.lbOnlineAt || Date.now() - S.lbOnlineAt > 20000)) fetchOnline().then(ok => { if (ok && screen === 'ranking') renderRanking(); });
  }

  /* The dopamine moment: your row climbs past the people you just overtook. */
  function showClimb(oldPts, newPts, then) {
    const before = ranking(oldPts), after = ranking(newPts);
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
    openModal(`<h2>Je klimt op de ranglijst! 🏆</h2>
      <div class="climb" style="height:${(rows.length + 1) * RH}px">
        ${rows.map((e, k) => `<div class="rrow crow" data-k="${k}" style="transform:translateY(${k * RH}px)">${rowHTML(e, rankOf(k, false))}</div>`).join('')}
        <div class="rrow me crow" id="meRow" style="transform:translateY(${startIdx * RH}px)">${rowHTML(myEntry(oldPts), oldRank)}</div>
      </div>
      <div class="climb-msg" id="climbMsg">&nbsp;</div>
      <button class="big-btn play" id="clOk"><span class="bb-text"><b>Verder</b></span></button>`, false);
    $('#clOk').onclick = () => { closeModal(); then(); };
    const me = $('#meRow');
    const rowsEls = [...document.querySelectorAll('.crow[data-k]')];
    // relabel the passed rows with their final rank numbers once they move down
    let pos = startIdx, k = 0;
    const steps = show.length;
    const stepTime = Math.max(380, Math.min(650, 2400 / Math.max(1, steps)));
    function step() {
      if (k >= steps) return finish();
      const victimIdx = startIdx - 1 - k;                  // the row right above you
      const victim = rowsEls[victimIdx];
      pos--; k++;
      me.style.transform = `translateY(${pos * RH}px) scale(1.04)`;
      victim.style.transform = `translateY(${(victimIdx + 1) * RH}px)`;
      victim.querySelector('.rk').textContent = medalOf(rankOf(victimIdx, true));
      const rank = oldRank - (passed.length - show.length) - k;
      me.querySelector('.rk').textContent = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : '#' + rank;
      const pts = Math.round(oldPts + (newPts - oldPts) * k / steps);
      me.querySelector('.rp').textContent = pts.toLocaleString('nl-NL');
      Sound.pass(k); buzz(15);
      const r = me.getBoundingClientRect(); FX.burst(r.left + r.width * 0.15, r.top + r.height / 2, 10);
      setTimeout(step, stepTime);
    }
    function finish() {
      me.style.transform = `translateY(${pos * RH}px)`;
      me.querySelector('.rp').textContent = newPts.toLocaleString('nl-NL');
      me.querySelector('.rk').textContent = newRank <= 3 ? ['🥇', '🥈', '🥉'][newRank - 1] : '#' + newRank;
      me.classList.add('glow');
      Sound.rankUp(); FX.confetti(); buzz([30, 50, 30, 50, 60]);
      const n = passed.length;
      const who = n === 1 ? `Je bent <b>${passed[0].name}</b> voorbij! 🎉` : `Je bent <b>${n} spelers</b> voorbij! 🎉`;
      const nxt = above ? `<br><small>Nog ${(above.points - newPts + 1).toLocaleString('nl-NL')} punten tot ${above.avatar} ${above.name}</small>` : `<br><small>Je staat bovenaan! 👑</small>`;
      $('#climbMsg').innerHTML = `<span class="climb-up">#${oldRank} → #${newRank} ⬆</span><br>${who}${nxt}`;
    }
    setTimeout(step, 650);
  }

  // ---------- winning ----------
  function win() {
    syncClock(); G.tStart = 0;
    clearCur();
    const stars = 3 - (G.usedHint ? 1 : 0) - (G.usedShuffle ? 1 : 0);
    G.score += stars * 50;
    const before = totalStars();
    const ptsBefore = myPoints();
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
    const rankBefore = myRank(ptsBefore), rankAfter = myRank(ptsAfter);
    if (rankAfter < rankBefore) rewards.push({ type: 'rank', from: ptsBefore, to: ptsAfter });
    pushScore();
    const nextUp = ranking(ptsAfter)[rankAfter - 2];
    const chase = nextUp && rankAfter >= rankBefore ? `<p class="chase">🏆 Plek #${rankAfter} · nog <b>${(nextUp.points - ptsAfter + 1).toLocaleString('nl-NL')}</b> punten tot ${nextUp.avatar} ${nextUp.name}</p>` : '';
    if (sunUnlocked() && !wasSun) rewards.push({ type: 'sun' });
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
    if (r.type === 'rank') { if (!S.name) askName(() => showClimb(r.from, r.to, next)); else showClimb(r.from, r.to, next); }
    else if (r.type === 'sun') showSunflowerUnlock(next);
    else if (r.type === 'trophies') showTrophies(r.list, next);
    else showUnlock(r.list.slice(), next);
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

  function showUnlock(list, then) {
    const bg = list.shift();
    Sound.unlock(); FX.confetti();
    openModal(`<h2>Nieuwe achtergrond! 🎉</h2><p>Je hebt <b>“${bg.name}”</b> vrijgespeeld.</p>
      <div class="unlock-pv" style="background:${bg.css}"></div>
      <button class="big-btn play" id="uUse"><span class="bb-text"><b>Gebruik nu</b></span></button>
      <button class="link-btn" id="uLater">Later</button>`, false);
    const next = () => { closeModal(); if (list.length) showUnlock(list, then); else then(); };
    $('#uUse').onclick = () => { S.bg = bg.id; save(); applyBg(); next(); };
    $('#uLater').onclick = next;
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
    else { Sound.resume(); resumeClock(); if (screen === 'home') renderHome(); }
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
  fetchOnline().then(ok => { if (ok && screen === 'home') renderHome(); });
  document.body.classList.toggle('nonum', !S.nums);
  show('home');
  // test hook
  window.__mj = { get G() { return G; }, S, startLevel, startDaily, onTap, Layouts, restart, pickTile, show, ranking, myPoints, showClimb };
})();
