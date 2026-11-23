// uses: rules, core/*, board, family/week, family/presence, rewards/*
/* Oma's Mahjong — core/save: the saved progress (S) and its counters. */
'use strict';

const STORE = 'omamj.v1', CUR = 'omamj.cur';
const APP_VERSION = '1.78';
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


const totalStars = () => sum(S.stars) + sum(S.daily) + S.bonusStars;

function bumpStat(k, n = 1) { if (G && G.film) return;   // (the intro film counts nothing: js/intro.js)
  S.stats[k] = (S.stats[k] || 0) + n; }
// extra stars and points outside a level (tasks, chest, gift, streak); points also count for the week
function giveBonus(stars = 0, pts = 0) { S.bonusStars += stars; S.bonusPts += pts; if (pts) ensureWeek().pts += pts; }
