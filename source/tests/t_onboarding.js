/* A new player chooses a name right after winning level 1, before anything else (Dennis 2026-11-27):
   then the dashboard sees them, with their level 1 log. Players who already have a name see nothing new. */
'use strict';
const fresh = { level: 1, name: undefined, pid: undefined, stars: {}, lvlPts: {} };
// the rewards after level 1 (new trophies) come after the name: tap them away
async function rewardsAway(p, sleep) {
  for (let k = 0; k < 8; k++) { await sleep(500); await p.evaluate(() => { const b = document.querySelector('#modal:not(.hidden) #trOk'); if (b) b.click(); }); }
}
const nameScreen = p => p.evaluate(() => !!document.querySelector('#modal:not(.hidden) #nmIn'));

async function winLevel1(p, lib) {
  await lib.startLevel(p, 1);
  await lib.solve(p, 1500);
  await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) #wNext'), null, { timeout: 8000 });
}

module.exports = [
  {
    name: 'onboarding: after winning level 1 the name comes before level 2, and the dashboard gets level 1',
    async run(t, lib) {
      const { click, sleep } = lib;
      const p = await t.phone({ state: fresh });
      await winLevel1(p, lib);
      t.eq(p.db.get('scores'), {}, 'nothing uploaded before a name');
      await click(p, '#wNext');
      await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) #nmIn'), null, { timeout: 6000 });
      const m = await p.evaluate(() => ({ frames: !!document.querySelector('#modalBox .frames'), restore: !!document.querySelector('#nmRestore'), key: __mj.G.key }));
      t.eq(m, { frames: false, restore: true, key: 'L1' }, 'a short name screen with the restore link, level 2 not started');
      await p.evaluate(() => document.querySelector('#modal').click());   // a tap beside it does not close it
      t.ok(await nameScreen(p), 'the name screen cannot be closed');
      await click(p, '#nmOk'); await sleep(200);
      t.ok(await nameScreen(p), 'an empty name is refused');
      await p.fill('#nmIn', 'Seb');
      await click(p, '#nmOk'); await rewardsAway(p, sleep);
      await p.waitForFunction(() => __mj.G && __mj.G.key === 'L2', null, { timeout: 30000 });
      await p.evaluate(() => flushLog()); await sleep(800);
      const pid = await p.evaluate(() => __mj.S.pid);
      t.eq(p.db.get('scores/' + pid) && p.db.get('scores/' + pid).name, 'Seb', 'the player is in the database');
      t.ok(p.db.plays(pid).some(e => e.k === 'end' && e.r === 'win' && e.lv === 1), 'the waiting level 1 log reached the dashboard', p.db.plays(pid).map(e => e.k));
    },
  },
  {
    name: 'onboarding: the menu and the ranking after level 1 also ask for the name first',
    async run(t, lib) {
      const { click, sleep } = lib;
      for (const btn of ['#wMenu', '#wRanking']) {
        const p = await t.phone({ state: fresh });
        await winLevel1(p, lib);
        await click(p, btn);
        await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) #nmIn'), null, { timeout: 6000 });
        await p.fill('#nmIn', 'Oma Riet');
        await click(p, '#nmOk'); await rewardsAway(p, sleep);
        const scr = await p.evaluate(() => document.querySelector('.screen.active').id);
        t.eq(scr, btn === '#wMenu' ? 'home' : 'ranking', btn + ': goes on where the player tapped');
      }
    },
  },
  {
    name: 'onboarding: a player past level 1 without a name is asked before any level or daily puzzle',
    async run(t, lib) {
      const { click, sleep } = lib;
      const p = await t.phone({ state: { level: 5, name: undefined, pid: undefined } });
      await click(p, '#btnPlay'); await sleep(400);
      t.ok(await nameScreen(p), 'Play asks for the name');
      t.ok(!(await p.evaluate(() => __mj.G)), 'no level started yet');
      await p.reload(); await p.waitForFunction(() => window.__mjReady === true);
      await click(p, '#btnDaily'); await sleep(400);
      t.ok(await nameScreen(p), 'the daily puzzle asks for the name');
      await p.fill('#nmIn', 'Gerda');
      await click(p, '#nmOk');
      await p.waitForFunction(() => __mj.G && __mj.G.mode === 'daily', null, { timeout: 30000 });
      t.ok(true, 'the daily puzzle starts after the name');
    },
  },
  {
    name: 'onboarding: a player with a name plays on as before; the restore link comes back to the name screen',
    async run(t, lib) {
      const { click, sleep } = lib;
      const p = await t.phone({ state: { level: 5, name: 'Dennis', pid: 'test-onboard' } });
      await click(p, '#btnPlay');
      await p.waitForFunction(() => __mj.G && __mj.G.key === 'L5', null, { timeout: 30000 });
      t.ok(!(await nameScreen(p)), 'no name screen for a named player');
      await p.evaluate(() => askName());
      t.eq(await p.evaluate(() => [!!document.querySelector('#modalBox .frames'), !!document.querySelector('#nmRestore')]), [true, false],
        'the profile of a named player keeps its frames and has no restore link');

      const q = await t.phone({ state: { level: 3, name: undefined, pid: undefined } });
      await click(q, '#btnPlay'); await sleep(300);
      await click(q, '#nmRestore'); await sleep(200);
      t.ok(await q.evaluate(() => !!document.querySelector('#rcIn')), 'the link opens the restore code');
      await click(q, '#rcBack'); await sleep(200);
      t.ok(await nameScreen(q), 'closing it shows the name screen again');
      await q.fill('#nmIn', 'Mama');
      await click(q, '#nmOk');
      await q.waitForFunction(() => __mj.G && __mj.G.key === 'L3', null, { timeout: 30000 });
      t.ok(true, 'and saving the name still starts the level');
    },
  },
];
