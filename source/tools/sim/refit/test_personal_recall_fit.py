import unittest

from personal_recall_fit import materialize, blocked_split
from personal_prefix_versions import semantic_prefix, select_prefixes


def game(index, level=None):
    prefix = {'aid': 'aid-' + str(index), 'lv': level if level is not None else index, 'at': 1,
        't': 10 * index + 1, 'availableAt': 10 * index + 2, 'observedAt': 10 * index + 3, 'decisions': []}
    prefix['versionSha256'] = semantic_prefix(prefix)[1]
    return prefix


def fixture():
    original = game(2)
    base = {'type': 'personalPrefixVersions-v1', 'features': [], 'kindContextFeatures': [], 'base': [], 'players': {'Dennis': [game(0), game(1), original]}}
    alternate = {**original, 'originalVersionSha256': original['versionSha256'], 'inheritedPictures': 1,
        'memorySources': [{'aid': 'aid-1', 'availableAt': 12}]}
    prepared = {'type': 'personalRecallAlternatives-v1', 'alternatives': {'configured': {'Dennis': [alternate]}, 'full': {'Dennis': [alternate]}}}
    return base, prepared


class ConsistentRecallFitTests(unittest.TestCase):
    def test_no_memory_controls_and_causal_variant_identity(self):
        base, prepared = fixture()
        none = materialize(base, prepared, 'none')
        self.assertEqual(none, base)
        recalled = materialize(base, prepared, 'configured')
        self.assertEqual(recalled['players']['Dennis'][0], base['players']['Dennis'][0])
        self.assertNotEqual(recalled['players']['Dennis'][2]['versionSha256'], base['players']['Dennis'][2]['versionSha256'])
        selected = select_prefixes(recalled, 'Dennis', 40, excluded=['aid-1'])
        self.assertEqual([prefix['aid'] for prefix in selected], ['aid-0'])

    def test_future_or_changed_source_refused(self):
        for changed in ({'originalVersionSha256': 'wrong'}, {'memorySources': [{'aid': 'aid-1', 'availableAt': 21}]},
                        {'memorySources': [{'aid': 'aid-2', 'availableAt': 12}]}):
            base, prepared = fixture()
            prepared['alternatives']['configured']['Dennis'][0].update(changed)
            with self.assertRaises(ValueError):
                materialize(base, prepared, 'configured')

    def test_block_excludes_whole_levels_not_only_selected_attempts(self):
        games = [game(0, 9), game(1, 1), game(2, 9), game(3, 10)]
        cutoff, excluded, held = blocked_split(games, limit=2)
        self.assertEqual(cutoff, 21)
        self.assertEqual(excluded, ['aid-0', 'aid-2', 'aid-3'])
        self.assertEqual(held, ['aid-2', 'aid-3'])
        with self.assertRaises(ValueError):
            blocked_split(games, limit=4)


if __name__ == '__main__':
    unittest.main()
