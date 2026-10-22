/* Optional real rules check for forecasts/ (the Voorspeltest locks), localhost only. No Firebase account
   or production access. Needs Java and the database emulator jar:
     EMULATOR_JAR=/path/firebase-database-emulator-v4.11.2.jar node tests/forecast_rules_emulator.js
   (download: https://storage.googleapis.com/firebase-preview-drop/emulator/firebase-database-emulator-v4.11.2.jar) */
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), net = require('net');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');

async function main() {
  const jar = process.env.EMULATOR_JAR, java = process.env.JAVA || 'java';
  assert.ok(jar && fs.existsSync(jar), 'set EMULATOR_JAR to the database emulator jar');
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const base = `http://127.0.0.1:${port}`, ns = 'demo-forecasts';
  const proc = spawn(java, ['-Duser.language=en', '-jar', jar, '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '', exit = null;
  proc.stdout.on('data', b => { log += b; }); proc.stderr.on('data', b => { log += b; }); proc.on('exit', code => { exit = code; });
  const call = async (p, method, body, admin = false) => {
    const u = new URL(base + '/' + p + '.json'); u.searchParams.set('ns', ns);
    const r = await fetch(u, { method, headers: admin ? { Authorization: 'Bearer owner' } : {}, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const SV = { '.sv': 'timestamp' };
  const allowed = async (what, p, method, body) => { const r = await call(p, method, body); assert.equal(r.status, 200, what + ': ' + JSON.stringify(r.json)); return r; };
  const denied = async (what, p, method, body) => { const r = await call(p, method, body); assert.notEqual(r.status, 200, what + ' should be refused'); };
  try {
    let ready = false;
    for (let i = 0; i < 120 && exit === null; i++) {
      try { if ((await call('.settings/rules', 'GET', undefined, true)).status === 200) { ready = true; break; } } catch (_) { }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(ready, 'emulator did not start: ' + log.slice(-1500));
    const rules = await call('.settings/rules', 'PUT', JSON.parse(fs.readFileSync(path.join(root, 'firebase/rules.json'), 'utf8')), true);
    assert.equal(rules.status, 200, JSON.stringify(rules.json));

    const before = Date.now();
    await allowed('lock a prediction with the server time', 'forecasts/pGerda/93', 'PUT', { p: 3, t: SV, by: 'gemini', model: 'v9' });
    const locked = (await call('forecasts/pGerda/93', 'GET')).json;
    assert.ok(locked.t >= before - 5000 && locked.t <= Date.now() + 5000 && locked.p === 3, 'stored with the server time');
    await denied('overwrite a locked prediction', 'forecasts/pGerda/93', 'PUT', { p: 5, t: SV, by: 'gemini' });
    await denied('change only its number', 'forecasts/pGerda/93/p', 'PUT', 5);
    await denied('change only its time', 'forecasts/pGerda/93/t', 'PUT', SV);
    await denied('delete it', 'forecasts/pGerda/93', 'DELETE');
    await denied('delete the player\'s whole set', 'forecasts/pGerda', 'DELETE');
    await denied('replace all forecasts', 'forecasts', 'PUT', {});
    await denied('patch over an existing level', 'forecasts/pGerda', 'PATCH', { 93: { p: 1, t: SV, by: 'gemini' }, 94: { p: 1, t: SV, by: 'gemini' } });
    assert.equal((await call('forecasts/pGerda/94', 'GET')).json, null, 'a refused patch writes nothing');
    await allowed('patch several new levels at once', 'forecasts/pGerda', 'PATCH', { 94: { p: 1, t: SV, by: 'gemini' }, 95: { p: 8, t: SV, by: 'gemini' } });
    await denied('backdated time', 'forecasts/pGerda/96', 'PUT', { p: 2, t: before - 86400000, by: 'gemini' });
    await denied('future time', 'forecasts/pGerda/96', 'PUT', { p: 2, t: Date.now() + 3600000, by: 'gemini' });
    await denied('no time', 'forecasts/pGerda/96', 'PUT', { p: 2, by: 'gemini' });
    await denied('try 9', 'forecasts/pGerda/96', 'PUT', { p: 9, t: SV, by: 'gemini' });
    await denied('try 0', 'forecasts/pGerda/96', 'PUT', { p: 0, t: SV, by: 'gemini' });
    await denied('half a try', 'forecasts/pGerda/96', 'PUT', { p: 2.5, t: SV, by: 'gemini' });
    await denied('no author', 'forecasts/pGerda/96', 'PUT', { p: 2, t: SV });
    await denied('extra field (a second guess)', 'forecasts/pGerda/96', 'PUT', { p: 2, t: SV, by: 'gemini', alt: 3 });
    await denied('level that is not a number', 'forecasts/pGerda/abc', 'PUT', { p: 2, t: SV, by: 'gemini' });
    await denied('level 0', 'forecasts/pGerda/0', 'PUT', { p: 2, t: SV, by: 'gemini' });
    await allowed('anyone can read', 'forecasts', 'GET');
    await allowed('test players can be overwritten', 'forecasts/test-x/5', 'PUT', { p: 1, t: SV, by: 'test' });
    await allowed('test players can be overwritten', 'forecasts/test-x/5', 'PUT', { p: 2, t: SV, by: 'test' });
    await allowed('test players can be cleaned up', 'forecasts/test-x/5', 'DELETE');
    await allowed('play records still work', 'plays/pGerda', 'POST', { k: 'start', t: Date.now(), lv: 93 });
    console.log('PASS: forecasts are written once with the server time and can never be changed or deleted (test- players excepted).');
  } finally { proc.kill(); }
}
main().catch(e => { console.error('FAIL:', e.message); process.exitCode = 1; });
