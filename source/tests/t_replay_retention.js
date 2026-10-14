/* Indexed expiry cleanup tests. All HTTP is simulated; production is never touched. */
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { pruneReplays, config } = require('../tools/prune_replays');
const DAY = 86400000, NOW = Date.UTC(2026, 9, 13), cutoff = NOW - 30 * DAY;
function fixture() {
  const records = {
    alice: { old: { createdAt: cutoff - DAY, c: { data: 'old' } }, boundary: { createdAt: cutoff }, recent: { createdAt: cutoff + 1 } },
    bob: { old1: { createdAt: cutoff - 3 }, old2: { createdAt: cutoff - 2 }, old3: { createdAt: cutoff - 1 } },
    'test-reserved': { old: { createdAt: 0 } },
  }, calls = [];
  const request = async (url, options = {}) => {
    const u = new URL(url), parts = u.pathname.replace(/\.json$/, '').split('/').filter(Boolean);
    assert.equal(u.origin, 'https://fixture.invalid'); assert.equal(parts[0], 'replays');
    calls.push({ parts, method: options.method || 'GET', params: Object.fromEntries(u.searchParams) });
    let data;
    if (options.method === 'DELETE') {
      assert.equal(parts.length, 3); assert.ok(records[parts[1]][parts[2]].createdAt <= cutoff);
      delete records[parts[1]][parts[2]]; data = null;
    } else if (parts.length === 1) {
      assert.equal(u.searchParams.get('shallow'), 'true');
      data = Object.fromEntries(Object.keys(records).map(k => [k, true]));
    } else {
      assert.equal(parts.length, 2); assert.equal(u.searchParams.get('orderBy'), '"createdAt"');
      assert.equal(+u.searchParams.get('endAt'), cutoff); assert.equal(u.searchParams.get('startAt'), '0');
      data = Object.fromEntries(Object.entries(records[parts[1]]).filter(([, r]) => r.createdAt <= cutoff)
        .sort((a, b) => a[1].createdAt - b[1].createdAt).slice(0, +u.searchParams.get('limitToFirst')));
    }
    return { ok: true, text: async () => JSON.stringify(data) };
  };
  return { records, calls, request, base: 'https://fixture.invalid', now: NOW, batch: 2 };
}
module.exports = [
  {
    name: 'replay retention: exact 30-day boundary, indexed pagination and recent/test attempts are preserved',
    cpu: true,
    async run(t) {
      const f = fixture(), r = await pruneReplays({ ...f, apply: true });
      t.eq(r.deleted, 5, 'all expired attempts removed across multiple batches');
      t.eq(r.expired, 5, 'count matches verified expired attempts');
      t.eq(f.records.alice, { recent: { createdAt: cutoff + 1 } }, 'one millisecond inside retention is preserved');
      t.eq(f.records.bob, {}, 'pagination reaches the last expired attempt');
      t.eq(f.records['test-reserved'], { old: { createdAt: 0 } }, 'test namespaces untouched');
      t.eq(r.players, 2, 'only actual players queried');
      t.ok(f.calls.filter(c => c.parts.length === 2).length === 4 && r.downloadBytes > 0, 'bounded indexed queries and download accounting');
    },
  },
  {
    name: 'replay retention: dry run performs no writes and marks limited counts as incomplete',
    cpu: true,
    async run(t) {
      const f = fixture(), before = JSON.stringify(f.records), r = await pruneReplays(f);
      t.eq(JSON.stringify(f.records), before, 'dry run changes nothing');
      t.eq(r.deleted, 0, 'no deletions');
      t.eq(r.expired, 4, 'one limited batch per player');
      t.ok(r.dryRunMayHaveMore, 'never presents a limited sample as a complete expired count');
      t.ok(f.calls.every(c => c.method === 'GET'), 'no write HTTP requests in default mode');
    },
  },
  {
    name: 'replay retention: unsafe responses and HTTP failures stop cleanup before unchecked deletions',
    cpu: true,
    async run(t) {
      for (const records of [
        { old: { createdAt: cutoff }, recent: { createdAt: cutoff + 1 } },
        { old: { createdAt: cutoff }, missingDate: {} },
        { '../outside': { createdAt: cutoff } },
        { a: { createdAt: cutoff }, b: { createdAt: cutoff }, c: { createdAt: cutoff } },
      ]) {
        let calls = 0, deleted = 0;
        const request = async (url, options = {}) => {
          if (options.method === 'DELETE') deleted++;
          return { ok: true, text: async () => JSON.stringify(calls++ === 0 ? { alice: true } : records) };
        };
        await assert.rejects(pruneReplays({ base: 'https://fixture.invalid', now: NOW, batch: 2, apply: true, request }), /Refusing|not limited/);
        t.eq(deleted, 0, 'whole response verified before any attempt deleted');
      }
      const f = fixture();
      await assert.rejects(pruneReplays({ ...f, apply: true, maxDeletes: 1 }), /safety limit/);
      t.eq(f.calls.filter(c => c.method === 'DELETE').length, 1, 'delete limit enforced');
      await assert.rejects(pruneReplays({ request: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
      const g = fixture();
      await assert.rejects(pruneReplays({ ...g, apply: true, request: (url, options) => options && options.method === 'DELETE'
        ? Promise.resolve({ ok: false, status: 403 }) : g.request(url, options) }), /delete failed: HTTP 403/);
    },
  },
  {
    name: 'replay retention: client, backend rules and scheduled cleanup share the 30-day policy',
    cpu: true,
    async run(t) {
      const root = path.resolve(__dirname, '..'), read = p => fs.readFileSync(path.join(root, p), 'utf8');
      const rules = JSON.parse(read('firebase/rules.json')).rules.replays.$pid;
      t.eq(config.days, 30, 'cleaner uses 30 days');
      t.ok(/retentionDays: 30/.test(read('www/js/telemetry.js')), 'phone uses the same retention period');
      t.eq(rules['.indexOn'], ['createdAt'], 'queries have a database index');
      // Evaluate the actual write predicate against snapshots: not a substitute for emulator integration.
      const write = new Function('data', 'newData', 'now', 'return ' + rules.$attempt['.write']);
      const snap = value => ({ exists: () => value != null, isNumber: () => Number.isFinite(value), val: () => value,
        child: k => snap(value && value[k]) });
      t.ok(write(snap({ createdAt: cutoff }), snap(null), NOW), 'server allows exact-boundary cleanup');
      t.ok(!write(snap({ createdAt: cutoff + 1 }), snap(null), NOW), 'server refuses deletion of recent attempts');
      t.ok(!write(snap({}), snap(null), NOW), 'server refuses undated deletion');
      t.ok(!write(snap({ createdAt: cutoff }), snap({ createdAt: cutoff }), NOW), 'expiry permission cannot authorize an overwrite');
      const birth = new Function('data', 'newData', 'return ' + rules.$attempt.createdAt['.write']);
      t.ok(!birth(snap(NOW), snap(cutoff)), 'existing birth date cannot be rewritten to force early deletion');
      const workflow = read('tools/replay-retention.yml');
      t.ok(workflow.includes("cron: '41 3 * * *'") && workflow.includes('node source/tools/prune_replays.js --apply'), 'daily job calls bounded cleanup');
      t.ok(read('release.py').includes("'replay-retention.yml'"), 'future releases install the workflow');
    },
  },
];
