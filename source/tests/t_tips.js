'use strict';
/* "Wist je dat?" tips (features/tips/tips.js): only on the home screen: the tip
   (always one that fits the player, never the same twice in a row), and no full stop after a one-sentence text. */
const keysFor = (p, st) => p.evaluate(st => { Object.assign(S, { seenSp: {}, daily: {}, stars: {} }, st); return homeTips().map(t => t[1]); }, st);
module.exports = [
  { name: 'tips: no tip in a level, none about the joker', async run(t, { startLevel }) {
    const p = await t.phone({ state: { name: 'Dennis', level: 33, sunSeen: true } });
    await startLevel(p, 33);
    await p.waitForTimeout(2500);
    t.eq(await p.evaluate(() => [document.querySelectorAll('#game .tip-box').length, typeof specialTip, Object.keys(TEXT).includes('tip_joker')]), [0, 'undefined', false], 'nothing in the level');
    t.eq(p.errors, [], 'no browser errors');
  }},
  { name: 'tips: the home tip fits the player (level, tools, what was met) and is never the same twice in a row', async run(t) {
    const p = await t.phone({ state: { name: 'Dennis', level: 5, sunSeen: true } });
    t.ok(!(await keysFor(p, { level: 33 })).includes('joker'), 'no joker tip');
    t.ok(!(await keysFor(p, { level: 10 })).includes('peek'), 'no helper tip before the helpers are told about');
    const open = await keysFor(p, { level: 20 });
    t.ok(['peek', 'undo', 'helpFree'].every(k => open.includes(k)), 'helper tips (Spieken, Steen terugleggen, free on Monday) once they are open');
    const late = await keysFor(p, { level: 60 });
    t.ok(late.includes('peek') && !late.some(k => ['hint', 'shuffle', 'hintCost', 'toolsBack', 'stars'].includes(k)), 'at 50+ the same helper tips, nothing about Hint, Schudden or stars');
    t.ok((await keysFor(p, { level: 40 })).includes('shop'), 'the shop tip replaces the star tip');
    t.ok(!(await keysFor(p, { level: 40 })).some(k => ['ice', 'lock', 'trayPair', 'clock'].includes(k)), 'nothing about a tile not met yet');
    t.ok((await keysFor(p, { level: 40, seenSp: { ice: 1, clockMoves: 1 } })).filter(k => ['ice', 'clock'].includes(k)).length === 2, 'ice and clock tips after they were met');
    t.ok((await keysFor(p, { level: 20 })).includes('sunflower') && !(await keysFor(p, { level: 21 })).includes('sunflower'), 'the sunflower tip only while it is locked');
    t.ok(!(await keysFor(p, { level: 40 })).includes('streak') && (await keysFor(p, { level: 40, daily: { '2026-01-01': 1 } })).includes('streak'), 'the streak tip once a daily puzzle was played');
    // shown on the home screen: always one, a different one each time
    await p.evaluate(() => { Object.assign(S, { level: 40, seenSp: { ice: 1, lock: 1 }, lastTip: '' }); });
    const seq = [];
    for (let k = 0; k < 25; k++) seq.push(await p.evaluate(() => { renderHome(); const e = $('#homeTip'); return e.hidden ? null : e.querySelector('b').textContent; }));
    t.ok(seq.every(Boolean), 'always one tip');
    t.ok(seq.every((x, i) => !i || x !== seq[i - 1]), 'never the same twice in a row', seq);
    t.ok(new Set(seq).size > 2, 'and they vary');
    t.eq(p.errors, [], 'no browser errors');
  }},
  { name: 'tips: a one-sentence tip or film text has no full stop', async run(t) {
    const p = await t.phone({ state: { name: 'Dennis', level: 5 } });
    const bad = await p.evaluate(() => Object.keys(TEXT).filter(k => /^(tip_|intro_|ic_|lc_|tp_|ck_)/.test(k)).flatMap(k => TEXT[k].map(s => [k, s]))
      .filter(([, s]) => typeof s === 'string' && s.trim().endsWith('.') && !/[.!?](\s|&nbsp;)+\S/.test(s.trim())).map(([k]) => k));
    t.eq(bad, [], 'no full stop after one sentence');
    t.eq(await p.evaluate(() => Object.keys(TEXT).filter(k => /^tip_/.test(k)).length), 11, 'the 11 tips of the pool (no gold, no joker)');
  }},
];
