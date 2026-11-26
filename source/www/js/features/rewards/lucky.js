// uses: core/*, rules, lang, board
/* Oma's Mahjong — rewards/lucky: the lucky moment: a glittering tile worth extra points if taken quickly. */
'use strict';

// ---------- the lucky moment: a glittering tile worth extra points if taken quickly ----------
const LUCKY_MS = 15000;
function maybeLucky() {
  if (!G) return;
  const L = help().lucky;
  // the tested picker rolls the chance first, runs the quiet solver only when Lucky would fire (30 ms limit), and skips flights, traps and a full tray
  const i = PrepBoard.pickSafeLuckyTile(G, { perLevel: L.perLevel, fromLevel: L.fromLevel, chance: L.chance, playerLevel: S.level, takeableFn: canTake });
  if (i == null) return;
  G.lucky = { i, until: Date.now() + LUCKY_MS }; G.luckyN = (G.luckyN || 0) + 1;
  replayMark('lucky', [i, LUCKY_MS]);
  glow(i, 'lucky', true);
  toast(tx('lucky'), 4000);
  Sound.hint();
  setTimeout(() => { if (G && G.lucky && G.lucky.i === i) { glow(i, 'lucky', false); G.lucky = null; } }, LUCKY_MS);
}
function luckyTaken(i) {
  if (!G.lucky || G.lucky.i !== i) return;
  const ok = Date.now() <= G.lucky.until;
  glow(i, 'lucky', false);
  G.lucky = null;
  if (!ok) return;
  const pts = RULES.score.lucky, c = centerOf(G.tiles[i].el);
  G.score += pts; updateScore(); bumpStat('lucky');
  setTimeout(() => { praise(tx('luckyGot', pts)); Sound.perfect(); FX.emoji(c.x || innerWidth / 2, c.y || innerHeight / 2, ['🍀', '✨', '🌟'], 12); }, 300);
}
