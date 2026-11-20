'use strict';
const assert = require('assert/strict'), path = require('path');
const { Worker } = require('worker_threads');

async function check(filename) {
  return new Promise((resolve, reject) => {
    const messages = [];
    const worker = new Worker("const {parentPort,workerData}=require('worker_threads');require(workerData.modulePath);parentPort.postMessage({imported:true});",
      { eval: true, workerData: { modulePath: path.join(__dirname, filename), entries: [], index: 0 } });
    worker.on('message', message => messages.push(message));
    worker.on('error', reject);
    worker.on('exit', code => {
      try { assert.equal(code, 0); assert.deepEqual(messages, [{ imported: true }], filename + ' ran an unrelated worker entry'); resolve(); }
      catch (error) { reject(error); }
    });
  });
}

module.exports = async () => {
  for (const filename of ['personal_known_plan_data.js', 'personal_known_plan_count_data.js',
    'personal_known_plan_fast_audit.js', 'personal_known_plan_bits_audit.js', 'personal_clock_route_data.js',
    'personal_clock_route_count_data.js', 'personal_clock_strategy_data.js', 'personal_outcome_styles_count_data.js',
    'personal_fresh_count_data.js', 'personal_fresh_clock_first.js', 'personal_clock_intents_first.js',
    'personal_joint_intents_first.js', 'personal_handoff_first.js', 'personal_handoff_count_data.js',
    'personal_recall_count_data.js', 'personal_policy_temperature_data.js', 'personal_public_count_data.js',
    'personal_attention_count_data.js', 'personal_attention_future_data.js', 'personal_attention_memory_data.js',
    'personal_causal_generator_audit.js', 'personal_causal_full26_audit.js', 'personal_verified_count_data.js', 'personal_clock_capacity_first_data.js',
    'personal_clock_capacity_count_data.js', 'personal_variant_count_data.js', 'personal_fresh_known_counts.js',
    'personal_reference_count_data.js', 'personal_distinct_route_count_data.js', 'personal_first_signals_data.js',
    'personal_first_count_data.js', 'personal_source_bound_causal_data.js', 'personal_attention_handoff_counts.js',
    'personal_factorized_count_data.js', 'personal_factorized_joint_data.js', 'personal_pair_capacity_later.js']) await check(filename);
  console.log('PASS importing worker helpers cannot run unrelated simulations or post task rows');
};

if (require.main === module) module.exports().catch(error => { console.error(error); process.exitCode = 1; });
