// uses: rules, core/*, board, family/week, family/presence
/* Oma's Mahjong — core/save: the saved progress (S), its counters, the family settings and "redo from level n". */
'use strict';

const STORE = 'omamj.v1', CUR = 'omamj.cur';
const APP_VERSION = '1.77';
// (the one-time wipe of 2026-10-07 is gone from the code; its key omamj.reset stays in old saves and is ignored)

// the saved progress; every list and counter exists from the start, so code never has to check
const defaults = () => ({
  level: 1, stars: {}, daily: {}, theme: 'classic', bg: 'jade', frame: 'none',
  sfx: true, music: true, vibrate: true, highlight: true, nums: true,
  seenIntro: false, sunSeen: false, seenSp: {},
  matches: 0, bestCombo: 0, bestStreak: 0, winStreak: 0, bonusStars: 0, bonusPts: 0, weekWins: 0,
  stats: {}, trophies: {}, att: {}, fails: {}, czLoss: {}, proSeen: {}, lvlPts: {}, dayPts: {},
  heartsSent: {}, heartsSeen: {}, heartsOut: {}, pendingHearts: [],
});
let S;
try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { S = defaults(); }
delete S.contrast;   // drop the retired preference from older saved games
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { } };
// 👵 Super-omamodus (grandma, or switched on the dashboard); each part of it can also be on by itself
const careMode = () => isCarePlayer(S.pid, S.name, S.cfg || {});
const part = id => partOn(id, S.pid, S.name, S.cfg || {});
// this player's settings from the family dashboard (grandma mode); kept on the phone for offline starts
async function loadCfg() {
  if (!DB_URL || !S.pid) return;
  try {
    const c = playerCfg(Object.values(await dbGet(`plays/${cfgKey(cfgPid(S.pid))}`) || {}));
    if (JSON.stringify(c) === JSON.stringify(S.cfg || {})) return;
    S.cfg = c; save();
    if (typeof G !== 'undefined' && G && G.rp) replayMark('help', help());
    applyRedo(c);
    if (typeof curScreen !== 'undefined' && curScreen === 'home') renderHome();
  } catch (e) { }
}
/* "Redo from level n" (set on the dashboard or by hand): the player goes back to level n; stars,
   points and tries of level n and up are wiped, once per request (redoId). */
function applyRedo(c) {
  const n = +c.redo;
  if (!n || !c.redoId || S.redoDone === c.redoId) return;
  S.redoDone = c.redoId;
  if (S.level > n) S.level = n;
  const lvOf = k => +String(k).replace(/^L/, '');
  for (const o of [S.stars, S.lvlPts, S.att, S.fails]) for (const k of Object.keys(o || {})) if (/^L?\d+$/.test(k) && lvOf(k) >= n) delete o[k];
  try { const cur = JSON.parse(localStorage.getItem(CUR) || 'null'); if (cur && /^L\d+$/.test(cur.key) && lvOf(cur.key) >= n) localStorage.removeItem(CUR); } catch (e) { }
  save();
  try { logEvt('redo', { from: n }); pushScore(); } catch (e) { }
  if (typeof curScreen !== 'undefined' && curScreen === 'home') renderHome();
}
const help = () => helpFor(S.pid, S.name, S.cfg || {});


const totalStars = () => sum(S.stars) + sum(S.daily) + S.bonusStars;
function streak() {
  const d = new Date();
  if (!S.daily[dkey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (S.daily[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function bumpStat(k, n = 1) { if (G && G.film) return;   // (the intro film counts nothing: js/intro.js)
  S.stats[k] = (S.stats[k] || 0) + n; }
// extra stars and points outside a level (tasks, chest, gift, streak); points also count for the week
function giveBonus(stars = 0, pts = 0) { S.bonusStars += stars; S.bonusPts += pts; if (pts) ensureWeek().pts += pts; }
