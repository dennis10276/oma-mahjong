// g2.1 measure + board features for a list of boards (live levels or factory boards), for the difficulty judge
const fs=require('fs'),vm=require('vm');const [what,part,parts,out]=process.argv.slice(2);
const {measureHuman}=require(process.env.HUMAN_BOT);
const T=vm.runInNewContext(require('child_process').execSync('git -C /home/claude/repo-oma show origin/main:source/www/levels-hard.js').toString()+';HARD_LEVELS');
const L=require('/home/claude/repo-oma/source/www/layouts.js');global.Layouts=L;global.HARD_LEVELS=T;const H=require('/home/claude/repo-oma/source/www/hard.js');
let items=[];
if(what==='live'){for(const r of JSON.parse(fs.readFileSync(process.env.TARGETS)))items.push({key:'live'+r.level,board:H.get(r.level)});}
else {const P=JSON.parse(fs.readFileSync('/home/claude/repo-oma/source/analysis/factory/dennis-plays.json'));for(const b of P.boards)if(b.board&&b.board.clock&&(b.tries||(b.plays&&b.plays.length)))items.push({key:b.key,board:b.board});}
const done=new Set(fs.existsSync(out)?fs.readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).key):[]);
items.forEach((it,k)=>{if(k%+parts!==+part||done.has(it.key))return;const d=it.board,n=d.tiles.length;
  const m=measureHuman({tiles:d.tiles,faces:d.faces,down:d.down,obst:d.obst,clock:d.clock},{runs:20,setting:'dennis',seed:4711});
  const at=m.results.flatMap(r=>r.attempts),lost=at.filter(a=>!a.win&&!a.censored);
  const ob=d.obst||{};const route=d.clock&&d.solution?d.solution.indexOf(d.clock.i)+1:null;
  fs.appendFileSync(out,JSON.stringify({key:it.key,exp:m.expectedTries,first:m.firstTryRate,n,down:(d.down||[]).filter(Boolean).length,ice:Object.keys(ob.ice||{}).length,locks:(ob.locks||[]).length,clock:d.clock?d.clock.n:null,route,spare:route?d.clock.n-route:null,
    clockLossShare:+(lost.filter(a=>a.why==='clock').length/Math.max(1,lost.length)).toFixed(2),late:+(lost.filter(a=>a.left<=0.35*n).length/Math.max(1,lost.length)).toFixed(2),reach:+(at.filter(a=>a.clockLeft!=null&&a.clockLeft<n).length/Math.max(1,at.length)).toFixed(2)})+'\n');});
