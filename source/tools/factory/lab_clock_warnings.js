/* Factory lab batch 11 (Claude, 2026-11-01): Dennis "The warnings for clock too loose or too tight: put them in the factory so I can see if it's right". Adds the clock-warned boards of the 175-200 candidate (Gemini's g3 critic) with the warning in the card text; keeps every earlier card. */
const fs=require('fs'),path=require('path');const R='/home/claude/repo-oma/source/';
const I=require(R+'tools/lab/ideas.js');
const file=R+'tools/lab/lab-ideas.js', L=new Function(fs.readFileSync(file,'utf8')+';return LAB_IDEAS')();
const rows=fs.readFileSync(R+'analysis/factory/batch-175-200-candidate.jsonl','utf8').trim().split('\n').map(JSON.parse);
const chk=Object.fromEntries(fs.readFileSync(R+'analysis/factory/final-checks-candidate.jsonl','utf8').trim().split('\n').map(JSON.parse).map(r=>[r.level,r]));
const WARN={clockTooLoose:'Clock too loose',clockTooTight:'Clock too tight'};
L.ideas=L.ideas.filter(i=>Math.floor(i.id/1000)!==11);
for(const r of rows){const c=chk[r.level];const w=(c.critic||[]).filter(k=>WARN[k]);if(!w.length)continue;
 const why=w.map(k=>c.reasons[k]).join('; ');
 L.ideas.push({id:11000+r.level,lv:r.level,kind:'planned',level:r.recipe.join('+'),shape:r.shape,tiles:r.n,
  title:w.map(k=>WARN[k]).join(' + ')+'? · '+r.recipe.map(k=>I.IDEAS[k].title).join(' + ')+' · '+r.shape,
  idea:r.recipe.map(k=>I.IDEAS[k].idea).join(' ')+` The clock has ${r.clockSpare} spare move${r.clockSpare===1?'':'s'} over the shortest way. Gemini's checker warns: ${why}. Is that right for you? Say so in the note.`,
  specials:{down:r.down,ice:r.ice,locks:r.locks,clockSpare:r.clockSpare},m:null,bot:['-'],board:r.design});}
L.made=new Date().toISOString();
L.intro='Planned levels (batches 4-11), each built around puzzles you rated 4-5 stars in the lab. Newest at the bottom: batch 11, the boards of the new 175-200 batch where Gemini\'s checker warns about the clock (176, 189, 193 too loose; 198 too tight). Is the warning right? Say so in the note. No bot numbers shown.';
fs.writeFileSync(file,'/* made by tools/factory/plan_to_lab.js (+ batch 11: clock warnings) */\nconst LAB_IDEAS = '+JSON.stringify(L)+';\n');
console.log(L.ideas.filter(i=>i.id>11000).map(i=>i.id+' '+i.title).join('\n'));
