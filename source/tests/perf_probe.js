/* Measure how smooth starting a level and matching feel on a slow phone (not part of run.js).
   node tests/perf_probe.js [levels...]   (CPU slowed down 6x, like a budget Android phone)
   Prints per level: time of the start itself, frames during the first 2 s, and per tap the
   handler time and the frames in the 400 ms after it. */
'use strict';
const t = require('./lib');
const SLOW = +(process.env.SLOW || 6);

(async () => {
  await t.setup();
  const levels = process.argv.slice(2).map(Number);
  const out = [];
  for (const L of levels.length ? levels : [30, 60, 100, 150]) {
    const p = await t.phone({ state: { level: L, name: 'perf', pid: 'perfpid', highlight: true, seenSp: { gold: 1, gift: 1, joker: 1, joker2: 1, ice: 1, lock: 1, clock: 1, clockMoves: 1, trayPair: 1 } }, size: [393, 852], clock: false });
    if (process.env.HOMEWAIT) await t.sleep(+process.env.HOMEWAIT);
    if (process.env.NOFX) await p.evaluate(() => { FX.burst = FX.emoji = () => {}; });
    const cdp = await p.ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
    await cdp.send('Performance.enable');
    // frame recorder
    await p.evaluate(() => {
      window.__frames = []; let last = performance.now();
      const tick = n => { window.__frames.push([n, n - last]); last = n; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      window.__lafs = [];
      try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lafs.push({ t: e.startTime, d: e.duration, block: e.blockingDuration, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0, style: e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0, scripts: (e.scripts || []).map(s => [s.sourceFunctionName || s.invoker, Math.round(s.duration)]) }))).observe({ type: 'long-animation-frame', buffered: false }); } catch (e) { }
    });
    if (process.env.WARM) { await p.evaluate(L => { localStorage.removeItem('omamj.cur'); __mj.startLevel(L - 1); }, L); await t.sleep(2500); await t.closeModal(p); }
    const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const t0 = await p.evaluate(L => { localStorage.removeItem('omamj.cur'); const a = performance.now(); __mj.startLevel(L); window.__beginMs = performance.now() - a; return a; }, L);
    await t.sleep(2500 * SLOW / 3);
    const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const start = await p.evaluate(t0 => {
      const f = window.__frames.filter(([n]) => n > t0 && n < t0 + 2000);
      return { beginMs: Math.round(window.__beginMs), frames: f.length, long: f.filter(x => x[1] > 50).map(x => Math.round(x[1])), worst: Math.round(Math.max(...f.map(x => x[1]))), lafs: window.__lafs.filter(l => l.t > t0 - 5 && l.t < t0 + 2000).slice(0, 4) };
    }, t0);
    const startCost = { script: +(m1.ScriptDuration - m0.ScriptDuration).toFixed(3), style: +(m1.RecalcStyleDuration - m0.RecalcStyleDuration).toFixed(3), layout: +(m1.LayoutDuration - m0.LayoutDuration).toFixed(3), task: +(m1.TaskDuration - m0.TaskDuration).toFixed(3), tiles: await p.evaluate(() => __mj.G.tiles.length), nodes: await p.evaluate(() => document.querySelectorAll('#board *').length) };
    await t.closeModal(p);
    // matching: play the solver's moves at a human pace
    const path = await p.evaluate(() => __mj.solveNow(80000)) || [];
    const taps = [];
    const mA = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    for (const i of path.slice(0, 16)) {
      const r = await p.evaluate(i => {
        const G = __mj.G; if (!G.alive[i] || G.done) return null;
        const a = performance.now(); __mj.onTap(i); if (G.alive[i]) __mj.onTap(i);
        return { a, ms: performance.now() - a, match: G.tray.length === 0 };
      }, i);
      if (!r) continue;
      await t.sleep(420 * SLOW / 3);
      const f = await p.evaluate(a => window.__frames.filter(([n]) => n > a && n < a + 400).map(x => x[1]), r.a);
      taps.push({ ms: Math.round(r.ms), worst: Math.round(Math.max(...f)), long: f.filter(x => x > 34).length, frames: f.length });
    }
    const mB = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const lafsPlay = await p.evaluate(() => window.__lafs.slice(-6));
    out.push({ L, start, startCost, tap: { n: taps.length, avgHandler: Math.round(taps.reduce((a, b) => a + b.ms, 0) / taps.length), maxHandler: Math.max(...taps.map(x => x.ms)), avgWorstFrame: Math.round(taps.reduce((a, b) => a + b.worst, 0) / taps.length), longFrames: taps.reduce((a, b) => a + b.long, 0), script: +(mB.ScriptDuration - mA.ScriptDuration).toFixed(3), style: +(mB.RecalcStyleDuration - mA.RecalcStyleDuration).toFixed(3), layout: +(mB.LayoutDuration - mA.LayoutDuration).toFixed(3), task: +(mB.TaskDuration - mA.TaskDuration).toFixed(3) }, lafsPlay: process.env.VERBOSE ? lafsPlay : undefined, errors: p.errors });
    await p.ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await t.teardown();
})().catch(e => { console.error(e); process.exit(1); });
