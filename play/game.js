(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const STORE = 'omamj.v1', CUR = 'omamj.cur';

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
  ];

  const defaults = () => ({ level: 1, stars: {}, daily: {}, theme: 'classic', bg: 'jade', sfx: true, music: true, vibrate: true, highlight: true, bestStreak: 0, seenIntro: false, matches: 0 });
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
  function applyBg() { const b = BGS.find(b => b.id === S.bg) || BGS[0]; $('#bg').style.background = b.css; }

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
        p.life++; p.vy += p.g; p.x += p.vx + (p.kind === 'paper' ? Math.sin((p.life + p.sway * 10) / 12) * 1.2 : 0); p.y += p.vy; p.rot += p.vr;
        if (p.kind !== 'paper') { p.vx *= 0.96; p.vy *= 0.96; }
        const a = 1 - Math.max(0, (p.life - p.max * 0.6) / (p.max * 0.4));
        g.globalAlpha = Math.max(0, a); g.fillStyle = p.col;
        if (p.kind === 'spark') spark(p.x, p.y, p.size);
        else if (p.kind === 'dot') { g.beginPath(); g.arc(p.x, p.y, p.size * 0.45, 0, 7); g.fill(); }
        else { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.4 + Math.abs(Math.sin(p.life / 6)))); g.restore(); }
      }
      g.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    }
    function clear() { parts = []; }
    return { burst, confetti, clear };
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
    const faces = S.theme === 'classic' ? [31, 34, 32] : [0, 4, 8];
    lt.forEach((el, i) => el.innerHTML = Tiles.faceHTML(S.theme === 'classic' ? 'classic' : S.theme, faces[i]).replace('class="emo"', 'class="emo" style="font-size:46px;display:grid;place-items:center;height:100%"'));
    renderGoal($('#nextUnlock'));
  }
  function renderGoal(el) {
    const ts = totalStars();
    const next = BGS.find(b => b.need > ts);
    if (!next) { el.innerHTML = 'Alle achtergronden vrijgespeeld! 🏆'; return; }
    const prev = [...BGS].reverse().find(b => b.need <= ts);
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
    const tl = $('#tileThemes'); tl.innerHTML = '';
    for (const [id, t] of Object.entries(Tiles.THEMES)) {
      const b = document.createElement('button');
      b.className = 'th' + (S.theme === id ? ' on' : '');
      const sample = id === 'classic' ? [0, 31, 22] : [0, 5, 13];
      b.innerHTML = `<div class="pv">${sample.map(k => `<div class="mini">${Tiles.faceHTML(id, k)}</div>`).join('')}</div>${t.name}`;
      b.onclick = () => { S.theme = id; save(); renderThemes(); Sound.select(); };
      tl.appendChild(b);
    }
    const bl = $('#bgThemes'); bl.innerHTML = '';
    const ts = totalStars();
    for (const bg of BGS) {
      const b = document.createElement('button');
      const locked = ts < bg.need;
      b.className = 'bgc' + (locked ? ' locked' : '') + (S.bg === bg.id ? ' on' : '');
      b.style.background = bg.css;
      b.innerHTML = locked ? `<div class="lock">🔒<br>${bg.need} ⭐</div>` : bg.name;
      b.onclick = () => {
        if (locked) { toast(`Verdien nog ${bg.need - ts} ⭐ om “${bg.name}” vrij te spelen`); Sound.blocked(); return; }
        S.bg = bg.id; save(); applyBg(); renderThemes(); Sound.select();
      };
      bl.appendChild(b);
    }
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
    const rows = [['sfx', '🔊 Geluidjes'], ['music', '🎵 Muziek'], ['vibrate', '📳 Trillen'], ['highlight', '✨ Vastzittende stenen donker']];
    openModal(`<h2>Instellingen</h2>${rows.map(([k, l]) => `<div class="set-row">${l}<button class="tog ${S[k] ? 'on' : ''}" data-k="${k}"></button></div>`).join('')}
      <button class="big-btn gold" id="mHow"><span class="bb-text"><b>Hoe speel je?</b></span></button>
      <button class="link-btn" id="mClose">Sluiten</button>`);
    $('#modalBox').querySelectorAll('.tog').forEach(t => t.onclick = () => {
      const k = t.dataset.k; S[k] = !S[k]; t.classList.toggle('on', S[k]); save();
      if (k === 'sfx') Sound.setSfx(S.sfx);
      if (k === 'music') Sound.setMusic(S.music);
      if (k === 'vibrate' && S.vibrate) buzz(40);
      if (k === 'highlight') $('#board').classList.toggle('hl', S.highlight);
    });
    $('#mHow').onclick = () => showIntro();
    $('#mClose').onclick = closeModal;
  }

  function showIntro(after) {
    const f = Tiles.faceHTML('classic', 31), g = Tiles.faceHTML('classic', 4);
    openModal(`<h2>Zo speel je 🀄</h2>
      <p>Tik op een <b>vrije steen</b>: hij schuift naar een <b>vakje onderaan</b>.</p>
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
  const loadCur = () => { try { const c = JSON.parse(localStorage.getItem(CUR) || 'null'); return c && c.v === 3 ? c : null; } catch (e) { return null; } };
  const clearCur = () => { try { localStorage.removeItem(CUR); } catch (e) { } };
  function saveCur() {
    if (!G || G.done) return;
    syncClock();
    try {
      localStorage.setItem(CUR, JSON.stringify({ v: 3, key: G.key, n: G.tiles.length, faces: G.tiles.map(t => t.face), alive: Array.from(G.alive), tray: G.tray, score: G.score, elapsed: G.elapsed, usedHint: G.usedHint, usedShuffle: G.usedShuffle }));
    } catch (e) { }
  }
  function syncClock() { if (G && G.tStart) { const n = performance.now(); G.elapsed += (n - G.tStart) / 1000; G.tStart = n; } }
  function pauseClock() { syncClock(); if (G) G.tStart = 0; saveCur(); }
  function resumeClock() { if (G && !G.done && screen === 'game') G.tStart = performance.now(); }

  function startLevel(level) { begin({ mode: 'level', level, key: 'L' + level, title: 'Level ' + level, spec: Layouts.forLevel(level) }); }
  function startDaily(k) {
    const d = parseKey(k);
    begin({ mode: 'daily', date: k, key: 'D' + k, title: `Dagpuzzel ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`, spec: Layouts.forDate(dnum(k)) });
  }

  function begin(o, restart = false) {
    $('#modal').classList.add('hidden'); modalOnClose = null;
    $('#comboTag').classList.remove('on'); $('#praise').classList.remove('show'); FX.clear();
    const spec = o.spec;
    const tiles = spec.tiles.map(t => ({ x: t.x, y: t.y, z: t.z, face: 0, el: null }));
    const nb = Layouts.neighbors(tiles);
    const n = tiles.length;
    G = { o, ...o, tiles, nb, alive: new Uint8Array(n).fill(1), tray: [], score: 0, combo: 0, lastMatch: 0, usedHint: false, usedShuffle: false, elapsed: 0, tStart: 0, done: false, busy: false, half: false };
    const cur = restart ? null : loadCur();
    if (cur && cur.key === o.key && cur.n === n) {
      cur.faces.forEach((f, i) => tiles[i].face = f);
      cur.alive.forEach((a, i) => G.alive[i] = a);
      Object.assign(G, { tray: cur.tray || [], score: cur.score, elapsed: cur.elapsed, usedHint: !!cur.usedHint, usedShuffle: !!cur.usedShuffle });
      G.half = aliveCount() <= n / 2;
    } else {
      if (!o.faces) o.faces = Layouts.makeDeal(spec).faces; // same deal again on "Opnieuw"
      o.faces.forEach((f, i) => tiles[i].face = f);
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
      el.className = 'tile' + (G.alive[i] ? '' : ' hidden');
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
    const ratio = 1.24, dF = 0.12;
    let tw = Math.min((W - 14) / (cols + maxZ * dF + 0.15), (H - 14) / (rows * ratio + maxZ * dF + 0.2));
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
      slots[k].innerHTML = t === undefined ? '' : `<div class="tmini">${Tiles.faceHTML(S.theme, G.tiles[t].face)}</div>`;
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
    const face = G.tiles[i].face;
    const mi = G.tray.findIndex(t => G.tiles[t].face === face);
    if (mi < 0 && G.tray.length >= SLOTS) {
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      Sound.blocked(); toast('Alle vakjes zijn vol. Kies een steen die past!');
      return;
    }
    clearHint();
    G.busy = true;
    const slotIdx = mi >= 0 ? mi : G.tray.length;
    const slotEl = $('#tray').children[slotIdx];
    const from = el.getBoundingClientRect(), to = slotEl.getBoundingClientRect();
    G.alive[i] = 0;
    el.classList.add('hidden');
    updateBlocked();
    Sound.select(); buzz(8);
    const MS = 270;
    const fly = flyTile(face, from, to, MS);
    setTimeout(() => {
      if (mi >= 0) {
        const partner = G.tray[mi];
        G.tray.splice(mi, 1);
        const mini = slotEl.firstElementChild;
        if (mini) mini.classList.add('popout');
        fly.classList.add('popout');
        onMatch(centerOf(slotEl));
        setTimeout(() => { fly.remove(); renderTray(); G.busy = false; afterMove(); }, 230);
      } else {
        G.tray.push(i);
        fly.remove();
        renderTray();
        const m = slotEl.firstElementChild; if (m) m.classList.add('land');
        G.busy = false; afterMove();
      }
    }, MS);
  }

  function onMatch(c) {
    const now = performance.now();
    G.combo = now - G.lastMatch < 6000 ? G.combo + 1 : 1;
    G.lastMatch = now;
    const pts = 10 * Math.min(G.combo, 5);
    G.score += pts;
    S.matches++;
    FX.burst(c.x, c.y - 10, G.combo >= 3 ? 30 : 20, G.combo >= 3);
    floatText(c.x, c.y - 50, '+' + pts);
    Sound.match(G.combo); buzz(G.combo >= 3 ? [15, 40, 25] : 18);
    updateScore();
    const tag = $('#comboTag');
    if (G.combo >= 2) { tag.textContent = `Combo x${Math.min(G.combo, 5)} 🔥`; tag.classList.add('on'); }
    clearTimeout(comboTimer); comboTimer = setTimeout(() => tag.classList.remove('on'), 6000);
    const left = aliveCount();
    if (G.combo >= 3 && G.combo % 2 === 1) praise(PRAISE[Math.min(PRAISE.length - 1, Math.floor(Math.random() * 3) + (G.combo - 3))]);
    else if (!G.half && left <= G.tiles.length / 2 && left > 0) { G.half = true; praise('Halverwege! 💪'); }
    else if (left === 4) praise('Bijna klaar!');
  }

  function afterMove() {
    updateProgress();
    if (aliveCount() === 0 && G.tray.length === 0) { G.done = true; setTimeout(win, 500); return; }
    saveCur();
    checkStuck();
  }

  function trayMatchFree() {
    const tf = new Set(G.tray.map(t => G.tiles[t].face));
    for (let i = 0; i < G.tiles.length; i++) if (G.alive[i] && tf.has(G.tiles[i].face) && free(i)) return i;
    return -1;
  }
  function checkStuck() {
    if (!G || G.done || G.tray.length < SLOTS || trayMatchFree() >= 0) return;
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

  // ---------- winning ----------
  function win() {
    syncClock(); G.tStart = 0;
    clearCur();
    const stars = 3 - (G.usedHint ? 1 : 0) - (G.usedShuffle ? 1 : 0);
    G.score += stars * 50;
    const before = totalStars();
    if (G.mode === 'level') {
      S.stars[G.level] = Math.max(S.stars[G.level] || 0, stars);
      if (G.level === S.level) S.level++;
    } else {
      S.daily[G.date] = Math.max(S.daily[G.date] || 0, stars);
      const s = streak(); if (s > S.bestStreak) S.bestStreak = s;
    }
    save();
    const after = totalStars();
    const unlocked = BGS.filter(b => b.need > before && b.need <= after);
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
        ${extra}
        <div class="goal" id="wGoal" style="background:#efe2c0;color:#5c4520;margin:12px 0 4px"></div>
        <button class="big-btn play pulse" id="wNext"><span class="bb-text"><b>${nextLbl}</b></span></button>
        <button class="link-btn" id="wMenu">Menu</button>`, false);
      renderGoal($('#wGoal'));
      const sts = document.querySelectorAll('.stars .st');
      for (let i = 0; i < stars; i++) setTimeout(() => {
        sts[i].classList.add('on'); Sound.star(i); buzz(20);
        const c = centerOf(sts[i]); FX.burst(c.x, c.y, 26, true);
      }, 450 + i * 420);
      const el = $('#wScore'), target = G.score, t0 = performance.now();
      (function tick() { const p = Math.min(1, (performance.now() - t0) / 1100); el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); })();
      const go = (dest) => {
        closeModal();
        const finish = () => {
          if (dest === 'next') { if (G.mode === 'daily') show('daily'); else startLevel(G.level + 1); }
          else show('home');
        };
        if (unlocked.length) showUnlock(unlocked, finish); else finish();
      };
      $('#wNext').onclick = () => go('next');
      $('#wMenu').onclick = () => go('menu');
    }, 700);
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
  $('#board').addEventListener('pointerdown', e => {
    const el = e.target.closest('.tile');
    if (el) { e.preventDefault(); onTap(+el.dataset.i); }
  });
  $('#btnHint').onclick = hint;
  $('#btnShuffle').onclick = shuffle;
  $('#btnHome').onclick = () => { saveCur(); show('home'); };
  $('#btnPlay').onclick = () => startLevel(S.level);
  $('#btnDaily').onclick = () => { selDate = todayKey(); const n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); show('daily'); };
  $('#btnLevels').onclick = () => show('levels');
  $('#btnThemes').onclick = () => show('themes');
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
  applyBg();
  show('home');
  // test hook
  window.__mj = { get G() { return G; }, S, startLevel, startDaily, onTap, Layouts, restart };
})();
