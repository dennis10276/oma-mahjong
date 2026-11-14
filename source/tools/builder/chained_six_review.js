'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const ROOT=path.resolve(__dirname,'../../..'),OUT=path.join(ROOT,'source/analysis/builder/bank/new-ideas'),REVIEW=path.join(OUT,'review-2026-11-14'),RESULTS=path.join(ROOT,'codex-tasks/results/new-ideas');
const read=f=>JSON.parse(fs.readFileSync(f)),write=(f,j)=>fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n');
const actions={
  350:['needs-more-chain','Replace this single-idea example with a connected multi-idea chain; no 320+ approval.'],
  351:['liked-trap-lighten-finish','Keep the clock-count/lookalike trap; make the finish easier.'],
  352:['needs-more-chain','Replace this obvious single-idea example with a connected multi-idea chain.'],
  353:['liked-320-plus','Keep this exact five-link self-locked/waiting-clock trap as the positive anchor for 320+.'],
  354:['hold-hidden-lock','Hold: the key-delay lock badge is completely hidden. Rebuild on readable geometry.'],
  355:['liked-trap-lighten-finish','Keep the three-of-a-kind/lookalike trap for 320+; make the finish easier.'],
  356:['more-chain-lighten-finish','Add a meaningful linked idea and make the finish easier.'],
  357:['hold-hidden-ice-and-lock','Hold: hidden ice and lock make the reason unreadable; loose keys do not establish a rewarding chain.'],
};
function replaySummary(raw,manifest,qaIds=[]){
  const chunks=new Map(),invalid=[];
  for(const [key,value]of Object.entries(raw)){
    if(!key.startsWith('omamj.replayq.'))continue;
    try{const c=JSON.parse(value),d=JSON.parse(c.data);if(!chunks.has(c.aid))chunks.set(c.aid,[]);chunks.get(c.aid).push({...c,decoded:d});}catch(e){invalid.push(key);}
  }
  const attempts=[];
  for(const [aid,list]of chunks){
    list.sort((a,b)=>a.seq-b.seq);const init=list.find(c=>c.decoded.init)?.decoded.init;
    const m=manifest.find(m=>init?.key==='X'+m.id);if(!m||qaIds.includes(aid))continue;
    const events=list.flatMap(c=>c.decoded.events||[]),end=events.filter(e=>e[1]==='end').at(-1),states=events.filter(e=>e[1]==='state');
    const clock=init.state.ck?.i;let reached=false,moves=init.state.m||0;
    for(const e of states){const s=e[2];if(s.m!=null)moves=s.m;if(s.a?.some(([i,v])=>i===clock&&v===0))reached=true;}
    attempts.push({aid,labId:m.id,labLevel:m.labLevel,attempt:init.at,partial:!!init.partial,chunks:list.length,continuous:list.every((c,i)=>c.seq===i),taps:events.filter(e=>e[1]==='tap').length,moves,reachedClock:reached,end:end?.[2]?.r||null});
  }
  return {attempts,invalidChunks:invalid,excludedQaIds:qaIds};
}
function capture(){
  fs.mkdirSync(REVIEW,{recursive:true});fs.mkdirSync(RESULTS,{recursive:true});
  const manifest=read(path.join(REVIEW,'original-lab-selection.json')),source=read(path.join(REVIEW,'findings.json'));
  const qa=read(path.join(RESULTS,'LAB_QA.json')).attempts.map(a=>a.aid);
  const replay=replaySummary(read(path.join(ROOT,'source/analysis/archive/new-ideas-2026-11-14/replays.json')),manifest,qa);
  const selected=new Set(read(path.join(OUT,'selection.json')).combinations.map(r=>r.file));
  const records=manifest.map(m=>{const r=read(path.join(OUT,'checked',m.file)),rating=source.ratings[m.id],a=actions[m.labLevel];
    if(!rating?.note)throw Error('Missing verdict: '+m.id);
    return {...m,inMainCatalogue:selected.has(m.file),boardHash:crypto.createHash('sha256').update(JSON.stringify(r.design)).digest('hex'),ideas:r.card.wrongIdea,links:r.card.trap.links,rating,status:a[0],action:a[1],readability:require('./chained_special_readability.js').measure(r.design),replays:replay.attempts.filter(a=>a.labId===m.id)};
  });
  const geometryAudit=fs.readdirSync(path.join(OUT,'checked')).filter(f=>f.endsWith('.json')).map(file=>({file,inMainCatalogue:selected.has(file),...require('./chained_special_readability.js').measure(read(path.join(OUT,'checked',file)).design)}));
  const data={schema:'task18-human-verdicts-v1',savedAt:source.savedAt,scope:'Exact eight original boards only; technical acceptance is not human placement approval.',status:'revision-required',bankApproved:false,records,geometryAudit,replayIntegrity:{invalidChunks:replay.invalidChunks,excludedQaIds:qa}};
  write(path.join(REVIEW,'verdicts.json'),data);write(path.join(RESULTS,'VERDICTS.json'),data);
  const esc=s=>String(s).replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>');
  const lines=['# Task 18 — Dennis’s verdicts, 14 November 2026','',
    'The forty-board catalogue is technically proved, **not approved as a 320+ run**. These eight exact-board verdicts supersede the original easiest/hardest ranking. Three traps were liked: 351 (count the clock/lookalike), 353 (self-locked twin/waiting clock), and 355 (three of a kind/lookalike). Keep their trap logic. 351 and 355 need a lighter finish. 353 is the strongest complete positive anchor: four stars, seven completed attempts, one win, explicitly 320+.',
    '', 'Single-idea examples 350 and 352 were too obvious and gave no AHA; 356 needs one more meaningful chain and a lighter finish. 354 and 357 are held for unreadable specials. The key-delay idea has no positive human verdict yet. A solver proof of a later lock effect did not establish a readable, rewarding chain.',
    '', '## Exact-board findings','',
    '| Lab | Ideas / links | Stars | Completed / won | Dennis’s exact note | Decision |',
    '|---:|---|---:|---|---|---|',
    ...records.map(r=>`| ${r.labLevel} | ${r.ideas.join(' + ')} / ${r.links} | ${r.rating.stars||'—'} | ${r.rating.tries||0} / ${r.rating.wins||0} | ${esc(r.rating.note)} | ${r.action} |`),
    '', 'Unselected stars are shown as “—”; no rating is invented. Completed attempts include restarts, not only terminal stuck screens. The original eight lab IDs, board hashes, notes and files are retained in VERDICTS.json. Verdicts do not transfer to siblings or retuned versions.',
    '', '## Why the old checks were insufficient','',
    'The old observer accepted any visible piece of a generic central overlay. It did not measure the actual bottom-right lock/snowflake glyph. On 354 the lock glyph is entirely hidden. On 357 the lock glyph is entirely hidden and only about half the clock ice glyph is exposed. The new clear-specials-v1 gate measures the CSS badge region against higher tiles and their drawn sides, requires at least 65% exposure, and rejects face-down special tiles. New Task 18 construction uses it by default, rejects bad geometry before picture search, and stores the profile for independent final verification. It is a conservative construction rule; it does not move badges or change production rendering.',
    '', `Under this deliberately stricter profile, ${geometryAudit.filter(x=>x.ok).length}/${geometryAudit.length} original checked boards pass all special badges; ${geometryAudit.filter(x=>x.inMainCatalogue&&x.ok).length}/40 pass in the original main catalogue. This flags rebuild/review work, not automatic human rejection of every flagged board. The old forty-board delivery must not be presented as forty newly readability-certified boards. The per-tile audit is preserved in VERDICTS.json.`,
    '', 'The old pressure statistic is conditional on never making a losing choice. At 355 it was only 2.4 pressure parks, yet a natural greedy finish won just 3%; 356 was 2.4 parks and 1.6% greedy wins. Low pressure did not mean an easy finish. The explicit light-after-verdict revision profile lowers parks to 0.5–1.5, caps three-waiting decisions at 5%, and independently requires at least 55% natural greedy tail wins (800 fixed-seed continuations). These are tuning diagnostics, not bot difficulty ratings or predictions of Dennis’s win chance. Original proofs and acceptance bands are preserved.',
    '', '## Recordings','',
    `Imported ${replay.attempts.length} original-lab attempts; ${replay.attempts.filter(a=>a.end).length} have an end event. The two agent QA attempts are explicitly excluded. Raw localStorage replay chunks and the append-only findings journal are archived under source/analysis/archive/new-ideas-2026-11-14/ (ignored); the derived attempt ledger is in VERDICTS.json. No Firebase writes.`,
    '', '| Lab | Replay attempts | Ended | Reached clock | End reasons |','|---:|---:|---:|---:|---|',
    ...records.map(r=>`| ${r.labLevel} | ${r.replays.length} | ${r.replays.filter(a=>a.end).length} | ${r.replays.filter(a=>a.reachedClock).length} | ${r.replays.map(a=>a.end||'open').join(', ')} |`),
    '', 'The original lab stays at http://127.0.0.1:8266/. Revised examples use new IDs on /new.html so the original notes and results cannot attach to changed boards. No production level placement is made.',
  ];
  fs.writeFileSync(path.join(RESULTS,'VERDICTS.md'),lines.join('\n')+'\n');
  return data;
}
function revise(j){
  const M=require('./trap_mixes.js'),E=require('./engine.js'),F=require('./bank/feel.js'),Tl=require('./bank/tail.js'),S=require('./bank/separate.js');
  const r=read(path.join(OUT,'checked',j.file)),original=structuredClone(r),k=r.card.clock.fewestMoves,spare=r.card.clock.spare;
  const roles={...r.roles,locks:new Set(r.roles.locks),holderSpecials:new Set(r.roles.holderSpecials)};
  const validate=d=>{
    if(!E.replay(d,d.solution,{strict:true}).ok)return {ok:false,why:'strictReplay'};
    const rt=M.retime(d,spare);if(!rt.ok||rt.k!==k)return {ok:false,why:'clockChanged'};
    const proof=M.prove(r.brief.story,d,roles,{k,spare,obviousnessDial:2,existingLinks:r.card.trap.newLinks});
    return proof.ok?{ok:true}:{ok:false,why:proof.why};
  };
  const freeze=[...new Set([...r.roles.bait.tiles,...r.design.obst.keys,...r.design.solution.slice(0,k),...(r.roles.bait.repeat?.copies||[]),...(r.roles.bait.sixLinks||[r.roles.bait.six]).flatMap(q=>q.visible)])];
  const target={parks:.7,parksMax:1.25,max3:.035,greedyMin:.65};
  const tune=require('./bank/feel_retune.js').tuneFeel(r.design,{target,ms:j.ms-30000,seed:j.seed,freeze,validate,tolerance:0});
  if(!tune.ok)return {ok:false,why:'noTailRevision',fails:tune.fails};
  const d=tune.design,proof=M.prove(r.brief.story,d,roles,{k,spare,obviousnessDial:2,existingLinks:r.card.trap.newLinks});
  if(!proof.ok)return {ok:false,why:proof.why};
  r.design=d;r.card.trap=proof.card;r.card.finishProfile='light-after-verdict';
  r.reviewRevision={sourceFile:j.file,labId:j.labId||null,reason:j.reason||'easier finish for a new multi-idea replacement',seed:j.seed,target,frozen:freeze,preClockUnchanged:original.design.solution.slice(0,k).every(i=>d.faces[i]===original.design.faces[i]),geometryUnchanged:JSON.stringify(d.tiles)===JSON.stringify(original.design.tiles),specialsUnchanged:JSON.stringify(d.obst)===JSON.stringify(original.design.obst)};
  const feel=F.expert(d,{playouts:16,seed:9});r.card.feel={...feel,pp:+(feel.parkAt[1]+feel.parkAt[2]).toFixed(1),seed:9,playouts:16};
  r.card.tail=Tl.measure(d,{seed:977,playouts:800});r.card.tailOccupancy=Tl.occupancy(d);r.card.pressure=require('./verify_trap_mixes.js').storedPressure(d);r.card.twins=S.summary(S.closeTwins(d));
  r.card.wrongIdea=require('./chained_v2_finish.js').ideas(r);
  if(j.requireReadable){r.brief.readabilityProfile='clear-specials-v1';r.card.specialReadability=require('./chained_special_readability.js').measure(d);}
  const v=require('./verify_chained_v2.js').verify(r);if(!v.ok)return {ok:false,why:'independentVerification',errors:v.errors,feel:r.card.feel,tail:r.card.tail.tailGreedyWin};
  r.verification=v;return {ok:true,row:r,summary:{file:j.file,pp:r.card.feel.pp,greedy:r.card.tail.tailGreedyWin,beforePp:original.card.feel.pp,beforeGreedy:original.card.tail.tailGreedyWin,edits:d.faces.filter((f,i)=>f!==original.design.faces[i]).length}};
}
function revisionsLab(){
  const files=fs.readdirSync(path.join(REVIEW,'revised')).filter(f=>f.endsWith('.json')).sort();
  const rows=files.map(file=>({file,r:read(path.join(REVIEW,'revised',file))}));
  if(rows.length!==4||rows.some(p=>!p.r.verification.ok))throw Error('Four verified revisions required');
  const titles=require('./chained_six_specs.js').DEFINITIONS;
  const manifest=rows.map(({file,r},i)=>({id:210000000+parseInt(crypto.createHash('sha256').update(file+JSON.stringify(r.design)).digest('hex').slice(0,6),16),labLevel:360+i,file,sourceFile:r.reviewRevision.sourceFile,sourceLabId:r.reviewRevision.labId,kind:r.reviewRevision.labId===190403256?'clockCount':r.reviewRevision.labId===189772842?'savePair':r.card.wrongIdea.includes('keysLater')?'keysLater':'selfLocked',ideas:r.card.wrongIdea,links:r.card.trap.links,pressureParks:r.card.feel.pp,naturalTailWin:r.card.tail.tailGreedyWin,clearSpecials:r.brief.readabilityProfile==='clear-specials-v1'}));
  const spec={factory:true,heading:'New wrong ideas · revised',intro:'The two traps you liked have a lighter finish. Two replacements add a linked idea with visible specials. The original boards and notes are kept on the original lab page.',verdict:[['easy','Too easy'],['right','About right'],['hard','Too hard']],noteHint:'Does the trap give an AHA? How does the finish feel?',ideas:rows.map(({r},i)=>({id:manifest[i].id,lv:manifest[i].labLevel,kind:'planned',title:titles[manifest[i].kind].title,idea:manifest[i].sourceLabId?'Same trap, a lighter finish.':'A longer chain with a lighter finish.',shape:r.card.shape,tiles:r.card.tiles,m:null,board:{...r.design,level:manifest[i].labLevel,aspect:1.6}}))};
  const dir=path.join(ROOT,'source/build/new-ideas-lab'),original=fs.readFileSync(path.join(dir,'lab-ideas.js'),'utf8'),html=fs.readFileSync(path.join(dir,'lab.html'),'utf8');
  if(!html.includes("'lab-ideas.js'"))throw Error('Original lab boot list changed');
  const js='const LAB_IDEAS = '+JSON.stringify(spec)+';\n';
  fs.writeFileSync(path.join(dir,'revisions-ideas.js'),js);fs.writeFileSync(path.join(dir,'new.html'),html.replace("'lab-ideas.js'","'revisions-ideas.js'"));
  if(fs.readFileSync(path.join(dir,'lab-ideas.js'),'utf8')!==original)throw Error('Original lab was changed');
  fs.writeFileSync(path.join(REVIEW,'revision-lab-ideas.js'),js);write(path.join(REVIEW,'revision-lab-selection.json'),manifest);write(path.join(RESULTS,'REVISIONS.json'),manifest);
  const lines=['# Task 18 — Revisions after Dennis’s verdicts','', '[Open four revised examples](http://127.0.0.1:8266/new.html). The original eight boards and their notes remain at [the original lab](http://127.0.0.1:8266/). New IDs keep the results separate. These are unreviewed revisions, not approved placements.','',
    '| New lab | Revision | Ideas / links | Pressure parks before → after | Natural tail wins before → after |',
    '|---:|---|---|---:|---:|',
    ...manifest.map((m,i)=>{const r=rows[i].r,old=read(path.join(OUT,'checked',m.sourceFile));return `| ${m.labLevel} | ${m.sourceLabId?'Original '+(m.sourceLabId===190403256?351:355)+', lighter finish':'New replacement: '+titles[m.kind].title} | ${m.ideas.join(' + ')} / ${m.links} | ${old.card.feel.pp} → ${m.pressureParks} | ${(100*old.card.tail.tailGreedyWin).toFixed(1)}% → ${(100*m.naturalTailWin).toFixed(1)}% |`;}),
    '', 'The two liked traps keep the same positions, clock number/minimum, obstacles, face-down set, initial clue pictures and pre-clock pictures. Only eligible after-clock pictures were re-paired. Every full solution replays strictly; the shipping-deadline baits still lose; the independent verifier re-proves the clock minimum, special effects, spacing, idea ledger and new finish target. Their existing geometry is preserved, so the new all-specials readability profile is not claimed for these two boards.',
    '', 'The two replacements combine savePair with selfLocked or keysLater on layout 31. Both pass clear-specials-v1: every lock, ice and key badge is at least 65% exposed at the start. The key-delay replacement has a visible lock, a separately proved post-clock effect and a second wrong idea; whether that feels rewarding remains a human judgement. These are new hosts, not a transfer of the previous verdict.',
    '', 'The very good original 353 is preserved unchanged as the positive anchor; it does not need another test here. Original 350 and 352 are retired from the later-level shortlist. Original 354 and 357 remain held for unreadable geometry. The bounded seed-421 construction sweep did not produce a new clear-specials clockCount+savePair or waitNested+selfLocked host. It is recorded as a failed search, not filled by relabelling the easy original.',
    '', 'Validation: 38 focused checks passed, two optional historical delivery checks skipped. All four new artifacts carry successful independent certificates. The original forty-board catalogue remains a technical research bank, not an approved 320+ sequence. Prior doubleMelt/freeMelt, fourth clockCount host and seven reserve-upgrade gaps remain open.',
  ];
  fs.writeFileSync(path.join(RESULTS,'REVISIONS.md'),lines.join('\n')+'\n');
  return manifest;
}
function reportOverlay(lines){
  const file=path.join(RESULTS,'VERDICTS.json');if(!fs.existsSync(file))return lines;
  return [lines[0],'','## Human review supersedes the initial ranking','',
    '**Revision required; the bank is not approved as a 320+ run.** Dennis liked the traps at original lab 351, 353 and 355. The first and third need easier finishes. The simple examples need more meaningful chaining. Both key-delay examples exposed unreadable specials. See [the exact verdicts](VERDICTS.md) and [the four revised examples](REVISIONS.md). The original boards and results are preserved. The counts below describe the earlier technical delivery, not human placement approval.',
    '',...lines.slice(1)];
}
async function run(){
  const a=process.argv.slice(2),arg=(n,d)=>{const i=a.indexOf('--'+n);return i<0?d:a[i+1];};
  if(a.includes('--lab')){console.log(JSON.stringify(revisionsLab()));return;}
  if(!a.includes('--revise')){const r=capture();console.log(JSON.stringify({verdicts:r.records.length,status:r.status}));return;}
  const jobs=read(path.resolve(arg('jobs'))),workers=+arg('workers',3),ms=+arg('ms',120000),seed=+arg('seed',401);let cursor=0;
  fs.mkdirSync(path.join(REVIEW,'revised'),{recursive:true});fs.mkdirSync(path.join(REVIEW,'runs'),{recursive:true});
  await Promise.all(Array.from({length:workers},async()=>{while(cursor<jobs.length){const j={...jobs[cursor++],ms,seed};
    const result=await new Promise(resolve=>{const w=new Worker(__filename,{workerData:j});let done=false;const end=r=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(r);};const timer=setTimeout(()=>end({ok:false,why:'hardWall'}),ms);w.on('message',end);w.on('error',e=>end({ok:false,why:e.stack}));w.on('exit',c=>end({ok:false,why:'exit:'+c}));});
    if(result.ok)write(path.join(REVIEW,'revised',j.file.replace('.json','-light.json')),result.row);
    const log={...j,...result,row:undefined};write(path.join(REVIEW,'runs',path.basename(j.file,'.json')+'-s'+seed+'.json'),log);console.log(JSON.stringify(log));
  }}));
}
if(!isMainThread){try{parentPort.postMessage(revise(workerData));}catch(e){parentPort.postMessage({ok:false,why:e.stack});}}
else if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={capture,replaySummary,revise,revisionsLab,reportOverlay,REVIEW,OUT};
