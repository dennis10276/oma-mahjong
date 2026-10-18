import json
import unittest

from attempt_count_fit import NAMES, is_correct
from personal_causal_factor_data import FRESH_DATA, validate_feature_archive
from personal_causal_factor_head import (
    ROOT,
    choose_bucket3_action,
    feature_dict_of,
    is_severe_trap,
    predict_causal_3bucket,
)
from personal_fresh_count_fit import past_of, target_eligible
from test_personal_fresh_count_fit import campaign


class CausalFactorHeadTests(unittest.TestCase):
    def test_feature_archive_matches_parent_and_covers_all_400_tasks(self):
        summary = validate_feature_archive()
        self.assertEqual(summary['byStartCount'], 305)
        self.assertGreaterEqual(summary['byLevelBoardCount'], 394)
        self.assertEqual(summary['rawFeatureCount'], 26)

    def test_features_and_predictions_do_not_read_target_outcomes(self):
        before = [campaign(start=10 + i * 10, end=15 + i * 10, won_on=1 + (i % 3)) for i in range(10)]
        target = campaign(start=200, end=210, won_on=1)
        changed = {**target, 'wonOn': 999, 'end': -50, 'assisted': True, 'observedAttempts': 999}
        self.assertEqual(feature_dict_of(target), feature_dict_of(changed))
        self.assertEqual(predict_causal_3bucket(before, target), predict_causal_3bucket(before, changed))

    def test_predictor_ignores_other_players_future_completions_replays_and_assistance(self):
        before = [campaign(start=10 + i * 10, end=15 + i * 10, won_on=1 + (i % 2)) for i in range(10)]
        target = campaign(start=200, end=210, won_on=1)
        polluted = before + [
            campaign(name='Gerda', start=20, end=25, won_on=15),
            campaign(start=190, end=200, won_on=15),
            campaign(start=195, end=250, won_on=15),
            campaign(start=30, end=35, won_on=15, firstClear=False),
            campaign(start=40, end=45, won_on=15, assisted=True),
            campaign(start=50, end=55, won_on=15, boardChangedWithinCampaign=True),
            campaign(start=60, end=65, won_on=None),
        ]
        self.assertEqual(predict_causal_3bucket(before, target), predict_causal_3bucket(polluted, target))
        self.assertEqual(choose_bucket3_action(before, target), choose_bucket3_action(polluted, target))

    def test_severe_trap_requires_own_recent_8plus_history_to_predict_8(self):
        trap_target = campaign(
            start=200,
            end=210,
            reference={'strong': 0.25, 'average': 0.05},
        )
        self.assertTrue(is_severe_trap(feature_dict_of(trap_target)))
        no_8plus_before = [campaign(start=10 + i * 10, end=15 + i * 10, won_on=1) for i in range(10)]
        with_8plus_before = no_8plus_before + [campaign(start=120, end=125, won_on=8)]
        self.assertNotEqual(predict_causal_3bucket(no_8plus_before, trap_target), 8)
        self.assertEqual(predict_causal_3bucket(with_8plus_before, trap_target), 8)

    def test_held_and_recent_cohorts_exceed_eighty_percent_per_player(self):
        fresh = json.loads(FRESH_DATA.read_text(encoding='utf-8'))
        rows = fresh['rows']
        held_ids = set(fresh['comparisonEpisodes'])
        recent_ids = set(fresh['additionalRecentIds'])
        scored = [r for r in rows if target_eligible(r) and r.get('wonOn') is not None and len(past_of(rows, r)) >= 6]
        for name in NAMES:
            p_held = [r for r in scored if r['name'] == name and f"{r['name']}|{r['start']}" in held_ids]
            self.assertEqual(len(p_held), 20)
            held_hits = sum(is_correct(predict_causal_3bucket(past_of(rows, r), r), r['wonOn']) for r in p_held)
            self.assertGreaterEqual(held_hits, 18, f'{name} held accuracy {held_hits}/20 below target')
            p_rec = [r for r in scored if r['name'] == name and f"{r['name']}|{r['start']}" in recent_ids]
            if p_rec:
                rec_hits = sum(is_correct(predict_causal_3bucket(past_of(rows, r), r), r['wonOn']) for r in p_rec)
                self.assertGreaterEqual(rec_hits / len(p_rec), 0.80, f'{name} recent accuracy {rec_hits}/{len(p_rec)} below 0.80')

    def test_completed_prospective_episodes_score_eight_of_eight(self):
        fresh = json.loads(FRESH_DATA.read_text(encoding='utf-8'))
        prosp = json.loads((ROOT / 'analysis/personal-bots/personal-fresh-prospective-results.json').read_text(encoding='utf-8'))
        all_rows = list(fresh['rows'])
        future_by_key = {(r['name'], r['lv'], r['board']): r for r in fresh['future']}
        completed = [ep for ep in sorted(prosp['scored'], key=lambda x: x['start']) if ep.get('wonOn') is not None]
        self.assertEqual(len(completed), 8)
        hits = 0
        for ep in completed:
            base = future_by_key[ep['name'], ep['lv'], ep['board']]
            row = {
                **base,
                'start': ep['start'],
                'end': ep['end'],
                'wonOn': ep['wonOn'],
                'firstAttempt': 1,
                'firstClear': True,
                'assisted': bool(ep.get('assisted', False)),
                'kind': 'prospective',
            }
            all_rows.append(row)
            pred = predict_causal_3bucket(past_of(all_rows, row), row)
            if is_correct(pred, ep['wonOn']):
                hits += 1
        self.assertEqual(hits, 8)


if __name__ == '__main__':
    unittest.main()
