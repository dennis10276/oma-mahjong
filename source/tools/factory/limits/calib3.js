// one calibration point: on levels 85-174 with lv % 8 in {0,4}, the bot's share of takes (clock gone) that leave 3
// waiting, and its flips per tile taken. Dennis on the same levels: 0.105 and 1.20.   node calib3.js <part> <parts> <out>
const fs=require('fs'),vm=require('vm');const G=process.env.G51_ROOT;const {measureHuman}=require(G+'/source/tools/sim/refit/human_bot.js');
const L=require(G+'/source/www/layouts.js');global.Layouts=L;global.HARD_LEVELS=vm.runInNewContext(fs.readFileSync(G+'/source/www/levels-hard.js','utf8')+';HARD_LEVELS');const H=require(G+'/source/www/hard.js');
const [part,parts,out]=process.argv.slice(2);let t3=0,tg=0,peeks=0,takes=0;
for(let lv=85;lv<=174;lv++){if(lv%8!==0&&lv%8!==4)continue;if(lv%+parts!==+part)continue;const d=H.get(lv);
 const m=measureHuman({tiles:d.tiles,faces:d.faces,down:d.down,obst:d.obst,clock:d.clock},{runs:10,setting:'dennis',seed:4711,capture:true});
 for(const r of m.results)for(const a of r.attempts){const ds=a.decisions;for(let k=0;k<ds.length;k++){const x=ds[k],i=x.index,nx=ds[k+1];const gone=nx?!nx.state.alive[i]:true;
  if(!gone){if(x.observed.down[i]===1)peeks++;continue;}takes++;
  if(d.clock&&x.state.alive[d.clock.i])continue;tg++;const tr=x.state.tray,matched=tr.includes(d.faces[i]);if((matched?tr.length-1:tr.length+1)>=3)t3++;}}}
fs.appendFileSync(out,JSON.stringify({t3,tg,peeks,takes})+'\n');
