/* Music plays: in the game after the first tap, the track equipped in the shop, and the shop's preview
   (1.80-1.82 played none: the shuffle code sat after `return api` in core/audio.js). */
'use strict';

async function counting(p) {
  await p.evaluate(() => { window.__osc = 0; const P = OscillatorNode.prototype, s = P.start; P.start = function (...a) { window.__osc++; return s.apply(this, a); }; });
}
const state = p => p.evaluate(() => ({ ...Sound.getMusicState(), osc: window.__osc }));
async function tap(p, sleep) { await p.mouse.click(200, 300); await p.evaluate(() => Sound.init()); await sleep(1500); }

module.exports = [
  {
    name: 'music: the first tap starts the music, without errors',
    async run(t, { sleep }) {
      const p = await t.phone({ state: { music: true, sfx: false } });
      await counting(p); await tap(p, sleep);
      const s = await state(p);
      t.eq(s.activeLoopId, 'mus_piano', 'the music box plays');
      t.ok(s.osc > 3, 'notes are played', s.osc);
      t.eq(p.errors, [], 'no page errors');
      await p.evaluate(() => { S.music = false; Sound.setMusic(false); });
      t.eq((await state(p)).activeLoopId, null, 'music off in Instellingen stops it');
      await p.evaluate(() => { S.music = true; Sound.setMusic(true); });
      t.eq((await state(p)).activeLoopId, 'mus_piano', 'and on again plays it');
    },
  },
  {
    name: 'music: the track equipped in the shop plays after a restart; shuffle still works',
    async run(t, { sleep }) {
      const owned = { tiles: ['classic'], bg: ['jade'], music: ['mus_piano', 'mus_waltz', 'mus_harp'], sfx: ['sfx_ivory'], frame: ['none'] };
      const p = await t.phone({ state: { music: true, sfx: false, econV: 2, musicTrack: 'mus_waltz', owned } });
      await counting(p); await tap(p, sleep);
      t.eq((await state(p)).activeLoopId, 'mus_waltz', 'the equipped track');
      await p.evaluate(() => { S.musicShuffle = true; Sound.refreshShuffle(); });
      const next = await p.evaluate(() => Sound.shuffleNext());
      t.ok(next !== 'mus_waltz' && (await state(p)).activeLoopId === next, 'shuffle moves to another owned track', next);
      t.eq(p.errors, [], 'no page errors');
    },
  },
  {
    name: 'music: the shop preview plays and then returns to the equipped track',
    async run(t, { sleep }) {
      const p = await t.phone({ state: { music: true, sfx: false } });
      await counting(p); await tap(p, sleep);
      t.ok(await p.evaluate(() => Sound.previewMusic('mus_harp')), 'preview accepted');
      await sleep(800);
      const s = await state(p);
      t.eq([s.previewId, s.activeLoopId], ['mus_harp', 'mus_harp'], 'the preview plays');
      await p.evaluate(() => Sound.stopPreview()); await sleep(200);
      t.eq((await state(p)).activeLoopId, 'mus_piano', 'back to the equipped track');
      t.eq(p.errors, [], 'no page errors');
    },
  },
];
