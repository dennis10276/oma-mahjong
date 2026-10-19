import copy
import hashlib
import json
import unittest

from personal_attention_count_fit import select_attention_temperatures
from test_personal_policy_temperature_fit import fixture as original_fixture


def fixture():
    data = original_fixture()
    data['evidence'] = 'own-future-attention-policy-count-calibration-training-only'
    for name, controller in data['actors'].items():
        static_id = controller['id']
        definition = json.dumps({'name': name, 'staticActorId': static_id,
                                 'staticSha256': '1' * 64, 'jointSha256': '2' * 64, 'attentionSha256': '3' * 64})
        controller.update(id=hashlib.sha256(definition.encode()).hexdigest(), definition=definition, staticActorId=static_id)
        for row in data['rows']:
            if row['name'] == name:
                row.update(modelId=controller['id'], staticActorId=static_id)
    return data


class OwnAttentionCountFitTests(unittest.TestCase):
    def test_fits_separate_current_own_controllers_to_counts_not_win_rate(self):
        selected = select_attention_temperatures(fixture(), 1000)
        self.assertEqual({name: row['temperature'] for name, row in selected.items()},
                         {'Dennisisdebeste': .25, 'Mrs. Doubtfire': .5, 'PUK': 1., 'Gerda': 1.5})

    def test_old_controller_and_pilot_counts_cannot_be_relabelled_as_this_policy(self):
        with self.assertRaises(ValueError):
            select_attention_temperatures(original_fixture(), 1000)
        data = fixture()
        data['rows'][0]['modelId'] = data['rows'][0]['staticActorId']
        with self.assertRaises(ValueError):
            select_attention_temperatures(data, 1000)
        data = fixture()
        data['runs'] = 2
        with self.assertRaises(ValueError):
            select_attention_temperatures(data, 1000)

    def test_binding_includes_this_person_and_all_actual_policy_parameters(self):
        for replacement in ('{}', '{"name":"Other"}'):
            data = fixture()
            data['actors']['Dennisisdebeste']['definition'] = replacement
            with self.assertRaises((ValueError, KeyError)):
                select_attention_temperatures(data, 1000)
        data = fixture()
        data['actors']['Dennisisdebeste']['staticActorId'] = 'wrong'
        with self.assertRaises(ValueError):
            select_attention_temperatures(data, 1000)

    def test_other_people_and_future_labels_cannot_change_own_selection(self):
        data = fixture()
        expected = select_attention_temperatures(data, 1000)['Dennisisdebeste']
        for row in data['rows']:
            if row['name'] != 'Dennisisdebeste':
                row['wonOn'] = 12
        future = copy.deepcopy(data['rows'][0])
        future.update(start=1001, end=1002, wonOn=12)
        data['rows'].append(future)
        self.assertEqual(select_attention_temperatures(data, 1000)['Dennisisdebeste'], expected)


if __name__ == '__main__':
    unittest.main()
