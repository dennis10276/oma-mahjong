import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from count_profile_prospective import append_snapshot, forecasts_of, validate_coverage


class ProfileProspectiveTests(unittest.TestCase):
    def test_append_can_use_existing_distinct_frozen_coverage_without_resetting_numbers(self):
        names = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']
        earlier = [{'name': name, 'lv': 100 + index, 'upcoming': True} for name in names for index in range(20)]
        new = [{'name': 'Mrs. Doubtfire', 'lv': 120, 'upcoming': True}]
        validate_coverage(new, earlier)
        self.assertRaises(ValueError, validate_coverage, new)
        repeated = [{'name': name, 'lv': 100, 'upcoming': True} for name in names for index in range(20)]
        self.assertRaises(ValueError, validate_coverage, new, repeated)

    def test_append_keeps_every_old_forecast_and_rejects_duplicate_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger = Path(directory) / 'forecasts.json'
            first = {'fingerprint': 'first', 'inputsFrozenAt': 10, 'forecasts': [{'predictedAttempt': 4}]}
            second = {'fingerprint': 'second', 'inputsFrozenAt': 20, 'forecasts': [{'predictedAttempt': 1}]}
            append_snapshot(ledger, first)
            append_snapshot(ledger, second)
            self.assertEqual(json.loads(ledger.read_text()), [first, second])
            self.assertRaises(ValueError, append_snapshot, ledger, first)
            self.assertEqual(json.loads(ledger.read_text()), [first, second])
            self.assertFalse(ledger.with_suffix('.tmp').exists())
            self.assertFalse(ledger.with_suffix('.lock').exists())
            ledger.with_suffix('.lock').write_text('another writer')
            self.assertRaises(FileExistsError, append_snapshot, ledger, {'fingerprint': 'third', 'inputsFrozenAt': 30})
            self.assertEqual(json.loads(ledger.read_text()), [first, second])

    def test_forecast_training_rejects_future_only_outcomes(self):
        data = {'profiles': {'baseline': {}}, 'runs': 10, 'rows': [
            {'name': name, 'firstAttempt': 1, 'wonOn': 1, 'end': 100} for name in
            ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda'] for index in range(6)]}
        self.assertRaises(ValueError, forecasts_of, data, {'inputsFrozenAt': 100, 'rows': []})

    def test_primary_forecast_uses_past_training_and_rejects_target_outcomes(self):
        names = ['Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda']
        base = {'board': 'old', 'firstAttempt': 1, 'lv': 60, 'start': 10, 'wonOn': 1, 'assisted': False,
                'physical': [20, 0.2, 2, 6, 2, 0, 0, 0, 0, 0, 5], 'reference': {'strong': 0.5, 'average': 0.3},
                'chains': {'baseline': {'within': [0.5, 0.75], 'cond': [0.5, 0.5]}}}
        data = {'profiles': {'baseline': {}}, 'runs': 10,
                'rows': [{**base, 'name': name, 'end': 20 + index} for name in names for index in range(6)]}
        data['rows'].append({**base, 'name': 'Gerda', 'end': 100, 'wonOn': 20})
        future = {key: value for key, value in base.items() if key not in ['wonOn', 'assisted']}
        inputs = {'inputsFrozenAt': 100, 'rows': [{**future, 'name': name, 'lv': 70 + index, 'start': 100,
                  'board': 'new', 'priorCounter': 5, 'version': '1.55', 'upcoming': True} for name in names for index in range(20)]}

        class FixedForest:
            classes_ = np.asarray([1, 2])

            def fit(self, features, labels):
                self.labels = labels

            def predict_proba(self, features):
                return np.asarray([[0.1, 0.9]])

        classifier = FixedForest()
        with patch('count_profile_prospective.FACTORIES', {'forest': lambda: classifier}):
            forecasts, through = forecasts_of(data, inputs)
            self.assertEqual(len(forecasts), 80)
            self.assertEqual(classifier.labels, [1] * 24)
            self.assertEqual(through, 25)
            self.assertTrue(all(row['predictedAttempt'] == 2 for row in forecasts))
            self.assertTrue(all(row['predictedDisplayedAttempt'] == 7 for row in forecasts))
            inputs['rows'][0]['wonOn'] = 2
            self.assertRaises(ValueError, forecasts_of, data, inputs)
            del inputs['rows'][0]['wonOn']
            inputs['rows'].append(dict(inputs['rows'][0]))
            self.assertRaises(ValueError, forecasts_of, data, inputs)
            inputs['rows'].pop()
            inputs['rows'][0]['chains'] = {'different': base['chains']['baseline']}
            self.assertRaises(ValueError, forecasts_of, data, inputs)


if __name__ == '__main__':
    unittest.main()
