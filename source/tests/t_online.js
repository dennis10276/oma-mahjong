/* Against the real database (only with --online). Uses test- players only and removes them again;
   the database rules allow deleting test- entries and nothing else. */
'use strict';
const DB = 'https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app';
const del = p => fetch(`${DB}/${p}.json`, { method: 'DELETE' });

module.exports = [
  {
    name: 'online: a heart pops up live during her level, and the play log arrives',
    online: true,
    async run(t, { startLevel, sleep }) {
      const id = 'test-on' + Date.now().toString(36), me = 'test-me' + Date.now().toString(36);
      let oma, snd;
      try {
        oma = await t.phone({ realDb: true, clock: false, state: { level: 8, pid: id, name: 'test-Oma Online' } });
        snd = await t.phone({ realDb: true, clock: false, state: { level: 3, pid: me, name: 'test-Klein Online' } });
        await startLevel(oma, 8); await sleep(2500);
        const t0 = Date.now();
        await snd.evaluate(id => __mj.sendHeart(id, 'Oma Online'), id); await sleep(300);
        await snd.evaluate(() => document.querySelector('.msg-pick .mp').click());   // with the first ready-made message
        let shown = false;
        for (let i = 0; i < 40 && !shown; i++) { await sleep(250); shown = await oma.evaluate(() => !!document.querySelector('#heartPop.on')); }
        t.ok(shown, 'heart pops up live in the level', { ms: Date.now() - t0 });
        t.ok(shown && /Goed bezig/.test(await oma.evaluate(() => document.querySelector('#heartPop').innerText)), 'with its message');
        if (shown) await oma.evaluate(() => document.querySelector('#heartPop').click());
        await sleep(2000);
        const h = await (await fetch(`${DB}/hearts/${id}/${me}.json`)).json();
        t.ok(h && h.t < 0, 'marked as seen', h);
        const plays = await (await fetch(`${DB}/plays/${id}.json`)).json() || {};
        const ks = Object.values(plays).map(e => e.k);
        t.ok(ks.includes('open') && ks.includes('start') && ks.includes('heart_in'), 'play log in the database', ks);
      } finally {
        // close the apps first: an app still open could send its play log again after the clean-up
        for (const p of [oma, snd]) if (p) await p.ctx.close().catch(() => { });
        for (const p of [`hearts/${id}/${me}`, `scores/${id}`, `scores/${me}`, `plays/${id}`, `plays/${me}`, `plays/test-msg-${id.slice(5)}`]) await del(p);
      }
    },
  },
];
