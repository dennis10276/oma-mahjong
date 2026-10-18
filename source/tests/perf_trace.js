/* Where does the time go? A Chrome trace of starting a level or of a few taps, summarised by kind
   of work (not part of run.js; CPU slowed down 6x).
   node tests/perf_trace.js <level> [start|taps]     NOFX=1: without sparkles */
'use strict';
const t = require('./lib');
const SLOW = +(process.env.SLOW || 6);

(async () => {
  await t.setup();
  const L = +(process.argv[2] || 100), what = process.argv[3] || 'start';
  const p = await t.phone({ state: { level: L, name: 'perf', pid: 'perfpid', highlight: true, seenSp: { gold: 1, gift: 1, joker: 1, joker2: 1, ice: 1, lock: 1, clock: 1, clockMoves: 1, trayPair: 1 } }, size: [393, 852], clock: false });
  const cdp = await p.ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
  if (what === 'taps') { await p.evaluate(L => { localStorage.removeItem('omamj.cur'); __mj.startLevel(L); }, L); await t.sleep(4000); await t.closeModal(p); }
  if (process.env.NOFX) await p.evaluate(() => { FX.burst = FX.emoji = () => {}; });
  const events = [];
  cdp.on('Tracing.dataCollected', d => events.push(...d.value));
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking,disabled-by-default-devtools.timeline,blink,cc,v8.execute,disabled-by-default-devtools.timeline.frame', transferMode: 'ReportEvents' });
  if (what === 'start') {
    await p.evaluate(L => { localStorage.removeItem('omamj.cur'); __mj.startLevel(L); }, L);
    await t.sleep(2200 * SLOW / 3);
  } else {
    const path = await p.evaluate(() => __mj.solveNow(80000)) || [];
    for (const i of path.slice(0, 8)) { await p.evaluate(i => { const G = __mj.G; if (!G.alive[i]) return; __mj.onTap(i); if (G.alive[i]) __mj.onTap(i); }, i); await t.sleep(400 * SLOW / 3); }
  }
  await cdp.send('Tracing.end');
  await done;
  const main = events.filter(e => e.name === 'thread_name' && e.args.name === 'CrRendererMain').find(n => events.some(x => x.pid === n.pid && x.tid === n.tid && x.name === 'FunctionCall'));
  const ev = events.filter(e => e.pid === main.pid && e.tid === main.tid && e.ph === 'X' && e.dur);
  const sum = {};
  const KEEP = ['UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'Layerize', 'Commit', 'FunctionCall', 'TimerFire', 'FireAnimationFrame', 'RunMicrotasks', 'ParseHTML', 'MinorGC', 'MajorGC', 'PaintImage', 'ProxyMain::BeginMainFrame'];
  for (const e of ev) { if (!KEEP.includes(e.name)) continue; const s = sum[e.name] || (sum[e.name] = { n: 0, ms: 0, max: 0 }); s.n++; s.ms += e.dur / 1000; s.max = Math.max(s.max, e.dur / 1000); }
  for (const k in sum) { sum[k].ms = Math.round(sum[k].ms); sum[k].max = Math.round(sum[k].max); }
  console.log(JSON.stringify(Object.entries(sum).sort((a, b) => b[1].ms - a[1].ms)));
  // animations the graphics chip could not take over, and why
  const notComp = {};
  for (const e of events) if (e.name === 'Animation' && e.args && e.args.data && e.args.data.compositeFailed) { const k = (e.args.data.unsupportedProperties || []).join(',') || 'reason ' + e.args.data.compositeFailed; notComp[k] = (notComp[k] || 0) + 1; }
  console.log('not composited', JSON.stringify(notComp));
  require('fs').writeFileSync(process.env.OUT || '/tmp/claude-0/trace.json', JSON.stringify({ traceEvents: events }));
  await t.teardown();
})().catch(e => { console.error(e); process.exit(1); });
