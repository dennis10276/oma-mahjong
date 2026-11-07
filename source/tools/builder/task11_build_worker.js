'use strict';
const { parentPort } = require('worker_threads'), B = require('./builder.js'), E = require('./engine.js'), M = require('../factory/meter.js');
const K = require('./knobs.js'), Placement = require('../factory/placement_score.js');
function build(job) {
  const { story, layout, way, seed, targets } = job, brief = { story, layout, shape: B.LAYOUTS[layout].shape, seed, frame: { way, spare: 1 }, targets };
  const r = B.build(brief), id = `${story}-L${layout}-w${way}-s${seed}`;
  if (r.fail) return { task: job.task, boards: [1, 2].map(spare => ({ id: id + '-p' + spare, stage: 'ladder', cell: { story, layout, way, seed, spare }, brief: { ...brief, frame: { way, spare } }, fail: r.fail, detail: r.detail, ms: r.ms })) };
  if ((r.design.obst.keys || []).some(k => r.design.obst.ice?.[k])) throw Error('Frozen key excluded');
  if (r.card.faceDownOnDig) throw Error('The requested readable dig contains hidden tiles');
  const boards = [];
  for (const spare of [1, 2]) {
    const x = spare === 1 ? { design: r.design } : K.clockSpare(r.design, spare);
    const base = { id: id + '-p' + spare, stage: 'ladder', cell: { story, layout, way, seed, spare }, brief: { ...brief, frame: { way, spare } }, ms: r.ms };
    if (x.fail) { boards.push({ ...base, fail: x.fail }); continue; }
    const card = structuredClone(r.card); card.clock.n = x.design.clock.n; card.clock.spare = spare;
    const forced = spare === 1 ? card.tray.forcedProof : B.canReachWithin(x.design, card.trayCap - 1, 60000);
    card.tray.forcedProof = forced; card.tray.forced = forced === 'no' ? card.trayCap : null;
    boards.push({ ...base, design: x.design, card, sourceIntents: r.intents, roles: r.roles, keep: r.keep,
      readable: Placement.readable(x.design), strictWitness: E.replay(x.design, x.design.solution, { strict: true }).ok,
      proof: { witness: E.replay(x.design, x.design.solution).ok, minimum: r.card.clock.fewestMoves, spare, clockOnly: spare === 2, forcedPressure: forced },
      note: 'sourceIntents describe the spare1 authored base. The transformed spare2 timer/witness and forced-pressure result are independently recorded; no copied pressure claim.' });
  }
  return { task: job.task, boards };
}
parentPort.on('message', job => { try { parentPort.postMessage(build(job)); } catch (e) { parentPort.postMessage({ error: e.stack }); } });
