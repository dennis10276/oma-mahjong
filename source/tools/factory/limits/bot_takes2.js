// the bot's takes on the live levels 85-174, in the same terms as human_taps.js (missed match by face-down tiles left)
const fs=require('fs'),vm=require('vm');const G=process.env.G51_ROOT;const {measureHuman}=require(G+'/source/tools/sim/refit/human_bot.js');
const L=require(G+'/source/www/layouts.js');global.Layouts=L;global.HARD_LEVELS=vm.runInNewContext(fs.readFileSync(G+'/source/www/levels-hard.js','utf8')+';HARD_LEVELS');const H=require(G+'/source/www/hard.js');
const [part,parts,out,runs]=process.argv.slice(2);
for(let lv=85;lv<=174;lv++){if(lv%+parts!==+part)continue;const d=H.get(lv),faces=d.faces,D=new Set(d.down);
 const m=measureHuman({tiles:d.tiles,faces:d.faces,down:d.down,obst:d.obst,clock:d.clock},{runs:+(runs||10),setting:process.env.SETTING||'dennis',seed:4711,capture:true});
 const rows=[];
 for(const res of m.results)for(const a of res.attempts){const ds=a.decisions||[];
  for(let k=0;k<ds.length;k++){const x=ds[k],i=x.index,al=x.state.alive;const nxt=ds[k+1];
   const taken=nxt?!nxt.state.alive[i]:true; if(!taken||!al[i])continue;
   const tray=x.state.tray,fog=al.reduce((c,v,j)=>c+(v&&D.has(j)&&x.observed.down[j]!==0?1:0),0);
   const matched=tray.includes(faces[i]);let avail=false;
   if(!matched&&tray.length)for(let j=0;j<al.length&&!avail;j++){if(j===i||!al[j]||x.observed.down[j]!==0||x.observed.takeable[j]!==true)continue;if(tray.includes(faces[j]))avail=true;}
   const twinFree=(()=>{for(let j=0;j<al.length;j++)if(j!==i&&al[j]&&x.observed.down[j]===0&&faces[j]===faces[i]&&x.observed.takeable[j]===true)return true;return false;})();rows.push({who:'bot',lv,move:k,twinFree,wasDown:x.observed.down[i]===1,fog,tray:tray.length,matched,missed:!matched&&avail,clockOn:!!(d.clock&&al[d.clock.i])});}}
 fs.appendFileSync(out,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');}
