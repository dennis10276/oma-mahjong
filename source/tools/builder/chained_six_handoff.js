'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const {OUT}=require('./chained_six_run.js'),{SHAPES}=require('./chained_shapes.js'),{DEFINITIONS}=require('./chained_six_specs.js');
const root=path.resolve(__dirname,'../../..'),results=path.join(root,'codex-tasks/results/new-ideas');
const read=p=>JSON.parse(fs.readFileSync(p)),write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
function primary(r){const f=SHAPES[r.brief.story];return [...(f.sixIdeas||[]),...({earlyClock:['waitForTwin'],repeatKeys:['lookalikeChoice'],roofKey:['clockRoof']}[f.mode]||[])].sort();}
function rank(r){return r.card.trap.links*2+r.card.clock.fewestMoves+(r.card.pressure?.at3||0)*.3+(primary(r).includes('lookalikeChoice')?3:0);}
function select(){
  const rows=fs.readdirSync(path.join(OUT,'checked')).filter(f=>f.endsWith('.json')).map(file=>({file,r:read(path.join(OUT,'checked',file))})).filter(p=>p.r.verification.ok);
  rows.forEach(p=>{p.primary=primary(p.r);p.pair=p.primary.join('+');p.rank=rank(p.r);p.fingerprint=crypto.createHash('sha256').update(JSON.stringify([p.r.design.tiles,p.r.design.obst,p.r.design.clock.i])).digest('hex');});
  const candidates=rows.filter(p=>p.primary.length===2),selected=[],pairs={},layouts={},seen=new Set();
  while(selected.length<40){
    const recent=new Set(selected.slice(-12).map(p=>p.r.card.layout));
    const eligible=candidates.filter(p=>!selected.includes(p)&&(pairs[p.pair]||0)<4&&!seen.has(p.fingerprint));
    if(!eligible.length)break;
    const cost=p=>(recent.has(p.r.card.layout)?1000:0)+(layouts[p.r.card.layout]||0)*20+(pairs[p.pair]||0)*8+p.rank+(p.r.card.layers===3?0:3);
    eligible.sort((a,b)=>cost(a)-cost(b)||a.file.localeCompare(b.file));const p=eligible[0];selected.push(p);pairs[p.pair]=(pairs[p.pair]||0)+1;layouts[p.r.card.layout]=(layouts[p.r.card.layout]||0)+1;seen.add(p.fingerprint);
  }
  const singles={};for(const kind of Object.keys(DEFINITIONS)){
    const used=new Set();singles[kind]=rows.filter(p=>p.primary.length===1&&p.primary[0]===kind&&p.r.card.layers===3).sort((a,b)=>a.rank-b.rank).filter(p=>{const l=p.r.card.layout;if(used.has(l)||used.size>=4)return false;used.add(l);return true;});
  }
  const simple=p=>({file:p.file,layout:p.r.card.layout,primary:p.primary,layers:p.r.card.layers,rank:p.rank});
  const selection={made:new Date().toISOString(),target:40,met:selected.length===40,combinations:selected.map(simple),pairCounts:pairs,layouts,singles:Object.fromEntries(Object.entries(singles).map(([k,a])=>[k,a.map(simple)]))};
  write(path.join(OUT,'selection.json'),selection);return {rows,selected,singles,selection};
}
function lab(data){
  const picked=[];
  for(const kind of Object.keys(DEFINITIONS)){
    const offers=data.rows.filter(p=>p.primary.includes(kind)).sort((a,b)=>a.rank-b.rank);
    if(offers.length<2)continue;
    const easy=offers[0],hard=offers.slice().reverse().find(p=>p.file!==easy.file&&p.r.card.layout!==easy.r.card.layout);if(!hard)continue;
    picked.push({kind,p:easy,edge:'easier'},{kind,p:hard,edge:'harder'});
  }
  const manifest=picked.map(({kind,p,edge},i)=>({id:180000000+parseInt(crypto.createHash('sha256').update(kind+'/'+p.file).digest('hex').slice(0,6),16),file:p.file,kind,edge,labLevel:350+i,layout:p.r.card.layout}));
  const ideas={made:new Date().toISOString(),factory:true,heading:'Six wrong ideas · constructor lab',intro:'New ideas built into connected chains, with a light finish. Please rate the trap and the finish in your note.',verdict:[['easy','Too easy'],['right','About right'],['hard','Too hard']],noteHint:'Where was the AHA? How did the finish feel?',winText:'Please rate the trap and the finish in the lab list.',ideas:picked.map(({kind,p},i)=>({id:manifest[i].id,lv:350+i,kind:'planned',title:DEFINITIONS[kind].title,idea:'Find the route through the connected gates.',shape:p.r.card.shape,tiles:p.r.card.tiles,m:null,board:{...p.r.design,level:350+i,aspect:1.6}}))};
  const file=path.join(OUT,'lab-ideas.js');fs.writeFileSync(file,'const LAB_IDEAS = '+JSON.stringify(ideas)+';\n');write(path.join(OUT,'lab-selection.json'),manifest);
  const dir=path.join(root,'source/build/new-ideas-lab');cp.execFileSync(process.execPath,[path.join(root,'source/tools/lab/build_lab.js'),dir,file],{stdio:'inherit'});return {dir,manifest};
}
function report(data){
  fs.mkdirSync(results,{recursive:true});
  const {rows,selected,singles,selection}=data,logs=fs.readdirSync(path.join(OUT,'runs')).filter(f=>f.endsWith('.jsonl')).flatMap(f=>fs.readFileSync(path.join(OUT,'runs',f),'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s)));
  const failures={};for(const row of logs)for(const [why,n]of Object.entries(row.fails||{}))failures[why]=(failures[why]||0)+n;
  const lines=['# Task 18 — Six constructor link kinds','',`Branch: \`wip/codex-new-ideas\`; base: \`c582db46\` from the newest local \`wip/cc-builder-loop\`. Updated task, including the forty-board combination target, is the scope.`,
    '',`Current independent acceptance: **${rows.length} boards**. Main 320+ catalogue: **${selected.length}/40** two-idea chains, with at most four boards per primary idea pair. ${Object.keys(selection.layouts).length} layouts. Only \`checked/\` boards are accepted; raw and unfinished examples are research evidence.`,
    '', 'No level table was changed. Nothing was merged into main, released, pushed, or written to Firebase. The numbers in the lab are local labels.',
    '', '## Constructor and proofs','',
    '`chained_six_specs.js` supplies declarative recipes; `chained_six_ideas.js` supplies six link kinds, each with `place`, `pictures`, and `prove`. `chained_shapes.js` composes a dependency graph with ordered link lists. `trap_mixes.registerChain(name, {base, links})` uses the same stages for further combinations. Incompatible physical constraints fail placement; combinations are never relabelled successes.',
    '', 'Geometry, fixed bait pictures, and tray obligations are authored before minimum-clock search. Three-of-a-kind inserts a reserved free copy immediately after the third copy in the planned dig, then assigns the fourth copy to a buried tail tile. This differs from moving pictures on an already finished host.',
    '', 'Every accepted new bait is a proven loss at the actual shipping deadline. Its exact price is also recorded through min(19, shortest+3). Dial 2 is required; all greedy ties are considered. A two-idea chain may have one immediate greedy lure and another separately proven losing decision. The older two-disjoint-baits requirement remains for older stories; a standalone new hard chain needs its authored bait, and combinations must prove every constituent idea.',
    '', 'Fixed the premature dial-2 gate: build previously called the obviousness check with no priced baits, making dial 2 fail universally. The preliminary gate now checks route obviousness; the final gate checks the priced preferred bait. The independent verifier still checks dial 2.',
    '', 'The verifier imports declarative specs and board predicates, and uses separate engine calls for prices, earlier-deadline unsatisfiability, and special effects. It imports no trap constructor. It checks each composed link, visibility at move 0, bait loss, and the wrong-idea ledger. A clock-count card also carries a strict winning witness for the longer top approach, avoiding the parked side tile until after the clock.',
    '', 'Finishing uses `bank/feel_retune.js` through `tuneFeel` with pressure parks 1.5–3 (the established finish aims inside that band), face-down share .23–.28, visible twins apart, no close four-copy pictures, strict complete replay, and a fresh independent verification. The stored feel cards use seed 9, 16 playouts. All heavy searches ran through `loop/heavy.js` with worker termination deadlines; unknown searches were rejected.',
    '', '## Per idea',''];
  const blockers={doubleMelt:'No accepted host. Real two-front constructions reach picture assignment and then fail `obvious:freeRoutePair`: the requested correct move is itself a ready free pair on the clock route. Pair-first greedy also prefers that correct pair over two lonely singles. To make this buildable, explicitly allow this idea’s shared correct pair in obviousness and test its wrong singles at the later frontier, or change the lure to a competing wrong ready pair. The current task requires the existing dial, so the constructor rejects it rather than weakening that gate.',freeMelt:'No accepted key/thaw host unless listed below. Frozen ordinary route tiles were explored but excluded: they are a broader idea than the requested key/thaw tile. Tight valid key/thaw placements frequently have covered combined badges, a survivable outside preparation, or ice that is redundant because the mandatory dig already removes its neighbours. A buildable change is a crossing two-route host: the frozen key/thaw tile blocks a genuinely cheaper early exit, while the intended dig removes its visible neighbours incidentally. That requires new crossing geometry, rather than making an arbitrary route tile icy.'};
  for(const [kind,spec]of Object.entries(DEFINITIONS)){
    const all=rows.filter(p=>p.primary.includes(kind)),raw=fs.readdirSync(path.join(OUT,'raw')).filter(f=>f.endsWith('.json')).map(f=>({file:f,r:read(path.join(OUT,'raw',f))})).filter(p=>SHAPES[p.r.brief.story]?.sixIdeas?.includes(kind));
    lines.push(`### ${spec.title} (\`${kind}\`)`,'',spec.see,'',`Accepted hosts (all chains): ${[...new Set(all.map(p=>p.r.card.layout))].sort((a,b)=>a-b).join(', ')||'none'}. Three-layer single-idea sample: ${singles[kind].map(p=>'L'+p.r.card.layout).join(', ')||'none'} (${singles[kind].length}/4). Raw constructors yielded ${raw.length} candidates.`, '');
    if(blockers[kind])lines.push(blockers[kind],'');
    const prices=all.map(p=>{const q=(p.r.card.trap.newLinks||[p.r.card.trap.newLink]).find(q=>q.kind===kind),bait=p.r.card.trap.baits.find(b=>JSON.stringify(b.tiles)===JSON.stringify(q.take));return bait.result==='lose'?'lost through price horizon':`+${bait.cost} clock moves`;});
    lines.push(`Bait prices: ${[...new Set(prices)].join('; ')||'no accepted price'}. ${kind==='keysLater'?'Every accepted lock has a post-clock fork/pressure effect, independently reproduced.':''}`,'');
  }
  lines.push('## Main two-idea catalogue for 320+','',`Target ${selection.met?'met':'not met'}: ${selected.length}/40. Extra qualified siblings stay in checked/ and are not counted beyond the pair quota.`, '', '| # | Board | Primary ideas | Layout / layers | Clock min + spare | Pressure parks | Down |', '|---:|---|---|---|---|---:|---:|');
  selected.forEach((p,i)=>lines.push(`| ${i+1} | ${p.file.replace('.json','')} | ${p.pair} | ${p.r.card.layout} / ${p.r.card.layers} | ${p.r.card.clock.fewestMoves} + ${p.r.card.clock.spare} | ${p.r.card.feel.pp} | ${(p.r.card.faceDownShare*100).toFixed(0)}% |`));
  lines.push('', 'Pair use: '+Object.entries(selection.pairCounts).map(([p,n])=>`${p}: ${n}`).join('; ')+'.','', 'Ordering favours fewer links/shorter digs and spreads layouts; it is a judgement, not a bot difficulty rating. The earlier six-level wrong-idea spacing rule cannot hold for an uninterrupted catalogue of two-idea boards: seven consecutive boards require fourteen distinct idea appearances, while six new plus three named old kinds supply nine. The pair cap is enforced; final interleaving with other levels belongs to the lead.','', '## Single-idea three-layer samples','', '| Idea | Boards | Hosts |','|---|---|---|');
  for(const [kind,ps]of Object.entries(singles))lines.push(`| ${kind} | ${ps.map(p=>p.file.replace('.json','')).join(', ')||'none'} | ${ps.length}/4 |`);
  lines.push('', '## Fifteen reserve hosts','', 'Each is rebuilt on its original layout and base graph with an extra new link. These are not clock-only retunes. A candidate is not an upgrade until finishing and independent acceptance pass.','', '| Reserve | Accepted rebuild | Status |', '|---|---|---|');
  const reserve=read(path.join(OUT,'reserve-hosts.json')).reserve;
  for(const h of reserve){const offers=rows.filter(p=>SHAPES[p.r.brief.story]?.baseName===h.base&&p.r.card.layout===h.layout),raw=fs.readdirSync(path.join(OUT,'raw')).filter(f=>f.startsWith(h.base+'_')&&f.includes('-L'+h.layout+'-'));
    lines.push(`| ${h.id} | ${offers.map(p=>p.file.replace('.json','')).join(', ')||'—'} | ${offers.length?'accepted':raw.length?'raw only; finish not accepted':'no proved rebuild'} |`);}
  lines.push('', '## Lab and review','', '[Open the lab](http://127.0.0.1:8266/). It uses the unchanged current `bank/lab_server.js`, including the named Lab player, `/replays` collection of `omamj.replayq*`, and “Show the way to the clock”. Findings and recordings are saved beside `source/build/new-ideas-lab/` on this PC. `lab-selection.json` identifies the easiest/hardest chosen board per yielding idea.', '', 'Strongest expected AHA: **Three of a kind**, because the familiar safe free pair becomes wrong for a visible third-copy reason; **The melter’s twin is under the ice**, because the same ice visibly explains why the tempting neighbour must wait. These are design judgements awaiting Dennis’s play, not measured ratings.', '', '## Failures and reproducibility','', 'Largest rejected-attempt counters (diagnostic logs span development revisions; acceptance uses the current proof):','');
  for(const [why,n]of Object.entries(failures).sort((a,b)=>b[1]-a[1]).slice(0,18))lines.push(`- ${why}: ${n}`);
  lines.push('', 'Source: `source/tools/builder/chained_six_*.js`, `chained_clock_count.js`, and the changes to `trap_mixes.js`, `chained_shapes.js`, `chained_v2_finish.js`, `verify_chained_v2.js`. Logs: `source/analysis/builder/bank/new-ideas/runs/`. `selection.json` is the machine-readable handoff. `checked/` contains accepted complete artifacts, including solutions and proof cards.','', 'Reproduce final proof refresh (through the shared heavy wrapper): `node source/tools/builder/chained_six_run.js --mode refresh --names <families> --workers 4 --minutes 10 --ms 60000`. Rebuild the handoff and lab: `node source/tools/builder/chained_six_handoff.js --lab`.','');
  fs.writeFileSync(path.join(results,'REPORT.md'),lines.join('\n'));return path.join(results,'REPORT.md');
}
if(require.main===module){const data=select();if(process.argv.includes('--lab'))console.log(lab(data));console.log(report(data));console.log(JSON.stringify(data.selection));}
module.exports={select,lab,report,primary,rank};
