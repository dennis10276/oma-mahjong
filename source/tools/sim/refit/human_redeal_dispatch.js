'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { readSelection } = require('./human_redeal_winnable.js');
const { mergePrefix, readRange, verifySource } = require('./human_redeal_draw_pool.js');
const workspace = path.resolve(__dirname, '../../../..');

function completeLines(filename) {
  if (!fs.existsSync(filename)) return [];
  const text = fs.readFileSync(filename, 'utf8'), last = text.lastIndexOf('\n');
  return last < 0 ? [] : text.slice(0, last).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function chooseRange(levels, progress, running) {
  const candidates = levels.filter(level => !progress.get(level.level).complete).map(level => {
    const current = progress.get(level.level), active = running.filter(job => job.kind === 'pool' && job.level === level.level).length;
    if (current.observedWins >= 10) return null;
    const meanNodes = current.records.reduce((sum, row) => sum + (row.nodes || 0), 0) / Math.max(1, current.records.length);
    const work = (10 - current.wins) * Math.max(10, current.records.length) / Math.max(1, current.observedWins) * (meanNodes + 1000);
    return { level, current, active, work: work / (active + 1) };
  }).filter(Boolean).sort((left, right) => +(left.active > 0) - +(right.active > 0) || right.work - left.work || left.level.level - right.level.level);
  if (!candidates.length) return null;
  const selected = candidates[0], remaining = 10 - selected.current.wins;
  const capped = selected.current.records.filter(row => row.status === 'node_cap').length / Math.max(1, selected.current.records.length);
  const size = capped > 0.5 && remaining <= 2 ? 8 : capped > 0.25 ? 32 : selected.current.records.length > 1000 ? 256 : 128;
  const start = selected.level.scheduledThrough + 1;
  return { kind: 'pool', level: selected.level.level, start, end: start + size - 1 };
}

async function dispatch(config) {
  process.chdir(workspace);
  const maxWorkers = config.maxWorkers ?? 12; assert(Number.isInteger(maxWorkers) && maxWorkers > 0 && maxWorkers <= 12);
  const stateFile = config.poolStateFile, state = JSON.parse(fs.readFileSync(stateFile));
  const manifest = JSON.parse(fs.readFileSync(state.manifestFile));
  const originals = state.originalFiles.map(readSelection);
  for (const worker of originals) {
    verifySource(worker.header); assert.equal(worker.header.manifestHash, manifest.hash);
    if (worker.footer) assert(worker.footer.sourceUnchanged);
    else assert(state.stopped.some(row => row.shard === worker.header.shard && row.pid === worker.header.pid
      && row.authoritativelyTerminal), 'Dispatcher requires terminal original workers');
  }
  for (const filename of state.rangeFiles) {
    const saved = readRange(filename); verifySource(saved.header);
    assert.equal(saved.header.manifestHash, manifest.hash);
    assert(saved.footer?.sourceUnchanged && saved.footer.referenceUnchanged,
      'Resume an interrupted range only after verifying its original handle is terminal');
  }
  const originalRows = originals.flatMap(worker => worker.draws);
  const directory = path.resolve(config.directory); fs.mkdirSync(directory, { recursive: true });
  assert(!fs.existsSync(path.join(directory, 'dispatcher-state.json')), 'Keep previous dispatcher evidence; use a fresh run directory');
  const lock = path.join(directory, 'dispatcher.lock');
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: 'wx' });
  const realQueue = (config.realShards ?? []).slice(), running = new Map(), finished = [];
  assert(realQueue.every(shard => Number.isInteger(shard) && shard >= 0 && shard < 12));
  assert.equal(new Set(realQueue).size, realQueue.length);
  let failed = false, serial = 0, scheduling = false, resolveFinished;
  const completion = new Promise(resolve => { resolveFinished = resolve; });
  const persist = () => fs.writeFileSync(path.join(directory, 'dispatcher-state.json'), JSON.stringify({
    pid: process.pid, updatedAt: new Date().toISOString(), failed, maxWorkers, realQueue,
    running: [...running.values()].map(job => ({ ...job, child: undefined })), finished }, null, 2));
  const refresh = () => {
    const records = originalRows.concat(state.rangeFiles.flatMap(filename => completeLines(filename)
      .filter(row => row.type === 'draw').map(({ type, ...row }) => row)));
    const progress = new Map();
    for (const level of state.levels) {
      const entry = manifest.entries.find(entry => entry.level === level.level); assert(entry);
      const byDraw = new Map();
      for (const row of records.filter(row => row.level === level.level)) {
        if (byDraw.has(row.draw)) assert.deepEqual(row, byDraw.get(row.draw)); else byDraw.set(row.draw, row);
      }
      const selected = [...byDraw.values()], prefix = mergePrefix(entry, state.split, selected);
      level.complete = prefix.complete;
      progress.set(level.level, { ...prefix, wins: prefix.complete ? 10 : prefix.wins,
        records: selected, observedWins: selected.filter(row => row.status === 'cleared').length });
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    return progress;
  };
  const reportFailure = error => {
    failed = true; console.error(String(error.stack ?? error)); persist();
  };
  const launch = spec => {
    const id = ++serial; let args, output;
    if (spec.kind === 'real') {
      args = ['.codex-runs/redeal-v2/run-real-sanity.js', 'run', String(spec.shard), '12'];
      output = '.codex-runs/redeal-v2/real-sanity-' + String(spec.shard).padStart(2, '0') + '.jsonl';
    } else {
      const rangeDirectory = config.rangeDirectory ?? '.codex-runs/redeal-v2/pool';
      fs.mkdirSync(rangeDirectory, { recursive: true });
      output = rangeDirectory + '/level-' + spec.level + '-' + spec.start + '-' + spec.end + '.jsonl';
      args = ['source/tools/sim/refit/human_redeal_draw_pool.js', 'range', state.manifestFile,
        state.referenceFile, String(spec.level), state.split, String(spec.start), String(spec.end), output];
      assert(!fs.existsSync(output)); state.rangeFiles.push(output);
      state.levels.find(level => level.level === spec.level).scheduledThrough = spec.end;
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    }
    assert(!fs.existsSync(output), 'Never silently replay an existing checkpoint');
    const child = spawn(process.execPath, args, { cwd: workspace, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const job = { ...spec, id, output, pid: child.pid, startedAt: new Date().toISOString(), child };
    running.set(id, job);
    child.stdout.pipe(fs.createWriteStream(path.join(directory, 'job-' + id + '.stdout.log')));
    child.stderr.pipe(fs.createWriteStream(path.join(directory, 'job-' + id + '.stderr.log')));
    console.log(JSON.stringify({ event: 'started', ...spec, pid: child.pid, output })); persist();
    child.on('error', reportFailure);
    child.on('close', (code, signal) => {
      running.delete(id);
      const record = { ...job, child: undefined, code, signal, authoritativelyTerminal: true, finishedAt: new Date().toISOString() };
      finished.push(record);
      try {
        assert.equal(code, 0, 'Worker failed; inspect its stderr and checkpoint before resuming');
        if (spec.kind === 'pool') {
          const saved = readRange(output); verifySource(saved.header);
          assert(saved.footer?.sourceUnchanged && saved.footer.referenceUnchanged);
        } else {
          const rows = completeLines(output); assert(rows.some(row => row.type === 'footer' && row.sourceUnchanged));
        }
      } catch (error) { reportFailure(error); }
      console.log(JSON.stringify({ event: 'finished', kind: spec.kind, level: spec.level, shard: spec.shard, code }));
      persist(); schedule();
    });
  };
  const schedule = () => {
    if (scheduling) return; scheduling = true;
    try {
      const progress = refresh();
      while (!failed && running.size < maxWorkers) {
        const realActive = [...running.values()].filter(job => job.kind === 'real').length;
        if (realQueue.length && realActive < (config.maxRealWorkers ?? 4)) { launch({ kind: 'real', shard: realQueue.shift() }); continue; }
        const next = chooseRange(state.levels, progress, [...running.values()]);
        if (next) { launch(next); continue; }
        if (realQueue.length) { launch({ kind: 'real', shard: realQueue.shift() }); continue; }
        break;
      }
      persist();
      if (!running.size) {
        assert(failed || state.levels.every(level => level.complete), 'Missing earlier draw prefix; refusing to skip a gap');
        if (JSON.parse(fs.readFileSync(lock)).pid === process.pid) fs.unlinkSync(lock);
        resolveFinished({ failed, finished: finished.length, completedPoolBoards: state.levels.filter(level => level.complete).length });
      }
    } catch (error) { reportFailure(error); if (!running.size) resolveFinished({ failed: true }); }
    scheduling = false;
  };
  console.log(JSON.stringify({ event: 'dispatcherStarted', pid: process.pid, maxWorkers, poolStateFile: stateFile }));
  schedule(); const result = await completion; console.log(JSON.stringify({ event: 'dispatcherFinished', ...result }));
  if (result.failed) process.exitCode = 1;
  return result;
}

if (require.main === module) dispatch(JSON.parse(fs.readFileSync(process.argv[2]))).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { completeLines, chooseRange, dispatch };
