// uses: features/shop/shop, rules, core/*, board, family/week, family/presence, rewards/*
/* Oma's Mahjong — core/save: the saved progress (S) and its counters. */
'use strict';

const STORE = 'omamj.v1', CUR = 'omamj.cur';
const APP_VERSION = '1.85';
// (the one-time wipe of 2026-10-07 is gone from the code; its key omamj.reset stays in old saves and is ignored)

const defaults = ShopEconomy.econDefaults;
let savedProgress;
try { savedProgress = localStorage.getItem(STORE); } catch { }
const progress = ShopEconomy.loadAndMigrateSave(savedProgress);
let S = progress.S;
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); return true; } catch (e) { return false; } };   // true when stored (the shop waits for it before a gift counts as paid)
if (progress.migrated) save();

const totalStars = () => sum(S.stars) + sum(S.daily) + S.bonusStars;
function mainLevelStars(level) {
  return Math.min(3, Math.floor(Math.max(0, Number(S.stars[level]) || 0, Number(S.stars['L' + level]) || 0)));
}
function mainStars() {
  let total = 0;
  for (let level = 1; level < S.level; level++) total += mainLevelStars(level);
  return total;
}

function bumpStat(k, n = 1) { if (G && G.film) return;   // (the intro film counts nothing: js/intro.js)
  S.stats[k] = (S.stats[k] || 0) + n; }
// extra stars and points outside a level (tasks, chest, gift, streak); points also count for the week
function giveBonus(stars = 0, pts = 0) { S.bonusStars += stars; S.bonusPts += pts; }
