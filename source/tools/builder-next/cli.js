#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { createBuilder } = require('./builder_next.js');
async function main() {
  const args = process.argv.slice(2), opts = {};
  for (let i=0; i<args.length; i++) {
    if (args[i] === '--help') return console.log('node cli.js --target 10 --layout 22 --seed 1 --candidates 6 --campaigns 80 --out result.json [--knowledge file]');
    if (!['--target','--layout','--seed','--candidates','--campaigns','--wall-ms','--knowledge','--out'].includes(args[i]) || args[i+1] == null)
      throw Error('Unknown or missing option: '+args[i]);
    opts[args[i].slice(2)] = args[++i];
  }
  const number = (key, fallback) => opts[key] == null ? fallback : Number(opts[key]);
  const builder = createBuilder({ knowledgeFile: opts.knowledge });
  const result = await builder.build({ target: number('target',10), layout: number('layout',22), seed: number('seed',undefined) },
    { maxCandidates: number('candidates',6), campaigns: number('campaigns',80), wallMs: number('wall-ms',180000) });
  if (opts.out) fs.writeFileSync(opts.out, JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({ status: result.status, target: result.request.target, attempts: result.attempts.length,
    measured: result.measured, D: result.evaluation?.D, S: result.evaluation?.S, cost: result.cost,
    misses: result.attempts.map(a => ({ recipe:a.recipe.id,D:a.evaluation?.D,S:a.evaluation?.S,issues:a.issues,failure:a.failure })) },null,2));
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode=1; });
module.exports = { main };
