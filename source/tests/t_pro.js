'use strict';
/* Replays of a won level (js/pro.js): switched on per player on the dashboard; after 5 lost tries of a
   level not passed yet, once, a win of that exact board (Dennisisdebeste's, else the fewest tries). */
const path = require('path'), fs = require('fs');
const seen = { gold: 1, joker2: 1, ice: 1, lock: 1, clockMoves: 1, clock: 1, trayPair: 1 };
// a player with the replays switched on (or off) on the dashboard
const dbFor = (lib, pid, on = true) => new lib.FakeDB({ scores: {}, plays: { [pid.startsWith('test-') ? 'test-cfg-' + pid.slice(5) : 'cfg-' + pid]: { a: { k: 'cfg', t: 1, pro: on } } } });
async function player(t, lib, { pid = 'test-pro', on = true, level = 132, reached = level, fails = 4, ...st } = {}) {
  const p = await t.phone({ size: [392, 785], db: dbFor(lib, pid, on), state: { name: 'Gerda', pid, level: reached, sunSeen: true, fails: { ['L' + level]: fails }, seenSp: seen, cfg: { pro: on }, ...st } });
  await lib.tune(p, { RULES: { pro: { url: lib.server.url + 'pro/', closeAfterMs: 600 } } });
  await lib.startLevel(p, level);
  return p;
}
const shown = p => p.evaluate(() => !!document.querySelector('#proView'));
module.exports = [
  { name: 'pro replay: every film is a full win and names who played it', async run(t) {
    const dir = path.join(__dirname, '..', 'www', 'pro');
    const files = fs.readdirSync(dir).filter(f => /^L\d+\.json$/.test(f));
    t.ok(files.length > 50, 'films are there');
    for (const f of files) { const d = JSON.parse(fs.readFileSync(path.join(dir, f))); t.ok(d.v === 1 && d.sig && d.acts.length > 20 && d.who && d.pid, 'film ok: ' + f); }
  }},
  { name: 'pro replay: shown once at the 5th lost try, covers the screen, small × only, game untouched', async run(t, lib) {
    const p = await player(t, lib, { fails: 3 });
    await p.evaluate(() => restart()); await lib.sleep(1500);
    t.ok(!(await shown(p)), 'not at the 4th lost try');
    await p.evaluate(() => restart());
    await p.waitForSelector('#proView', { timeout: 8000 });
    t.ok(await p.evaluate(() => /Replay van Dennisisdebeste/.test($('#proView h2').textContent) && /Level 132/.test($('#proView').textContent)), 'title names him and the level');
    t.eq(await p.locator('#proView button:not(.pro-x):visible').count(), 0, 'no button but the ×');
    t.ok(await p.evaluate(() => !G.tStart), 'the level clock waits');
    const before = await p.evaluate(() => JSON.stringify([G.mv, G.tray, [...G.alive], [...G.down], G.peek]));
    await lib.sleep(2500);
    t.ok(await p.evaluate(() => document.querySelectorAll('#proView .cz-board .tile').length < G.tiles.length), 'the film plays');
    t.eq(await p.evaluate(() => JSON.stringify([G.mv, G.tray, [...G.alive], [...G.down], G.peek])), before, 'the film does not touch the game');
    await p.click('#proView .pro-x'); await lib.sleep(500);
    t.ok(await p.evaluate(() => !document.querySelector('#proView') && !!G.tStart && !coachRun), 'the × closes it and the level goes on');
    await p.evaluate(() => restart()); await lib.sleep(2000);
    t.ok(!(await shown(p)), 'only once per level');
  }},
  { name: 'pro replay: in the player\'s own tiles, background and language; another player\'s win carries her name', async run(t, lib) {
    const p = await player(t, lib, { level: 58, theme: 'fruit', bg: 'lavender', lang: 'en', stars: Object.fromEntries([...Array(20)].map((_, i) => ['L' + (i + 1), 3])) });
    await p.evaluate(() => restart());
    await p.waitForSelector('#proView', { timeout: 8000 });
    t.ok(await p.evaluate(() => /Replay from Gerda/.test($('#proView h2').textContent) && /Level 58 · 2× speed/.test($('#proView .pro-sub').textContent)), 'English, and the name of the player who won it');
    t.ok(await p.evaluate(() => !!$('#proView .cz-board .tile .emo') && !$('#proView .cz-board .tile .fi')), 'the player\'s own tiles');
    t.ok(await p.evaluate(() => { const d = document.createElement('div'); d.style.background = (BGS.find(b => b.id === S.bg && !bgLocked(b)) || BGS[0]).css; return S.bg === 'lavender' && !bgLocked(BGS.find(b => b.id === 'lavender')) && $('#proView .cz-stage').style.background === d.style.background; }), 'the player\'s own background');
  }},
  { name: 'pro replay: never when switched off, for the player\'s own win, a passed level or another board', async run(t, lib) {
    const cases = [[{ on: false }, 'switched off'], [{ pid: 'pmuy78xu6tsths9' }, 'his own win'], [{ level: 140, reached: 141 }, 'passed level'], [{ sig: 1 }, 'other board']];
    for (const [o, why] of cases) {
      const { sig, ...opt } = o;
      const p = await player(t, lib, { pid: 'test-pro2', ...opt });
      if (sig) await p.evaluate(() => { window.proSig = () => 'other'; });    // the next try gets another fingerprint
      await p.evaluate(() => restart()); await lib.sleep(2500);
      t.ok(!(await shown(p)), 'no replay: ' + why);
    }
  }},
];
