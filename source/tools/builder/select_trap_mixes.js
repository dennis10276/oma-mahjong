'use strict';
const fs=require('fs'),path=require('path');
const Ledger=require('./bank/ledger.js');
const B=require('./builder.js');
const OUT=path.resolve(__dirname,'../../analysis/builder/bank/variety-v1');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
function history(checkout){
  if(!checkout&&fs.existsSync(path.join(OUT,'ledger-history.json')))return read(path.join(OUT,'ledger-history.json'));
  const entries=Ledger.loadRated();
  // ledger.js predates labs 4 and 5. Snapshot their signatures without changing
  // Claude's ledger or borrowing the boards as new examples.
  if(checkout){
    const root=path.resolve(checkout,'source/build/traps');
    const captured=new Set();
    for(const lab of [4,5]){
      const file=path.resolve(checkout,`source/build/try-lab-${lab}/lab-ideas.js`);
      const notesFile=path.resolve(__dirname,`../../analysis/builder/process-v2/lab-findings-2026-11-13-lab${lab}.json`);
      if(!fs.existsSync(file)||!fs.existsSync(notesFile))continue;
      const data=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\s*const LAB_IDEAS\s*=\s*/,'').replace(/;\s*$/,'')),notes=read(notesFile).ratings;
      for(const idea of data.ideas||[]){const note=notes[idea.lv];if(!note||!note.stars||!idea.board)continue;
        const layout=B.LAYOUTS.findIndex(l=>JSON.stringify(l.tiles)===JSON.stringify(idea.board.tiles));
        entries.push({...Ledger.signature(idea.board,{layout:layout<0?null:layout,trapType:note.chain||note.name?.split(' L')[0]||'historical'}),source:`try-lab-${lab}/${idea.lv}`});
        captured.add(lab);
      }
    }
    const files=['examples/keyOnClock-7.json','examples/keyOnClock-31.json',...['chain-11-46','chain-15-12','chain-5-9','chain-0-1','chain-2-6','chain-3-8'].map(f=>'examples2/'+f+'.json')];
    for(const file of files){if(captured.has(file.startsWith('examples2/')?5:4))continue;const full=path.join(root,file);if(!fs.existsSync(full))continue;const r=read(full),d=r.design||r.r?.design,c=r.card||r.r?.card||{};
      if(!d)continue;const layout=+(file.match(/-(\d+)\.json$/)||[])[1];
      entries.push({...Ledger.signature(d,{...c,layout,trapType:c.trapType||c.trap?.trapType||c.trap?.type||c.story}),source:file});
    }
  }
  return entries;
}
function select(pool,baseline,opts={}){
  const want=opts.want??30,deadline=Date.now()+(opts.wallMs??5000),by=new Map();
  for(const p of pool){const f=p.r.card.trapType;if(!by.has(f))by.set(f,[]);by.get(f).push(p);}
  const qualified=[...by].filter(([,ps])=>new Set(ps.map(p=>p.r.card.layout)).size>=2).sort((a,b)=>new Set(b[1].map(p=>p.r.card.layout)).size-new Set(a[1].map(p=>p.r.card.layout)).size).map(([f])=>f);
  if(qualified.length<12)return {ok:false,why:'fewerThan12FamiliesWithTwoLayouts',qualified:qualified.length};
  // Precompute the immutable ledger tests. Repeating geometric overlap scans at
  // every DFS node made an otherwise small scheduling problem time out.
  let visited=0,best=0,bestDeficit=24,roundNodes=0,attempt=0;
  let seed=73;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const required=qualified.slice(0,12),candidates=pool.filter(p=>required.includes(p.r.card.trapType)).map(p=>({...p,sig:Ledger.signature(p.r.design,p.r.card)})).filter(p=>baseline.every(e=>Ledger.diffCount(p.sig,e)>=Ledger.RULES.minDiff&&!(e.layout===p.sig.layout&&e.trap===p.sig.trap)));
  const n=candidates.length,compatible=candidates.map((p,i)=>candidates.map((q,j)=>i!==j&&Ledger.diffCount(p.sig,q.sig)>=3&&!(p.sig.layout===q.sig.layout&&p.sig.trap===q.sig.trap))),same=candidates.map(p=>candidates.map(q=>Ledger.sameLayout(p.sig,q.sig))),hist=candidates.map(p=>baseline.map(e=>Ledger.sameLayout(p.sig,e)));
  function walk(order,available,counts){
    if(Date.now()>deadline||++roundNodes>10000)return null;visited++;best=Math.max(best,order.length);
    if(order.length===want)return required.every(f=>(counts[f]||0)>=2)?order:null;
    if(available.length<want-order.length)return null;
    const deficit=required.reduce((v,f)=>v+Math.max(0,2-(counts[f]||0)),0);if(deficit>want-order.length)return null;
    const remain={};for(const i of available)(remain[candidates[i].sig.trap]??=[]).push(i);
    for(const f of required)if((counts[f]||0)+(remain[f]?.length||0)<2)return null;
    bestDeficit=order.length===want?Math.min(bestDeficit,deficit):bestDeficit;
    const recent=order.slice(-12),last=order.slice(-2),eligible=available.filter(i=>!recent.some(j=>same[i][j])&&!last.some(j=>candidates[j].sig.trap===candidates[i].sig.trap)&&!hist[i].slice(Math.max(0,baseline.length-12+order.length)).some(Boolean)&&(deficit<want-order.length||(counts[candidates[i].sig.trap]||0)<2));
    const scores=new Map(eligible.map(i=>{const p=candidates[i],f=p.sig.trap,need=Math.max(0,2-(counts[f]||0));return [i,100*need/(remain[f]?.length||1)+(p.r.card.trap.firstMoves.winning>=3?2:0)-.2*(counts[f]||0)+random()*150];}));
    eligible.sort((a,b)=>scores.get(b)-scores.get(a));
    for(const i of eligible){const f=candidates[i].sig.trap,got=walk(order.concat(i),available.filter(j=>compatible[i][j]),{...counts,[f]:(counts[f]||0)+1});if(got)return got;if(Date.now()>deadline)break;}
    return null;
  }
  let order=null;while(!order&&Date.now()<deadline){roundNodes=0;attempt++;order=walk([],candidates.map((_,i)=>i),{});}
  // Keep the unchanged public ledger as the final authority.
  if(order){let previous=baseline;for(const i of order){const p=candidates[i],r=Ledger.check(p.sig,previous);if(!r.ok)throw Error('selector disagrees with ledger: '+r.reasons.join(';'));previous=previous.concat(p.sig);}}
  return order?{ok:true,visited,required,order:order.map(i=>candidates[i].file)}:{ok:false,why:'noOrderWithinWall',visited,best,bestDeficit,attempt,required};
}
function main(){
  const args=process.argv.slice(2),i=args.indexOf('--history-checkout'),base=history(i<0?null:args[i+1]),dir=path.join(OUT,'examples');
  const pool=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(file=>({file,r:read(path.join(dir,file))}));
  const result=select(pool,base,{wallMs:10000});
  fs.writeFileSync(path.join(OUT,'ledger-history.json'),JSON.stringify(base,null,2)+'\n');
  fs.writeFileSync(path.join(OUT,'selection.json'),JSON.stringify(result,null,2)+'\n');
  if(result.ok&&args.includes('--apply'))applySelection(result);
  console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
}
function applySelection(result){
  if(!result.ok||result.order.length!==30)throw Error('need a successful thirty-board selection');
  const dir=path.join(OUT,'examples'),reserve=path.join(OUT,'reserves'),keep=new Set(result.order);
  for(const file of keep)if(!fs.existsSync(path.join(dir,file)))throw Error('selected board missing: '+file);
  fs.mkdirSync(reserve,{recursive:true});
  for(const file of fs.readdirSync(dir).filter(f=>/\.(json|svg|md)$/.test(f)&&f!=='CARDS.md'&&!keep.has(f.replace(/\.(svg|md)$/,'.json')))){
    const from=path.resolve(dir,file),to=path.resolve(reserve,file),root=path.resolve(OUT)+path.sep;
    if(!from.startsWith(root)||!to.startsWith(root))throw Error('artifact path escaped variety directory');
    fs.renameSync(from,to);
  }
}
if(require.main===module)main();
module.exports={history,select,applySelection};
