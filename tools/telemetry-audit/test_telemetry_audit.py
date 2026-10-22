import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from telemetry_audit import inventory, extract, deduplicate, classify, audit, sha


class TelemetryAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def put(self,name,data):
        p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(json.dumps(data));return p
    def test_inventory_includes_hidden_and_nested_ignored_directories(self):
        self.put('.hidden/plays.json',{});self.put('archive/ignored.json',{})
        files,errors=inventory([str(self.root)])
        self.assertEqual(len(files),2);self.assertFalse(errors)
    def test_missing_scope_blocks_every_descendant(self):
        r=audit({'roots':[str(self.root/'missing')],'candidateHashes':{}})
        self.assertFalse(any(g['passed'] for g in r['gates'].values()))
    def test_unknown_is_not_irrelevant(self):
        p=self.put('unknown.json',{'newSchema':'possible telemetry'})
        files,_=inventory([str(self.root)])
        self.assertEqual(extract(str(p),files[str(p)])[0],'UNRESOLVED_SCHEMA')
    def test_malformed_json_not_empty_success(self):
        p=self.root/'broken.json';p.write_text('{')
        files,_=inventory([str(self.root)])
        self.assertEqual(extract(str(p),files[str(p)])[0],'UNRESOLVED_PARSE')
    def test_raw_event_end_does_not_invent_opening(self):
        p=self.put('plays.json',{'pmuy78xu6tsths9':{'one':{'k':'end','t':1790000000000,'lv':20}}})
        files,_=inventory([str(self.root)])
        status,rows,_=extract(str(p),files[str(p)])
        self.assertIsNone(rows[0]['start']);self.assertTrue(status.startswith('UNRESOLVED'))
    def test_derived_live_label_is_not_authentication(self):
        p=self.put('outcome.json',{'evidence':'separate-live-completed-and-pending-outcomes','episodes':[{'name':'Gerda','lv':20,'start':1790000000000}]})
        files,_=inventory([str(self.root)])
        self.assertEqual(extract(str(p),files[str(p)])[0],'UNRESOLVED_DERIVED_PROVENANCE')
    def record(self):
        return {'origin':'RAW_EVENT_NEEDS_CAMPAIGN_RECONSTRUCTION','name':'Gerda','sourceRecord':'pid/id','source':'a','payload':{'r':'win'}}
    def test_overlapping_exports_deduplicate_with_all_sources(self):
        a=self.record();b={**a,'source':'b'}
        rows,conflicts=deduplicate([a,b]);self.assertEqual(len(rows),1);self.assertEqual(rows[0]['sources'],['a','b']);self.assertFalse(conflicts)
    def test_conflicting_duplicate_retained_and_blocks(self):
        a=self.record();b={**a,'source':'b','payload':{'r':'loss'}}
        _,conflicts=deduplicate([a,b]);self.assertEqual(len(conflicts),1)
    def test_distinct_raw_events_not_collapsed_by_same_time(self):
        a=self.record();b={**a,'sourceRecord':'pid/another'}
        self.assertEqual(len(deduplicate([a,b])[0]),2)
    def test_historical_cannot_become_prospective(self):
        c={'frozenAt':100,'progressionStartLevels':{'Gerda':1}}
        self.assertEqual(classify({'name':'Gerda','lv':10,'start':100},c),'HISTORICAL_BEFORE_CANDIDATE_FREEZE')
    def test_missing_opening_and_board_are_explicit(self):
        c={'frozenAt':100,'progressionStartLevels':{'Gerda':1}}
        self.assertEqual(classify({'name':'Gerda','lv':10,'start':101},c),'UNRESOLVED_BOARD_OR_OPENING')
        self.assertEqual(classify({'start':None},c),'UNRESOLVED_NO_OPENING')
    def test_even_complete_derived_episode_is_only_a_lead(self):
        c={'frozenAt':100,'progressionStartLevels':{'Gerda':1}}
        r={'name':'Gerda','lv':10,'start':101,'board':'a'*64,'openingRecorded':True}
        self.assertEqual(classify(r,c),'POST_FREEZE_LEAD_REQUIRES_G6_AUTHENTICATION')
    def test_changed_candidate_rejected(self):
        p=self.put('candidate.jsonl',{'model':'x','forecasts':[],'frozenAt':100,'progressionStartLevels':{}})
        r=audit({'roots':[str(self.root)],'candidateHashes':{str(p):'0'*64}})
        self.assertFalse(r['gates']['T4_CANDIDATE_ELIGIBILITY']['passed'])
    def test_corpus_changed_during_scan_blocks(self):
        with patch('telemetry_audit.inventory',side_effect=[({},[]),({'new':{}},[])]):
            r=audit({'roots':[str(self.root)],'candidateHashes':{}})
        self.assertFalse(r['gates']['T1_INVENTORY']['passed'])
    def test_unresolved_forbids_exhaustion_claim(self):
        self.put('unknown.json',{})
        r=audit({'roots':[str(self.root)],'candidateHashes':{}})
        self.assertFalse(r['gates']['T5_BOUNDED_CONCLUSION']['details']['noEligibleTelemetryClaimPermitted'])
        self.assertFalse(r['prospectiveSuccessEstablished'])
    def test_extraction_detects_changed_bytes(self):
        p=self.put('unknown.json',{});files,_=inventory([str(self.root)]);p.write_text('[]')
        self.assertEqual(extract(str(p),files[str(p)])[0],'UNRESOLVED_CHANGED')


if __name__=='__main__':unittest.main()
