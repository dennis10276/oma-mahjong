'use strict';
// Human feedback is an overlay on exact board identities. Never propagate a
// verdict onto a sibling board or treat a technical proof as placement approval.
const fs=require('fs'),path=require('path'),{OUT}=require('./chained_v2_run.js');
const REPORT=path.resolve(__dirname,'../../../codex-tasks/results/chained-2');
const reviews={
  170332:{note:'No AHA. Finish fine but no hard chain.',status:'insufficient-aha',action:'Strengthen the trap before later-level use. The finish was explicitly fine.',range:null},
  170333:{note:'A bit better nut nog hard enough to spot like the other chains.',status:'insufficient-aha',action:'Needs a less obvious, stronger chain before later-level use.',range:null},
  170334:{note:'This is an AHA yes!. 290-310 level.',status:'positive-earlier-range',action:'Positive AHA anchor for approximately 290–310; not approval for 332+. The two clearer variants are different boards and remain untested.',range:'290–310'},
  170335:{note:'Its an AHA but early introducing chains. Its an easy one.',status:'early-introduction',action:'Use as an early chain introduction or strengthen it before later placement.',range:'early chain introduction'},
  170336:{note:'Yes AHA moment :). 300+ level.',status:'positive-300-plus',action:'Positive AHA anchor for 300+. Four completed attempts and no win are recorded; do not describe this as a four-try solve.',range:'300+'},
  170337:{note:'Got an AHA but got stuck with it. Is that intended? I dont see it otherwise.',status:'hold-for-clarity-review',action:'Hold for route and clue review. An engine win exists, but the intended continuation was not clear to Dennis. Six completed attempts and no win are recorded.',range:null},
  170338:{note:'Easy to see the trap. too easy.. not even an AHA',status:'insufficient-aha',action:'This exact board is too obvious for the intended later AHA role. Its delivered sibling has a different seed and spare and is not reviewed by this note.',range:null},
  170339:{note:'Just about an AHA could be place around 275 or more chained to place later.',status:'marginal-earlier-range',action:'Approximately 275 as-is; add more meaningful chaining for later use.',range:'around 275 as-is'},
};
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),escape=s=>String(s).replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
function build(opts={}){
  const recoveredFile=path.join(REPORT,'verdicts-recovered.json');if(!fs.existsSync(recoveredFile))return null;
  const recovered=read(recoveredFile),live=path.resolve(__dirname,'../../build/chained-v2-lab-findings.json');
  const source=fs.existsSync(live)?read(live):{savedAt:recovered.savedAt,ratings:Object.fromEntries(recovered.records.map(r=>[r.id,r.rating]))};
  const primary=new Set(opts.primaryFiles||read(path.join(OUT,'selection.json')).order);
  const records=recovered.records.map(m=>{
    const rating=source.ratings[m.id]||m.rating,known=reviews[m.id],analysis=known?.note===rating.note?known:null;
    return {id:m.id,labLevel:m.labLevel,file:m.file,layout:m.layout,shape:m.shape,inPrimaryBank:primary.has(m.file),rating,analysis:analysis?{status:analysis.status,action:analysis.action,suggestedRange:analysis.range}: {status:'updated-note-needs-analysis',action:'The note changed; review it before reusing the previous interpretation.',suggestedRange:null}};
  });
  if(records.length!==8||records.some(r=>!r.rating.note))throw Error('The eight original notes must remain present');
  const data={schema:'task17-human-findings-v1',source:fs.existsSync(live)?'source/build/chained-v2-lab-findings.json':'verdicts-recovered.json',savedAt:source.savedAt,scope:'Exact original played boards; lab numbers are review labels, not placed game levels',status:'mixed-requires-revision',approvedFor332Plus:false,reviewedPrimaryFiles:records.filter(r=>r.inPrimaryBank).map(r=>r.file),unanalysedNotes:records.filter(r=>r.analysis.status==='updated-note-needs-analysis').length,records};
  const summary=data.unanalysedNotes?[
    'Some notes changed after the last interpretation. Their updated text is preserved below and marked for analysis. Placement approval remains pending; use only the exact-board interpretations that still match their source notes.',
  ]:[
    'Dennis’s notes do not approve this bank as a run of levels 332 and up. The sixty-board technical delivery remains available for review; human readiness is mixed and revisions are needed.',
    '',
    'The strongest positive anchors are the exact lookalikeCoverThaw board at lab 334 (four stars, suggested 290–310) and roofThawKey at lab 336 (four stars, 300+). lookalikeCover at 335 is an easy introduction; waitThawKey at 339 belongs around 275 as-is or needs more chaining for later use. lookalikeWay at 337 has an AHA but is held for continuation/clue review.',
    '',
    'The outsideIn pilot at 332 did not produce an AHA, and the clearLockRoof pilot at 333 was not hard enough to spot. These two examples do not establish successful new AHA ideas. The selected outsideIn board uses a different layout; it remains untested. The other new patterns in /new.html have no recorded user verdict yet. Only lab 332 explicitly comments on the finish: it was fine. That does not validate every tail.',
    '',
    'The original rank order predates these notes and is not an approved placement order. Exact-board findings below supersede that earlier judgment. Unrated stars are shown as “—”, not zero-star reviews. Recorded wins/attempts are telemetry, separate from Dennis’s written verdict.',
  ];
  const table=['| Original lab | Exact board | Stars / verdict choice | Recorded results | Dennis’s note | Finding / next action |','|---:|---|---|---|---|---|',...records.map(r=>`| ${r.labLevel} | ${r.file} | ${r.rating.stars||'—'} / ${r.rating.verdict||'—'} | ${r.rating.tries||0} completed, ${r.rating.wins||0} wins | ${escape(r.rating.note)} | ${escape(r.analysis.action)} |`)];
  const reportLines=[...summary,'',...table,'','These findings apply to the exact files named. They do not transfer to other hosts, seeds, spare settings, or clearer-key-roof variants. Notes and IDs are preserved verbatim in lab-findings.json. The eight original boards remain at http://127.0.0.1:8265/; additional candidates are separate at /new.html.'];
  fs.writeFileSync(path.join(REPORT,'lab-findings.json'),JSON.stringify(data,null,2)+'\n');
  fs.writeFileSync(path.join(REPORT,'LAB-FINDINGS.md'),['# Dennis’s Task 17 lab findings','',...reportLines,''].join('\n'));
  return {...data,reportLines};
}
if(require.main===module){const r=build();console.log(JSON.stringify(r?{status:r.status,notes:r.records.length,reviewedPrimary:r.reviewedPrimaryFiles.length,approvedFor332Plus:r.approvedFor332Plus}:null));}
module.exports={build};
