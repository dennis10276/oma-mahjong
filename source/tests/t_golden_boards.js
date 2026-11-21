/* Golden boards: a fingerprint of every board the game deals (tiles, faces, face-down, gold, ice/locks, clock),
   so a refactor can prove nothing deals differently.
     GOLDEN=record node tests/run.js golden     writes fixtures/golden-boards.json (only on unchanged code)
     node tests/run.js golden                   compares; a mismatch names the board (e.g. normal/390x820/L57) */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const FIXTURE = path.join(__dirname, 'fixtures', 'golden-boards.json');
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const dates = (() => { const out = []; for (let d = new Date(Date.UTC(2026, 9, 1)); d <= new Date(Date.UTC(2026, 10, 29)); d = new Date(d.getTime() + 864e5)) out.push(d.toISOString().slice(0, 10)); return out; })();
const PARTS_OFF = ['gentle', 'adapt', 'retry', 'rescue', 'nudge', 'shuffleLater', 'lucky', 'keepTools', 'pro', 'news'];   // every PARTS id except levels
const SPECIALS = { gold: 1, gift: 1, joker: 1, joker2: 1, ice: 1, lock: 1, clock: 1, clockMoves: 1, trayPair: 1 };

const SETS = [
  { who: 'normal', size: [390, 820], levels: range(1, 400), dates },
  { who: 'normal', size: [360, 740], levels: [...range(1, 50), 52], dates: [] },
  { who: 'normal', size: [768, 1024], levels: [...range(1, 50), 52], dates: [] },
  ...[[390, 820], [360, 740], [768, 1024]].map(size => ({ who: 'grandma', size, levels: range(1, 250), dates })),
];

// runs inside the page: deal every board, return { key: fingerprint string }
async function dealAll({ levels, dates }) {
  const out = {};
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const take = async (key, start) => {
    localStorage.removeItem('omamj.cur');
    start();
    for (let i = 0; (document.querySelector('#buildMsg') || !__mj.G || __mj.G.key !== key) && i < 3000; i++) await wait(10);   // a designed level may first be built
    const G = __mj.G;
    if (!G || G.key !== key) { out[key] = 'NOT DEALT: ' + (G && G.key); return; }
    const o = G.o;
    out[key] = JSON.stringify([o.spec.tiles.map(t => [t.x, t.y, t.z]), o.faces, o.down, o.gold, o.obst, o.clock]);
    out['track/' + key] = o.track || '';
    const m = document.querySelector('#modal'); if (m && !m.classList.contains('hidden') && document.querySelector('#mGo')) document.querySelector('#mGo').click();
  };
  for (const n of levels) await take('L' + n, () => __mj.startLevel(n));
  for (const k of dates) await take('D' + k, () => __mj.startDaily(k));
  return out;
}

module.exports = [{
  name: 'golden boards: every level and daily puzzle deals exactly as recorded',
  cpu: true,
  async run(t, { FakeDB }) {
    const record = process.env.GOLDEN === 'record';
    const fixture = record ? {} : JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const got = {};
    for (const set of SETS) {
      const grandma = set.who === 'grandma';
      const t0 = Date.now();
      let db, state;
      if (grandma) {
        const ev = {}; PARTS_OFF.forEach((p, i) => ev['e' + i] = { k: 'cfg', t: 1000 + i, [p]: false });
        db = new FakeDB({ scores: {}, plays: { 'test-cfg-oma': ev } });
        state = { name: 'OmaTest', pid: 'test-oma', seenSp: SPECIALS };
      } else { db = new FakeDB({ scores: {} }); state = { seenSp: SPECIALS }; }
      const p = await t.phone({ state: { seenTray: true, seenDown: true, ...state }, size: set.size, db });
      if (grandma) await p.waitForFunction(() => Object.keys(S.cfg || {}).length >= 10, null, { timeout: 8000 });
      const res = await p.evaluate(dealAll, { levels: set.levels, dates: set.dates });
      const prefix = `${set.who}/${set.size.join('x')}/`;
      const tracks = new Set(Object.entries(res).filter(([k]) => k.startsWith('track/')).map(([, v]) => v));
      t.eq([...tracks], [grandma ? 'care' : ''], prefix + 'track (care for grandma only)');
      for (const [k, v] of Object.entries(res)) {
        if (k.startsWith('track/')) continue;
        got[prefix + k] = v.startsWith('NOT DEALT') ? v : crypto.createHash('sha1').update(v).digest('hex');
      }
      t.log(prefix, Object.keys(res).length / 2, 'boards in', Date.now() - t0, 'ms');
    }
    if (record) {
      fs.writeFileSync(FIXTURE, JSON.stringify(got, null, 0).replace(/,"/g, ',\n"'));
      console.log('   recorded', Object.keys(got).length, 'boards');
      t.ok(!Object.values(got).some(v => v.startsWith('NOT DEALT')), 'every board was dealt');
      return;
    }
    t.eq(Object.keys(got).length, Object.keys(fixture).length, 'number of boards');
    for (const k of Object.keys(fixture)) t.eq(got[k], fixture[k], k);
  },
}];
