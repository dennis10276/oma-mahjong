/* Oma's Mahjong — finishing a level: the win screen and the rewards that follow it. */
'use strict';

// ---------- winning ----------
function win() {
  syncClock(); G.tStart = 0;
  clearCur();
  // 3 stars, one less for each help used (hint, shuffle, putting the tray back)
  const stars = Math.max(1, 3 - [G.usedHint, G.usedShuffle, G.rescued].filter(Boolean).length);
  G.score += stars * RULES.score.perStar;
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
  delete S.fails[G.key];   // won: the next level starts without easier retries
  // levels won in a row (a failed try breaks the streak): a bonus star now and then
  let streakBonus = false;
  if (G.mode === 'level') {
    const ws = RULES.winStreak;
    S.winStreak++;
    if (S.winStreak === ws.first || S.winStreak % ws.every === 0) { giveBonus(1); streakBonus = true; bumpStat('streakStars'); }
    if (S.winStreak > (S.bestWinStreak || 0)) S.bestWinStreak = S.winStreak;
  }
  taskProgress('points', G.score);
  bumpStat('wins'); bumpStat('playSec', Math.round(G.elapsed));
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
  const wasSun = S.sunSeen;
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
  // the family is always on the win screen, so you see where everyone stands
  const famNow = famHTML('week', ranking(wkAfter, 'week'), tx('famWeek'));
  pushScore();
  const heartsP = Promise.race([fetchHearts(), new Promise(r => setTimeout(() => r([]), 2500))]);
  const nextUp = ranking(wkAfter, 'week')[wkRankAfter - 2];
  const chase = nextUp && wkRankAfter >= wkRankBefore ? `<p class="chase">${tx('chase', wkRankAfter, fmtN(nextUp.points - wkAfter + 1), nextUp.avatar + ' ' + esc(nextUp.name))}</p>` : '';
  if (sunUnlocked() && !wasSun) rewards.push({ type: 'sun' });
  if (S.level >= RULES.tools.fromLevel && !S.toolsSeen) rewards.push({ type: 'tools' });
  const tr = newTrophies();
  if (tr.length) rewards.push({ type: 'trophies', list: tr });
  if (unlocked.length) rewards.push({ type: 'bgs', list: unlocked });
  if (villageOn()) rewards.push({ type: 'village' });     // news from Apeldoorn comes last, right before the next level
  const mins = Math.floor(G.elapsed / 60), secs = Math.round(G.elapsed % 60);
  Sound.win(); FX.confetti(); buzz([30, 60, 30, 60, 60]);
  const titles = tx('winTitles');
  const title = G.mode === 'daily' ? tx('dailyWon') : titles[Math.floor(Math.random() * titles.length)];
  const extra = G.mode === 'daily' ? `<p>🔥 ${tx('daysInRow', streak())}!</p>` : stars < 3 ? `<p class="note">${tx(G.rescued && !G.usedHint && !G.usedShuffle ? 'noRescueStars' : 'noHelpStars')}</p>` : '';
  const nextLbl = G.mode === 'daily' ? tx('toCalendar') : tx('nextLevel', G.level + 1);
  setTimeout(() => {
    openModal(`<h2>${title}</h2>
      <div class="stars"><span class="st">★</span><span class="st">★</span><span class="st">★</span></div>
      <div class="win-stats"><div>${tx('scoreWord')}<b id="wScore">0</b></div><div>${tx('timeWord')}<b>${mins}:${pad(secs)}</b></div>${G.mode === 'level' && S.winStreak >= 2 ? `<div class="ws-streak${streakBonus ? ' bonus' : ''}">🔥<b>${tx('inARow', S.winStreak)}${streakBonus ? ' +⭐' : ''}</b></div>` : ''}</div>
      <div class="perfect" id="wPerfect">${stars === 3 ? tx('perfect') : ''}</div>
      ${extra}${chase}${famNow}
      <div class="goal" id="wGoal"></div>
      <button class="big-btn play pulse" id="wNext"><span class="bb-text"><b>${nextLbl}</b></span></button>
      <button class="link-btn" id="wMenu">${tx('menu')}</button>`, false, null, 'compact');
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
          save(); updateReady = false; toast(tx('newVersion'), 1500);
          return setTimeout(() => location.reload(), 900);
        }
        if (dest === 'next') { if (G.mode === 'daily') show('daily'); else startLevel(G.level + 1); }
        else show('home');
      };
      heartsP.then(fresh => {
        const all = [...S.pendingHearts, ...(fresh || [])];
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
  else if (r.type === 'village') showVillage(next);
  else showUnlock(r.list.slice(), next);
}
function showToolsUnlock(then) {
  S.toolsSeen = true; save();
  Sound.unlock(); FX.confetti(); buzz([20, 40, 20, 40, 40]);
  openModal(`<h2>${tx('toolsNew')}</h2>
    <div class="tools-new"><span>💡</span><span>🔀</span></div>
    <p>${tx('toolsText')}</p>
    <p class="note">${tx('toolsNote')}</p>
    <button class="big-btn play" id="tlOk"><span class="bb-text"><b>${tx('top')}</b></span></button>`, false);
  $('#tlOk').onclick = () => { closeModal(); then(); };
}
function showSunflowerUnlock(then) {
  S.sunSeen = true; save();
  Sound.sunflower(); FX.sunRain(); buzz([30, 60, 30, 60, 30, 60, 80]);
  openModal(`<div class="sun-big">🌻</div><h2>${tx('sunWin')}</h2>
    <p>${tx('sunWinText')}</p>
    <button class="big-btn gold" id="sunUse"><span class="bb-text"><b>${tx('sunUse')}</b></span></button>
    <button class="link-btn" id="sunLater">${tx('sunLater')}</button>`, false);
  $('#sunUse').onclick = () => { S.theme = 'sunflower'; S.bg = 'sunfield'; save(); applyBg(); applyTheme(); closeModal(); FX.emoji(innerWidth / 2, innerHeight / 2, ['🌻', '🌼', '🐝', '✨'], 16); then(); };
  $('#sunLater').onclick = () => { closeModal(); then(); };
}
function showTrophies(list, then) {
  Sound.trophy(); FX.confetti(); buzz([20, 40, 20, 40, 60]);
  openModal(`<h2>${tx('newTrophies', list.length)}</h2>
    <div class="tr-new">${list.map(t => `<div class="trn"><span>${t.ico}</span><div><b>${t.name}</b><small>${t.desc}</small></div></div>`).join('')}</div>
    <button class="big-btn play" id="trOk"><span class="bb-text"><b>${tx('hooray')}</b></span></button>
    <button class="link-btn" id="trSee">${tx('seeCabinet')}</button>`, false);
  $('#trOk').onclick = () => { closeModal(); then(); };
  $('#trSee').onclick = () => { closeModal(); show('trophies'); };
}

// new backgrounds: only a message, picking one is done in Thema's (only the Zonnebloem prize gets a 'use now' button)
function showUnlock(list, then) {
  const bg = list.shift();
  Sound.unlock(); FX.confetti();
  const next = () => { closeModal(); if (list.length) showUnlock(list, then); else then(); };
  openModal(`<h2>${tx('newBg')}</h2><p>${tx('newBgText', bg.name)}</p>
    <div class="unlock-pv" style="background:${bg.css}"></div>
    <p style="font-size:18px">${tx('newBgWhere')}</p>
    <button class="big-btn play" id="uOk"><span class="bb-text"><b>${tx('fun')}</b></span></button>`, false);
  $('#uOk').onclick = next;
}
