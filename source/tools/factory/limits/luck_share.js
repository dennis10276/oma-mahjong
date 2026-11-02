// how much of a board's difficulty is hidden information: the family profile on the board as it is, and with every
// tile face-up (nothing hidden: what is left is the traps and the tray planning)
const fs=require('fs'),vm=require('vm');const G=process.env.G51_ROOT;const {measureHuman}=require(G+'/source/tools/sim/refit/human_bot.js');
const L=require(G+'/source/www/layouts.js');global.Layouts=L;global.HARD_LEVELS=vm.runInNewContext(fs.readFileSync(G+'/source/www/levels-hard.js','utf8')+';HARD_LEVELS');const H=require(G+'/source/www/hard.js');
const P={};for(const b of JSON.parse(fs.readFileSync('/home/claude/repo-oma/source/analysis/factory/dennis-plays.json')).boards)P[b.key]=b.board;
const [part,parts,out]=process.argv.slice(2);
const items=['L150','L132','L91','L145','L149','blind1-185','blind1-194','blind1-183','factory6-190','factory2-175','release163-185'];
items.forEach((k,j)=>{if(j%+parts!==+part)return;const d=k[0]==='L'?H.get(+k.slice(1)):P[k];
 const m=x=>measureHuman({tiles:d.tiles,faces:d.faces,down:x,obst:d.obst,clock:d.clock},{runs:20,setting:'family',seed:4711}).expectedTries;
 const a=m(d.down),b=m([]);fs.appendFileSync(out,JSON.stringify({k,down:d.down.length,asIs:a,faceUp:b,luckShare:+((a-b)/a).toFixed(2)})+'\n');});
