'use strict';
const fs=require('fs'),path=require('path'),S=require('./shape_bench'),T=require('./shape_bench_tools'),D=require('./detower');
const B=S.bench(279),file=path.resolve(__dirname,'../../../analysis/builder/footprint60/bench/level-279.json'),seed=JSON.parse(fs.readFileSync(file));B.load(seed);const initial=structuredClone(B.st.T),free=T.relations(B.design().d).free,begin=Date.now(),attempts=[];
const mir=(U,m)=>{const K=new Set(U.map(t=>t.join(',')));return U.filter(t=>K.has([m-t[0],t[1],t[2]].join(','))).length;};
for(const axis of[10,11]){B.st.T=structuredClone(initial);for(let it=0;it<12;it++){if(Date.now()-begin>90000)break;let best=null;const old=mir(B.st.T,axis),homeAll=structuredClone(B.st.T);
 for(const i of B.ids((t,i,r)=>r==='.')){const home=B.st.T[i],cur=B.st.T.filter((_,j)=>j!==i);if(cur.some(q=>q[2]>home[2]&&Math.abs(q[0]-home[0])<2&&Math.abs(q[1]-home[1])<2))continue;
  for(let z=0;z<=2;z++)for(let y=0;y<=14;y++)for(let x=0;x<=11;x++){if(Date.now()-begin>90000)break;const p=[x,y,z];if(!D.brickSpot(cur,p))continue;B.st.T[i]=p;const U=B.st.T,score=mir(U,axis);if(score<=old||(best&&score<=best.score))continue;
   if(!T.geometry(B.design().d).ok||S.diffDeps(B,{silent:true}).length)continue;const fr=T.relations(B.design().d).free;if(JSON.stringify(fr)!==JSON.stringify(free))continue;best={i,p,score};}
  B.st.T[i]=home;
 }
 if(!best)break;B.at(best.i,best.p);const shape=D.shape(B.st.T);console.log('axis',axis,'move',best,'mirror',shape.mirror);
 if(shape.mirror>D.shape(initial).mirror){const r=B.prove();attempts.push({axis,move:best,shape:D.strip(shape),result:r});if(r.ok){B.save('Finish tiles moved to mirror spots without changing initial free tiles, trap holds or the certified trap');console.log('saved',shape.mirror);}}
 }
}
fs.writeFileSync(path.resolve(__dirname,'../../../analysis/builder/towers/279-mirror.json'),JSON.stringify({ms:Date.now()-begin,attempts},null,2));
