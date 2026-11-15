'use strict';
const fs=require('fs'),path=require('path'),P=require('./narrow_proof');
function record(row){if(row.keep)return {keep:row.keep};if(row.recordFile)return JSON.parse(fs.readFileSync(path.resolve(P.ROOT,row.recordFile)));let dir,name=row.swapFrom||row.level;if(row.swapFrom)dir='tens-narrowed';else if(row.from.startsWith('same mechanics:'))dir='peel-mech';else if(row.from.startsWith('peel_drop:'))dir='peel-drop';else if(row.from.startsWith('completion:'))dir='narrow/placement-lab/completed';else dir='narrow';const file=path.resolve(P.DIR,'..',dir,'level-'+name+'.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;}
function mapping(before,d,rec){const a=before.design,n=a.tiles.length,m=d.tiles.length;if(rec?.keep?.length===m)return {keep:rec.keep,inferred:false};if(rec?.map?.length===m)return {keep:rec.map,inferred:false};if(n===m)return {keep:Array.from({length:n},(_,i)=>i),inferred:false};
  const anchors=new Map([[a.clock.i,d.clock.i]]),pair=(x,y)=>x.forEach((id,i)=>anchors.set(id,y[i]));pair(a.obst.keys,d.obst.keys);pair(a.obst.locks,d.obst.locks);pair(Object.keys(a.obst.ice).map(Number).sort((a,b)=>a-b),Object.keys(d.obst.ice).map(Number).sort((a,b)=>a-b));
  for(const p of rec?.prices||rec?.check?.certificate?.baits||[])pair(p.tiles,p.after.tiles);
  const inverse=new Map([...anchors].map(([i,j])=>[j,i])),oldDown=new Set(a.down),newDown=new Set(d.down),dp=Array.from({length:n+1},()=>new Float64Array(m+1).fill(Infinity)),prev=Array.from({length:n+1},()=>new Uint8Array(m+1));dp[0][0]=0;
  for(let i=0;i<n;i++)for(let j=0;j<=m;j++)if(Number.isFinite(dp[i][j])){
    if(!anchors.has(i)&&dp[i][j]<dp[i+1][j]){dp[i+1][j]=dp[i][j];prev[i+1][j]=1;}
    if(j<m&&(!anchors.has(i)||anchors.get(i)===j)&&(!inverse.has(j)||inverse.get(j)===i)&&oldDown.has(i)===newDown.has(j)){
      const p=a.tiles[i],q=d.tiles[j],cost=(a.faces[i]===d.faces[j]?0:8)+Math.abs(p[2]-q[2])*20+(Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1]))*.1;
      if(dp[i][j]+cost<dp[i+1][j+1]){dp[i+1][j+1]=dp[i][j]+cost;prev[i+1][j+1]=2;}
    }
  }
  if(!Number.isFinite(dp[n][m]))return {error:'No source tile mapping satisfies the recorded special/bait and face-down anchors.'};const keep=[];let i=n,j=m;while(i){if(prev[i][j]===2){keep.push(i-1);j--;}i--;}return {keep:keep.reverse(),inferred:true,cost:dp[n][m],note:'Older output omitted its tile map; recovered by ordered alignment of pictures, layers and recorded special/bait anchors.'};
}
module.exports={record,mapping};
