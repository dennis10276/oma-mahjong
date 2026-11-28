// uses: core/*, rules, lang, board
/* Oma's Mahjong — rewards/lucky: a glittering tile worth coins on an eligible board. */
'use strict';

// ---------- the lucky moment ----------
const LUCKY_MS = 15000;
function maybeLucky() {
  if (!G) return;
  const L = help().lucky;
  // the tested picker rolls the chance first, runs the quiet solver only when Lucky would fire (30 ms limit), and skips flights, traps and a full tray
  const i = PrepBoard.pickSafeLuckyTile(G, { perLevel: L.perLevel, fromLevel: L.fromLevel, chance: L.chance, playerLevel: S.level, takeableFn: canTake });
  if (i == null) return;
  const lucky = G.lucky = { i, until: Date.now() + LUCKY_MS }; G.luckyN = (G.luckyN || 0) + 1;
  replayMark('lucky', [i, LUCKY_MS]);
  glow(i, 'lucky', true);
  toast(tx('lucky'), 4000);
  Sound.hint();
  saveCur();
  setTimeout(() => { if (G?.lucky === lucky) clearLucky(); }, LUCKY_MS);
}
function clearLucky() {
  if (!G?.lucky) return;
  glow(G.lucky.i, 'lucky', false);
  G.lucky = null;
}
function luckyTaken(i) {
  if (!G.lucky || G.lucky.i !== i) return;
  const ok = Date.now() <= G.lucky.until;
  clearLucky();
  if (!ok) return;
  const pts = RULES.score.lucky, c = centerOf(G.tiles[i].el);
  const coins = boardCoinEligible() ? SHOP_RULES.coins.lucky : 0;
  G.score += pts;
  G.boardCoins += coins;
  updatePurse(Boolean(coins)); bumpStat('lucky');
  setTimeout(() => { praise(tx('luckyGot', coins)); Sound.perfect(); FX.emoji(c.x || innerWidth / 2, c.y || innerHeight / 2, ['🍀', '✨', '🌟'], 12); }, 300);
}
