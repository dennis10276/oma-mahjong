const path='/home/claude/repo-oma/source/';
const B=require(path+'tools/builder/builder.js'), E=require(path+'tools/builder/engine.js');
const {measureHuman}=require(path+'tools/sim/refit/human_style_measure.js');
const [story,layout,ks]=process.argv.slice(2);
const r=B.build({layout:+layout,story,seed:1,frame:{spare:1},targets:{trayRoom:0,hiddenOnWay:0,maxDown:0.3,keysShown:+ks}},{});
const d=r.design, g=E.game(d), ck=d.clock.i, F=d.faces;
const m=measureHuman(d,{runs:4,seed:4711,seeds:1,setting:'family',capture:true});
const pre=d.solution.slice(0,d.solution.indexOf(ck)+1);
const role=i=>(i===ck?'C':'')+(d.obst.keys.includes(i)?'K':'')+(d.obst.locks.includes(i)?'L':'')+(d.obst.ice[i]?'I'+d.obst.ice[i]:'')+(d.down.includes(i)?'d':'');
console.log('family',m.expectedTries,'clock',ck,'n',d.clock.n,'locks',d.obst.locks,'keys',d.obst.keys,'ice',JSON.stringify(d.obst.ice));
console.log('way',pre.map(i=>i+role(i)).join(' '));
console.log(r.card.bites.join(' | '));
for(const res of m.results.slice(0,2)) for(const a of res.attempts.slice(0,3)){
  let s=E.start(g); const out=[];
  for(const i of a.actions){ if(!s.alive[ck]) break; const cl=E.classify(g,s,{nodes:20000,ms:150}); const mine=cl.find(c=>c.move===i); const wins=cl.filter(c=>c.result==='win').length;
    const tk=s.tray.some(t=>F[t]===F[i])?'m':(E.legal(g,s).some(j=>typeof j==='number'&&j!==i&&F[j]===F[i])?'p':'s');
    out.push(i+role(i)+tk+'['+(mine?mine.result[0]:'?')+wins+'/'+cl.length+']'); const n=E.step(g,s,i); if(!n){out.push('X');break;} s=n; }
  console.log('try',a.attempt,a.why,out.join(' '));
}
