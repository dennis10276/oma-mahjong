'use strict';
const assert = require('assert/strict');
const { unopenedLevels, selectedPolicySettings } = require('./personal_attention_future_data.js');
const { profiles, policyIdentity } = require('./personal_attention_memory_data.js');
const target = { first: 106, levels: [105, 106, 107, 108, 109] };
const events = [{ k: 'start', lv: 53 }, { k: 'start', lv: 106 }, { k: 'start', lv: 107, m: 'd' }, { k: 'start', lv: 108, tk: 'track' }];
assert.deepEqual(unopenedLevels(target, events), [107, 108, 109]);
assert.deepEqual(unopenedLevels(target, Object.fromEntries(events.map((event, index) => [index, event]))), [107, 108, 109]);
assert.deepEqual(unopenedLevels(target, [...events, { k: 'start', lv: 109, at: 20 }]), [107, 108]);
const controller = { id: 'own-controller' }, settings = profiles.none_confidence025;
const selected = { ...settings, controllerId: controller.id, selectedProfile: 'none_confidence025', policy: policyIdentity(controller, settings) };
const input = { policyKind: 'memory-grid', controllers: { Dennis: controller }, selected: { Dennis: selected } };
const entry = { name: 'Dennis', ...settings, selectedProfile: selected.selectedProfile, policyId: selected.policy.id };
assert.deepEqual(selectedPolicySettings(input, entry), settings);
for (const change of [{ memory: [1, 1, 1] }, { policyId: 'old-controller' }, { temperature: .5 }, { recall: 'full' }]) {
  assert.throws(() => selectedPolicySettings(input, { ...entry, ...change }));
}
assert.throws(() => selectedPolicySettings({ ...input, policyKind: 'configured-confidence' }, entry));
assert.throws(() => selectedPolicySettings({ ...input, policyKind: 'invented' }, entry));
assert.equal(selectedPolicySettings({}, {}), null);
console.log('PASS new own-policy forecast preparation excludes opened levels and low replays without confusing daily/track starts or displayed retry counters');
