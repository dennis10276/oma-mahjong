/* Self-update of the Android app: new game files arrive without reinstalling. */
'use strict';
const path = require('path');
const json = (body) => r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });

module.exports = [
  {
    name: 'update: an old 1.5 app and the current app both move to a newer version',
    async run(t, { WWW, buildBundle, startLevel, solve, modal, sleep }) {
      const nb = buildBundle('99.1');
      for (const [label, file] of [['1.5 app', path.join(__dirname, 'fixtures', 'app-1.5', 'index.html')], ['current app', path.join(WWW, 'index.html')]]) {
        const p = await t.phone({ url: 'file://' + file, clock: false, state: { level: 4 }, routes: [['**/version.json*', json({ v: '99.1' })], ['**/bundle.json*', json(nb)]] });
        const before = await p.evaluate(() => window.__mjCode);
        await p.waitForFunction(() => window.__mjCode === '99.1' && window.__mjReady, null, { timeout: 15000 }).catch(() => { });
        const after = await p.evaluate(() => ({ code: window.__mjCode, ver: APP_VERSION, level: __mj.S.level }));
        t.eq(after, { code: '99.1', ver: '99.1', level: 4 }, `${label} (was ${before}): updated, progress kept`);
        await startLevel(p, 4);
        t.ok(await solve(p), `${label}: a level can be played on the new version`);
        t.ok(await modal(p), `${label}: win screen`);
        await p.ctx.close();
      }
    },
  },
  {
    name: 'update: a broken update is thrown away and the app keeps working',
    async run(t, { WWW, buildBundle, sleep }) {
      const nb = buildBundle('99.2');
      nb.js[3] = 'throw new Error("a broken update");';
      const p = await t.phone({ url: 'file://' + path.join(WWW, 'index.html'), clock: false, state: { level: 6 }, routes: [['**/version.json*', json({ v: '99.2' })], ['**/bundle.json*', json(nb)]] });
      const built = await p.evaluate(() => window.__mjCode);
      // it downloads, switches, fails to start, and falls back within a few seconds
      await sleep(14000);
      await p.waitForFunction(() => window.__mjReady, null, { timeout: 10000 }).catch(() => { });
      const st = await p.evaluate(() => ({ code: window.__mjCode, ready: !!window.__mjReady, bad: localStorage.getItem('omamj.badv'), cached: !!localStorage.getItem('omamj.code'), level: __mj.S.level }));
      t.eq(st, { code: built, ready: true, bad: '99.2', cached: false, level: 6 }, 'back on the built-in version, bad version skipped');
    },
    allowErrors: true,   // the broken update throws on purpose
  },
];
