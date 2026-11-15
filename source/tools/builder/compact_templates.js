'use strict';
// Alternate compact host piles for a puzzle whose original outline will not fit.
// These are geometry proposals only: every original tile is assigned and the
// independent before/after intent contract still has to pass.
const L=require('../../www/layouts'),F=require('./footprint');
function rng(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};}
const overlap=(a,b)=>Math.abs(a[0]-b[0])<2&&Math.abs(a[1]-b[1])<2;
function templates(design,count=24,seed=1,opts={}){
  const out=[],seen=new Set(),n=design.tiles.length;
  const maxX=opts.near?11:10,maxY=opts.near?14:12;
  for(let attempt=0;attempt<count*6&&out.length<count;attempt++){
    const random=rng(seed*7919+attempt*104729),tiles=[],brick=attempt%2===1;
    const base=[];for(let y=0;y<=maxY;y+=2)for(let x=(brick&&y%4===2?1:0);x<=maxX;x+=2){
      const corner=Math.abs(x-5)/5+Math.abs(y-6)/6;
      base.push({tile:[x,y,0],score:corner+(attempt%4===0?random()*.9:random()*.3)});
    }
    const baseCount=Math.min(base.length,Math.round(n*(.36+(attempt%4)*.025)));
    base.sort((a,b)=>a.score-b.score);tiles.push(...base.slice(0,baseCount).map(q=>q.tile));
    for(let z=1;z<=5&&tiles.length<n;z++){
      const layer=[],candidates=[];
      for(let y=z>=4?2:1;y<=maxY;y++)for(let x=z>=4?2:1;x<=maxX;x++){
        const tile=[x,y,z],support=tiles.filter(t=>t[2]===z-1&&overlap(t,tile)).length;
        if(support<2)continue;
        const stagger=(x+z)%2===0&&((attempt%3===0)||(y+z)%2===0);
        candidates.push({tile,score:support*2+(stagger?4:0)-Math.abs(x-5)*.5-Math.abs(y-6)*.2+random()*(attempt%3===0?8:3)});
      }
      candidates.sort((a,b)=>b.score-a.score);
      const desired=z===1?Math.ceil(n*(.25+(attempt%3)*.025)):z===2?Math.ceil(n*.20):n;
      for(const q of candidates){if(tiles.length+layer.length>=n||layer.length>=desired)break;if(!layer.some(t=>overlap(t,q.tile)))layer.push(q.tile);}
      tiles.push(...layer);
    }
    if(tiles.length!==n||!F.measure(tiles,{minimum:opts.near?58:60}).ok)continue;
    // Seed the identity assignment with a legal geometric removal order.
    const objects=tiles.map(([x,y,z])=>({x,y,z})),nb=L.neighbors(objects),alive=new Uint8Array(n).fill(1),assigned=[];
    for(const id of design.solution){const ready=tiles.map((t,i)=>({i,score:t[2]+random()*.5})).filter(q=>L.isFree(q.i,alive,nb)).sort((a,b)=>b.score-a.score);if(!ready.length)break;const slot=ready[0].i;assigned[id]=tiles[slot];alive[slot]=0;}
    if(assigned.length!==n||assigned.some(q=>!q))continue;
    const key=JSON.stringify(assigned);if(seen.has(key))continue;seen.add(key);out.push(assigned);
  }
  return out;
}
module.exports={templates};
