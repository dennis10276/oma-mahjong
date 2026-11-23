'use strict';
/* The home screen on tall phones (min-height 741px; Dennis's app is 392x785): the hero tiles grow first, the rest of the
   height is split above the tiles and below the bottom bar. 1.77 gave all of it to the bottom ("cropped to the top,
   massive space on the bottom", the owner 2026-11-23). */
const SIZES = [[360, 741], [360, 780], [392, 785], [384, 854], [393, 873], [412, 915], [430, 932]];
module.exports = [
  { name: 'home tall phones: no big gap at the bottom, tiles grow, nothing cut off', async run(t) {
    for (const [w, h] of SIZES) {
      const p = await t.phone({ size: [w, h], state: { theme: 'sunflower', bg: 'sunfield', level: 120, name: 'Dennis', sunSeen: true } });
      await p.evaluate(() => show('home')); await p.waitForTimeout(400);
      const m = await p.evaluate(() => {
        const b = s => document.querySelector(s).getBoundingClientRect(), tiles = b('#home .logo-tiles'), lt = document.querySelector('#home .lt').offsetWidth;
        return { above: Math.round(tiles.top - b('#home .home-top').bottom), below: Math.round(innerHeight - b('#nextUnlock').bottom), lt,
          tipToPlay: Math.round(b('#btnPlay').top - b('#homeTip').bottom), titleOk: b('#home .logo h1').top >= b('#home .lt.t1').bottom - 4,
          fits: document.querySelector('#home').scrollHeight <= innerHeight };
      });
      const at = `${w}x${h}`;
      t.ok(m.fits, `${at}: nothing cut off`, m);
      t.ok(m.below <= 75, `${at}: no big gap under the bottom bar`, m);
      t.ok(m.lt >= 50, `${at}: hero tiles grown`, m);
      t.ok(m.tipToPlay <= 26, `${at}: buttons follow the tip`, m);
      t.ok(m.titleOk, `${at}: tiles do not cover the title`, m);
      t.eq(p.errors, [], `${at}: no browser errors`);
      await p.ctx.close();
    }
  }},
];
