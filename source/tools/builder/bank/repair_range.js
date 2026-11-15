'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const R=require('./compact_range'),G=require('./compact_geometry'),F=require('../footprint'),P=require('../preserve_trap'),I=require('../preserve_intent'),E=require('../engine'),SR=require('../chained_special_readability');
const ROOT=path.resolve(__dirname,'../../../..'),OUT=path.join(ROOT,'source/build/footprint60-250-300');
const clone=x=>JSON.parse(JSON.stringify(x)),hash=x=>JSON.stringify(x),read=p=>JSON.parse(fs.readFileSync(p));
function prefix(actions,clock){const out=[];for(const a of actions){out.push(a);if((typeof a==='object'?a.pair:[a]).includes(clock))break;}return out;}
function without(d,ablate){const x=clone(d);if(ablate[0]==='lock')x.obst.locks=x.obst.locks.filter(i=>i!==ablate[1]);else delete x.obst.ice[ablate[1]];return x;}
function visibility(before,tiles){
  const initial=SR.measure({...before.design,obst:before.design.obst||{ice:{},locks:[],keys:[]}}),allowed=[];
  for(const i of [...new Set(initial.rows.filter(r=>r.clear).map(r=>r.tile))]){
    const markers=initial.rows.filter(r=>r.tile===i&&r.clear).map(r=>r.kind),slots=[];
    for(let s=0;s<tiles.length;s++){
      const d={tiles,down:[],obst:{ice:before.design.obst?.ice[i]?{[s]:before.design.obst.ice[i]}:{},keys:before.design.obst?.keys.includes(i)?[s]:[],locks:before.design.obst?.locks.includes(i)?[s]:[]}};
      const measured=SR.measure(d);if(markers.every(kind=>measured.rows.some(r=>r.kind===kind&&r.clear)))slots.push(s);
    }
    allowed.push([i,slots]);
  }return allowed;
}
function feedback(before,design,proof,request){
  const prep=I.prepare(before),budget={nodes:1500000,ms:10000};let added=0;
  const append=(kind,route)=>{const key=hash(route);if(!request[kind].some(q=>hash(q)===key)){request[kind].push(route);added++;}};
  const refine=(d,actions,kind,ablate)=>{
    const g=E.game(clone(d)),removed=[];let s=E.start(g);
    for(const act of actions){
      const take=typeof act==='object'?act.pair:[act],legal=new Set(E.legal(g,s).filter(x=>typeof x==='number'));
      const blocked=take.find(i=>!legal.has(i));
      if(blocked!==undefined){append(kind,{tile:blocked,removed:removed.slice(),...(ablate?{ablate}: {})});return;}
      s=E.step(g,s,act);removed.push(...take);if(!s)return;
    }
  };
  for(const [goal,needs]of proof.dependencies||[]){
    const prior=prep.roleDependencies.find(q=>q[0]===goal)?.[1]||[];
    for(const pin of needs.filter(i=>!prior.includes(i))){
      const g=E.game(clone(before.design)),s=E.start(g),removed=[];
      for(let guard=0;guard<g.n;guard++){
        const legal=E.legal(g,s).filter(x=>typeof x==='number'&&x!==pin);
        if(!legal.length)break;
        const i=legal.includes(goal)?goal:legal.sort((a,b)=>before.design.solution.indexOf(a)-before.design.solution.indexOf(b))[0];
        const newer=E.game(clone(design)),targetState={...s,alive:s.alive.slice()};
        if(!E.legal(newer,targetState).includes(i)){append('requireState',{tile:i,removed:removed.slice()});break;}
        s.alive[i]=0;removed.push(i);if(i===goal)break;
      }
    }
  }
  if(proof.errors.includes('clockMinimumChangedOrUnproven')){
    const next=E.clockShortest(E.game(clone(design)),budget),old=prep.clock;
    if(next&&!next.unsure&&old&&!old.unsure){if(next.k<old.k)refine(before.design,next.path,'forbidState');else if(next.k>old.k)refine(design,old.path,'requireState');}
  }
  for(const effect of proof.effects||[])if(effect.afterK!==effect.beforeK){
    const ablate=[effect.kind,effect.tile],a=without(before.design,ablate),b=without(design,ablate);
    const ca=E.clockShortest(E.game(a),budget),cb=E.clockShortest(E.game(b),budget);
    if(ca&&!ca.unsure&&cb&&!cb.unsure){if(cb.k<ca.k)refine(a,cb.path,'forbidState',ablate);else refine(b,ca.path,'requireState',ablate);}
  }
  for(const price of proof.prices||[])if(!price.after.exact||price.before.result!==price.after.result||price.before.cost!==price.after.cost){
    if(price.after.result==='win'&&price.after.need){
      const d={...design,clock:{...design.clock,n:price.after.need}},g=E.game(d);let s=E.start(g);
      try{for(const i of price.tiles)s=E.step(g,s,i);}catch{s=null;}
      const win=s&&E.winnable(g,s,{...budget,solution:true});
      if(win?.result==='win'&&win.solution)refine({...before.design,clock:{...before.design.clock,n:price.after.need}},price.tiles.concat(win.solution),'forbidState');
    }
  }
  for(const probe of proof.probes||[])if(probe.before!==probe.after&&probe.after==='win'){
    const g=E.game(clone(design)),s=prep.states[probe.step];let ns;try{ns=E.step(g,s,probe.tile)}catch{}
    const win=ns&&E.winnable(g,ns,{...budget,solution:true});
    if(win?.result==='win'&&win.solution)refine(before.design,before.design.solution.slice(0,probe.step).concat(probe.tile,win.solution),'forbidState');
  }
  for(const error of proof.errors){const match=/^offerMissing:(\d+):(\d+)$/.exec(error);if(match){const pair=[+match[2],+match[1]];if(!request.availableAt.some(q=>hash(q)===hash(pair))){request.availableAt.push(pair);added++;}}}
  return added;
}
function save(before,design,proof,strategy,stats){
  const fit=F.measure(design),result={...before,design,footprint:fit.ok?fit:F.measure(design,{minimum:58}),preservation:proof,footprintOriginal:before.design,repair:{strategy,...stats}};
  fs.writeFileSync(path.join(OUT,'drafts/level-'+before.level+'.json'),JSON.stringify(result));return result;
}
function repair(before,opts={}){
  const started=Date.now(),failures={},seen=new Set(),level=before.level,base=before.design,templates=[];
  const existing=read(path.join(OUT,'drafts/level-'+level+'.json'));
  const minimum=opts.minimum??58;
  if(existing.design&&F.measure(existing.design,{minimum}).ok&&I.verify(before,existing).ok)return existing;
  const windows=[...G.enumerateWindows(base,8,6.5),...G.enumerateWindows(base,8),...G.enumerateWindows(base)],constraints=I.constraints(before),serialized={rules:constraints.rules,opens:[...constraints.opens]};
  // This migration uses the explicitly scoped behavioural contract. Ordinary
  // construction still uses compact_footprint's stronger exact-core contract.
  for(const window of windows)for(const extraCount of [0,2,4,8,16])for(let seed=1;seed<=4;seed++){
    const d=G.buildRestackedTiles(base,level,window,{seed,extraCount,useStripShift:false});if(!d||!F.measure(d,{minimum}).ok)continue;
    const key=hash(d.tiles);if(seen.has(key))continue;seen.add(key);
    const proof=I.verify(before,{design:d});
    if(proof.ok)return save(before,d,proof,'geometry',{ms:Date.now()-started});
    for(const error of proof.errors)failures[error]=(failures[error]||0)+1;
    if(templates.length<12)templates.push(d.tiles);
  }
  const prep=I.prepare(before);
  const necessary=[];
  const necessaryTargets=prep.roleDependencies.flatMap(([goal,pins])=>pins.map(pin=>[pin,goal]));
  templates.push(...require('../compact_templates').templates(base,16,level,{near:true}));
  for(let template=0;template<templates.length;template++){
    const request={design:base,hint:templates[template],constraints:serialized,iceGraphs:[],necessary,necessaryTargets,visibleSlots:visibility(before,templates[template]),forbid:[],require:[],forbidState:[],requireState:[],availableAt:[],workers:opts.workers??4,seconds:opts.seconds??8,seed:template+1};
    const input=path.join(OUT,'solver-input-'+level+'.json'),output=path.join(OUT,'solver-output-'+level+'.json');
    for(let pass=0;pass<10;pass++){
      fs.writeFileSync(input,JSON.stringify(request));
      cp.execFileSync('python',[path.join(ROOT,'source/tools/builder/solve_slots.py'),input,output],{stdio:'pipe',windowsHide:true});
      const solved=read(output);console.log(JSON.stringify({level,template,pass,solver:solved.status,seconds:solved.seconds}));
      if(!solved.tiles)break;
      const d={...clone(base),tiles:solved.tiles},proof=I.verify(before,{design:d});
      if(proof.ok&&F.measure(d,{minimum}).ok)return save(before,d,proof,'slot-solver',{template,pass,ms:Date.now()-started});
      for(const error of proof.errors)failures[error]=(failures[error]||0)+1;
      console.log(JSON.stringify({level,errors:proof.errors}));
      if(!feedback(before,d,proof,request))break;
    }
  }
  return {fail:'repairUnresolved',level,failures,ms:Date.now()-started};
}
function run(opts={}){
  const rows=[];
  for(const before of R.baseline()){
    if(opts.levels&&!opts.levels.includes(before.level))continue;
    const result=repair(before,opts),row={level:before.level,ok:!!result.design,tiles:before.design.tiles.length,px:result.design?F.measure(result.design).tilePx:null,proof:result.preservation?.scope||'exact-core',repair:result.repair,fail:result.fail,failures:result.failures};
    rows.push(row);console.log('RESULT '+JSON.stringify(row));fs.writeFileSync(path.join(OUT,'repair-report-'+(opts.levels?.[0]??'all')+'.json'),JSON.stringify({passed:rows.filter(r=>r.ok).length,total:rows.length,rows},null,2));
  }return rows;
}
if(require.main===module){const at=process.argv.indexOf('--levels'),sec=process.argv.indexOf('--seconds'),wk=process.argv.indexOf('--workers');run({levels:at>=0?process.argv[at+1].split(',').map(Number):null,seconds:sec>=0?+process.argv[sec+1]:8,workers:wk>=0?+process.argv[wk+1]:4});}
module.exports={repair,run,feedback};
