// uses: core/*, rules, lang, family/*, win
/* Oma's Mahjong — family/ranking: the ranking list and its screen, rows, the family at a glance, the climb animation. */
'use strict';

// ---------- ranking (real family players) ----------
const LB_CACHE = 'omamj.lb';
// v = my weekly points (week) or my level (all-time); undefined = my current value
function myEntry(v, mode = 'all') {
  const all = mode !== 'week';
  return { id: S.pid, name: S.name || tx('you'), avatar: S.avatar || '😊', frame: S.frame || 'none', points: all ? myPoints() : (v ?? myWeekPts()), level: all ? (v ?? S.level) : S.level, me: true, title: S.title || '', perfect: !perfectBlockers().length && S.level > 1 };
}
function onlineEntries(mode = 'all', weekId) {
  let list = [];
  try { list = (JSON.parse(localStorage.getItem(LB_CACHE) || '[]') || []).filter(e => e.id !== S.pid && !hiddenFromRanking(e.id, e.name)); } catch (e) { }
  if (mode === 'week') { const id = weekId || weekInfo().id; list = list.map(e => ({ ...e, points: e.wk === id && e.wkV === 2 ? (e.wkPts || 0) : 0 })); }
  return list;
}
/* week = points this week; all-time ("All-time") = highest level, points only break a tie */
function ranking(v, mode = 'all') {
  const list = [...onlineEntries(mode), myEntry(v, mode)];
  // on a tie you are placed above the other player
  if (mode === 'week') list.sort((a, b) => b.points - a.points || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  else list.sort((a, b) => b.level - a.level || b.points - a.points || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  return list;
}
const myRank = (v, mode = 'all') => ranking(v, mode).findIndex(e => e.me) + 1;
const isFam = e => !e.bot && !e.me;
// value shown on the right of a row
const rowVal = (e, mode) => mode === 'week' ? fmtN(e.points) : tx('levelWord', e.level);
/* the family (real players) at a glance: everyone with their place */
function famHTML(mode, list, title = tx('family'), withHearts = false, activity = false) {
  list = list || ranking(undefined, mode);
  const fam = list.map((e, i) => ({ e, r: i + 1 })).filter(x => !x.e.bot);
  if (fam.length < 2) return '';
  const mine = fam.findIndex(x => x.e.me);
  const limit = innerHeight < 740 ? 3 : 6;
  const visible = activity && fam.length > limit ? fam.slice(Math.max(0, Math.min(mine - 1, fam.length - limit)), Math.max(0, Math.min(mine - 1, fam.length - limit)) + limit) : fam;
  return `<div class="fam-box${activity ? ' win-family' : ''}"><div class="fam-title">${title}</div>${visible.map(({ e, r }) => {
    const presence = presenceOf(e), heart = withHearts && !e.me ? heartBtn(e) : '';
    const avatar = avatarHTML(e, 'ra', presence?.online);
    return `<div class="fam-row${e.me ? ' me' : ''}"><span class="fr-rank">${medal(r)}</span>${avatar}<span class="fr-name">${esc(e.name)}${e.me ? ` <i>${tx('youTag')}</i>` : ''}<small class="fr-sub">${mode === 'week' ? `🧩 ${tx('levelWord', e.level)}` : tx('points', fmtN(e.points))}${presenceSubHTML(presence)}</small>${!e.me && !activity ? heartState(e.id) : ''}</span><span class="fr-val">${activity ? `${heart}<span class="points">${rowVal(e, mode)}</span>` : `${rowVal(e, mode)}${heart}`}</span></div>`;
  }).join('')}</div>`;
}

function rowHTML(e, rank, mode) {
  const presence = presenceOf(e);
  const sub = mode === 'week' ? tx('levelWord', e.level) : tx('points', fmtN(e.points));
  const name = esc(e.name) + (e.me ? ` <i>${tx('youTag')}</i>` : ' <i class="fam-tag">👪</i>');
  return `<span class="rk">${medal(rank)}</span>${avatarHTML(e, 'ra', presence?.online)}<span class="rn">${name}<small>${sub + presenceSubHTML(presence, !!sub)}</small></span><span class="rp">${rowVal(e, mode)}</span>`;
}
let rankMode = 'week';
/* ---------- the ranking page: a tile (week cup or the all-time Perfect goal) and the pink block of rows ---------- */
// The completed levels that can still improve toward PERFECT.
function perfectBlockers() {
  const blockers = [];
  for (let l = 1; l < S.level; l++) if (mainLevelStars(l) < 3) blockers.push(l);
  return blockers;
}
// The same badge is sized by its context. The badge's inner pill carries the shine.
const perfectSticker = (cls = '') => `<span class="pf pf-w2${cls ? ' ' + cls : ''}"><span class="pf-in">PERFECT</span></span>`;
function showPerfectPlaque(entry) {
  const blockers = perfectBlockers().length, nudge = blockers > 0 && blockers <= 5;
  openModal(`<div class="perfect-plaque"><div class="plaque-stars">⭐⭐⭐</div>${perfectSticker('pf-hero')}<h2>${esc(entry.name)}</h2>
    <p>${tx('perfectPlaqueText', entry.level - 1)}</p>
    ${nudge ? `<p class="plaque-nudge"><span>${tx('perfectPlaqueNudge', blockers)}</span>${perfectSticker()}</p>
      <button class="big-btn play" id="pfReplay"><span class="bb-text"><b>${fx('perfectPlaquePlay', blockers)}</b></span></button>` : ''}
    <button class="link-btn" id="pfClose">${tx('close')}</button></div>`);
  $('#pfClose').onclick = closeModal;
  if (nudge) $('#pfReplay').onclick = () => { closeModal(); show('levels', { missingStars: true }); };
}
const titleOf = e => { const it = e.title && SHOP_CATALOG.title.find(x => x.id === e.title); return it ? `${it.icon} ${isEn() ? it.en : it.nl}` : ''; };
const cupName = c => ['bronze', 'silver', 'gold', 'diamond'].includes(c.id) ? tx('cup_' + c.id) : tx('cup_extra');
function weekTileHTML(list) {
  const g = WeekEconomy.getCupGoalState(S), tiers = SHOP_RULES.cups.tiers, max = tiers[tiers.length - 1].pt;
  const place = list.findIndex(e => e.me) + 1;
  const now = `${g.currentTier ? `${g.currentTier.ico} ${tx('cupHave', cupName(g.currentTier))}` : tx('cupNone')} · ${tx('points', fmtN(g.pts))} · ${tx('rankYouAre', place)}`;
  return `<div class="week-tile"><div class="wt-top"><span>${tx('cupWeek')}</span><span class="wt-end">${tx('cupEnds')}</span></div>
    <div class="wgoal"><span class="next">${g.nextTier.ico}</span><div class="gt"><b>${tx('cupToGo', g.ptsToNext)}</b><small>${tx('cupUntil', cupName(g.nextTier))}</small></div><span class="rew">+${g.nextCoins} 🪙</span></div>
    <div class="track"><i style="width:${Math.min(100, g.pts / max * 100)}%"></i>${tiers.map(t => `<span class="cupmark${g.pts >= t.pt ? '' : ' not'}" style="left:${t.pt / max * 100}%">${t.ico}</span>`).join('')}</div>
    <div class="now">${now}</div></div>`;
}
function allTileHTML(list) {
  const blockers = S.level > 1 ? perfectBlockers().length : 1, total = Math.max(1, S.level - 1), done = total - blockers;
  const place = list.findIndex(e => e.me) + 1;
  const dots = Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(done / total * 10) ? '' : 'not'}"></i>`).join('');
  const goal = blockers ? `<b>${tx('tileToGo', blockers)}</b><small>${tx('tileWith3')}</small>` : `<b>${tx('tileYouAre')}</b><small>${tx('tileAll3')}</small>`;
  return `<div class="week-tile"><div class="wt-top"><span>${tx('tileTitle')}</span><span class="wt-end">${tx('rankYouAre', place)}</span></div>
    <div class="wgoal"><div class="gt">${goal}</div><span class="medrew plain">${perfectSticker()}</span></div>
    <div class="dots">${dots}</div>
    <div class="foot"><span class="now">${tx('tileDone', done, total)}</span><button class="go" id="rkPlay">${tx('tilePlay')}</button></div></div>`;
}
// a ranking row: place · photo · name (jij) PERFECT / shop title · presence · points or level · heart
function rankRowHTML(e, rank, mode) {
  const presence = presenceOf(e), title = titleOf(e);
  const sub = [title, presence ? `<span class="${presence.online ? 'presence-text' : 'presence-last'}">${presence.text}</span>` : '', isFam(e) ? heartSeenShort(e.id) : ''].filter(Boolean).join(' · ');
  const val = mode === 'week' ? `<span class="rp">${fmtN(e.points)}</span>` : `<span class="rp lvl"><small>level</small>${e.level}</span>`;
  const badge = e.perfect ? `<button class="pf-button" data-perfect="${esc(e.id)}" aria-label="PERFECT · ${esc(e.name)}">${perfectSticker()}</button>` : '';
  return `<div class="rrow tight${e.me ? ' me' : ''}${isFam(e) ? ' fam' : ''}"><span class="rk">${medal(rank)}</span>${avatarHTML(e, 'ra', presence?.online)}<span class="rn"><span class="nm1"><span class="nmt">${esc(e.name)}</span>${e.me ? `<i>${tx('youTag')}</i>` : ''}${badge}</span><small>${sub || '&nbsp;'}</small></span>${val}<span class="hb">${isFam(e) ? heartBtn(e) : ''}</span></div>`;
}
const rankPageHTML = mode => {
  const list = ranking(undefined, mode);
  return `${mode === 'week' ? weekTileHTML(list) : allTileHTML(list)}<div class="rank-block"><div class="rl-scroll">${list.map((e, i) => rankRowHTML(e, i + 1, mode)).join('')}</div></div>`;
};
// the buttons inside a page (hearts, Speel)
function bindRankPage(root) {
  root.querySelectorAll('.heart-btn').forEach(b => b.onclick = ev => { ev.stopPropagation(); sendHeart(b.dataset.pid, b.dataset.name, b); });
  root.querySelectorAll('[data-perfect]').forEach(b => b.onclick = () => {
    const player = ranking(undefined, rankMode).find(entry => entry.id === b.dataset.perfect);
    if (player?.perfect) showPerfectPlaque(player);
  });
  const play = root.querySelector('#rkPlay');
  if (play) play.onclick = () => show('levels', { missingStars: perfectBlockers().length > 0 });
}

function bindRankingNavigation() {
  const viewport = $('#rankViewport'), current = $('#rankList'), next = $('#rankNext'), tabs = $('#ranking .rk-tabs');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const position = mode => mode === 'week' ? 0 : 1;
  let touch = null, motion = null;

  function paint(progress) {
    motion.progress = progress;
    const offset = (position(rankMode) - progress) * motion.stride;
    viewport.style.setProperty('--rank-x', offset + 'px');
    tabs.style.setProperty('--rank-slide', progress);
    tabs.dataset.spot = progress < .5 ? 'week' : 'all';
  }
  function prepare() {
    const origin = position(rankMode);
    motion = { mode: origin === 0 ? 'all' : 'week', stride: viewport.clientWidth + 8, settling: false };
    next.innerHTML = rankPageHTML(motion.mode);
    viewport.style.setProperty('--rank-side', (origin === 0 ? motion.stride : -motion.stride) + 'px');
    next.hidden = false;
    viewport.classList.add('rank-moving');
    paint(origin);
  }
  function finish(mode) {
    clearTimeout(motion.timer);
    motion = null;
    rankMode = mode;
    viewport.classList.remove('rank-moving', 'rank-settling');
    viewport.style.removeProperty('--rank-x');
    viewport.style.removeProperty('--rank-side');
    tabs.classList.remove('rank-settling');
    tabs.style.removeProperty('--rank-slide');
    next.hidden = true;
    next.replaceChildren();
    if (curScreen === 'ranking') renderRanking();
  }
  function settle(commit) {
    if (!motion || motion.settling) return;
    const mode = commit ? motion.mode : rankMode, target = position(mode);
    if (reduceMotion.matches || motion.progress === target) { finish(mode); return; }
    motion.settling = true;
    // Establish the drag position before adding a transition, including on a direct tab tap.
    viewport.getBoundingClientRect();
    viewport.classList.add('rank-settling');
    tabs.classList.add('rank-settling');
    paint(target);
    motion.done = () => finish(mode);
    motion.timer = setTimeout(motion.done, 340);
  }
  current.addEventListener('transitionend', e => {
    if (e.target === current && e.propertyName === 'transform') motion?.done?.();
  });
  function switchTab(mode) {
    if (mode === rankMode || motion) return;
    prepare();
    settle(true);
  }
  $('#rkWeek').onclick = () => switchTab('week');
  $('#rkAll').onclick = () => switchTab('all');

  function cancelTouch() { touch = null; settle(false); }
  viewport.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { cancelTouch(); return; }
    if (!motion && modalFree()) {
      const { identifier, clientX, clientY } = e.touches[0];
      touch = { identifier, clientX, clientY, horizontal: false };
    }
  }, { passive: true });
  viewport.addEventListener('touchmove', e => {
    if (!touch) return;
    if (e.touches.length !== 1) { cancelTouch(); return; }
    const moving = e.touches[0];
    if (moving.identifier !== touch.identifier) return;
    const dx = moving.clientX - touch.clientX, dy = moving.clientY - touch.clientY;
    if (!touch.horizontal) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { cancelTouch(); return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
      touch.horizontal = true;
    }
    const towardOther = rankMode === 'week' ? dx < 0 : dx > 0;
    if (!motion && towardOther) prepare();
    if (motion) paint(Math.max(0, Math.min(1, position(rankMode) - dx / motion.stride)));
  }, { passive: true });
  viewport.addEventListener('touchcancel', cancelTouch);
  viewport.addEventListener('touchend', e => {
    const start = touch;
    touch = null;
    if (e.touches.length) { settle(false); return; }
    if (!start?.horizontal) return;
    if (e.cancelable) e.preventDefault();
    if (!motion) return;
    const travel = Math.abs(motion.progress - position(rankMode)) * motion.stride;
    const threshold = 24;
    settle(curScreen === 'ranking' && modalFree() && travel >= threshold);
  }, { passive: false });
}

function renderRanking() {
  if ($('#rankViewport').classList.contains('rank-moving')) return;
  ensureId(); ensureWeek();
  const tabs = $('#ranking .rk-tabs');
  tabs.dataset.mode = tabs.dataset.spot = rankMode;
  for (const [id, mode] of [['#rkWeek', 'week'], ['#rkAll', 'all']]) {
    $(id).classList.toggle('on', rankMode === mode);
    $(id).setAttribute('aria-pressed', rankMode === mode);
  }

  const rankList = $('#rankList'), keep = rankList.querySelector('.rl-scroll')?.scrollTop || 0;
  rankList.innerHTML = rankPageHTML(rankMode);
  bindRankPage(rankList);
  const rows = rankList.querySelector('.rl-scroll');
  if (rows) rows.scrollTop = keep;
  const online = !!DB_URL;
  $('#rankName').innerHTML = avatarHTML(myEntry(0), 'ra small');
  $('#rankName').setAttribute('aria-label', tx('rankProfile'));
  $('#rankName').title = S.name || tx('pickName');

  if (online && (!S.lbOnlineAt || Date.now() - S.lbOnlineAt > 20000)) fetchOnline().then(ok => { if (ok && curScreen === 'ranking') renderRanking(); });
  if (online && Date.now() - (sentCheckAt || 0) > 8000) { sentCheckAt = Date.now(); checkSentHearts().then(ch => { if (ch && curScreen === 'ranking') renderRanking(); }); }
}

/* The dopamine moment: your row climbs past the people you just overtook. */
function showClimb(oldPts, newPts, then, mode = 'all') {
  const before = ranking(oldPts, mode), after = ranking(newPts, mode);
  const oldRank = before.findIndex(e => e.me) + 1, newRank = after.findIndex(e => e.me) + 1;
  const passed = after.slice(newRank, oldRank);          // the people you overtook (closest last)
  const above = after[newRank - 2];                       // the next target
  const show = passed.slice(-3);                          // animate at most 3 overtakes (fits on the screen)
  const rows = [...(above ? [above] : []), ...show];
  const RH = 46;
  const startIdx = (above ? 1 : 0) + show.length;         // where your row starts (below the others)
  const offset = passed.length - show.length;             // overtakes too far up to animate
  // rank shown on a row: before being overtaken it is one place higher than at the end
  const rankOf = (k, done) => {
    if (above && k === 0) return newRank - 1;
    const j = k - (above ? 1 : 0);
    const finalRank = newRank + offset + j + 1;
    return done ? finalRank : finalRank - 1;
  };
  openModal(`<h2>${tx(mode === 'week' ? 'climbWeek' : 'climbAll')}</h2>
    <div class="climb" style="height:${(rows.length + 1) * RH}px">
      ${rows.map((e, k) => `<div class="rrow crow${isFam(e) ? ' fam' : ''}" data-k="${k}" style="transform:translateY(${k * RH}px)">${rowHTML(e, rankOf(k, false), mode)}</div>`).join('')}
      <div class="rrow me crow" id="meRow" style="transform:translateY(${startIdx * RH}px)">${rowHTML(myEntry(oldPts, mode), oldRank, mode)}</div>
    </div>
    <div class="climb-msg" id="climbMsg">&nbsp;</div>
    <button class="big-btn play" id="clOk"><span class="bb-text"><b>${tx('next')}</b></span></button>`, false, null, 'compact');
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
    victim.querySelector('.rk').textContent = medal(rankOf(victimIdx, true));
    const rank = oldRank - (passed.length - show.length) - k;
    me.querySelector('.rk').textContent = medal(rank);
    const pts = Math.round(oldPts + (newPts - oldPts) * k / steps);
    me.querySelector('.rp').textContent = mode === 'week' ? fmtN(pts) : tx('levelWord', pts);
    Sound.pass(k); buzz(15);
    const r = me.getBoundingClientRect(); FX.burst(r.left + r.width * 0.15, r.top + r.height / 2, 10);
    setTimeout(step, stepTime);
  }
  function finish() {
    if (stopped || !$('#climbMsg')) return;
    me.style.transform = `translateY(${pos * RH}px)`;
    me.querySelector('.rp').textContent = mode === 'week' ? fmtN(newPts) : tx('levelWord', newPts);
    me.querySelector('.rk').textContent = medal(newRank);
    me.classList.add('glow');
    Sound.rankUp(); FX.confetti(); buzz([30, 50, 30, 50, 60]);
    const n = passed.length;
    const who = n === 1 ? tx('passedOne', esc(passed[0].name)) : tx('passedMany', n);
    const gap = mode === 'week' ? tx('points', fmtN(above ? above.points - newPts + 1 : 0)) : (above ? tx('levelsN', above.level - newPts + 1) : '');
    const nxt = above ? `<br><small>${tx('gapTo', gap, above.avatar + ' ' + esc(above.name))}</small>` : `<br><small>${tx('onTop')}</small>`;
    const wk = mode === 'week' ? `<br><small>${tx('weekEnds', weekLeftText())}</small>` : '';
    $('#climbMsg').innerHTML = `<span class="climb-up">#${oldRank} → #${newRank} ⬆</span><br>${who}${nxt}${wk}`;
  }
  setTimeout(() => { if (!stopped) step(); }, 650);
}
