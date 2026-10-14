/* Optional real rules integration, localhost only. No Firebase account or production access.
   node tests/replay_rules_emulator.js
   Requires the database emulator jar in build/toolchain and the project's bundled JDK. */
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const { pruneReplays } = require('../tools/prune_replays');
const root = path.resolve(__dirname, '..');
async function main() {
  const jar = path.join(root, 'build/toolchain/firebase-database-emulator-v4.11.2.jar');
  const jdk = path.join(root, 'build/toolchain/jdk');
  const java = path.join(jdk, fs.readdirSync(jdk).find(d => fs.existsSync(path.join(jdk, d, 'bin/java.exe'))), 'bin/java.exe');
  const port = await new Promise(resolve => {
    const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); });
  });
  const base = `http://127.0.0.1:${port}`, ns = 'demo-replay-retention';
  const proc = spawn(java, ['-Duser.language=en', '-jar', jar, '--host', '127.0.0.1', '--port', String(port)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', exit = null;
  proc.stdout.on('data', b => { log += b; }); proc.stderr.on('data', b => { log += b; });
  proc.on('error', e => { log += e.message; exit = -1; }); proc.on('exit', code => { exit = code; });
  const request = (url, options = {}) => {
    const u = new URL(url); assert.equal(u.origin, base); u.searchParams.set('ns', ns);
    return fetch(u, { ...options, signal: AbortSignal.timeout(10000) });
  };
  const call = async (p, method, body, admin = false) => {
    const r = await request(base + '/' + p + '.json', { method, headers: admin ? { Authorization: 'Bearer owner' } : {},
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, text: await r.text() };
  };
  try {
    let ready = false;
    for (let i = 0; i < 80 && exit === null; i++) {
      try { if ((await call('.settings/rules', 'GET', undefined, true)).status === 200) { ready = true; break; } } catch (_) { }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.ok(ready, 'Emulator startup failed: ' + log.slice(-1500));
    const rules = await call('.settings/rules', 'PUT', JSON.parse(fs.readFileSync(path.join(root, 'firebase/rules.json'), 'utf8')), true);
    assert.equal(rules.status, 200, rules.text);
    const born = Date.now(), aid = 'attempt-recent', p = 'replays/alice/' + aid;
    const chunk = { v: 1, t: born, code: 'local-test', aid, seq: 0, data: '{"events":[]}' };
    const payload = { createdAt: born, chunk0: chunk };
    assert.equal((await call(p, 'PATCH', payload)).status, 200, 'atomic initial chunk upload');
    assert.equal((await call(p, 'PATCH', payload)).status, 200, 'idempotent lost-ack retry');
    assert.equal((await call(p, 'PATCH', { createdAt: born, chunk1: { ...chunk, seq: 1 } })).status, 200, 'later chunk');
    assert.equal((await call(p, 'DELETE')).status, 401, 'recent attempt deletion refused');
    assert.equal((await call(p + '/createdAt', 'PUT', born - 31 * 86400000)).status, 401, 'birth rewrite refused');
    assert.equal((await call(p, 'PATCH', { createdAt: born, chunk0: { ...chunk, data: 'changed' } })).status, 401, 'chunk overwrite refused');
    assert.equal((await call(p + '/chunk0', 'DELETE')).status, 401, 'individual chunk deletion refused');
    const expired = born - 31 * 86400000;
    assert.equal((await call('replays/alice/expired', 'PUT', { createdAt: expired, chunk0: { ...chunk, aid: 'expired', t: expired } })).status, 401, 'old offline attempt cannot be re-created');
    assert.equal((await call('replays/alice/expired', 'PUT', { createdAt: expired, chunk0: { ...chunk, aid: 'expired', t: expired } }, true)).status, 200, 'local admin fixture seeded');
    const r = await pruneReplays({ base, now: Date.now(), apply: true, batch: 1, request });
    assert.equal(r.deleted, 1, 'indexed cleaner deletes the expired fixture without admin credentials');
    assert.equal((await call('replays/alice/expired', 'GET')).text, 'null');
    assert.equal(JSON.parse((await call(p, 'GET')).text).createdAt, born, 'recent attempt survives cleanup');
    assert.equal((await call('replays/alice/expired', 'PATCH', { createdAt: expired, chunk0: { ...chunk, aid: 'expired', t: expired } })).status, 401, 'stale retry cannot resurrect deleted history');
    console.log('PASS: actual Firebase emulator rules accept replay PATCH/retries, protect recent data and allow only expired cleanup.');
  } finally {
    proc.kill();
    if (exit === null) await new Promise(resolve => proc.once('exit', resolve));
  }
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
