/* Replay fixtures: three real recorded attempts (anonymized: aid a1..a3, no player id, device, session or name)
   must reconstruct offline exactly as recorded, before and after every refactor.
     GOLDEN=record node tests/run.js replay_fixtures   stores the `expect` key in each fixture (only on unchanged code)
     node tests/run.js replay_fixtures                 compares */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { readReplay } = require('../tools/replays');
const DIR = path.join(__dirname, 'fixtures', 'replays');
const sha = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const NAMES = { a1: 'generated level (L2)', a2: 'designed level with an alarm clock (L264)', a3: 'grandma attempt (care track, L115)' };

function summary(records) {
  const r = readReplay(records), last = r.frames[r.frames.length - 1];
  return {
    result: r.result, frames: r.frames.length, complete: r.complete, issues: r.issues, kinds: r.kinds,
    framesHash: sha(r.frames.map(f => [f.ms, f.kind, f.data])),       // every recorded tap, state edit and cue
    statesHash: sha(r.frames.map(f => f.state)),                      // the board after every frame
    initialHash: sha(r.initial),
    last: { ms: last.ms, kind: last.kind, data: last.data, stateHash: sha(last.state) },
  };
}

const tests = Object.keys(NAMES).map(id => ({
  name: `replay fixtures: ${id} ${NAMES[id]} plays back as recorded`,
  async run(t) {
    const file = path.join(DIR, id + '.json'), fx = JSON.parse(fs.readFileSync(file, 'utf8'));
    const got = summary(fx.records);
    if (process.env.GOLDEN === 'record') { fs.writeFileSync(file, JSON.stringify({ ...fx, expect: got }, null, 1) + '\n'); return; }
    t.ok(fx.expect, 'fixture has an expect key (record with GOLDEN=record)');
    t.eq(got, fx.expect, id + ' replay');
    t.eq(got.result, 'win', id + ' ended in a win');
  },
}));

tests.push({
  name: 'replay fixtures: changing one tap makes the compare fail',
  async run(t) {
    const fx = JSON.parse(fs.readFileSync(path.join(DIR, 'a1.json'), 'utf8')), recs = JSON.parse(JSON.stringify(fx.records));
    t.eq(summary(recs), fx.expect, 'untouched copy still matches');
    let changed = false;
    for (const row of Object.values(recs)) {
      const d = JSON.parse(row.data), tap = d.events.find(e => e[1] === 'tap');
      if (!tap) continue;
      tap[0] += 1; row.data = JSON.stringify(d); changed = true; break;   // one tap, 1 ms later (in memory only)
    }
    t.ok(changed, 'found a tap to change');
    t.ok(JSON.stringify(summary(recs)) !== JSON.stringify(fx.expect), 'a changed tap is detected');
  },
});
module.exports = tests;
