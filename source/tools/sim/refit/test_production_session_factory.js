'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const Layouts = require('../../../www/layouts.js');
const { createSession, createSessionFactory } = require('./production_physical_session.js');
const filename = path.resolve(__dirname, '../../../www/hard.js'), originalRead = fs.readFileSync;
const tiles = [{ x: 0, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }];
const game = { tiles, nb: Layouts.neighbors(tiles), faces: [2, 2], down: [1, 1], rules: null, clock: null };
let reads = 0, pretendChanged = false;
try {
  fs.readFileSync = function (target, ...options) {
    const bytes = originalRead.call(this, target, ...options);
    if (path.resolve(target) !== filename || options[0] !== 'utf8') return bytes;
    reads++; return pretendChanged ? bytes + '\n' : bytes;
  };
  const factory = createSessionFactory(); assert.equal(reads, 1);
  const sessions = Array.from({ length: 20 }, () => factory(game)); assert.equal(reads, 1);
  factory.verifySource(); assert.equal(reads, 2);
  const standard = createSession(game); assert.equal(reads, 3);
  standard.tap(0); standard.tap(1);
  for (const session of sessions) { session.tap(0); session.tap(1); assert.deepEqual(session.audit(), standard.audit()); }
  pretendChanged = true;
  assert.throws(() => factory.verifySource(), /Pinned production source changed/);
  assert.throws(() => createSession(game), /AssertionError/);
  const pinned = factory(game); pinned.tap(0); pinned.tap(1); assert.deepEqual(pinned.audit(), standard.audit());
  pretendChanged = false; factory.verifySource();
  console.log('PASS batch factory pins verified production code, removes per-session source reads, preserves full traces, rejects changed-source validation and keeps the standard constructor guard');
} finally { fs.readFileSync = originalRead; }
