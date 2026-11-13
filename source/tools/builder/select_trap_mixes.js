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
  let visited=0;
  const required=qualified.slice(0,12),candidates=pool.filter(p=>required.includes(p.r.card.trapType)).map(p=>({...p,sig:Ledger.signature(p.r.design,p.r.card)}));
  function walk(order,used,counts,sigs){
    if(Date.now()>deadline)return null;visited++;
    if(order.length===want)return required.every(f=>(counts[f]||0)>=2)?order:null;
    const deficit=required.reduce((n,f)=>n+Math.max(0,2-(counts[f]||0)),0);if(deficit>want-order.length)return null;
    const eligible=candidates.filter(p=>!used.has(p.file)&&Ledger.check(p.sig,sigs).ok);
    for(const f of required)if((counts[f]||0)+candidates.filter(p=>!used.has(p.file)&&p.r.card.trapType===f).length<2)return null;
    eligible.sort((a,b)=>{
      const score=p=>100*Math.max(0,2-(counts[p.r.card.trapType]||0))+(p.r.card.trap.firstMoves.winning>=3?30:0)-2*(counts[p.r.card.trapType]||0)+((p.r.card.layout*17+order.length*13)%47)/47;
      return score(b)-score(a);
    });
    for(const p of eligible.slice(0,18)){
      const f=p.r.card.trapType,next=new Set(used);next.add(p.file);
      const got=walk(order.concat(p),next,{...counts,[f]:(counts[f]||0)+1},sigs.concat(p.sig));if(got)return got;
      if(Date.now()>deadline)break;
    }
    return null;
  }
  const order=walk([],new Set(),{},baseline);
  return order?{ok:true,visited,required,order:order.map(p=>p.file)}:{ok:false,why:'noOrderWithinWall',visited,required};
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
