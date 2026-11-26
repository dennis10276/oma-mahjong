// uses: core/*, lang, trophies
/* Oma's Mahjong — trophies/screen: the prize cabinet: statistics and the trophy grid. */
'use strict';

// ---------- statistics (prize cabinet) ----------
function fmtTime(sec) { return tx('hoursMin', Math.floor(sec / 3600), Math.round(sec % 3600 / 60)); }
const daysText = n => tx('days', n);
function statsHTML() {
  const st = S.stats;
  const items = [
    ['🧩', 'st_levels', S.level - 1], ['⭐', 'st_stars', totalStars()], ['🀄', 'st_pairs', S.matches],
    ['🏆', 'st_cups', st.cups || 0], ['📅', 'st_daily', Object.keys(S.daily).length], ['🔥', 'st_streak', daysText(S.bestStreak)],
    ['⚡', 'st_flows', st.flows || 0], ['⏱️', 'st_time', fmtTime(st.playSec || 0)], ['🎁', 'st_chests', st.chests || 0],
    ['💛', 'st_hearts', st.hearts || 0], ['🍀', 'st_lucky', st.lucky || 0], ['🥇', 'st_weeks', S.weekWins],
  ].map(([i, k, v]) => [i, tx(k), v]);
  return `<div class="stats-card"><h3>${tx('myStats')}</h3><div class="stats-grid">${items.map(([i, l, v]) => `<div class="stat"><span>${i}</span><b>${v}</b><small>${l}</small></div>`).join('')}</div></div>`;
}
function renderTrophies() {
  $('#statsBox').innerHTML = statsHTML();
  $('#trCount').textContent = `🏅 ${trophyCount()}/${TROPHIES.length}`;
  $('#trophyGrid').innerHTML = TROPHIES.map(t => {
    const got = S.trophies[t.id];
    const [v, n] = t.prog();
    return `<div class="trophy${got ? ' got' : ''}"><span class="t-ico">${t.ico}</span><b>${fx('tr_' + t.id)}</b><small>${fx('tr_' + t.id + '_d')}</small>${got ? `<em>${tx('won')}</em>` : `<span class="bar"><i style="width:${Math.round(Math.min(1, v / n) * 100)}%"></i></span><em>${Math.min(v, n)} / ${n}</em>`}</div>`;
  }).join('');
}
