/* Saved games load the same: progress saved by 1.72 (fixtures/saves/*.json, made once by tools/make_save_fixtures.js
   on the unchanged code) must give the same home screen, level and half-played board after every later change. */
'use strict';
const fs = require('fs');
const S = require('./saves_common');
const names = fs.readdirSync(S.DIR).filter(f => /\.json$/.test(f)).map(f => f.replace(/\.json$/, '')).sort();

module.exports = names.map(name => ({
  name: `saves: ${name} loads to the same home screen${name.startsWith('cur-') ? ' and board' : ''}`,
  async run(t, lib) {
    const fx = S.read(name);
    const p = await S.openWithSave(t, lib, fx);
    const h = await S.home(p);
    t.eq(h.home, fx.expect.home, 'home label');
    t.eq(h.level, fx.expect.level, 'level');
    if (fx.cur) {
      await S.resume(p, lib, fx.cur.key);
      t.eq(await S.board(p), fx.expect.board, 'half-played board');
    }
    if (name === 'old-fields') {
      // the fields of 1.72 features stay in old saves and must not trip "erase progress"
      await p.evaluate(() => { openSettings(); document.querySelector('#mReset').click(); document.querySelector('#rsYes').click(); });
      await lib.sleep(600);
      t.eq(await p.evaluate(() => [__mj.S.level, Object.keys(__mj.S.stars).length]), [1, 0], 'progress wiped');
    }
    t.ok(p.errors.length === 0, 'no page error', p.errors);
  },
}));
