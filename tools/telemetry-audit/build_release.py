"""Prepare v2 for review/admin installation. Does not modify protected v1 or elevate."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

V1=Path('C:/ProgramData/OmasMahjongAcceptance/v1')
PIN='ac984d93c2fc26107ee8b629cf29a5143e82c2d1392de600e050c41272356a51'

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def build(output):
    source=Path(__file__).resolve().parent
    if digest(V1/'MANIFEST.json')!=PIN:raise ValueError('Protected v1 differs from pinned authority')
    old=json.loads((V1/'MANIFEST.json').read_bytes())
    output=output.resolve();output.mkdir(parents=True,exist_ok=False)
    for name,expected in old['files'].items():
        p=(V1/name).resolve()
        if not p.is_relative_to(V1) or digest(p)!=expected:raise ValueError('Untrusted protected source: '+name)
        dest=output/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
    for name in ['telemetry_audit.py','test_telemetry_audit.py','TASK_CONTRACT.json']:
        dest=output/'telemetry'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source/name,dest)
    shutil.copyfile(source/'Run-TelemetryAudit.ps1',output/'Run-TelemetryAudit.ps1')
    manifest={**old,'telemetryTask':{'contractSha256':digest(source/'TASK_CONTRACT.json'),
        'authority':'Bounded discovery only; no model/G6 promotion', 'protectedV1Unchanged':True},
        'files':{p.relative_to(output).as_posix():digest(p) for p in sorted(output.rglob('*')) if p.is_file()}}
    p=output/'MANIFEST.json';p.write_text(json.dumps(manifest,indent=2)+'\n')
    return {'payload':str(output),'manifestSha256':digest(p),'files':len(manifest['files']),
            'installed':False,'destination':'C:\\ProgramData\\OmasMahjongAcceptance\\v2'}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('output',type=Path)
    print(json.dumps(build(parser.parse_args().output),indent=2))
