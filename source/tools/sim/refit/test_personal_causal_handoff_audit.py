import copy
import json
import tempfile
import unittest
from pathlib import Path

from attempt_count_fit import NAMES
from personal_causal_handoff_audit import EVALUATION, LEDGER, PIDS, PROTOCOL, evaluate_snapshot, progression_frontiers, read_ledger, score_frozen
from personal_value_fit import digest


def episode(name, level, start, actual=1):
    return {'name': name, 'lv': level, 'board': str(level), 'start': start, 'end': start + 1,
            'wonOn': actual, 'firstAttempt': 1, 'firstClear': True, 'openingRecorded': True}


def fixture():
    plays = {pid: {'first': {'k': 'start', 't': 1, 'lv': 100}} for pid in PIDS.values()}
    ledger = [{'frozenAt': 100, 'model': PROTOCOL, 'scope': 'first-clear-progression-v1',
               'forecasts': [{'name': name, 'lv': 101 + index, 'board': str(101 + index), 'predictedAttempt': 1}
                             for name in NAMES for index in range(20)]}]
    outcomes = {'evidence': 'separate-live-completed-and-pending-outcomes', 'observedAt': 'later',
                'episodes': [episode(name, 101 + index, 101 + 2 * index) for name in NAMES for index in range(20)]}
    return plays, ledger, outcomes


class CausalHandoffAuditTests(unittest.TestCase):
    def audit_fixture(self, folder):
        snapshot, live = folder / 'snapshot', folder / 'new-live'
        snapshot.mkdir()
        live.mkdir()
        plays, ledger, outcomes = fixture()
        ledger[0]['liveSnapshot'] = 'old-live'
        files = {}
        for relative, payload in ((LEDGER, ledger[0]), ('old-live/plays.json', plays), (EVALUATION, {})):
            filename = snapshot / relative
            filename.parent.mkdir(parents=True, exist_ok=True)
            filename.write_text(json.dumps(payload), encoding='utf-8')
            files[relative] = digest(filename)
        (snapshot / 'audit-manifest.json').write_text(json.dumps({
            'evidence': 'independent-causal-handoff-audit-inputs', 'sourceCommit': 'pinned', 'files': files}), encoding='utf-8')
        (live / 'plays.json').write_text('{}', encoding='utf-8')
        outcomes['observedAt'] = '2026-10-19T00:00:00Z'
        (live / 'manifest.json').write_text(json.dumps({'made': outcomes['observedAt'],
            'evidence': 'read-only-live-opening-check', 'files': {'plays.json': digest(live / 'plays.json')}}), encoding='utf-8')
        outcomes.update(liveManifestSha256=digest(live / 'manifest.json'), playsSha256=digest(live / 'plays.json'))
        filename = live / 'personal-outcomes.json'
        filename.write_text(json.dumps(outcomes), encoding='utf-8')
        return snapshot, filename

    def test_preserved_bundle_is_checked_before_numeric_scoring(self):
        with tempfile.TemporaryDirectory() as directory:
            snapshot, filename = self.audit_fixture(Path(directory))
            self.assertTrue(evaluate_snapshot(snapshot, filename)['targetMet'])
            (snapshot / LEDGER).write_text('changed', encoding='utf-8')
            with self.assertRaises(ValueError):
                evaluate_snapshot(snapshot, filename)

    def test_changed_live_observation_cannot_reuse_export_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            snapshot, filename = self.audit_fixture(Path(directory))
            (filename.parent / 'plays.json').write_text('changed', encoding='utf-8')
            with self.assertRaises(ValueError):
                evaluate_snapshot(snapshot, filename)

    def test_only_original_numeric_freeze_scores_not_current_recalculation(self):
        plays, ledger, outcomes = fixture()
        ledger[0]['forecasts'][0]['predictedAttempt'] = 8
        outcomes['episodes'][0]['wonOn'] = 2
        current = {'frozenFutureForecasts': [{'name': NAMES[0], 'lv': 101, 'board': '101', 'predictedAttempt': 2}],
                   'prospectiveCompletedEpisodes': [episode(NAMES[0], 100, 50, 2)]}
        report = score_frozen(ledger, plays, outcomes, current)
        self.assertEqual(report['cohort'][NAMES[0]]['correct'], 19)
        self.assertEqual(report['scored'][0]['predictedAttempt'], 8)
        self.assertFalse(report['scored'][0]['correct'])
        self.assertEqual(len(report['recomputedEpisodesOpenedBeforeOriginalFreeze']), 1)
        self.assertEqual(report['currentRecomputationDrift'][0]['currentRecomputedAttempt'], 2)
        self.assertFalse(report['originalModelSourceBoundInLedger'])

    def test_future_frontier_cannot_shift_to_forecasts_or_latest_outcomes(self):
        plays, ledger, outcomes = fixture()
        ledger[0]['forecasts'] = [forecast for forecast in ledger[0]['forecasts'] if forecast['lv'] > 101]
        report = score_frozen(ledger, plays, outcomes)
        for name in NAMES:
            self.assertEqual(report['progressionStartLevels'][name], 101)
            self.assertEqual(report['cohort'][name]['opened'], 20)
            self.assertEqual(report['cohort'][name]['missingForecastsOrOpening'], 1)
        self.assertFalse(report['targetMet'])

    def test_pending_unresolved_and_replayed_levels_do_not_disappear(self):
        plays, ledger, outcomes = fixture()
        outcomes['episodes'][0]['wonOn'] = None
        outcomes['episodes'][1]['board'] = None
        outcomes['episodes'].insert(0, episode(NAMES[0], 100, 102))
        outcomes['episodes'].append(episode(NAMES[0], 101, 200))
        report = score_frozen(ledger, plays, outcomes)
        self.assertEqual(report['cohort'][NAMES[0]]['opened'], 20)
        self.assertEqual(report['cohort'][NAMES[0]]['pending'], 1)
        self.assertEqual(report['cohort'][NAMES[0]]['missingForecastsOrOpening'], 1)
        self.assertEqual(len(report['diagnostics']['excludedEpisodes']), 2)
        self.assertFalse(report['targetMet'])

    def test_already_opened_and_equal_freeze_cannot_supply_prospective_accuracy(self):
        plays, ledger, outcomes = fixture()
        outcomes['episodes'] = [episode(NAMES[0], 101, 99), episode(NAMES[1], 101, 100)]
        report = score_frozen(ledger, plays, outcomes)
        self.assertEqual(report['scored'], [])
        self.assertTrue(all(value['opened'] == 0 for value in report['cohort'].values()))
        self.assertFalse(report['targetMet'])

    def test_each_person_needs_twenty_completed_and_eighty_percent(self):
        plays, ledger, outcomes = fixture()
        self.assertTrue(score_frozen(ledger, plays, outcomes)['targetMet'])
        for row in ledger[0]['forecasts'][:5]:
            row['predictedAttempt'] = 2
        self.assertFalse(score_frozen(ledger, plays, outcomes)['targetMet'])

    def test_original_progression_ignores_daily_and_rejects_future_openings(self):
        plays, ledger, outcomes = fixture()
        plays[PIDS[NAMES[0]]]['daily'] = {'k': 'start', 'm': 'd', 'lv': 1000, 't': 2}
        plays[PIDS[NAMES[0]]]['track'] = {'k': 'start', 'tk': 'test', 'lv': 999, 't': 2}
        self.assertEqual(progression_frontiers(plays, 100)[NAMES[0]], 101)
        plays[PIDS[NAMES[0]]]['future'] = {'k': 'start', 'lv': 110, 't': 101}
        with self.assertRaises(ValueError):
            progression_frontiers(plays, 100)

    def test_ledger_rejects_ambiguous_or_nonnumeric_points(self):
        unused_plays, ledger, unused_outcomes = fixture()
        self.assertEqual(read_ledger(json.dumps(ledger[0]).encode()), ledger)
        duplicate = copy.deepcopy(ledger[0])
        duplicate['forecasts'].append(duplicate['forecasts'][0])
        with self.assertRaises(ValueError):
            read_ledger(json.dumps(duplicate).encode())
        for value in (True, 0, -1, 1.5, '2'):
            changed = copy.deepcopy(ledger[0])
            changed['forecasts'][0]['predictedAttempt'] = value
            with self.assertRaises(ValueError):
                read_ledger(json.dumps(changed).encode())


if __name__ == '__main__':
    unittest.main()
