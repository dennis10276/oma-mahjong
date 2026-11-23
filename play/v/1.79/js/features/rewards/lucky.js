// uses: core/*, rules, lang, board
/* Oma's Mahjong — rewards/lucky: the lucky moment: a glittering tile worth extra points if taken quickly. */
'use strict';

// ---------- the lucky moment: a glittering tile worth extra points if taken quickly ----------
const LUCKY_MS = 15000;
function maybeLucky() {
  const L = help().lucky;
  if (!G || G.done || G.lucky || (G.luckyN || 0) >= L.perLevel) return;
  if ((G.mode === 'level' ? G.level : S.level) < L.fromLevel) return;
  const n = G.tiles.length, left = aliveCount();
  if (left > n * 0.8 || left < 6 || Math.random() > L.chance) return;
  const tf = new Set(G.tray.map(faceOf));
  const freeUp = [];
  for (let i = 0; i < n; i++) if (G.alive[i] && !G.down[i] && canTake(i) && faceOf(i) < 100) freeUp.push(i);
  const cand = freeUp.filter(i => tf.has(faceOf(i)) || freeUp.some(j => j !== i && faceOf(j) === faceOf(i)));
  if (!cand.length) return;
  const i = cand[Math.floor(Math.random() * cand.length)];
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
