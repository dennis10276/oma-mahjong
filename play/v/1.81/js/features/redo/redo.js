// uses: core/*, family/presence
/* Oma's Mahjong — redo/redo: "redo from level n", set on the dashboard. */
'use strict';

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
