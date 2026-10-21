'use strict';
const assert = require('assert/strict');
const { rng } = require('../../../www/layouts.js');

function createObservedMemory({ size, campaign, board, seed = 1, retryRetention = 1, decay = 0 }) {
  assert(Number.isInteger(size) && size > 0);
  assert(typeof campaign === 'string' && campaign.length && typeof board === 'string' && board.length);
  assert(Number.isInteger(seed));
  for (const rate of [retryRetention, decay]) assert(Number.isFinite(rate) && rate >= 0 && rate <= 1);
  const random = rng(seed);
  let records = Array(size).fill(null), attempt = 0, active = false, lastTap = -1, ending = null, previousAlive = null;
  const beginAttempt = identity => {
    assert(!active && (attempt === 0 || ending === 'physicalLoss'), 'Only an actual completed loss permits another attempt');
    assert.equal(identity.campaign, campaign); assert.equal(identity.board, board); assert.equal(identity.size, size);
    assert.equal(identity.attempt, attempt + 1);
    if (attempt) records = records.map(record => record && random() < retryRetention ? record : null);
    attempt++; active = true; lastTap = -1; ending = null; previousAlive = null;
    return structuredClone(records);
  };
  const observe = ({ physicalTaps, alive, pictures, evidence }) => {
    assert(active, 'Begin the actual attempt before observing');
    assert(Number.isInteger(physicalTaps) && physicalTaps >= 0 && physicalTaps > lastTap, 'Observations must advance physical time');
    assert(Array.isArray(alive) && Array.isArray(pictures) && Array.isArray(evidence));
    assert.equal(alive.length, size); assert.equal(pictures.length, size); assert.equal(evidence.length, size);
    for (let index = 0; index < size; index++) {
      assert(alive[index] === 0 || alive[index] === 1);
      assert(!previousAlive || previousAlive[index] || !alive[index], 'Tiles cannot resurrect inside one attempt');
      const picture = pictures[index];
      assert(picture === null || Number.isInteger(picture) && picture >= 0 && picture <= 101);
      assert(alive[index] || picture === null, 'Removed tiles cannot supply new pictures');
      if (picture !== null) {
        if (records[index]) assert.equal(picture, records[index].picture, 'An unchanged board cannot contradict prior observed identity');
        const source = evidence[index];
        assert(source && typeof source.kind === 'string' && source.kind.length);
        assert(typeof source.sha256 === 'string' && /^[a-f0-9]{64}$/.test(source.sha256));
      } else assert.equal(evidence[index], null, 'Unknown pictures must not acquire fabricated provenance');
    }
    for (let index = 0; index < size; index++) {
      if (pictures[index] !== null) {
        records[index] = { picture: pictures[index], observed: { attempt, physicalTaps,
          evidence: { kind: evidence[index].kind, sha256: evidence[index].sha256 } } };
      } else if (alive[index] && records[index] && random() < decay) records[index] = null;
    }
    lastTap = physicalTaps;
    previousAlive = alive.slice();
    return { pictures: records.map((record, index) => alive[index] ? record?.picture ?? null : null),
      provenance: structuredClone(records), attempt, physicalTaps,
      note: 'Memory of supplied current public observations only. Evidence must come from a separately validated observer; this layer does not authenticate perception or infer pictures from the actual deck.' };
  };
  const endAttempt = frame => {
    assert(active);
    assert.equal(frame.type, 'productionPhysicalEnd-v1', 'Computation limits or partial prefixes cannot become free retry losses');
    assert.equal(frame.state.alive.length, size, 'Terminal frame must belong to this board size');
    assert.equal(typeof frame.win, 'boolean');
    assert(Number.isInteger(frame.state.physicalTaps) && frame.state.physicalTaps >= lastTap);
    assert(!previousAlive || previousAlive.every((alive, index) => alive || !frame.state.alive[index]));
    if (frame.computationCensored) ending = 'unresolved';
    else if (frame.win === true) {
      assert(!frame.state.alive.some(Boolean) && !frame.state.tray.length);
      ending = 'cleared';
    }
    else if (['tray', 'clock', 'stuck'].includes(frame.why)) ending = 'physicalLoss';
    else ending = 'unresolved';
    active = false;
    return { attempt, status: ending, wonOn: ending === 'cleared' ? attempt : null,
      remembered: records.filter(Boolean).length };
  };
  return { beginAttempt, observe, endAttempt };
}

module.exports = { createObservedMemory };
