import unittest

from personal_fresh_clock_fit import checked_training
from personal_prefix_versions import semantic_prefix, training_identity


def fixture():
    game = {'aid': 'own-attempt', 'lv': 100, 'at': 1, 't': 10, 'availableAt': 20, 'observedAt': 30, 'decisions': []}
    game['versionSha256'] = semantic_prefix(game)[1]
    identity, roster = training_identity('Dennis', [game])
    actor = {'id': identity, 'name': 'Dennis', 'trainingCut': 40, 'trainingGames': {'Dennis': 1},
             'trainedVersions': [{'aid': aid, 'availableAt': available, 'versionSha256': version} for aid, available, version in roster]}
    bank = {'type': 'personalPrefixVersions-v1', 'players': {'Dennis': [game], 'Other': []}}
    return bank, actor, game


class FreshClockMembershipTests(unittest.TestCase):
    def test_exact_own_version_is_retained(self):
        bank, actor, game = fixture()
        self.assertEqual(checked_training(bank, actor), [game])

    def test_clock_annotations_cannot_change_semantic_identity(self):
        bank, actor, game = fixture()
        game['decisions'] = [{'F': [[0], [1]], 'immediate': [[0], [1]], 'kindContext': [0] * 26, 'k': 0}]
        annotated = {**game, 'decisions': [{**game['decisions'][0], 'knownPlan': [[1], [0]]}]}
        self.assertEqual(semantic_prefix(game), semantic_prefix(annotated))
        changed = {**annotated, 'decisions': [{**annotated['decisions'][0], 'k': 1}]}
        self.assertNotEqual(semantic_prefix(game), semantic_prefix(changed))

    def test_unobserved_future_fit_is_refused(self):
        bank, actor, game = fixture()
        game['observedAt'] = actor['trainingCut']
        with self.assertRaisesRegex(ValueError, 'membership'):
            checked_training(bank, actor)
        actor['historicalExploratoryOnly'] = True
        self.assertEqual(checked_training(bank, actor), [game])

    def test_replaced_roster_or_missing_own_prefix_is_refused(self):
        bank, actor, game = fixture()
        actor['trainedVersions'][0]['versionSha256'] = 'different'
        with self.assertRaisesRegex(ValueError, 'membership'):
            checked_training(bank, actor)
        bank['players']['Dennis'] = []
        with self.assertRaisesRegex(ValueError, 'membership'):
            checked_training(bank, actor)


if __name__ == '__main__':
    unittest.main()
