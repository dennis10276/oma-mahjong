"""Bounded, fail-closed local telemetry discovery. Never a G6 certification."""
import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import stat
import time

PIDS = {'pmuy78xu6tsths9':'Dennisisdebeste','pmv16kj3jr35750':'Mrs. Doubtfire',
        'pmv2gaa0g00eq3q':'PUK','pmv6yhzz3x9oxs8':'Gerda'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def inventory(roots, deadline=None):
    files, errors = {}, []
    for root in roots:
        root = Path(root)
        if (not root.is_dir() or root.is_symlink() or
                os.path.normcase(str(root.resolve()))!=os.path.normcase(os.path.abspath(root)) or
                bool(getattr(root.lstat(),'st_file_attributes',0) & 0x400)):
            errors.append(f'Missing or linked scope root: {root}')
            continue
        def walk_error(error):
            errors.append(str(error))
        for folder, dirs, names in os.walk(root, onerror=walk_error, followlinks=False):
            for name in list(dirs) + names:
                if deadline is not None and time.monotonic()>deadline:
                    errors.append('Bounded audit time exhausted; inventory incomplete, no exhaustion claim permitted')
                    return dict(sorted(files.items())), errors
                p = Path(folder)/name
                try:
                    info = p.lstat()
                    linked = p.is_symlink() or bool(getattr(info,'st_file_attributes',0) & 0x400)
                    if linked:
                        errors.append(f'Unresolved reparse/link: {p}')
                        if name in dirs:
                            dirs.remove(name)
                        continue
                    if not stat.S_ISREG(info.st_mode):
                        continue
                    if info.st_size>64*1024*1024:
                        files[str(p)]={'sha256':None,'bytes':info.st_size}
                        errors.append(f'Large source requires separately reviewed streaming hash/extraction: {p}')
                        continue
                    h = hashlib.sha256()
                    with p.open('rb') as stream:
                        for chunk in iter(lambda: stream.read(1024*1024), b''):
                            if deadline is not None and time.monotonic()>deadline:
                                raise OSError('Bounded audit time exhausted during hashing')
                            h.update(chunk)
                    files[str(p)] = {'sha256': h.hexdigest(), 'bytes': info.st_size}
                except OSError as error:
                    errors.append(f'{p}: {error}')
    return dict(sorted(files.items())), errors


def extract(path, metadata):
    """Every file gets a disposition. Unknown never means irrelevant/no telemetry."""
    p = Path(path)
    if metadata['bytes'] > 64*1024*1024:
        return 'UNRESOLVED_SIZE', [], 'Requires a reviewed streaming adapter'
    if p.suffix.lower() not in ('.json','.jsonl'):
        return 'UNRESOLVED_NON_JSON', [], 'Manual/source-specific review required'
    try:
        raw = p.read_bytes()
        if sha(raw) != metadata['sha256']:
            return 'UNRESOLVED_CHANGED', [], 'Input changed during extraction'
        data = json.loads(raw.decode('utf-8-sig')) if p.suffix.lower()=='.json' else [json.loads(x) for x in raw.decode('utf-8-sig').splitlines() if x.strip()]
    except (ValueError, OSError, UnicodeError) as error:
        return 'UNRESOLVED_PARSE', [], str(error)
    if isinstance(data, list) and data and all(isinstance(x,dict) and 'forecasts' in x and 'model' in x for x in data):
        return 'CANDIDATE_LEDGER_NOT_GAMEPLAY', [], None
    if isinstance(data, dict) and data.get('evidence') == 'separate-live-completed-and-pending-outcomes' and isinstance(data.get('episodes'),list):
        records=[]
        for i,e in enumerate(data['episodes']):
            if (not isinstance(e,dict) or e.get('name') not in PIDS.values() or
                    type(e.get('start')) not in (int,float) or not math.isfinite(e['start']) or
                    not 1e12 < e['start'] < 1e14):
                return 'UNRESOLVED_EPISODE', records, f'Invalid episode {i}'
            records.append({'name':e['name'],'lv':e.get('lv'),'start':e['start'], 'board':e.get('board'),
                'wonOn':e.get('wonOn'), 'openingRecorded':e.get('openingRecorded') is True,
                'assisted':e.get('assisted',None), 'origin':'DERIVED_UNAUTHENTICATED',
                'availableAt':data.get('observedAt'), 'sourceRecord':str(i), 'payload':e})
        # Episodes are leads. An evidence label and self-reported hashes do not
        # authenticate human origin, exact boards, or completeness of raw events.
        return 'UNRESOLVED_DERIVED_PROVENANCE', records, 'Reconstruct from bound raw export before eligibility'
    if isinstance(data,dict) and any(k in PIDS for k in data):
        records=[]; unresolved=False
        for pid,events in data.items():
            if pid not in PIDS:
                unresolved=True
                continue
            if not isinstance(events,dict):
                unresolved=True
                continue
            for event_id,e in events.items():
                if not isinstance(e,dict) or e.get('k') not in ('start','end'):
                    unresolved=True
                    continue
                if type(e.get('t')) not in (int,float) or not math.isfinite(e['t']) or not 1e12 < e['t'] < 1e14:
                    unresolved=True
                    continue
                records.append({'name':PIDS[pid],'lv':e.get('lv'),'start':e['t'] if e['k']=='start' else None,
                    'eventTime':e['t'],'kind':e['k'],'aid':e.get('aid'),'board':e.get('board'),
                    'origin':'RAW_EVENT_NEEDS_CAMPAIGN_RECONSTRUCTION','sourceRecord':pid+'/'+event_id,'payload':e})
        return 'UNRESOLVED_RAW_CAMPAIGNS',records,'Raw start/end events retained; retries, missing openings and exact boards require reviewed reconstruction'
    return 'UNRESOLVED_SCHEMA', [], 'No reviewed adapter; cannot infer absence of telemetry'


def deduplicate(records):
    unique, conflicts = {}, []
    for r in records:
        # Preserve raw event IDs; do not collapse distinct attempts or campaigns
        # merely because name/level/time happen to match.
        key=(r['origin'],r['name'],r['sourceRecord']) if r['origin'].startswith('RAW_') else (r['origin'],r['name'],r.get('lv'),r.get('start'),r.get('board'))
        payload=sha(json.dumps(r['payload'],sort_keys=True,separators=(',',':')).encode())
        if key in unique:
            old=unique[key]
            if old['payloadSha256']!=payload:
                conflicts.append({'identity':list(key),'sources':old['sources']+[r['source']]})
            old['sources'].append(r['source'])
        else:
            unique[key]={**r,'payloadSha256':payload,'sources':[r['source']]}
    return list(unique.values()),conflicts


def classify(record, candidate):
    if record.get('start') is None:
        return 'UNRESOLVED_NO_OPENING'
    if record['start'] <= candidate['frozenAt']:
        return 'HISTORICAL_BEFORE_CANDIDATE_FREEZE'
    if record.get('lv',-1) < candidate['progressionStartLevels'].get(record['name'],0):
        return 'BELOW_DECLARED_FRONTIER'
    if record.get('assisted') is True:
        return 'ASSISTED_INELIGIBLE'
    if not record.get('board') or not record.get('openingRecorded'):
        return 'UNRESOLVED_BOARD_OR_OPENING'
    # Discovery does not certify a self-reported episode. G6 must independently
    # authenticate raw origin, first-20 membership, before-opening forecast and score.
    return 'POST_FREEZE_LEAD_REQUIRES_G6_AUTHENTICATION'


def gate(passed, details):
    return {'status':'PASS' if passed else 'INCOMPLETE','passed':bool(passed),'details':details}


def audit(contract):
    deadline=time.monotonic()+contract.get('maxRunSeconds',120)
    before,errors=inventory(contract['roots'],deadline)
    for path,size in contract.get('requiredInventory',{}).items():
        if path not in before:
            errors.append(f'Pinned source missing or outside completed inventory: {path}')
        elif before[path]['bytes']!=size:
            errors.append(f'Pinned source size changed: {path}')
    sources=[]; records=[]
    for path,metadata in before.items():
        status,rows,reason=(extract(path,metadata) if time.monotonic()<=deadline else
            ('UNRESOLVED_BUDGET',[],'Bounded run ended; no exhaustion claim permitted'))
        if status=='CANDIDATE_LEDGER_NOT_GAMEPLAY' and path not in contract['candidateHashes']:
            status='UNRESOLVED_UNPINNED_LEDGER';reason='Cannot relabel an arbitrary source as a registered candidate to bypass extraction'
        sources.append({'path':path,**metadata,'disposition':status,'records':len(rows),'reason':reason})
        records.extend({**r,'source':path} for r in rows)
    unique,conflicts=deduplicate(records)
    candidates=[]; candidate_errors=[]
    for path,expected in contract['candidateHashes'].items():
        try:
            raw=Path(path).read_bytes()
            if sha(raw)!=expected:
                raise ValueError('Registered candidate changed')
            rows=[json.loads(line) for line in raw.decode('utf-8-sig').splitlines() if line.strip()]
            if len(rows)!=1 or type(rows[0].get('frozenAt')) not in (int,float):
                raise ValueError('Unresolved candidate schema')
            c=rows[0]
            counts=defaultdict(int)
            for r in unique:
                counts[classify(r,c)]+=1
            candidates.append({'path':path,'sha256':expected,'model':c['model'], 'frozenAt':c['frozenAt'],
                'classifications':dict(counts), 'cohortInheritedBeforeFreeze':c.get('cohortStartsAfter',0)<c['frozenAt'],
                'prospectiveSuccessEstablished':False})
        except (OSError,ValueError,KeyError,TypeError) as error:
            candidate_errors.append(f'{path}: {error}')
    after,after_errors=inventory(contract['roots'],deadline)
    unresolved=[s['path'] for s in sources if s['disposition'].startswith('UNRESOLVED')]
    gates={
        'T0_SCOPE':gate(bool(contract['roots']) and not errors,errors),
        'T1_INVENTORY':gate(before==after and not errors and not after_errors,
            {'files':len(before),'stable':before==after,'errors':errors+after_errors}),
        'T2_EXTRACTION':gate(not unresolved and bool(sources) and before==after and not errors and not after_errors,{'unresolvedSources':unresolved}),
        'T3_DEDUPLICATION':gate(not conflicts and not unresolved,{'conflicts':conflicts}),
        'T4_CANDIDATE_ELIGIBILITY':gate(not candidate_errors and not unresolved and not conflicts and bool(candidates),
            {'errors':candidate_errors,'limitation':'No G6 certification. Raw provenance and complete first-20 audit remain mandatory.'})}
    for child,parent in [('T1_INVENTORY','T0_SCOPE'),('T2_EXTRACTION','T1_INVENTORY'),('T3_DEDUPLICATION','T2_EXTRACTION'),('T4_CANDIDATE_ELIGIBILITY','T3_DEDUPLICATION')]:
        if not gates[parent]['passed']:
            gates[child]['passed']=False;gates[child]['status']='BLOCKED'
    complete=all(g['passed'] for g in gates.values())
    leads=sum(c['classifications'].get('POST_FREEZE_LEAD_REQUIRES_G6_AUTHENTICATION',0) for c in candidates)
    gates['T5_BOUNDED_CONCLUSION']=gate(complete,{'noEligibleTelemetryClaimPermitted':complete and leads==0,
        'scopeLimitation':'Only the pinned local roots; no claim about remote/server/global absence',
        'newLeadsRequiringAuthentication':leads})
    return {'schemaVersion':1,'evaluatedAt':datetime.now(timezone.utc).isoformat(),
        'allGatesPassed':all(g['passed'] for g in gates.values()),'gates':gates,'sources':sources,
        'records':unique,'candidates':candidates,'prospectiveSuccessEstablished':False,
        'summary':'Bounded discovery only. Unresolved sources forbid an exhaustion/no-data conclusion.'}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args(); raw=Path(__file__).with_name('TASK_CONTRACT.json').read_bytes();contract=json.loads(raw)
    output=args.output.resolve()
    if any(output.is_relative_to(Path(r).resolve()) for r in contract['roots']):
        parser.error('Output must be outside the audited corpus')
    result=audit(contract);result['contractSha256']=sha(raw)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open('x',encoding='utf-8') as stream:
        json.dump(result,stream,indent=2,ensure_ascii=False)
    for name,value in result['gates'].items():print(name,value['status'])
    print('Files:',len(result['sources']),'Deduplicated records/leads:',len(result['records']))
    print(result['summary'])
    return 0 if result['allGatesPassed'] else 1


if __name__=='__main__':raise SystemExit(main())
