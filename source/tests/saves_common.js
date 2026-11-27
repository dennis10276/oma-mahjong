/* Shared by t_saves.js and tools/make_save_fixtures.js: put a saved game on a phone the way an update finds it
   (omamj.v1 and omamj.cur in localStorage, then the game starts), and read off what the player sees. */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'fixtures', 'saves');

// the fake database a saved player needs: her dashboard settings (S.cfg) as the cfg events the game reads
function dbFor(lib, v1) {
  const plays = v1 && v1.pid && v1.cfg && Object.keys(v1.cfg).length ? { [lib.cfgPath(v1.pid)]: lib.cfgEvents(v1.cfg) } : {};
  return new lib.FakeDB({ scores: {}, plays });
}
/* A phone that starts with no saved progress, then the two saved keys written from a page of the same site that is
   not the game (the game itself could save its own state over ours while reloading), then the game opened on them. */
async function openWithSave(t, lib, fx) {
  const p = await t.phone({ state: null, db: dbFor(lib, fx.v1) });
  const url = lib.server.url;
  await p.goto(new URL('__blank__', url).href);
  await p.evaluate(([v1, cur]) => {
    localStorage.setItem('omamj.v1', JSON.stringify(v1));
    if (cur) localStorage.setItem('omamj.cur', JSON.stringify(cur)); else localStorage.removeItem('omamj.cur');
  }, [fx.v1, fx.cur || null]);
  await p.goto(url);
  await p.waitForFunction(() => window.__mjReady === true, null, { timeout: 8000 });
  if (fx.v1.cfg && Object.keys(fx.v1.cfg).length) await p.waitForFunction(n => Object.keys(S.cfg || {}).length >= n, Object.keys(fx.v1.cfg).length, { timeout: 8000 });
  await lib.sleep(600);
  return p;
}
const home = p => p.evaluate(() => ({ home: document.querySelector('#playLabel').textContent.trim(), level: __mj.S.level }));
// the half-played board: which tiles are left, what is in the tray, every face
const board = p => p.evaluate(() => { const G = __mj.G; return G && { key: G.key, alive: Array.from(G.alive), tray: G.tray.slice(), faces: G.tiles.map(t => t.face), down: Array.from(G.down), peek: G.peek, rescued: !!G.rescued }; });
// continue the saved level (or daily) from the home screen, as Play does
async function resume(p, lib, key) {
  // (an old save without a name past level 1 is asked for one first, t_onboarding.js: the player types it)
  await p.evaluate(() => { if (needsName()) { __mj.S.name = 'Tester'; save(); } });
  if (key[0] === 'L') { await lib.startLevel(p, +key.slice(1), false); return; }
  await p.evaluate(k => __mj.startDaily(k.slice(1)), key);
  await p.waitForFunction(k => !document.querySelector('#buildMsg') && __mj.G && __mj.G.key === k, key, { timeout: 30000 });
  await lib.sleep(700); await lib.closeModal(p);
}
const read = name => JSON.parse(fs.readFileSync(path.join(DIR, name + '.json'), 'utf8'));
module.exports = { DIR, dbFor, openWithSave, home, board, resume, read };
