import copy
import hashlib
import io
import json
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from attempt_count_fit import NAMES
import personal_attention_future as future
from personal_attention_future import PIDS, PROTOCOL, append_snapshot, current_targets, eligible_points, predict_data, read_ledger
from personal_value_fit import digest
from progression_score import score_progression


def fixture():
    controllers = {name: {'id': name + '-attention', 'staticActorId': name + '-static'} for name in NAMES}
    selected = {name: {'actorId': controllers[name]['id'], 'temperature': 1, 'selectedProfile': 'confidence100'} for name in NAMES}
    rows = [{'name': name, 'lv': 101 + index, 'board': str(101 + index), 'version': '1.55',
             'modelId': controllers[name]['id'], 'staticActorId': controllers[name]['staticActorId'],
             'firstAttempt': 1, 'firstClear': True, 'temperature': 1, 'selectedProfile': 'confidence100',
             'chain': {'first': 1, 'within': [1] * 9}, 'computationCaps': 0} for name in NAMES for index in range(24)]
    data = {'evidence': 'own-log-attention-future-counts-not-frozen', 'rows': rows, 'controllers': controllers,
            'selected': selected, 'runs': 32, 'attempts': 9, 'computationCaps': 0, 'validUncensoredSimulation': True,
            'pairedPilotControls': len(rows), 'exactZeroPilotControls': len(rows)}
    plays = {pid: {'start': {'k': 'start', 'lv': 100, 't': 1, 'v': '1.58'},
                   'end': {'k': 'end', 'lv': 100, 'r': 'win', 't': 2, 'v': '1.58'}} for pid in PIDS.values()}
    scores = {pid: {'level': 101} for pid in PIDS.values()}
    return data, plays, scores


def snapshot(points, timestamp=100):
    return {'model': PROTOCOL, 'scope': 'first-clear-progression-v1', 'frozenAt': timestamp,
            'progressionStartLevels': dict.fromkeys(NAMES, 101), 'forecasts': points}


class AttentionFuturePipelineTests(unittest.TestCase):
    def memory_fixture(self):
        data, unused_plays, unused_scores = fixture()
        data['policyKind'] = 'memory-grid'
        for name, selected in data['selected'].items():
            controller = data['controllers'][name]
            definition = json.dumps({'controllerId': controller['id'], 'temperature': .25,
                                     'memory': [0, 0, 0], 'learnFromLoss': True, 'seed': 20261028})
            selected.clear()
            selected.update(controllerId=controller['id'], temperature=.25, memory=[0, 0, 0], recall='none',
                            selectedProfile='none_confidence025',
                            policy={'id': hashlib.sha256(definition.encode()).hexdigest(), 'definition': definition})
        for row in data['rows']:
            selected = data['selected'][row['name']]
            row.update(temperature=.25, memory=[0, 0, 0], recall='none', selectedProfile=selected['selectedProfile'],
                       policyId=selected['policy']['id'])
        return data

    def test_memory_future_points_retain_complete_selected_policy_not_just_old_actor(self):
        data = self.memory_fixture()
        points = predict_data(data)
        self.assertEqual(len(points), 96)
        self.assertTrue(all(point['memory'] == [0, 0, 0] and point['recall'] == 'none' for point in points))
        self.assertEqual(points[0]['policyId'], data['selected'][NAMES[0]]['policy']['id'])
        for change in ({'memory': [1, 1, 1]}, {'policyId': 'old-actor'}, {'recall': 'configured'}, {'temperature': .5}):
            changed = copy.deepcopy(data)
            changed['rows'][0].update(change)
            with self.assertRaises(ValueError):
                predict_data(changed)

    def test_changed_recall_cannot_hide_in_configured_family_or_disable_failure_learning(self):
        data = self.memory_fixture()
        with self.assertRaises(ValueError):
            predict_data({**data, 'policyKind': 'configured-confidence'})
        with self.assertRaises(ValueError):
            predict_data({**data, 'policyKind': 'unknown'})
        policy = data['selected'][NAMES[0]]['policy']
        definition = json.loads(policy['definition'])
        definition['learnFromLoss'] = False
        policy['definition'] = json.dumps(definition)
        policy['id'] = hashlib.sha256(policy['definition'].encode()).hexdigest()
        for row in data['rows']:
            if row['name'] == NAMES[0]:
                row['policyId'] = policy['id']
        with self.assertRaises(ValueError):
            predict_data(data)

    def disk_fixture(self, directory, use_memory=False):
        archive = directory / 'archive'
        folder = archive / 'runs' / 'future-fixture'
        folder.mkdir(parents=True)
        data, plays, scores = fixture()
        if use_memory:
            data = self.memory_fixture()
        sources = {}
        for filename in future.QUANTITATIVE_SOURCES:
            original = Path(future.__file__).with_name(filename)
            target = folder / 'tools/sim/refit' / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(original, target)
            sources['tools/sim/refit/' + filename] = digest(target)
        inputs = {'evidence': 'own-log-attention-unopened-future-input-not-numeric-forecasts',
                  'entries': data['rows'], 'controllers': data['controllers'], 'selected': data['selected'],
                  'confidenceReadyAt': '2026-10-18T00:00:00Z', 'confidenceSha256': 'a' * 64,
                  'calibrationSha256': 'b' * 64, 'targets': {name: {'first': 101} for name in NAMES}}
        inputs['policyKind'] = data.get('policyKind', 'configured-confidence')
        input_file = folder / future.INPUT
        input_file.parent.mkdir(parents=True, exist_ok=True)
        input_file.write_text(json.dumps(inputs), encoding='utf-8')
        manifest_file = folder / 'attention-future-run-manifest.json'
        manifest_file.write_text(json.dumps({'evidence': 'immutable-own-log-attention-future-measurement-run',
            'sourceHashes': dict(sources), 'inputSha256': digest(input_file)}), encoding='utf-8')
        sources.update({future.INPUT: digest(input_file), manifest_file.name: digest(manifest_file)})
        data.update({key: inputs[key] for key in ('confidenceReadyAt', 'confidenceSha256', 'calibrationSha256')})
        data.update(sourceRoot=str(folder), sourceHashes=sources, inputSha256=digest(input_file),
                    started='2026-10-18T00:00:01Z', made='2026-10-18T00:00:02Z')
        (folder / future.DATA).write_text(json.dumps(data), encoding='utf-8')
        return archive, folder, plays, scores

    def test_disk_memory_prediction_preserves_policy_and_refuses_measurement_rebinding(self):
        with tempfile.TemporaryDirectory() as directory:
            archive, folder, unused_plays, unused_scores = self.disk_fixture(Path(directory), use_memory=True)
            with patch.object(future, 'ARCHIVE', archive), redirect_stdout(io.StringIO()):
                future.predict(folder)
                draft = json.loads((folder / future.PREDICTIONS).read_bytes())
                self.assertEqual(draft['policyKind'], 'memory-grid')
                self.assertTrue(all(point['memory'] == [0, 0, 0] for point in draft['forecasts']))
                data = json.loads((folder / future.DATA).read_bytes())
                data['rows'][0]['memory'] = [1, 1, 1]
                (folder / future.DATA).write_text(json.dumps(data), encoding='utf-8')
                with self.assertRaisesRegex(ValueError, 'prepared recall/confidence policy'):
                    future.load_run(folder)

    def test_disk_pipeline_freezes_original_draft_and_excludes_a_start_during_computation(self):
        with tempfile.TemporaryDirectory() as directory:
            archive, folder, plays, scores = self.disk_fixture(Path(directory))
            ledger = Path(directory) / 'forecasts.jsonl'
            with patch.object(future, 'ARCHIVE', archive), patch.object(future, 'LEDGER', ledger):
                with redirect_stdout(io.StringIO()):
                    future.predict(folder)
                prediction_file = folder / future.PREDICTIONS
                draft = json.loads(prediction_file.read_bytes())
                moment = future.millis(draft['made']) + 1000
                plays[PIDS[NAMES[0]]]['opened'] = {'k': 'start', 'lv': 101, 't': moment - 1, 'v': '1.58'}
                live = archive / 'live-openings-fixture'
                live.mkdir()
                (live / 'plays.json').write_text(json.dumps(plays), encoding='utf-8')
                (live / 'scores.json').write_text(json.dumps(scores), encoding='utf-8')
                (live / 'manifest.json').write_text(json.dumps({'evidence': 'read-only-live-opening-check',
                    'made': datetime.fromtimestamp(moment / 1000, timezone.utc).isoformat(),
                    'files': {name: digest(live / name) for name in ('plays.json', 'scores.json')}}), encoding='utf-8')
                with patch.object(future.time, 'time', return_value=(moment + 1000) / 1000), redirect_stdout(io.StringIO()):
                    future.freeze(folder, live)
                frozen = read_ledger(ledger)[0]
                self.assertEqual(len(frozen['forecasts']), 95)
                self.assertFalse(any(point['name'] == NAMES[0] and point['lv'] == 101 for point in frozen['forecasts']))
                self.assertEqual(frozen['predictionSha256'], digest(prediction_file))
                self.assertTrue(all(point['predictedAttempt'] == 1 for point in frozen['forecasts']))
                draft['forecasts'][0]['predictedAttempt'] = 8
                prediction_file.write_text(json.dumps(draft), encoding='utf-8')
                with self.assertRaisesRegex(ValueError, 'draft has changed'):
                    future.freeze(folder, live)
                self.assertEqual(len(read_ledger(ledger)), 1)

    def test_disk_runtime_and_prepared_target_changes_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            archive, folder, unused_plays, unused_scores = self.disk_fixture(Path(directory))
            with patch.object(future, 'ARCHIVE', archive):
                future.load_run(folder)
                target = folder / 'tools/sim/refit' / future.QUANTITATIVE_SOURCES[0]
                target.write_text('changed', encoding='utf-8')
                with self.assertRaisesRegex(ValueError, 'source/input changed'):
                    future.load_run(folder)

    def test_new_selected_controller_produces_real_numeric_points_without_target_labels(self):
        data, unused_plays, unused_scores = fixture()
        points = predict_data(data)
        self.assertEqual(len(points), 96)
        self.assertTrue(all(point['predictedAttempt'] == 1 for point in points))
        self.assertEqual(json.loads(json.dumps(points))[0]['predictedAttempt'], 1)
        for key, value in (('wonOn', None), ('end', 999), ('modelId', 'old-static'), ('temperature', .25)):
            changed = copy.deepcopy(data)
            changed['rows'][0][key] = value
            with self.assertRaises(ValueError):
                predict_data(changed)

    def test_caps_pilots_missing_controls_and_easy_subset_cannot_supply_points(self):
        data, unused_plays, unused_scores = fixture()
        for key, value in (('computationCaps', 1), ('runs', 2), ('attempts', 8), ('pairedPilotControls', 0)):
            with self.assertRaises(ValueError):
                predict_data({**data, key: value})
        changed = copy.deepcopy(data)
        changed['rows'] = [row for row in changed['rows'] if row['name'] != NAMES[0] or row['lv'] < 120]
        changed['pairedPilotControls'] = changed['exactZeroPilotControls'] = len(changed['rows'])
        with self.assertRaises(ValueError):
            predict_data(changed)

    def test_current_progression_ignores_low_replays_and_daily_progress_not_unknown_app_versions(self):
        unused_data, plays, scores = fixture()
        pid = PIDS[NAMES[0]]
        plays[pid]['daily'] = {'k': 'end', 'lv': 2000, 'r': 'win', 'm': 'd', 't': 3, 'v': '1.58'}
        plays[pid]['replay'] = {'k': 'start', 'lv': 53, 't': 4, 'v': '1.58'}
        self.assertEqual(current_targets(plays, scores)[0][NAMES[0]]['first'], 101)
        plays[pid]['daily']['t'] = 5
        plays[pid]['daily']['v'] = '1.59'
        with self.assertRaises(ValueError):
            current_targets(plays, scores)

    def test_opened_levels_are_not_frozen_even_when_their_point_is_correct(self):
        data, plays, scores = fixture()
        points = predict_data(data)
        plays[PIDS[NAMES[0]]]['new'] = {'k': 'start', 'lv': 101, 't': 3, 'v': '1.58'}
        eligible, frontiers, unused_targets = eligible_points(points, plays, scores, [])
        self.assertNotIn((NAMES[0], 101), [(point['name'], point['lv']) for point in eligible])
        self.assertEqual(frontiers[NAMES[0]], 101)
        for level in range(102, 106):
            plays[PIDS[NAMES[0]]][str(level)] = {'k': 'start', 'lv': level, 't': level, 'v': '1.58'}
        with self.assertRaises(ValueError):
            eligible_points(points, plays, scores, [])

    def test_same_family_updates_keep_frontier_and_old_values_and_can_extend_coverage(self):
        data, plays, scores = fixture()
        first = snapshot(predict_data(data))
        for name, pid in PIDS.items():
            plays[pid]['higher'] = {'k': 'end', 'lv': 120, 't': 200, 'r': 'win', 'v': '1.58'}
            scores[pid]['level'] = 121
        later_points = [{**point, 'lv': point['lv'] + 24, 'board': str(point['lv'] + 24)} for point in first['forecasts']]
        selected, frontiers, unused_targets = eligible_points(later_points, plays, scores, [first])
        self.assertEqual(frontiers, first['progressionStartLevels'])
        self.assertEqual(len(selected), 96)
        with self.assertRaises(ValueError):
            eligible_points(first['forecasts'], plays, scores, [first])

    def test_append_preserves_bytes_and_rejects_replacing_points_frontiers_or_backdating(self):
        data, unused_plays, unused_scores = fixture()
        first = snapshot(predict_data(data))
        with tempfile.TemporaryDirectory() as directory:
            ledger = Path(directory) / 'forecasts.jsonl'
            append_snapshot(ledger, first)
            original = ledger.read_bytes()
            with self.assertRaises(ValueError):
                append_snapshot(ledger, {**first, 'frozenAt': 200})
            later = {**first, 'frozenAt': 200, 'forecasts': [
                {**point, 'lv': point['lv'] + 24, 'board': str(point['lv'] + 24)} for point in first['forecasts']]}
            with self.assertRaises(ValueError):
                append_snapshot(ledger, {**later, 'progressionStartLevels': dict.fromkeys(NAMES, 125)})
            with self.assertRaises(ValueError):
                append_snapshot(ledger, {**later, 'frozenAt': 99})
            self.assertEqual(ledger.read_bytes(), original)
            append_snapshot(ledger, later)
            self.assertTrue(ledger.read_bytes().startswith(original))
            self.assertEqual(len(read_ledger(ledger)), 2)

    def test_exclusive_writer_lock_and_duplicate_points_are_not_silently_ignored(self):
        data, unused_plays, unused_scores = fixture()
        first = snapshot(predict_data(data))
        with tempfile.TemporaryDirectory() as directory:
            ledger = Path(directory) / 'forecasts.jsonl'
            lock = ledger.with_suffix('.lock')
            lock.write_text('another writer', encoding='utf-8')
            with self.assertRaises(FileExistsError):
                append_snapshot(ledger, first)
            self.assertEqual(lock.read_text(), 'another writer')
            lock.unlink()
            first['forecasts'].append(first['forecasts'][0])
            with self.assertRaises(ValueError):
                append_snapshot(ledger, first)
            self.assertFalse(ledger.exists())

    def test_only_genuine_later_first_twenty_per_person_can_pass(self):
        data, unused_plays, unused_scores = fixture()
        frozen = snapshot(predict_data(data))
        episodes = [{'name': name, 'lv': 101 + index, 'board': str(101 + index),
                     'start': 101 + 2 * index, 'end': 102 + 2 * index, 'wonOn': 1,
                     'firstAttempt': 1, 'openingRecorded': True} for name in NAMES for index in range(20)]
        self.assertTrue(score_progression([frozen], episodes, frozen['progressionStartLevels'])['targetMet'])
        episodes[19]['wonOn'] = None
        self.assertFalse(score_progression([frozen], episodes, frozen['progressionStartLevels'])['targetMet'])
        episodes[19]['wonOn'] = 1
        episodes[0]['start'] = 99
        self.assertFalse(score_progression([frozen], episodes, frozen['progressionStartLevels'])['targetMet'])


if __name__ == '__main__':
    unittest.main()
