// Plays every mechanics test board in the real game and checks the expected game state after each step (MECHANICS.md).
//   node make_mech.js; node ../../../lab/build_lab.js <dir> mech-ideas.js  (from a copy with the game www you want to check)
//   MECH=1 node ../lab_server.js <dir> <PORT>; PORT=<PORT> CHROME=... NODE_PATH=... node run_mech.js
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'mech-ideas.js'), 'utf8'), L = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME });
  for (let k = 0; k < L.ideas.length; k++) {
    const it = L.ideas[k], p = await b.newPage({ viewport: { width: 392, height: 730 } }), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://127.0.0.1:' + process.env.PORT + '/lab.html'); await p.waitForTimeout(1200);
    // no intro films: every tile kind counts as seen
    await p.evaluate(() => { S.seenTray = true; S.seenDown = true; S.seenSp = Object.assign(S.seenSp || {}, { gold: true, lock: true, lock2: true, ice: true, joker2: true, trayPair: true, clock: true, clockMoves: true }); save(); });
    const cards = await p.$$('.lab-card'); await (await cards[k].$('button, .lab-play')).click(); await p.waitForTimeout(1500);
    for (let i = 0; i < 3; i++) { const g = await p.$('#ntGo:not([disabled]), #mGo'); if (!g) break; try { await g.click(); await p.waitForTimeout(500); } catch (e) { break; } }
    const out = await p.evaluate(async steps => {
      const G = __mj.G, wait = ms => new Promise(r => setTimeout(r, ms)), res = [];
      for (const s of steps) {
        if (s.tap !== undefined) { __mj.onTap(s.tap); await wait(380); }
        if (s.wait) await wait(s.wait);
        if (s.expect) { let ok; try { ok = !!eval(s.expect.replace(/\bG\b/g, '__mj.G')); } catch (e) { ok = 'error ' + e.message; } res.push({ expect: s.expect, ok, why: s.why || '' }); }
      }
      return { res, state: { mv: __mj.G.mv, tray: __mj.G.tray.slice(), peek: __mj.G.peek, over: !!__mj.G.overShown, left: __mj.G.ob ? __mj.G.ob.left : null, unlocked: __mj.G.ob ? __mj.G.ob.unlocked : null } };
    }, it.steps);
    const bad = out.res.filter(r => r.ok !== true);
    console.log((bad.length ? 'FAIL ' : 'ok   ') + it.title.padEnd(26) + out.res.map(r => (r.ok === true ? '✓' : '✗') + ' ' + r.expect + (r.why ? ' (' + r.why + ')' : '')).join(' | ') + (bad.length ? ' || state ' + JSON.stringify(out.state) : '') + (errs.length ? ' || errors ' + errs.join(';') : ''));
    await p.close();
  }
  await b.close();
})();
