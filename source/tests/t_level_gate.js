/* The level lock (RULES.levels.blockedFrom, added by Codex while the harder levels waited for
   approval; Dennis opened them on 2026-10-11, so it is off: null). */
'use strict';

module.exports = [
  {
    name: 'level gate: when switched on (75), 75 and above stay locked, including saved games, for every player',
    async run(t, { click, startLevel }) {
      for (const name of ['Dennis', 'Oma']) {
        const p = await t.phone({ state: { name, pid: 'test-gate-' + name, level: 90, lang: 'en' }, tune: { RULES: { levels: { blockedFrom: 75 } } } });
        await p.evaluate(() => renderHome());
        t.ok((await p.locator('#playLabel').textContent()).includes('🔒'), 'home shows the hold');
        await click(p, '#btnPlay');
        t.eq(await p.evaluate(() => [curScreen, __mj.G, __mj.S.att.L90 || 0]), ['levels', null, 0], 'Play cannot start a later level');
        for (const level of [75, 76, 90, 100]) {
          const result = await p.evaluate(level => {
            const saved = JSON.stringify({ v: CUR_V, key: 'L' + level });
            localStorage.setItem(CUR, saved);
            __mj.startLevel(level);
            return [curScreen, __mj.G, __mj.S.att['L' + level] || 0, localStorage.getItem(CUR) === saved];
          }, level);
          t.eq(result, ['levels', null, 0, true], `level ${level} cannot start or resume; saved progress retained`);
        }
        t.eq(await p.evaluate(() => [74, 75, 90].map(i => {
          const b = document.querySelector('#levelGrid').children[i - 1];
          return [b.disabled, b.classList.contains('locked'), !!b.onclick];
        })), [[false, false, true], [true, true, false], [true, true, false]], 'picker locks the boundary and later levels');
        await startLevel(p, 74, false);
        t.eq(await p.evaluate(() => [curScreen, __mj.G.level]), ['game', 74], 'level 74 remains playable');
        t.eq(await p.evaluate(() => {
          begin({ mode: 'level', level: 75 }, true);
          return [curScreen, __mj.G.level, __mj.S.att.L75 || 0];
        }), ['levels', 74, 0], 'restart cannot bypass the gate');
        await p.evaluate(() => __mj.startDaily('2026-10-07'));
        t.eq(await p.evaluate(() => [curScreen, __mj.G.mode, __mj.S.level]), ['game', 'daily', 90], 'daily puzzle works and progress is preserved');
      }
    },
  },
  {
    name: 'level gate: switched off (null, now) level 75 and up play normally',
    async run(t, { startLevel }) {
      const p = await t.phone({ state: { name: 'Dennis', pid: 'test-gate-release', level: 75 } });
      t.eq(await p.evaluate(() => RULES.levels.blockedFrom), null, 'all levels open');
      await startLevel(p, 75);
      t.eq(await p.evaluate(() => [curScreen, __mj.G.level]), ['game', 75], 'level 75 starts');
    },
  },
];
