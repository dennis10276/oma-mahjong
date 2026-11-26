// uses: core/*, rules, lang, board, looks, trophies, rewards/*, family/*
/* Oma's Mahjong — finishing a level: the win screen and the rewards that follow it. */
'use strict';

// ---------- winning ----------
/* 3 stars, one less for each help used: hint, shuffle, putting the tray back.
   (Planned: hints, shuffles and jokers bought in a shop; each bought joker used on a pair will cost a
   star too, a joker that finishes the level will not. Count them here, e.g. G.boughtJokersUsed.) */
const starsFor = G => Math.max(1, 3 - [G.usedHint, G.usedShuffle, G.rescued].filter(Boolean).length - (G.boughtJokersUsed || 0));
let winFamilyRefresh = null;
addEventListener('resize', () => { if (winFamilyRefresh) winFamilyRefresh(); });

function win() {
  if (G.winSettled) return;
  G.winSettled = true;
  syncClock(); G.tStart = 0;
  if (G.autoFin) autoBanner(false);
  clearCur();
  const stars = starsFor(G);
  G.score += stars * RULES.score.perStar;
  endLevel('win', { st: stars });
  const rankBefore = myRank(undefined, 'all');
  const wkBefore = myWeekPts();
  const today = todayKey(), daily = G.mode === 'daily';
  const prevStars = daily ? S.daily[G.date] : mainLevelStars(G.level);
  const fresh = !G.film && !prevStars && (daily ? G.date === today : G.level === S.level);
  // daily tasks + statistics
  if (G.mode === 'level') taskProgress('levels'); else taskProgress('daily');
  if (stars === 3) taskProgress('stars3');
  if (!G.usedHint && !G.usedShuffle && !G.rescued && (toolsOpen() || toolsGone())) taskProgress('nohelp');
  delete S.fails[G.key];   // won: the next level starts without easier retries
  const streakResult = PrepBoard.stepWinStreak(S, { mode: G.mode, fresh, won: true });
  if (streakResult.changed) {
    S.bestWinStreak = Math.max(S.bestWinStreak || 0, S.winStreak);
    if (streakResult.momentumArmed) S.momentumLevel = G.level + 1;
    else delete S.momentumLevel;
  }
  bumpStat('wins'); bumpStat('playSec', Math.round(G.elapsed));
  const winHour = new Date().getHours();
  if (winHour < 9) bumpStat('earlyWins');
  if (winHour >= 22) bumpStat('nightWins');
  if (G.mode === 'level') S.lvlPts[G.level] = Math.max(S.lvlPts[G.level] || 0, G.score);
  else S.dayPts[G.date] = Math.max(S.dayPts[G.date] || 0, G.score);
  let earnedCoins = 0;
  let weekReward = { ptAdded: 0, weekPts: wkBefore, unlockedCups: [] };
  if (!G.film) {
    const receipt = ShopEconomy.rewardWin(S, {
      mode: G.mode, level: G.level, date: G.date, today, fresh, stars, prevStars, boardCoins: G.boardCoins,
    });
    weekReward = WeekEconomy.awardWin(S, { mode: G.mode, fresh, date: G.date });
    earnedCoins = receipt.total + weekReward.cupCoins;
  }
  const wkAfter = weekReward.weekPts;
  if (G.mode === 'level') {
    const legacyKey = 'L' + G.level;
    const starKey = G.level in S.stars || !(legacyKey in S.stars) ? G.level : legacyKey;
    S.stars[starKey] = Math.max(prevStars, stars);
    if (G.level === S.level) { S.level++; notePassedBaseline(false); }
  } else {
    S.daily[G.date] = Math.max(S.daily[G.date] || 0, stars);
    const s = streak(); if (s > S.bestStreak) S.bestStreak = s;
  }
  const wasSun = S.sunSeen;
  grantSunPrize();
  save();
  const rewards = [];
  ensureId();
  // the weekly challenge moves most, so its climb comes first; otherwise the all-time list
  const wkRankBefore = myRank(wkBefore, 'week'), wkRankAfter = myRank(wkAfter, 'week');
  const rankAfter = myRank(S.level, 'all');
  const climbMode = wkRankAfter < wkRankBefore ? 'week' : rankAfter < rankBefore ? 'all' : null;
  const overtaken = climbMode ? ranking(undefined, climbMode).slice(climbMode === 'week' ? wkRankAfter : rankAfter, climbMode === 'week' ? wkRankBefore : rankBefore) : [];
  const rankChange = climbMode ? `<p class="chase win-rank-up">${tx(climbMode === 'week' ? 'thisWeek' : 'allTime')} · ${tx('winRankUp', climbMode === 'week' ? wkRankBefore : rankBefore, climbMode === 'week' ? wkRankAfter : rankAfter)}${overtaken.length === 1 ? ' · ' + tx('passedOne', esc(overtaken[0].name)) : ''}</p>` : '';
  // the family is always on the win screen, so you see where everyone stands
  const famNow = famHTML('week', ranking(wkAfter, 'week'), tx('famWeek'), true, true);
  pushScore();
  const heartsP = Promise.race([fetchHearts(), new Promise(r => setTimeout(() => r([]), 2500))]);
  const standingsText = () => {
    const list = ranking(wkAfter, 'week'), rank = list.findIndex(e => e.me) + 1;
    const nextUp = list[rank - 2];
    return rankChange || `<p class="chase">${nextUp ? tx('chase', rank, fmtN(nextUp.points - wkAfter + 1), nextUp.avatar + ' ' + esc(nextUp.name)) : tx(list.length > 1 ? 'winLeading' : 'winSolo')}</p>`;
  };
  if (sunUnlocked() && !wasSun) rewards.push({ type: 'sun' });
  if (S.level >= RULES.tools.fromLevel && !S.toolsSeen) rewards.push({ type: 'tools' });
  const tr = newTrophies();
  if (tr.length) rewards.push({ type: 'trophies', list: tr });
  const mins = Math.floor(G.elapsed / 60), secs = Math.round(G.elapsed % 60);
  Sound.win(); FX.confetti(); buzz([30, 60, 30, 60, 60]);
  const titles = tx('winTitles');
  const title = G.mode === 'daily' ? tx('dailyWon') : titles[Math.floor(Math.random() * titles.length)];
  const extra = G.mode === 'daily' ? `<p>🔥 ${tx('daysInRow', streak())}!</p>` : stars < 3 ? `<p class="note">${tx(G.rescued && !G.usedHint && !G.usedShuffle ? 'noRescueStars' : 'noHelpStars')}</p>` : '';
  const nextLevel = daily ? S.level : G.level + 1;
  const nextLbl = tx('nextLevel', nextLevel);
  const cups = weekReward.unlockedCups.map(cup =>
    `<div class="win-cup-reached">${tx('cupReached', cup.ico, cup.id === 'pr' ? tx('weekPersonalBest') : cupName(cup), cup.coins)}</div>`).join('');
  const momentum = streakResult.momentumArmed ? `<div class="win-momentum">${tx('momentumReady', streakResult.winStreak, nextLevel)}</div>` : '';
  setTimeout(() => {
    openModal(`<h2>${title}</h2>
      <div class="stars"><span class="st">★</span><span class="st">★</span><span class="st">★</span></div>
      <div class="win-stats"><div class="win-payout"><b>+${earnedCoins} 🪙 · +${weekReward.ptAdded} pt</b></div><div>${tx('timeWord')}<b>${mins}:${pad(secs)}</b></div></div>
      <div class="perfect" id="wPerfect">${stars === 3 ? perfectSticker() : ''}</div>
      ${cups}${momentum}${extra}<div id="wStanding">${standingsText()}</div><div id="wFamily">${famNow}</div>
      <button class="link-btn" id="wRanking">${tx('fullRanking')}</button>
      <div class="goal" id="wGoal"></div>
      <button class="big-btn play pulse" id="wNext"><span class="bb-text"><b>${nextLbl}</b></span></button>
      <div class="win-links">${daily ? `<button class="link-btn" id="wCalendar">📅 ${tx('dailyCalendar')}</button>` : ''}<button class="link-btn" id="wMenu">${tx('menu')}</button></div>`, false, null, 'compact');
    renderGoal($('#wGoal'));
    const familyNode = $('#wFamily');
    const bindHearts = () => familyNode.querySelectorAll('.heart-btn').forEach(btn => btn.onclick = () => {
      if (sentToday(btn.dataset.pid)) { toast(tx('heartAlreadyShort')); return; }
      const height = parseFloat(getComputedStyle($('#modalBox')).height), resume = keepModal();
      sendHeart(btn.dataset.pid, btn.dataset.name, btn, { height, restore: () => { resume(); winFamilyRefresh(); } });
    });
    winFamilyRefresh = () => {
      if (!$('#wNext') || $('#wFamily') !== familyNode) return;
      familyNode.innerHTML = famHTML('week', ranking(wkAfter, 'week'), tx('famWeek'), true, true);
      $('#wStanding').innerHTML = standingsText();
      bindHearts();
    };
    bindHearts();
    fetchOnline().then(winFamilyRefresh);
    const sts = document.querySelectorAll('.stars .st');
    for (let i = 0; i < stars; i++) setTimeout(() => {
      sts[i].classList.add('on'); Sound.star(i); buzz(20);
      const c = centerOf(sts[i]); FX.burst(c.x, c.y, 26, true);
      if (S.theme === 'sunflower') FX.emoji(c.x, c.y, ['🌻', '✨'], 5);
    }, 450 + i * 420);
    const perfectEl = $('#wPerfect');
    if (stars === 3) setTimeout(() => { perfectEl.classList.add('on'); Sound.perfect(); }, 450 + 3 * 420 + 150);
    const go = (dest) => {
      winFamilyRefresh = null;
      closeModal();
      const finish = () => {
        if (updateReady) {   // a new version is waiting: switch now, then carry on where we were going
          S.afterUpdate = dest === 'next' ? { level: nextLevel } : { show: dest === 'calendar' ? 'daily' : dest === 'ranking' ? 'ranking' : 'home' };
          save(); updateReady = false; toast(tx('newVersion'), 1500);
          return setTimeout(() => location.reload(), 900);
        }
        if (dest === 'next') startLevel(nextLevel);
        else show(dest === 'calendar' ? 'daily' : dest === 'ranking' ? 'ranking' : 'home');
      };
      heartsP.then(fresh => {
        const all = [...S.pendingHearts, ...(fresh || [])];
        if (all.length) { S.pendingHearts = []; save(); rewards.unshift({ type: 'hearts', list: all }); }
        runRewards(rewards, finish);
      });
    };
    if (climbMode) familyNode.querySelector('.me')?.classList.add('win-rank-rise');
    $('#wRanking').onclick = () => go('ranking');
    $('#wNext').onclick = () => go('next');
    $('#wMenu').onclick = () => go('menu');
    if (daily) $('#wCalendar').onclick = () => go('calendar');
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
}
function showToolsUnlock(then) {
  S.toolsSeen = true; save();
  Sound.unlock(); FX.confetti(); buzz([20, 40, 20, 40, 40]);
  openModal(`<h2>${tx('toolsNew')}</h2>
    <div class="tools-new"><span>👁️</span><span>↩️</span></div>
    <p>${tx('toolsText')}</p>
    <p class="note">${tx('toolsNote')}</p>
    <button class="big-btn play" id="tlOk"><span class="bb-text"><b>${tx('top')}</b></span></button>`, false);
  $('#tlOk').onclick = () => { closeModal(); then(); };
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

