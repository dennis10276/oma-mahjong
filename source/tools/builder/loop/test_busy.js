'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {activeBuilderJobs} = require('./busy.js');
test('one active builder job blocks another run regardless of its sampled core use', () => {
  const jobs = [{pid:1,cores:0.5,cmd:'node source/tools/builder/loop/run_pipeline.js --n 400'},
    {pid:2,cores:0,cmd:'node "D:\\other\\source\\tools\\builder\\loop\\accept_levels.js" --plan x'},
    {pid:3,cores:0,cmd:'node source/tools/builder/loop/research/compare_tail_plans.js --out x'},
    {pid:4,cores:0,cmd:'node source/tools/builder/loop/research/reframe_clock_plan.js --out x'}];
  assert.deepEqual(activeBuilderJobs(jobs,'C:\\own').map(p=>p.pid),[1,2,3,4]);
});
test('queued wrappers and short tests do not deadlock the queue; active jobs in our checkout still block', () => {
  const jobs = [{pid:1,cmd:'node source/tools/builder/loop/heavy.js -- node source/tools/builder/loop/run_pipeline.js'},
    {pid:2,cmd:'node --test source/tools/builder/loop/test_run_pipeline.js'},
    {pid:3,cmd:'node C:\\own\\source\\tools\\builder\\loop\\run_pipeline.js'}];
  assert.deepEqual(activeBuilderJobs(jobs).map(p=>p.pid),[3]);
});
