/* The two board helpers beside the tray: Spieken (peek) and Steen terugleggen (undo). */
'use strict';
const STATE = { name: 'Dennis', pid: 'test-helpers', level: 84, sunSeen: true, econV: 2, peekStock: 2, undoStock: 2 };
const LEVEL = 84;   // has face-down tiles
// take one free face-up tile into the tray (not the twin of a tray tile) and wait until it has landed
async function trayOne(p, sleep) {
  const i = await p.evaluate(() => { const G = __mj.G; return G.tiles.findIndex((_, i) => G.alive[i] && !G.down[i] && __mj.G && document.querySelector(`#board .tile[data-i="${i}"]`) && !document.querySelector(`#board .tile[data-i="${i}"]`).classList.contains('blocked') && !G.tray.some(t => G.tiles[t].face === G.tiles[i].face)); });
  await p.evaluate(i => __mj.onTap(i), i); await sleep(900);
  return i;
}
const backs = p => p.evaluate(() => document.querySelectorAll('#board .tile.back').length);
module.exports = [
  {
    name: 'Spieken turns every face-down tile for 4 s and back',
    async run(t, { startLevel, click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: STATE });
      await startLevel(p, LEVEL); await sleep(1800);
      const before = await p.evaluate(() => ({ back: document.querySelectorAll('#board .tile.back').length, down: [...__mj.G.down].join('') }));
      t.ok(before.back > 0, 'the level has face-down tiles', before);
      await click(p, '#btnPeek'); await sleep(150);
      t.ok(await p.evaluate(() => /Spieken\?/.test(document.querySelector('#modalBox h2').textContent)), 'the ask popup says Spieken?');
      t.eq(await p.evaluate(() => __mj.S.peekStock), 2, 'asking spends nothing');
      await click(p, '#hYes'); await sleep(300);
      t.eq(await backs(p), 0, 'no face-down tile is shown face-down');
      t.eq(await p.evaluate(() => [document.querySelectorAll('#board .tile.peeked').length, __mj.S.peekStock, __mj.G.rescued, document.querySelector('#btnPeek span').textContent, document.querySelector('#btnPeek').classList.contains('armed')]), [before.back, 1, true, '4', true], 'peeked, one token spent, no Perfect, countdown 4 with the armed look');
      await sleep(4300);
      t.eq(await backs(p), before.back, 'face-down again after 4 s');
      t.eq(await p.evaluate(() => [[...__mj.G.down].join(''), document.querySelector('#btnPeek span').textContent, document.querySelectorAll('#board .tile.peeked').length]), [before.down, '👁️', 0], 'G.down unchanged, icon back, nothing peeked');
      await p.evaluate(() => flushLog());
      t.ok(p.db.plays('test-helpers').some(e => e.k === 'peek_use'), 'peek_use reaches the play log');
      t.eq(p.errors, [], 'no page error');
    },
  },
  {
    name: 'second Spieken in the same try shows the toast and spends nothing; after restart it works again',
    async run(t, { startLevel, click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: STATE });
      await startLevel(p, LEVEL); await sleep(1800);
      await click(p, '#btnPeek'); await click(p, '#hYes'); await sleep(4400);
      await click(p, '#btnPeek'); await sleep(150);
      t.ok(await p.evaluate(() => document.querySelector('#modal').classList.contains('hidden')), 'no popup');
      t.ok(await p.evaluate(() => /1 keer per poging/.test(document.querySelector('#gameMsg').innerText)), 'the toast says once per try');
      t.eq(await p.evaluate(() => [__mj.S.peekStock, document.querySelector('#btnPeek').classList.contains('used')]), [1, true], 'nothing spent, button marked used');
      await p.evaluate(() => __mj.restart()); await sleep(1800);
      await click(p, '#btnPeek'); await sleep(150);
      t.ok(await p.evaluate(() => /Spieken\?/.test(document.querySelector('#modalBox h2').textContent)), 'after restart the ask popup shows again');
      await click(p, '#hYes'); await sleep(300);
      t.eq(await p.evaluate(() => [__mj.S.peekStock, document.querySelectorAll('#board .tile.peeked').length > 0]), [0, true], 'the second try peeks');
      await sleep(4400);
      // stock 0: a tap opens the shop on Hulpen
      await p.evaluate(() => __mj.restart()); await sleep(1800);
      await click(p, '#btnPeek'); await sleep(300);
      t.eq(await p.evaluate(() => [document.querySelector('#shop').classList.contains('active'), document.querySelector('#shop .shop-tabs button.on').textContent]), [true, 'Hulpen'], 'no stock: the shop opens on Hulpen');
      t.eq(p.errors, [], 'no page error');
    },
  },
  {
    name: 'Steen terugleggen puts the tapped tray tile back and spends one',
    async run(t, { startLevel, click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: STATE });
      await startLevel(p, LEVEL); await sleep(1800);
      const i = await trayOne(p, sleep);
      const mv = await p.evaluate(() => __mj.G.mv);
      await click(p, '#btnUndo'); await sleep(150);
      t.ok(await p.evaluate(() => /Steen terugleggen\?/.test(document.querySelector('#modalBox h2').textContent)), 'the ask popup');
      await click(p, '#hYes'); await sleep(200);
      t.eq(await p.evaluate(() => [document.querySelector('#btnUndo').classList.contains('armed'), document.querySelectorAll('#tray .tmini.pulse').length, __mj.S.undoStock]), [true, 1, 2], 'waiting for the tile: armed, the tray tile pulses, nothing spent yet');
      await p.evaluate(() => document.querySelector('#tray .slot .tmini').click()); await sleep(300);
      t.eq(await p.evaluate(i => { const G = __mj.G; return [G.tray.length, !!G.alive[i], document.querySelector(`#board .tile[data-i="${i}"]`).classList.contains('hidden'), __mj.S.undoStock, G.rescued, G.undoUsed, G.mv, document.querySelector('#btnUndo').classList.contains('armed'), document.querySelector('#btnUndo').classList.contains('used')]; }, i), [0, true, false, 1, true, 1, mv, false, true], 'tile back on the board, one token spent, no Perfect, moves unchanged, button used');
      t.eq(p.errors, [], 'no page error');
      // cancel: a tap outside the tray spends nothing
      const q = await t.phone({ size: [392, 785], state: { ...STATE, pid: 'test-helpers2' } });
      await startLevel(q, LEVEL); await sleep(1800);
      await trayOne(q, sleep);
      await click(q, '#btnUndo'); await click(q, '#hYes'); await sleep(150);
      await q.evaluate(() => document.querySelector('#gameTitle').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await sleep(150);
      t.eq(await q.evaluate(() => [document.querySelector('#btnUndo').classList.contains('armed'), __mj.S.undoStock, __mj.G.tray.length]), [false, 2, 1], 'a tap outside cancels, nothing spent');
    },
  },
  {
    name: 'empty tray: Steen terugleggen spends nothing',
    async run(t, { startLevel, click, sleep }) {
      const p = await t.phone({ size: [392, 785], state: STATE });
      await startLevel(p, LEVEL); await sleep(1800);
      await click(p, '#btnUndo'); await sleep(150);
      t.ok(await p.evaluate(() => document.querySelector('#modal').classList.contains('hidden')), 'no popup');
      t.ok(await p.evaluate(() => document.querySelector('#gameMsg').innerText.length > 0), 'a toast says why');
      t.eq(await p.evaluate(() => [__mj.S.undoStock, !!__mj.G.undoUsed, document.querySelector('#btnUndo').classList.contains('used')]), [2, false, false], 'nothing spent, not marked used');
    },
  },
  {
    name: 'helper buttons stay inside the tray line and under home, also while pressed',
    async run(t, { startLevel, sleep }) {
      for (const size of [[392, 785], [360, 740], [412, 915], [338, 654]]) {
        const tight = size[0] === 338;   // the smallest phone: the tray row is only 117 px high, the cards touch home's 5 px edge (the stills measure 392 x 785)
        const p = await t.phone({ size, state: STATE });
        await startLevel(p, LEVEL); await sleep(1800);
        const geo = () => p.evaluate(() => { const R = s => document.querySelector(s).getBoundingClientRect(), tray = R('#tray'), home = R('#btnHome'), rest = R('#btnRestart'), pk = R('#btnPeek'), un = R('#btnUndo'), cx = r => r.left + r.width / 2;
          return { lip: tray.bottom + 4, pkEdge: pk.bottom + 5, unEdge: un.bottom + 5, dHome: Math.abs(cx(pk) - cx(home)), dRest: Math.abs(cx(un) - cx(rest)), homeW: home.width, pkW: pk.width, pkH: pk.height, gap: pk.top - (home.bottom + 5), homeEdge: home.bottom + 5, cntGap: document.querySelector('#btnPeek .cnt').getBoundingClientRect().top - (home.bottom + 5) }; });
        const g = await geo();
        t.ok(Math.abs(g.pkEdge - g.lip) <= 0.5 && Math.abs(g.unEdge - g.lip) <= 0.5, `${size}: the card edge ends on the tray line`, g);
        t.ok(g.dHome <= 1.5 && g.dRest <= 1.5, `${size}: centred under home and restart`, g);
        t.eq([g.homeW, Math.round(g.pkW), Math.round(g.pkH)], [56, 58, 56], `${size}: sizes`);
        t.ok(tight ? g.gap + 5 >= 0 : g.gap >= 4, `${size}: room under home (tight phone: no overlap with home's face)`, g);
        // pressed: sinks 4 px, bottom stays within the tray line, away from home
        await p.evaluate(() => { document.querySelector('#btnPeek').classList.add('pressed'); document.querySelector('#btnUndo').classList.add('pressed'); }); await sleep(250);
        const d = await geo();
        t.ok(d.pkEdge - 5 + 1 <= d.lip + 0.5 && d.unEdge - 5 + 1 <= d.lip + 0.5, `${size}: pressed stays above the tray line`, d);
        t.ok(d.gap > g.gap + 3, `${size}: pressed moves away from home`, [g.gap, d.gap]);
        await p.evaluate(() => { for (const s of ['#btnPeek', '#btnUndo']) document.querySelector(s).classList.remove('pressed'); });
        // armed (countdown look): the solid card and its ring stay clear of home
        await p.evaluate(() => document.querySelector('#btnPeek').classList.add('armed', 'count')); await sleep(250);
        for (let k = 0; k < 6; k++) { const a = await p.evaluate(() => { const home = document.querySelector('#btnHome').getBoundingClientRect(), pk = document.querySelector('#btnPeek').getBoundingClientRect(); return { ring: (pk.top - 3) - (home.bottom + 5), z: getComputedStyle(document.querySelector('#game .topbar')).zIndex }; });
          t.ok((tight || a.ring >= 1) && a.z === '3', `${size}: armed card and ring stay >= 1 px below home`, a); await sleep(170); }
        t.eq(p.errors, [], 'no page error');
      }
    },
  },
];
