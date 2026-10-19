import copy
import math
import unittest

from personal_policy_temperature_fit import TEMPERATURES, count_loss, select_temperatures


def fixture():
    profiles = {str(temperature): {'temperature': temperature} for temperature in TEMPERATURES}
    rows = []
    for name, actual in (('Dennisisdebeste', 1), ('Mrs. Doubtfire', 2), ('PUK', 3), ('Gerda', 9)):
        for index in range(20):
            rows.append({'name': name, 'start': index * 10, 'end': index * 10 + 1, 'wonOn': actual,
                'firstAttempt': 1, 'firstClear': True, 'campaignAids': [name + str(index)], 'modelId': name + '-current',
                'computationCaps': dict.fromkeys(profiles, 0), 'chains': {
                    profile: {'first': float(position == 0), 'within': [float(attempt >= position) for attempt in range(8)]}
                    for position, profile in zip((0, 1, 2, 8), profiles)}})
    return {'evidence': 'own-future-policy-count-calibration-training-only', 'runs': 8, 'attempts': 8, 'profiles': profiles, 'rows': rows,
        'actors': {name: {'id': name + '-current', 'name': name} for name in ('Dennisisdebeste', 'Mrs. Doubtfire', 'PUK', 'Gerda')}}


class DirectPolicyCountCalibrationTests(unittest.TestCase):
    def test_proper_bucket_likelihood_and8plus_tail(self):
        first = {'first': 1, 'within': [1] * 8}
        self.assertLess(count_loss(first, 8, 1), count_loss(first, 8, 2))
        tail = {'first': 0, 'within': [0] * 8}
        self.assertEqual(count_loss(tail, 8, 8), count_loss(tail, 8, 99))
        self.assertAlmostEqual(count_loss(tail, 8, 8), -math.log(8.125 / 9))
        with self.assertRaises(ValueError):
            count_loss({**tail, 'computationCensored': 1}, 8, 8)

    def test_fits_each_person_to_their_clear_counts_not_strongest_policy(self):
        selected = select_temperatures(fixture(), 1000)
        self.assertEqual({name: row['temperature'] for name, row in selected.items()},
            {'Dennisisdebeste': .25, 'Mrs. Doubtfire': .5, 'PUK': 1., 'Gerda': 1.5})
        self.assertEqual(selected['Gerda']['calibrationEpisodes'], 20)

    def test_future_labels_and_other_people_cannot_change_own_fit(self):
        data = fixture()
        expected = select_temperatures(data, 1000)['Dennisisdebeste']
        future = copy.deepcopy(data['rows'][0]); future.update(start=1001, end=1002, wonOn=7)
        data['rows'].append(future)
        for row in data['rows']:
            if row['name'] == 'Gerda':
                row['wonOn'] = 1
        self.assertEqual(select_temperatures(data, 1000)['Dennisisdebeste'], expected)

    def test_censoring_is_rejected_not_treated_as_difficult_human_level(self):
        data = fixture()
        data['rows'][0]['computationCaps']['0.25'] = 1
        selected = select_temperatures(data, 1000)['Dennisisdebeste']
        self.assertIn('0.25', selected['computationCensoredCandidates'])
        self.assertNotEqual(selected['temperature'], .25)
        with self.assertRaises(ValueError):
            select_temperatures(fixture(), 5)
        data = fixture()
        data['rows'][0]['modelId'] = 'older-asof-controller'
        with self.assertRaises(ValueError):
            select_temperatures(data, 1000)


if __name__ == '__main__':
    unittest.main()
