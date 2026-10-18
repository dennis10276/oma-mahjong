import argparse
import json
from pathlib import Path

from personal_known_plan_run import contained, materialize
from personal_value_fit import ARCHIVE, ROOT


def main(name):
    snapshots = (ARCHIVE / 'experiments').resolve()
    snapshot = Path(name)
    snapshot = snapshot.resolve() if snapshot.is_absolute() else contained(snapshots, name)
    if not snapshot.is_relative_to(snapshots):
        raise ValueError('Outcome-style runs require a pinned workspace experiment')
    manifest = json.loads((snapshot / 'manifest.json').read_bytes())
    if (manifest.get('mode') not in ['actions', 'pilot'] or manifest.get('targetMet')
            or manifest.get('evidence') != 'historical-exploratory-outcome-styles-' + manifest['mode']):
        raise ValueError('Outcome-style count runs need their own validated action or paired-pilot closure')
    for name in ['personal_outcome_styles_count_data.js', 'personal_outcome_styles_count_fit.py']:
        if 'tools/sim/refit/' + name not in manifest['files']:
            raise ValueError('Outcome-style count execution and scoring must be declared before the run')
    folder = materialize(snapshot, ROOT, ARCHIVE / 'runs')
    print(json.dumps({'experiment': 'personal-outcome-styles', 'runRoot': str(folder), 'snapshot': str(snapshot),
                      'pilotCommand': ['node', 'tools/sim/refit/personal_outcome_styles_count_data.js', 'pilot'],
                      'fullCommand': ['node', 'tools/sim/refit/personal_outcome_styles_count_data.js']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot')
    main(parser.parse_args().snapshot)
