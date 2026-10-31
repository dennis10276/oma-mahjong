// the game's current difficulty curve in g2.1 units: expectedTries of every live level (Dennis 2026-10-31:
// "the difficulty curve should stay the same from before")
const fs=require('fs'),vm=require('vm');const ROOT='/home/claude/repo-oma/source';
const {measureHuman}=require('/tmp/claude-0/-home-claude/dadcee87-273a-5b61-b793-8a16944909f6/scratchpad/gemini-1e22fc0/source/tools/sim/refit/human_bot.js');
const T=vm.runInNewContext(require('child_process').execSync('git -C /home/claude/repo-oma show origin/main:source/www/levels-hard.js').toString()+';HARD_LEVELS');
const L=require(ROOT+'/www/layouts.js');global.Layouts=L;global.HARD_LEVELS=T;const H=require(ROOT+'/www/hard.js');
const [from,to,part,parts,out]=process.argv.slice(2);const done=new Set(fs.existsSync(out)?fs.readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).level):[]);
for(let lv=+from;lv<=+to;lv++){if((lv-from)%+parts!==+part||done.has(lv))continue;const d=H.get(lv);
 const m=measureHuman({tiles:d.tiles,faces:d.faces,down:d.down,obst:d.obst,clock:d.clock},{runs:20,setting:'dennis',seed:4711});
 const at=m.results.flatMap(r=>r.attempts),n=d.tiles.length,lost=at.filter(a=>!a.win&&!a.censored);
 fs.appendFileSync(out,JSON.stringify({level:lv,n,exp:m.expectedTries,first:m.firstTryRate,label:m.label,late:+(lost.filter(a=>a.left<=0.35*n).length/Math.max(1,lost.length)).toFixed(2),reach:d.clock?+(at.filter(a=>a.clockLeft!=null&&a.clockLeft<n).length/at.length).toFixed(2):null})+'\n');}
