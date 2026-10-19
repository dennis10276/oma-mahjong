import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from attempt_count_fit import NAMES
from personal_policy_temperature_fit import select_temperatures, validate_sources
from personal_value_fit import ARCHIVE, digest


def select_attention_temperatures(data, cutoff):
    if data['evidence'] != 'own-future-attention-policy-count-calibration-training-only':
        raise ValueError('Changed attention policies need their own completed calibration, not old/pilot counts')
    if set(data['actors']) != set(NAMES):
        raise ValueError('Retain all four separately fitted own controllers')
    for name, controller in data['actors'].items():
        definition = json.loads(controller['definition'])
        if (set(definition) != {'name', 'staticActorId', 'staticSha256', 'jointSha256', 'attentionSha256'}
                or any(not isinstance(definition.get(key), str) or len(definition[key]) != 64
                       or any(character not in '0123456789abcdef' for character in definition[key])
                       for key in ('staticSha256', 'jointSha256', 'attentionSha256'))
                or hashlib.sha256(controller['definition'].encode()).hexdigest() != controller['id']
                or definition['name'] != name or controller['name'] != name
                or definition['staticActorId'] != controller['staticActorId']):
            raise ValueError('Attention calibration lost its own static/joint/attention controller binding')
        for row in data['rows']:
            if row['name'] == name and (row['modelId'] != controller['id'] or row['staticActorId'] != controller['staticActorId']):
                raise ValueError('Old static-only chains cannot substitute for a changed attention controller')
    return select_temperatures({**data, 'evidence': 'own-future-policy-count-calibration-training-only'}, cutoff)


def main(filename):
    data = json.loads(filename.read_bytes())
    source_root = validate_sources(data, filename)
    request = int(datetime.now(timezone.utc).timestamp() * 1000)
    if datetime.fromisoformat(data['made'].replace('Z', '+00:00')).timestamp() * 1000 >= request:
        raise ValueError('Attention counts must finish before their own actual fit request')
    selected = select_attention_temperatures(data, request)
    report = {'made': datetime.now(timezone.utc).isoformat(), 'actualFitRequest': request, 'targetMet': False,
              'evidence': 'own-future-attention-confidence-fit-to-prior-counts-training-only',
              'attentionModelSha256': data['attentionModelSha256'], 'controllers': data['actors'], 'selected': selected,
              'dataFile': str(filename.resolve()), 'dataSourceRoot': str(source_root), 'dataSha256': digest(filename),
              'sourceHashes': {name: digest(Path(__file__).with_name(name)) for name in (
                  Path(__file__).name, 'personal_policy_temperature_fit.py', 'personal_value_fit.py')},
              'note': 'Only this exact own attention controller’s four declared confidence policies train its count likelihood. '
                      'Old-controller/zero controls never replace candidate chains. Any computation-censored person/profile is rejected. '
                      'This is training calibration; fresh future measurement, readiness-bound numeric freezes and later real outcomes are still required.'}
    output = ARCHIVE / 'personal-attention-log-temperature-models.json'
    with output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('data', type=Path)
    main(parser.parse_args().data)
