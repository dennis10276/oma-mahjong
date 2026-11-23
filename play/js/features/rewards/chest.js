// uses: core/*, rules, lang, tasks
/* Oma's Mahjong — rewards/chest: the chest that opens when the three daily tasks are done. */
'use strict';

const chestPts = () => { const c = RULES.chest; return c.pts + Math.min(c.maxSteps, Math.floor((S.level - 1) / 10)) * c.ptsPer10Levels; };
function openChest() {
  const T = ensureTasks();
  if (T.chest) return;
  T.chest = true;
  const pts = chestPts(), stars = RULES.chest.stars;
  giveBonus(stars, pts);
  bumpStat('chests'); save(); pushScore();
  logEvt('chest', { pts });
  Sound.trophy(); FX.confetti(); buzz([30, 60, 30, 60, 80]);
  openModal(`<div class="chest-open"><span class="lid">🎁</span></div><h2>${tx('chestTitle')}</h2>
    <div class="chest-loot"><div>💰<b>+${pts}</b><small>${tx('ptsWord')}</small></div><div>⭐<b>+${stars}</b><small>${tx('starsWord')}</small></div></div>
    <p class="note">${tx('newTasksTomorrow')}</p>
    <button class="big-btn play" id="chOk"><span class="bb-text"><b>${tx('hooray')}</b></span></button>`, false);
  setTimeout(() => FX.emoji(innerWidth / 2, innerHeight * 0.35, ['⭐', '💰', '✨', '🎉'], 16), 250);
  $('#chOk').onclick = () => { closeModal(); renderHome(); };
}
