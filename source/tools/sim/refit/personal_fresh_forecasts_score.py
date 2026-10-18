import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from personal_value_fit import ROOT, digest
from progression_score import score_progression


def main(outcome_file):
    ledger_file = ROOT / 'analysis/personal-bots/personal-fresh-forecasts.jsonl'
    ledger = [json.loads(line) for line in ledger_file.read_text(encoding='utf8').splitlines() if line.strip()]
    if not ledger or any(snapshot['model'] != 'fresh-own-first-clear-prequential-v1' for snapshot in ledger):
        raise ValueError('Use the unchanged experimental own-only forecast protocol')
    anchor = min(ledger, key=lambda snapshot: snapshot['frozenAt'])
    if any(snapshot['progressionStartLevels'] != anchor['progressionStartLevels'] for snapshot in ledger):
        raise ValueError('An updated future schedule cannot reset the cohort progression frontier')
    outcomes = json.loads(outcome_file.read_bytes())
    if outcomes['evidence'] != 'separate-live-completed-and-pending-outcomes':
        raise ValueError('Fresh scoring needs explicitly timestamped completed and pending outcomes')
    report = score_progression(ledger, outcomes['episodes'], anchor['progressionStartLevels'])
    report.update({'evaluatedAt': datetime.now(timezone.utc).isoformat(), 'observedAt': outcomes['observedAt'],
        'model': anchor['model'], 'ledgerSha256': digest(ledger_file), 'outcomesSha256': digest(outcome_file),
        'outcomesFile': str(outcome_file.resolve()), 'unresolvedBoardEpisodes': outcomes['unresolvedBoards'],
        'note': 'All first20 newly opened first-clear campaigns remain, including pending, unsupported boards and missing forecasts. '
                'Earliest same-protocol freeze and progression frontiers are unchanged. Newly fitted clock candidates never replace these numeric points. '
                'Older original model ledgers/misses remain separate retained failed evidence.'})
    output = ROOT / 'analysis/personal-bots/personal-fresh-prospective-results.json'
    output.write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps({'targetMet': report['targetMet'], 'observedAt': report['observedAt'], 'cohort': report['cohort']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('outcomes', type=Path)
    main(parser.parse_args().outcomes)
