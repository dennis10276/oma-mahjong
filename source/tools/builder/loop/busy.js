#!/usr/bin/env node
// Is someone else measuring on this PC? Run before any CPU-heavy bot run of the builder loop.
//   node source/tools/builder/loop/busy.js          -> prints a verdict; exit 0 free, 2 busy
//   node source/tools/builder/loop/busy.js --json   -> the same as JSON
// "Busy" means: node/python processes outside this worktree that used more than one core in
// total over a 3 s sample, or a Codex/Gemini log written in the last 3 minutes, or CPU above 60%.
// GPU work is allowed at any time and does not need this check.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = path.resolve(__dirname, '..', '..', '..', '..'); // this worktree
const ROOT = path.dirname(HERE);                                // C:\Users\den_k\Idea\OmasMahjong
const LOG_DIRS = [
  path.join(ROOT, 'codex-level-factory', 'source', 'build'),
  path.join(ROOT, 'gemini-tasks', 'results'),
  path.join(ROOT, 'gemini-gpu-probe', 'source', 'build'),
];
const RECENT_MS = 3 * 60 * 1000;

function sampleProcesses() {
  const ps = `
$a = @{}; Get-Process node,python -ErrorAction SilentlyContinue | ForEach-Object { $a[$_.Id] = $_.CPU }
Start-Sleep -Milliseconds 3000
$cmd = @{}; Get-CimInstance Win32_Process -Filter "Name='node.exe' or Name='python.exe'" | ForEach-Object { $cmd[[int]$_.ProcessId] = $_.CommandLine }
$load = (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
$rows = Get-Process node,python -ErrorAction SilentlyContinue | ForEach-Object {
  $before = $a[$_.Id]; if ($null -eq $before) { $before = 0 }
  [pscustomobject]@{ pid = $_.Id; cores = [math]::Round(($_.CPU - $before) / 3, 2); cmd = [string]$cmd[$_.Id] }
}
@{ load = $load; procs = @($rows) } | ConvertTo-Json -Depth 4 -Compress`;
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' });
  return JSON.parse(out);
}

function recentLogs() {
  const now = Date.now();
  const hits = [];
  for (const dir of LOG_DIRS) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const n of names) {
      const f = path.join(dir, n);
      try {
        const st = fs.statSync(f);
        if (st.isFile() && now - st.mtimeMs < RECENT_MS) hits.push({ file: path.relative(ROOT, f), agoS: Math.round((now - st.mtimeMs) / 1000) });
      } catch { /* vanished */ }
    }
  }
  return hits;
}

function main() {
  const s = sampleProcesses();
  const self = process.pid;
  const procs = (s.procs || []).filter((p) => p.pid !== self);
  const ours = (p) => p.cmd.toLowerCase().includes(HERE.toLowerCase()) || p.cmd.includes('cc-builder-loop');
  const others = procs.filter((p) => !ours(p) && p.cores > 0.05).sort((x, y) => y.cores - x.cores);
  const otherCores = others.reduce((t, p) => t + p.cores, 0);
  const logs = recentLogs();
  const reasons = [];
  if (otherCores > 1) reasons.push(`other node/python jobs use ${otherCores.toFixed(1)} cores`);
  if (logs.length) reasons.push(`recent logs: ${logs.map((l) => `${l.file} (${l.agoS}s ago)`).join(', ')}`);
  if (s.load > 60) reasons.push(`CPU load ${s.load}%`);
  const verdict = { busy: reasons.length > 0, load: s.load, otherCores: +otherCores.toFixed(2), reasons,
    others: others.slice(0, 8).map((p) => ({ pid: p.pid, cores: p.cores, cmd: p.cmd.slice(0, 160) })) };
  if (process.argv.includes('--json')) console.log(JSON.stringify(verdict, null, 2));
  else {
    console.log(verdict.busy ? `BUSY - ${reasons.join('; ')}` : `FREE - CPU ${s.load}%, other jobs ${otherCores.toFixed(1)} cores`);
    for (const p of verdict.others) console.log(`  ${p.pid} ${p.cores} cores  ${p.cmd}`);
  }
  process.exit(verdict.busy ? 2 : 0);
}

main();
