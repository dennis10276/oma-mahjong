// uses: core/*, rules, lang, board (toolsEarnLevel, toolsEarned), prizes (sunUnlocked, bgLocked, numBgs)
/* Oma's Mahjong — tips/tips: the "Wist je dat?" tips on the home screen. */
'use strict';
/* "Wist je dat?" (the owner 2026-11-23): gold and the joker are not explained, and there are no tips in a level and none about the joker:
   only the home screen shows a tip (always one that fits the player, a new one each time) */
// the home screen's pool: [the picture on the little tile, lang key, who sees it]; tools open at level L (board.js toolsEarned)
const toolsAt = L => L >= RULES.tools.fromLevel && !(toolsEarnLevel(L) && !toolsEarned(L));
const met = k => () => !!S.seenSp[k];
const HOME_TIPS = [
  ['💡', 'hint', () => toolsAt(S.level)], ['💡', 'hintCost', () => toolsAt(S.level)], ['🔀', 'shuffle', () => toolsAt(S.level)],
  ['⭐', 'toolsBack', () => toolsEarnLevel(S.level) && !toolsAt(S.level)],
  ['📅', 'daily', () => true], ['🔥', 'streak', () => Object.keys(S.daily).length > 0],
  ['🌻', 'sunflower', () => !sunUnlocked()], ['⭐', 'stars', () => numBgs.some(b => bgLocked(b))],
  ['❄️', 'ice', met('ice')], ['🔑', 'lock', met('lock')], ['🀄', 'trayPair', met('trayPair')], ['⏰', 'clock', () => S.seenSp.clock || S.seenSp.clockMoves]];
// one tip: a cream card, the small tile on the left shows what the tip is about
function tipEl(ico, k, extra) {
  const el = document.createElement('div'); el.className = 'tip-box ' + extra;
  el.innerHTML = '<i class="tip-tile">' + ico + '</i><span class="tip-txt"><small>' + tx('tipHead') + '</small><b>' + tx('tip_' + k) + '</b></span>';
  return el;
}
// the home screen's tip under the greeting: one that fits the player, never the same twice in a row (S.lastTip); none if none fits
const homeTips = () => HOME_TIPS.filter(t => t[2]());
function homeTip() {
  const fit = homeTips(), fresh = fit.filter(t => t[1] !== S.lastTip), pool = fresh.length ? fresh : fit, el = $('#homeTip');
  if (!pool.length) { el.hidden = true; return; }
  const t = pool[Math.floor(Math.random() * pool.length)], n = tipEl(t[0], t[1], 'home-tip');
  S.lastTip = t[1]; el.replaceWith(n); n.id = 'homeTip';
}
