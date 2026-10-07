/* Oma's Mahjong — finishing a level: the win curScreen and the rewards that follow it. */
'use strict';

// ---------- winning ----------
function win() {
  syncClock(); G.tStart = 0;
  clearCur();
  const stars = Math.max(1, 3 - (G.usedHint ? 1 : 0) - (G.usedShuffle ? 1 : 0) - (G.rescued ? 1 : 0));
  G.score += stars * 50;
  endLevel('win', { st: stars });
  const before = totalStars();
  const ptsBefore = myPoints(), lvlBefore = S.level;
  ensureWeek();
  const wkBefore = S.wk.pts;
  S.wk.pts += G.score;               // every finished level counts for the weekly challenge
  const wkAfter = S.wk.pts;
  // daily tasks + statistics
  if (G.mode === 'level') taskProgress('levels'); else taskProgress('daily');
  if (stars === 3) taskProgress('stars3');
  if (!G.usedHint && !G.usedShuffle && !G.rescued && toolsOpen()) taskProgress('nohelp');
  if (S.fails) delete S.fails[G.key];   // won: the next level starts without easier retries
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
  const rankBefore = myRank(lvlBefore, 'all'), rankAfter = myRank(S.level, 'all');
  if (wkRankAfter < wkRankBefore) rewards.push({ type: 'rank', mode: 'week', from: wkBefore, to: wkAfter });
  else if (rankAfter < rankBefore) rewards.push({ type: 'rank', mode: 'all', from: lvlBefore, to: S.level });
  // the family is always on the win curScreen, so you see where everyone stands
  const famNow = famHTML('week', ranking(wkAfter, 'week'), '👪 Familie deze week');
  pushScore();
  const heartsP = Promise.race([fetchHearts(), new Promise(r => setTimeout(() => r([]), 2500))]);
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
  const extra = G.mode === 'daily' ? `<p>🔥 ${streak()} ${streak() === 1 ? 'dag' : 'dagen'} op rij!</p>` : stars < 3 ? `<p class="note">${G.rescued && !G.usedHint && !G.usedShuffle ? 'Zonder terugleggen' : 'Zonder hint en schudden'} verdien je ⭐⭐⭐</p>` : '';
  const nextLbl = G.mode === 'daily' ? 'Naar de kalender' : `Volgende: level ${G.level + 1} ▶`;
  setTimeout(() => {
    openModal(`<h2>${title}</h2>
      <div class="stars"><span class="st">★</span><span class="st">★</span><span class="st">★</span></div>
      <div class="win-stats"><div>Punten<b id="wScore">0</b></div><div>Tijd<b>${mins}:${pad(secs)}</b></div></div>
      <div class="perfect" id="wPerfect">${stars === 3 ? 'PERFECT! ✨' : ''}</div>
      ${extra}${chase}${famNow}
      <div class="goal" id="wGoal"></div>
      <button class="big-btn play pulse" id="wNext"><span class="bb-text"><b>${nextLbl}</b></span></button>
      <button class="link-btn" id="wMenu">Menu</button>`, false, null, 'compact');
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
        if (updateReady) {   // a new version is waiting: switch now, then carry on where we were going
          S.afterUpdate = dest === 'next' ? (G.mode === 'daily' ? { show: 'daily' } : { level: G.level + 1 }) : { show: 'home' };
          save(); updateReady = false; toast('✨ Nieuwe versie! Even geduld…', 1500);
          return setTimeout(() => location.reload(), 900);
        }
        if (dest === 'next') { if (G.mode === 'daily') show('daily'); else startLevel(G.level + 1); }
        else show('home');
      };
      heartsP.then(fresh => {
        const all = [...(S.pendingHearts || []), ...(fresh || [])];
        if (all.length) { S.pendingHearts = []; save(); rewards.unshift({ type: 'hearts', list: all }); }
        runRewards(rewards, finish);
      });
    };
    $('#wNext').onclick = () => go('next');
    $('#wMenu').onclick = () => go('menu');
  }, 700);
}

function runRewards(queue, then) {
  const r = queue.shift();
  if (!r) return then();
  const next = () => runRewards(queue, then);
  if (r.type === 'hearts') showHearts(r.list, next);
  else if (r.type === 'rank') { if (!S.name) askName(() => showClimb(r.from, r.to, next, r.mode)); else showClimb(r.from, r.to, next, r.mode); }
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
    <p class="note">💡 Hint wijst een slimme zet aan. 🔀 Schudden husselt de stenen, handig als je vastzit. Zonder ze te gebruiken verdien je ⭐⭐⭐.</p>
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
