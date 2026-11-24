// uses: core/*, rules, lang
/* Oma's Mahjong — rewards/gift: the daily gift: the first visit of the day starts with a present. */
'use strict';

// ---------- the daily gift: the first visit of the day starts with a present ----------
function maybeDailyGift() {
  const day = todayKey();
  if (S.giftDay === day || !S.seenIntro || curScreen !== 'home' || !modalFree()) return;
  if ($('#heartPop') && $('#heartPop').classList.contains('on')) return;
  const roll = Math.random();
  const stars = roll < RULES.dailyGift.twoStarChance ? 2 : 1;
  const coins = roll < SHOP_RULES.dailyGift.bigChance ? SHOP_RULES.dailyGift.big : SHOP_RULES.dailyGift.base;
  openModal(`<div class="gift-box" id="gBox">🎁</div>
    <h2 id="gTitle">${tx('giftTitle')}</h2>
    <p id="gText">${tx('giftText', S.name ? esc(S.name) : '')}</p>
    <button class="big-btn play" id="gOpen"><span class="bb-text"><b>${tx('giftOpen')}</b></span></button>`, false);
  let opened = false;
  const open = () => {
    if (opened || S.giftDay === day) { closeModal(); renderHome(); return; }
    opened = true;
    S.giftDay = day;
    giveBonus(stars); bumpStat('gifts');
    ShopEconomy.addCoins(S, coins);
    save();
    logEvt('gift', { stars });
    Sound.trophy(); FX.confetti(); buzz([20, 40, 20, 40, 60]);
    const b = $('#gBox'); b.textContent = '⭐'.repeat(stars); b.classList.add('open');
    $('#gTitle').textContent = tx('giftStars', stars);
    $('#gText').textContent = tx('giftEnjoy');
    $('#gOpen').innerHTML = `<span class="bb-text"><b>${tx('nice')}</b></span>`;
  };
  $('#gOpen').onclick = open; $('#gBox').onclick = () => { if (!opened) open(); };
}
