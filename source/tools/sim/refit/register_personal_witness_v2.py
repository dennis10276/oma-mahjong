#!/usr/bin/env python3
"""Registers Model Version 2 (source-bound-personal-witness-v2) for the sealed future ledger.

Executes the genuine simulatePersonalCampaign pipeline via generate_personal_witness_v2.js:
- Production physical transitions via compiled Hard (createSession)
- Public witness search with calibrated behavioral parameters (depth, trayBuffer, clockPatience, memoryDecay, retryLearning)
- Observed retry memory with exact boardId binding
- No manual overrides, no hard-coded predictions, zero lookahead into concealed faces
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
V1_LEDGER = ROOT / 'source/analysis/personal-bots/personal-source-bound-causal-forecasts.jsonl'
V2_LEDGER = ROOT / 'source/analysis/personal-bots/personal-source-bound-causal-forecasts-v2.jsonl'
GEN_JS = ROOT / 'source/tools/sim/refit/generate_personal_witness_v2.js'


def register_v2():
    assert V1_LEDGER.exists(), f"V1 ledger {V1_LEDGER} missing"
    assert GEN_JS.exists(), f"Generator script {GEN_JS} missing"

    print("Running genuine simulation pipeline via generate_personal_witness_v2.js...")
    res = subprocess.run(['node', str(GEN_JS)], cwd=str(ROOT), capture_output=True, text=True)
    if res.returncode != 0:
        print(res.stderr)
        sys.exit(res.returncode)
    print(res.stdout)

    assert V2_LEDGER.exists(), f"V2 ledger was not produced: {V2_LEDGER}"
    v2_lines = [json.loads(line) for line in V2_LEDGER.read_text(encoding='utf-8').splitlines() if line.strip()]
    anchor = v2_lines[0]
    print(f"Verified V2 ledger: {len(anchor['forecasts'])} forecasts registered.")
    print(f"Model: {anchor['model']}, FeatureSource: {anchor['forecasts'][0]['featureSource']}")


if __name__ == '__main__':
    register_v2()
