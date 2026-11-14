'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),{OUT}=require('./chained_v2_run.js');
const root=path.resolve(__dirname,'../..');
function build(){
  const selection=JSON.parse(fs.readFileSync(path.join(OUT,'selection.json'))),allowed=new Set([...selection.order,...selection.clearer]);
  const all=fs.readdirSync(path.join(OUT,'examples')).filter(f=>f.endsWith('.json')&&allowed.has(f)).map(file=>({file,r:JSON.parse(fs.readFileSync(path.join(OUT,'examples',file)))}));
  all.sort((a,b)=>Number(!a.r.card.trap.newLink)-Number(!b.r.card.trap.newLink)||a.r.card.layers-b.r.card.layers||a.r.card.clock.fewestMoves-b.r.card.clock.fewestMoves);
  const picked=[],layouts=new Set(),shapes=new Set();
  for(const file of [...selection.order.filter(f=>all.find(p=>p.file===f)?.r.card.trap.newLink),...selection.clearer]){
    const p=all.find(p=>p.file===file);if(!p||layouts.has(p.r.card.layout)||picked.length===8)continue;picked.push(p);layouts.add(p.r.card.layout);shapes.add(p.r.brief.story);
  }
  for(const p of all){if(picked.length===8)break;if(layouts.has(p.r.card.layout)||shapes.has(p.r.brief.story))continue;picked.push(p);layouts.add(p.r.card.layout);shapes.add(p.r.brief.story);}
  for(const p of all){if(picked.length===8)break;if(layouts.has(p.r.card.layout))continue;picked.push(p);layouts.add(p.r.card.layout);}
  if(picked.length!==8)throw Error('Need eight distinct verified hosts');
  const previousFile=path.join(OUT,'lab-selection.json'),previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile)):[],ids=new Map(previous.map(r=>[r.file,r.id]));
  const id=file=>ids.get(file)??170000000+parseInt(require('crypto').createHash('sha256').update(file).digest('hex').slice(0,6),16);
  const data={made:new Date().toISOString(),factory:true,heading:'New chains · lab 10',intro:'Eight new boards on different layouts, with a light finish after each trap. Please rate the trap and the finish separately in your note.',verdict:[['easy','Too easy'],['right','About right'],['hard','Too hard']],noteHint:'Where was the AHA? How did the finish feel?',winText:'Please rate the trap and the finish in the lab list.',ideas:picked.map(({r,file},i)=>({id:id(file),lv:332+i,kind:'planned',title:`Chain ${i+1} · ${r.card.shape}`,idea:'Find the route through the connected gates. The finish is kept light.',shape:r.card.shape,tiles:r.card.tiles,m:null,board:{...r.design,level:332+i,aspect:1.6}}))};
  const file=path.join(OUT,'lab-ideas.js');fs.writeFileSync(file,'const LAB_IDEAS = '+JSON.stringify(data)+';\n');
  const manifest=picked.map((p,i)=>({id:id(p.file),labLevel:332+i,file:p.file,layout:p.r.card.layout,shape:p.r.brief.story}));fs.writeFileSync(path.join(OUT,'lab-selection.json'),JSON.stringify(manifest,null,2)+'\n');
  const dir=path.join(root,'build/chained-v2-lab');
  cp.execFileSync(process.execPath,[path.join(root,'tools/lab/build_lab.js'),dir,file],{stdio:'inherit'});
  if(fs.existsSync(path.join(OUT,'lab-selection-original.json')))cp.execFileSync(process.execPath,[path.join(__dirname,'recover_chained_v2_verdicts.js')],{stdio:'inherit'});
  console.log(JSON.stringify({dir,manifest}));return {dir,manifest};
}
if(require.main===module)build();module.exports={build};
