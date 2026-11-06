'use strict';
/* Replay from Dennisisdebeste (js/pro.js): after 5 lost tries of a level not passed yet, once, his win of that exact board. */
const path = require('path'), fs = require('fs');
const seen = { gold: 1, joker2: 1, ice: 1, lock: 1, clockMoves: 1, clock: 1, trayPair: 1 };
module.exports = [
  { name: 'pro replay: every film matches the rules and today\'s board', async run(t) {
    const dir = path.join(__dirname, '..', 'www', 'pro');
    const files = fs.readdirSync(dir).filter(f => /^L\d+\.json$/.test(f));
    t.ok(files.length > 50, 'films are there');
    for (const f of files) { const d = JSON.parse(fs.readFileSync(path.join(dir, f))); t.ok(d.v === 1 && d.sig && d.acts.length > 20 && d.who === 'Dennisisdebeste', 'film ok: ' + f); }
  }},
  { name: 'pro replay: shown once at the 5th lost try, covers the screen, small × only, game untouched', async run(t, { startLevel, sleep, tune, server }) {
    const p = await t.phone({ size: [392, 785], state: { name: 'Gerda', pid: 'test-pro', level: 132, sunSeen: true, fails: { L132: 3 }, seenSp: seen } });
    await tune(p, { RULES: { pro: { url: server.url + 'pro/', closeAfterMs: 600 } } });
    await startLevel(p, 132);
    await p.evaluate(() => restart()); await sleep(1500);
    t.ok(!(await p.evaluate(() => !!document.querySelector('#proView'))), 'not at the 4th lost try');
    await p.evaluate(() => restart());
    await p.waitForSelector('#proView', { timeout: 8000 });
    t.ok(await p.evaluate(() => /Dennisisdebeste/.test($('#proView h2').textContent) && /132/.test($('#proView').textContent)), 'title names him and the level');
    t.eq(await p.locator('#proView button:not(.pro-x):visible').count(), 0, 'no button but the ×');
    t.ok(await p.evaluate(() => !G.tStart), 'the level clock waits');
    const before = await p.evaluate(() => JSON.stringify([G.mv, G.tray, [...G.alive], [...G.down], G.peek]));
    await sleep(2500);
    t.ok(await p.evaluate(() => document.querySelectorAll('#proView .cz-board .tile').length < G.tiles.length), 'the film plays');
    t.eq(await p.evaluate(() => JSON.stringify([G.mv, G.tray, [...G.alive], [...G.down], G.peek])), before, 'the film does not touch the game');
    await p.click('#proView .pro-x'); await sleep(500);
    t.ok(await p.evaluate(() => !document.querySelector('#proView') && !!G.tStart && !coachRun), 'the × closes it and the level goes on');
    await p.evaluate(() => restart()); await sleep(2000);
    t.ok(!(await p.evaluate(() => !!document.querySelector('#proView'))), 'only once per level');
  }},
  { name: 'pro replay: never for Dennisisdebeste himself, a passed level or another board', async run(t, { startLevel, sleep, tune, server }) {
    for (const [st, why] of [[{ pid: 'pmuy78xu6tsths9', level: 132 }, 'himself'], [{ level: 140 }, 'passed level'], [{ level: 132, sig: 1 }, 'other board']]) {
      const p = await t.phone({ state: { name: 'Gerda', pid: 'test-pro2', sunSeen: true, fails: { L132: 4 }, seenSp: seen, ...st } });
      await tune(p, { RULES: { pro: { url: server.url + 'pro/' } } });
      await startLevel(p, 132);
      if (st.sig) await p.evaluate(() => { window.proSig = () => 'other'; });    // the next try gets another fingerprint
      await p.evaluate(() => restart()); await sleep(2500);
      t.ok(!(await p.evaluate(() => !!document.querySelector('#proView'))), 'no replay: ' + why);
    }
  }},
];
