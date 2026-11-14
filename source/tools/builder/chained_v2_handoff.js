'use strict';
const fs=require('fs'),path=require('path'),{OUT,NAMES}=require('./chained_v2_run.js'),{DEFINITIONS}=require('./chained_new_ideas.js');
const REPORT=path.resolve(__dirname,'../../../codex-tasks/results/chained-2'),read=f=>JSON.parse(fs.readFileSync(f));
const ORIGINAL=NAMES.filter(n=>n!=='lookalikeCoverThaw');
const human={waitThawWay:1,waitNested:1,waitThawKey:1.5,lookalikeThaw:2,lookalikeCover:2.7,lookalikeWay:3,roofThawKey:4,waitLookalikeRoof:4.5,waitLookalikeWay:5,lookalikeCoverThaw:9,pairedFalseMelt:3,sharedThawDetour:4,roofBeforeSide:3,clearLockRoof:3.5,twinChase:4,splitPreparation:4.5,outsideIn:2.5};
function rank(r){const c=r.card;return +(10*(human[r.brief.story]??5)+.7*c.trap.links+.25*c.layers+.12*c.clock.fewestMoves-.7*c.clock.spare+2/(c.trap.firstMoves.winning||1)).toFixed(3);}
function quality(r){return (r.card.trap.firstMoves.winning<3?20:0)+r.card.layers-r.card.clock.spare/10;}
function collect(){
  const originalHosts={};for(const f of fs.readdirSync(path.resolve(OUT,'../chained-v1/examples')).filter(f=>f.endsWith('.json'))){const r=read(path.resolve(OUT,'../chained-v1/examples',f));(originalHosts[r.brief.story]??=new Set()).add(r.card.layout);}
  const pool=fs.readdirSync(path.join(OUT,'examples')).filter(f=>f.endsWith('.json')).map(file=>({file,r:read(path.join(OUT,'examples',file))})).sort((a,b)=>quality(a.r)-quality(b.r)||rank(a.r)-rank(b.r));
  const unique=[],seen=new Set();for(const p of pool){const key=p.r.brief.story+'/'+p.r.card.layout;if(!seen.has(key)){seen.add(key);unique.push(p);}}
  const oldGlobal=new Set([0,14,18,31,36]);
  const chosen=[];for(const name of ORIGINAL)chosen.push(...unique.filter(p=>p.r.brief.story===name).sort((a,b)=>Number(oldGlobal.has(a.r.card.layout))-Number(oldGlobal.has(b.r.card.layout))||quality(a.r)-quality(b.r)).slice(0,6));
  const newKinds=Object.keys(DEFINITIONS).filter(name=>unique.some(p=>p.r.brief.story===name));
  const newNames=newKinds.slice().sort((a,b)=>Number(a==='sharedThawDetour')-Number(b==='sharedThawDetour')).slice(0,6),usedNew=new Set();
  for(const name of newNames.sort((a,b)=>unique.filter(p=>p.r.brief.story===a).length-unique.filter(p=>p.r.brief.story===b).length)){
    const options=unique.filter(p=>p.r.brief.story===name),p=options.find(p=>!usedNew.has(p.r.card.layout))||options[0];chosen.push(p);usedNew.add(p.r.card.layout);
  }
  const quotas=Object.fromEntries(ORIGINAL.map(name=>[name,unique.filter(p=>p.r.brief.story===name).map(p=>p.r.card.layout).sort((a,b)=>a-b)]));
  // Fill review capacity with additional hosts, while reporting quota deficits.
  for(const p of unique)if(chosen.length<60&&p.r.brief.story!=='lookalikeCoverThaw'&&!chosen.includes(p))chosen.push(p);
  // Six big-board candidates for six ending-in-zero slots in a sixty-level run.
  for(const p of unique.filter(p=>p.r.card.tiles===96&&!chosen.includes(p)&&ORIGINAL.includes(p.r.brief.story)).sort((a,b)=>Number(![13,29,47].includes(a.r.card.layout))-Number(![13,29,47].includes(b.r.card.layout))||quality(a.r)-quality(b.r))){
    if(chosen.filter(q=>q.r.card.tiles===96).length>=6)break;
    const replace=chosen.filter(q=>q.r.brief.story===p.r.brief.story&&q.r.card.tiles!==96).sort((a,b)=>quality(b.r)-quality(a.r))[0];if(replace)chosen[chosen.indexOf(replace)]=p;
  }
  chosen.sort((a,b)=>rank(a.r)-rank(b.r));
  const clear=[],clearSeen=new Set();for(const p of pool.filter(p=>p.r.brief.story==='lookalikeCoverThaw'&&require('./chained_readability.js').keyRoof(p.r.design).keyShown>=.65&&require('./chained_readability.js').keyRoof(p.r.design).roofShown>=.9)){
    const fp=require('./verify_chained_mixes.js').fingerprint(p.r.design);if(!clearSeen.has(fp)&&clear.length<2){clearSeen.add(fp);clear.push(p);}
  }
  return {pool,unique,chosen,clear,quotas,newKinds,originalHosts};
}
function run(){
  fs.mkdirSync(REPORT,{recursive:true});const s=collect(),history=read(path.join(REPORT,'sequence-history.json'));
  const rows=fs.readdirSync(path.join(OUT,'runs')).filter(f=>/^(build|finish)-.*\.jsonl$/.test(f)).flatMap(f=>fs.readFileSync(path.join(OUT,'runs',f),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
  const matrix={};for(const r of rows.filter(r=>r.mode==='build')){const q=matrix[r.name]??={};const l=q[r.layout]??={jobs:0,raw:0,failures:{}};l.jobs++;l.raw+=Number(r.ok);for(const [k,n]of Object.entries(r.fails||{}))l.failures[k]=(l.failures[k]||0)+n;if(r.fail)l.failures['job:'+r.fail]=(l.failures['job:'+r.fail]||0)+1;}
  fs.writeFileSync(path.join(OUT,'host-search.json'),JSON.stringify(matrix,null,2)+'\n');
  const primaryHosts=Object.fromEntries(ORIGINAL.map(name=>[name,s.chosen.filter(p=>p.r.brief.story===name).map(p=>p.r.card.layout).sort((a,b)=>a-b)])),deliveredKinds=[...new Set(s.chosen.flatMap(p=>p.r.card.trap.newLink?[p.r.card.trap.newLink.kind]:[]))].sort();
  const selection={complete:s.chosen.length===60&&ORIGINAL.every(n=>new Set(primaryHosts[n]).size>=6)&&deliveredKinds.length>=6&&s.clear.length===2,order:s.chosen.map(p=>p.file),clearer:s.clear.map(p=>p.file),quotas:primaryHosts,newKinds:deliveredKinds,prototypeKinds:s.newKinds.filter(n=>!deliveredKinds.includes(n)),rankRule:'human anchor x10 + links x0.7 + layers x0.25 + k x0.12 - spare x0.7 + 2/winningStarts',rows:s.chosen.map((p,i)=>({rank:i+1,file:p.file,score:rank(p.r),shape:p.r.brief.story,layout:p.r.card.layout}))};
  const findings=require('./chained_v2_findings.js').build({primaryFiles:selection.order});
  if(findings)selection.humanReview={status:findings.status,approvedFor332Plus:false,findings:'codex-tasks/results/chained-2/lab-findings.json',reviewedPrimaryFiles:findings.reviewedPrimaryFiles,rankingStatus:'pre-feedback design judgment; use exact-board findings before placement'};
  fs.writeFileSync(path.join(OUT,'selection.json'),JSON.stringify(selection,null,2)+'\n');
  const auditFile=path.join(OUT,'audit-final.json'),audit=fs.existsSync(auditFile)?read(auditFile):null;
  const barrier=k=>k==='noChain'?'no visible connected placement':k==='noClockPartnerHolders'?'too few late-route holders':k==='noRepeatedKeyPair'?'no separated ordinary lookalike pair':k==='fixedTwinsClose'?'fixed twins too close':k==='clockShortest'?'clock minimum unproved or too long':k==='noProvenBait'?'no exact losing bait':k==='clockNotBait'?'exposed clock affordable or unproved':k==='twoMeaningfulBaits'?'two disjoint losing choices not proved':k.startsWith('idle:')?'redundant special under ablation':k==='obvious:freeRoutePair'?'ready pair on the right route':k==='obvious:greedyPrefix'?'greedy right opening':k;
  const hostBarriers=ORIGINAL.map(name=>{
    const totals={};for(const q of Object.values(matrix[name]||{}))for(const [k,n]of Object.entries(q.failures))if(!k.startsWith('job:')){const reason=barrier(k);totals[reason]=(totals[reason]||0)+n;}
    const untouched=Array.from({length:48},(_,i)=>i).filter(i=>!matrix[name]?.[i]&&!s.originalHosts[name]?.has(i));
    return `| ${name} | ${Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,n])=>k+' ('+n+')').join('; ')} | ${untouched.join(', ')||'none'} |`;
  });
  const previewFile=path.join(REPORT,'game-previews.json'),preview=fs.existsSync(previewFile)?read(previewFile):null;
  const auditFresh=!!audit?.ok&&[...selection.order,...selection.clearer].every(file=>audit.rows.some(r=>r.file===file&&r.ok));
  const breakdown=Object.fromEntries([['250-302',history.rows.filter(r=>r.level<=302)],['303-331',history.rows.filter(r=>r.level>=303)]].map(([name,rows])=>{const c=require('./check_sequence.js').check(rows);return [name,{boards:c.boards,counts:c.counts,missing:c.missing}];}));
  fs.writeFileSync(path.join(REPORT,'sequence-history-breakdown.json'),JSON.stringify(breakdown,null,2)+'\n');
  const lines=['# TASK 17 — more chained traps','',selection.complete&&auditFresh&&preview?.ok?(findings?'Technical candidate bank complete. Human review is mixed; revisions and placement review remain. No game levels were changed.':'Complete candidate bank; no game levels were changed.'):'Work in progress. The following counts are evidence, not a completion claim.','',
    'Branch `wip/codex-chained-2`, based on local `wip/cc-builder-loop` at `56c0218f`, in its own worktree. Main, Firebase, level tables, bots, ribbon and jokers were not changed. Claude’s builder/bank files were read and reused without edits. Heavy searches run through `loop/heavy.js` with disposable workers and per-job and total walls.','',
    `Review bank: ${s.chosen.length}/60 primary boards across ${new Set(s.chosen.map(p=>p.r.card.layout)).size} layouts; ${s.chosen.filter(p=>p.r.card.tiles===96).length} have 96 tiles for ending-in-zero slots; ${deliveredKinds.length} new kinds are delivered; ${s.clear.length}/2 separate clearer lookalikeCoverThaw variants. Additional experimental records remain in local reserves.`,'',
    ...(findings?['## Dennis’s latest lab findings','',...findings.reportLines,'']:[]),
    '## New hosts for the nine placed shapes','',
    'Six additional layouts are counted per shape, relative to that shape’s two previous hosts. Most also exclude all five previous layouts (0, 14, 18, 31, 36). The nested shape may use 14 and 18, which were previously hosts of other shapes; its previous hosts were 31 and 36. The eight-board lab uses only globally unseen layouts. Three layers are preferred in selection; deeper exceptions are disclosed in the board table.','',
    '| Shape | Previous hosts | Delivered additional layouts | Quota |','|---|---|---|---:|',...ORIGINAL.map(n=>`| ${n} | ${[...(s.originalHosts[n]||[])].sort((a,b)=>a-b).join(', ')} | ${primaryHosts[n].join(', ')} | ${Math.min(6,primaryHosts[n].length)}/6 |`),'',
    'The full 48-layout search matrix is in `source/analysis/builder/bank/chained-v2/host-search.json`. Per layout it records every completed search, raw successes and rejection reasons. `noChain` means the recipe placement search failed; `noClockPartnerHolders` means the exposed-clock link lacked two guarded twin holders; `fixedTwinsClose`/`noRepeatedKeyPair` reject unreadable fixed picture groups; `noProvenBait`, `clockNotBait`, `wrongRepeatedPairNotBait` and `newIdeaNotBait` reject harmless or unproven offers; `idle:*` rejects a special whose ablation has no effect. A hard wall is inconclusive. None of these bounded failures proves a layout impossible. Finishing can additionally fail separation, exact replay/minimum, face-down protection, the pressure target or the independent verifier.','',
    '| Shape | Most frequent observed barriers | Other legacy hosts intentionally unsearched |','|---|---|---|',...hostBarriers,'',
    'Barrier counts span bounded searches and constructor revisions. Layouts named as unsearched are not called blocked. The earlier constructor unnecessarily required route matches below the gated clock itself; `flexClockHolders` can instead use tiles below late prerequisites. The final exact prices still decide whether taking the exposed clock loses. Extra lookalikes may consume an entire ordinary two-copy picture group; using all 36 pictures was not a game rule. Twin repair can move unmarked extra copies while keeping every authored bait/key tile fixed, and can keep improving through intermediate states before reaching the final separation threshold.','',
    '## New wrong ideas','',
    '| Kind | Wrong idea | Delivered host |','|---|---|---|',...Object.entries(DEFINITIONS).map(([n,d])=>`| ${n} | ${d.sentence} | ${s.chosen.filter(p=>p.r.brief.story===n).map(p=>p.r.card.layout).join(', ')||'local prototype; not counted'} |`),'',
    'Each delivered new link names an initially legal offer and its geometric evidence in `card.trap.newLink`. The exact engine must prove it loses at the shipped deadline, and removing each ice or lock must change the minimum or defuse a bait. All use existing game rules on a chain of three or four links. For splitPreparation, the verifier also proves that each preparation alone wins within the spare budget while the combined offer loses. Novelty is a design judgment; human AHA is not proved by engine solvability. Failed prototypes are not counted as delivered kinds.','',
    '## Wrong-idea ledger and sequence audit','',
    '`card.wrongIdea` is a sorted, unique list of the actual proven bait kinds. The read-only checker checks all shared kinds independently: distance <=6 for a wrong idea, <=20 for wrong idea plus full chain signature, and <=12 for the same layout. Duplicate levels and missing annotations fail explicitly.','',
    '```powershell','node source/tools/builder/check_sequence.js source/analysis/builder/bank/placed-250-B source/analysis/builder/bank/placed-303 --out codex-tasks/results/chained-2/sequence-history.json','```','',
    `Historical audit: ${history.boards} levels, wrongIdea6=${history.counts.wrongIdea6}, wrongIdeaShape20=${history.counts.wrongIdeaShape20}, layout12=${history.counts.layout12}; ${history.missing.length} boards lack reliable saved trap metadata. The detailed output is in sequence-history.json/.txt. Historical boards were not edited. The old metadata is traced to its original saved card and marked derived. Unknown older traps are not invented.`, '',
    `Within 250–302 alone: ${JSON.stringify(breakdown['250-302'].counts)}. Within 303–331 alone: ${JSON.stringify(breakdown['303-331'].counts)}. The combined result additionally includes violations across their boundary.`,'',
    'This is a review order, not sixty consecutive placed levels. Reusing the common early-key/lonely-melt kinds in adjacent candidate slots would violate the ledger. The lead must interleave other wrong ideas and obey the checker when assigning actual levels 332 and up; 96-tile candidates belong only at levels ending in 0. No level table was changed.','',
    '## Easier to read and far end','',
    'The key-roof readability dial measures the true covered key and its icy roof from the initial rendered geometry. Clearer variants require at least 65% of the key and 90% of the roof exposed; both old extreme boards expose 58.35% of their covered key. The original two designs are preserved in `far-end/` for the last levels. Their old pressure is archival, not a claim that they meet the v2 tail target.','',
    ...s.clear.map(p=>`- ${p.file}: ${JSON.stringify(require('./chained_readability.js').keyRoof(p.r.design))}`),'',
    '## Review order','',
    'Human anchors: waitThawWay and waitNested one try, lookalikeThaw two, roofThawKey four, lookalikeCoverThaw eleven. The latter is kept out of the primary bank. The remaining shape and new-idea weights are explicit design judgments in chained_v2_handoff.js. Within that ordering, more links, deeper layers, longer clock route, less spare and fewer winning openings raise the score. This is not a player-rating model or a bot prediction.','',
    '| Order | Board | Shape | Layout | Layers | Tiles | k + spare | Starts | Pressure parks | Down |','|---:|---|---|---:|---:|---:|---|---:|---:|---:|',
    ...s.chosen.map((p,i)=>{const c=p.r.card;return `| ${i+1} | ${p.file} | ${p.r.brief.story} | ${c.layout} | ${c.layers} | ${c.tiles} | ${c.clock.fewestMoves} + ${c.clock.spare} | ${c.trap.firstMoves.winning} | ${c.feel.pp} | ${(100*c.faceDownShare).toFixed(1)}% |`;}),'',
    '## Validation and lab','',
    'Each accepted board has a complete strict single-tap replay, an exact minimum with spare, no visibly close twins or close four-copy group, face-down share 23–28% outside the mechanism and shortest route, and 1.5–3 pressure parks with at most 10% of expert decisions at three waiting. Pressure uses bank/feel.js expert, 16 games, seed 9; atomic free pairs do not count as waiting. The older forcedPressure and greedy-loss/one-waiter targets are diagnostics only.','',
    `Fresh final independent audit of the current manifest: ${audit?JSON.stringify({ok:auditFresh,completed:audit.rows?.length}):'pending'}. Real-game preview: ${preview?JSON.stringify({ok:preview.ok,boards:preview.rows?.length}):'pending'}.`, '',
    `Lab: http://127.0.0.1:8265/${fs.existsSync(path.join(OUT,'lab-selection-original.json'))?'new.html':''} . Eight distinct hosts outside the previous five; real game, local fake/offline data, findings saved on this PC. \`lab-selection.json\` maps the eight previews to exact files. The lab level labels are review labels, not placement.`,'',
    'Reproduce the lightweight tests with `node --test source/tools/builder/test_chained_v2.js source/tools/builder/test_chained_mixes.js`. Regeneration and verification must reserve cores through loop/heavy.js. Raw candidates and finishing traces remain local; the delivered JSON cards and aggregate host evidence are the handoff.',''];
  if(fs.existsSync(path.join(OUT,'lab-selection-original.json')))lines.push('## Verdict recovery','',
    'The original played set is restored at http://127.0.0.1:8265/ . Its eight notes, stars and verdict choices were still present in the PC findings file. Replacing the displayed board set hid most of their IDs; switching between localhost and 127.0.0.1 also changes browser storage. The replacement boards now live at /new.html. Ratings are never copied onto a different design. The original manifest and complete original board set are pinned, and rebuilds preserve them. `chained_v2_server.js` restores saved ratings before lab.js initializes, on either hostname. Fresh browser checks verified all eight original notes and rating fields on both origins; see verdict-recovery-check.json.','');
  fs.writeFileSync(path.join(REPORT,'REPORT.md'),lines.join('\n'));console.log(JSON.stringify({complete:selection.complete,boards:s.chosen.length,quotas:primaryHosts,newKinds:deliveredKinds,clear:s.clear.map(p=>p.file)}));return selection;
}
if(require.main===module)run();module.exports={run,collect,REPORT,ORIGINAL,rank};
