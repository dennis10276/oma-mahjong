import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import personal_fresh_forecasts_score as scorer


class FreshForecastScoreTests(unittest.TestCase):
    def test_pending_missing_and_existing_miss_survive_rescoring(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / 'analysis/personal-bots'
            output.mkdir(parents=True)
            frontiers = {'Dennisisdebeste': 151, 'Mrs. Doubtfire': 104, 'PUK': 54, 'Gerda': 68}
            snapshots = [{'model': 'fresh-own-first-clear-prequential-v1', 'frozenAt': 100, 'progressionStartLevels': frontiers,
                          'forecasts': [{'name': 'Dennisisdebeste', 'lv': 151, 'board': 'board', 'predictedAttempt': 1}]}]
            ledger = output / 'personal-fresh-forecasts.jsonl'
            ledger.write_text(json.dumps(snapshots[0]) + '\n', encoding='utf8')
            before = ledger.read_bytes()
            rows = [{'name': 'Dennisisdebeste', 'lv': 151, 'board': 'board', 'start': 110, 'end': 120,
                     'firstAttempt': 1, 'openingRecorded': True, 'wonOn': 2},
                    {'name': 'Dennisisdebeste', 'lv': 152, 'board': None, 'start': 130, 'end': 130,
                     'firstAttempt': 1, 'openingRecorded': True, 'wonOn': None}]
            outcomes = root / 'outcomes.json'
            outcomes.write_text(json.dumps({'evidence': 'separate-live-completed-and-pending-outcomes', 'observedAt': 'now',
                                            'episodes': rows, 'unresolvedBoards': 1}), encoding='utf8')
            with patch.object(scorer, 'ROOT', root), contextlib.redirect_stdout(io.StringIO()):
                scorer.main(outcomes)
            report = json.loads((output / 'personal-fresh-prospective-results.json').read_bytes())
            result = report['cohort']['Dennisisdebeste']
            self.assertEqual(result['opened'], 2)
            self.assertEqual(result['completed'], 1)
            self.assertEqual(result['correct'], 0)
            self.assertEqual(result['pending'], 1)
            self.assertEqual(result['missingForecastsOrOpening'], 1)
            self.assertFalse(report['targetMet'])
            self.assertEqual(ledger.read_bytes(), before)
            snapshots[0]['model'] = 'other-protocol'
            ledger.write_text(json.dumps(snapshots[0]) + '\n', encoding='utf8')
            with patch.object(scorer, 'ROOT', root), self.assertRaisesRegex(ValueError, 'protocol'):
                scorer.main(outcomes)

    def test_updated_frontier_cannot_reset_cohort_clock(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / 'analysis/personal-bots'
            output.mkdir(parents=True)
            first = {'model': 'fresh-own-first-clear-prequential-v1', 'frozenAt': 100, 'progressionStartLevels': {'Dennis': 151}}
            later = {**first, 'frozenAt': 200, 'progressionStartLevels': {'Dennis': 160}}
            (output / 'personal-fresh-forecasts.jsonl').write_text(json.dumps(first) + '\n' + json.dumps(later) + '\n', encoding='utf8')
            with patch.object(scorer, 'ROOT', root), self.assertRaisesRegex(ValueError, 'reset'):
                scorer.main(root / 'not-read.json')


if __name__ == '__main__':
    unittest.main()
