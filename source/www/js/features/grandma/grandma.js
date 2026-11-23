// uses: core/*, rules, board, redo
/* Oma's Mahjong — grandma/grandma: Super-omamodus (care mode), its parts, and the settings from the dashboard. */
'use strict';

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
const help = () => helpFor(S.pid, S.name, S.cfg || {});
