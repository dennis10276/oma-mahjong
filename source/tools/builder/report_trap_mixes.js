'use strict';
// Pure reporting: reads certificates; never searches or changes a board.
const fs=require('fs'),path=require('path');
const M=require('./trap_mixes.js');
const OUT=path.resolve(__dirname,'../../analysis/builder/bank/variety-v1');
const REPORT=path.resolve(__dirname,'../../../codex-tasks/results/trap-variety-v1');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function svg(r){
  const d=r.design,T=d.tiles.map(t=>({x:t[0],y:t[1],z:t[2]})),scale=20;
  const xs=T.map(t=>t.x+.12*t.z),ys=T.map(t=>t.y-.25*t.z),x0=Math.min(...xs)-2,y0=Math.min(...ys)-2;
  const w=(Math.max(...xs)-x0+4)*scale,h=(Math.max(...ys)-y0+4)*scale;
  const bait=new Set(r.card.trap.baits.flatMap(p=>p.tiles)),down=new Set(d.down),keys=new Set(d.obst.keys),locks=new Set(d.obst.locks);
  const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h+115}" viewBox="0 0 ${w} ${h+115}">`,
    '<rect width="100%" height="100%" fill="#162e35"/>',
    `<text x="12" y="22" fill="white" font-family="sans-serif" font-size="16">${esc(r.card.trap.type)} · layout ${r.card.layout}</text>`,
    '<text x="12" y="42" fill="#a9c7d0" font-family="sans-serif" font-size="11">Schematic: numbers are pictures; small labels are tile ids. Orange rim = proven bait.</text>'];
  for(const i of T.map((_,i)=>i).sort((a,b)=>T[a].z-T[b].z||T[a].y-T[b].y)){
    const x=(xs[i]-x0)*scale,y=(ys[i]-y0)*scale+55,ice=d.obst.ice[i]||0;
    const fill=ice?'#bcecff':down.has(i)?'#647787':`hsl(${d.faces[i]*137.5%360} 52% 86%)`;
    parts.push(`<g><rect x="${x}" y="${y}" width="37" height="37" rx="5" fill="${fill}" stroke="${bait.has(i)?'#ff9b42':'#34525a'}" stroke-width="${bait.has(i)?3:1}"/>`,
      `<text x="${x+18.5}" y="${y+23}" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#152f38">${down.has(i)?'?':d.faces[i]+1}</text>`,
      `<text x="${x+3}" y="${y+9}" font-family="sans-serif" font-size="7" fill="#203c46">${i}</text>`);
    const label=[i===d.clock.i?'C'+d.clock.n:'',keys.has(i)?'K':'',locks.has(i)?'L':'',ice?'I'+ice:''].filter(Boolean).join(' ');
    if(label)parts.push(`<rect x="${x+1}" y="${y+27}" width="35" height="10" rx="2" fill="#183942"/><text x="${x+18.5}" y="${y+35}" text-anchor="middle" font-family="sans-serif" font-size="8" fill="white">${label}</text>`);
    parts.push('</g>');
  }
  parts.push(`<text x="12" y="${h+76}" fill="white" font-family="sans-serif" font-size="11">C = clock · K = key · L = lock · I2 = two-neighbour ice</text>`,
    `<text x="12" y="${h+94}" fill="#a9c7d0" font-family="sans-serif" font-size="11">k=${r.card.clock.fewestMoves}, spare=${r.card.clock.spare} · winning starts ${r.card.trap.firstMoves.winning} · tail ${r.card.tail.tailGreedyWin}</text></svg>`);
  return parts.join('\n');
}
function catalogue(){
  const dir=path.join(OUT,'examples');fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(REPORT,{recursive:true});
  const examples=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(file=>({file,r:read(path.join(dir,file))}));
  for(const {file,r}of examples)fs.writeFileSync(path.join(dir,file.replace('.json','.svg')),svg(r)+'\n');
  const sweeps=fs.readdirSync(OUT).filter(f=>/^sweep.*\.json$/.test(f)).flatMap(f=>(read(path.join(OUT,f)).rows||[]).map(row=>({...row,sweep:f})));
  const families=Object.values(M.FAMILIES).map(f=>{
    const rows=sweeps.filter(r=>r.name===f.name),ok=rows.filter(r=>r.ok),ex=examples.filter(e=>e.r.brief.story===f.name);
    return {...f,testedLayouts:[...new Set(rows.map(r=>r.layout))].sort((a,b)=>a-b),hosts:[...new Set(ok.map(r=>r.layout))].sort((a,b)=>a-b),jobs:rows.length,built:ok.length,examples:ex.map(e=>e.file)};
  });
  fs.writeFileSync(path.join(OUT,'families.json'),JSON.stringify(families,null,2)+'\n');
  const lines=['# Trap variety example cards','', '| Board | Family | Layout | Tiles | k + spare | Bait price(s) | Dearest unrelated | Winning starts | Tail | Face down |','|---|---|---:|---:|---|---|---|---:|---:|---:|'];
  for(const {file,r}of examples){const c=r.card,t=c.trap,b=t.baits.map(b=>b.tiles.join('+')+': '+(b.result==='lose'?'loss through spare 3':'+'+b.cost)).join('; '),u=t.control.dearest;
    lines.push(`| [${file}](${file}) / [picture](${file.replace('.json','.svg')}) | ${t.type} | ${c.layout} | ${c.tiles} | ${c.clock.fewestMoves} + ${c.clock.spare} | ${b} | ${u?(u.result==='lose'?'loss through spare 3':'+'+u.cost):'none'} | ${t.firstMoves.winning} | ${c.tail.tailGreedyWin} | ${(100*c.faceDownShare).toFixed(1)}% |`);
  }
  lines.push('','Each JSON contains the full board, strict winning route, independent verification, special ablations, tray pressure facts, see sentence, and tuning notes. SVGs are schematic review cards, not screenshots of changed game levels.');
  fs.writeFileSync(path.join(dir,'CARDS.md'),lines.join('\n')+'\n');
  console.log(JSON.stringify({examples:examples.length,familiesWithTwo:families.filter(f=>f.examples.length>=2).length,families:families.map(f=>({name:f.name,built:f.built,hosts:f.hosts,examples:f.examples.length}))},null,2));
}
if(require.main===module)catalogue();
module.exports={svg,catalogue};
