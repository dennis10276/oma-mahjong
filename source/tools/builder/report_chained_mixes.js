'use strict';
// Reporting reads saved evidence only; it never changes or searches a board.
const fs=require('fs'),path=require('path');
const {SHAPES}=require('./chained_shapes.js'),{OUT}=require('./verify_chained_mixes.js'),R=require('./report_trap_mixes.js');
const REPORT=path.resolve(__dirname,'../../../codex-tasks/results/chained-mixes-v1');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
function run(){
  fs.mkdirSync(REPORT,{recursive:true});
  const selection=fs.existsSync(path.join(OUT,'selection.json'))?read(path.join(OUT,'selection.json')):{ok:false,order:[]};
  const pool=fs.existsSync(path.join(OUT,'examples'))?fs.readdirSync(path.join(OUT,'examples')).filter(f=>f.endsWith('.json')):[];
  const files=selection.order.length?selection.order:pool,examples=files.map(file=>({file,r:read(path.join(OUT,'examples',file))}));
  const audit=fs.existsSync(path.join(OUT,'audit-final.json'))?read(path.join(OUT,'audit-final.json')):null;
  const tests=fs.existsSync(path.join(REPORT,'validation.json'))?read(path.join(REPORT,'validation.json')):null;
  const shapes=[...new Set(examples.map(p=>p.r.card.trap.type))],ready=examples.length===20&&shapes.length===10&&audit?.ok&&audit.completed===20&&tests?.ok;
  const link='../../../source/analysis/builder/bank/chained-v1/';
  const lines=['# TASK 15 — chained mixes','',ready?'Complete: twenty independently re-proved boards, two per shape across ten extended chain shapes.':`In progress: ${examples.length} finished examples across ${shapes.length} shapes. The twenty-board delivery is not yet complete.`,'',
    'Branch `wip/codex-chained-mixes` was created from `wip/codex-trap-variety` (`b73fe838`) and merged local `wip/cc-builder-loop` (`2126579d`, merge `da2f54f3`) before implementation. The frozen-key/lock markers, subtler thaw glow and special-tile tap priority from Task 13 are retained. The ribbon implementation, packed extension, prototype entry, lesson strings and tests are removed. No levels were placed or released. Main and Firebase were not touched. No player bots or ratings were run.','',
    '## Shapes and what to see','',
    'A base signature keeps Claude’s notation. The waiting-clock/lookalike combinations join two existing gate links to two authored links (four total); the other shapes add a link to existing ice/lock/key gates. Cards give the resulting chain length and the engine effect of every special. `clock<waitForTwin` moves the alarm onto the exposed twin of the old gated clock picture; the preceding `clock<...` links describe that gated twin. `keyB<clockRoof` puts the tempting real key on the clock’s roof. `keyPair<lookalikeChoice` adds two ordinary copies of the key picture. `thaw<innerIce` freezes an additional neighbour within the chain. Two-front cards also name a proven lonely neighbour on each of two different icy hosts. These use the existing game rules only.','',
    '| Shape | Signature | Chain links | What the player must see |','|---|---|---:|---|'];
  for(const name of shapes){const f=SHAPES[name];lines.push(`| ${name} | \`${f.signature}\` | ${f.links} | ${f.see} |`);}
  lines.push('','## Board table','',
    '| Card | Shape | Layout | Layers | Tiles | k + spare | Winning starts | Tail | Face down | Tail waiting 0 / 1 / 2 / 3 |','|---|---|---:|---:|---:|---|---:|---:|---:|---|');
  for(const {file,r}of examples){const c=r.card;lines.push(`| [${file.replace('.json','')}](${link}examples/${file.replace('.json','.md')}) | ${c.trap.type} | ${c.layout} | ${c.layers} | ${c.tiles} | ${c.clock.fewestMoves} + ${c.clock.spare} | ${c.trap.firstMoves.winning}${c.trap.firstMoves.unknown?' (+'+c.trap.firstMoves.unknown+' unknown)':''} | ${c.tail.tailGreedyWin} | ${(100*c.faceDownShare).toFixed(1)}% | ${c.tailOccupancy.share.join(' / ')} |`);}
  const needles=examples.filter(p=>p.r.card.trap.firstMoves.winning<3).length,flat=examples.filter(p=>p.r.card.layers<=3).length;
  lines.push('',`${needles}/${examples.length} needle boards (fewer than three proven winning first moves); at most four are allowed. ${flat}/${examples.length} boards have at most three layers. Layouts were searched with three layers first, ranked by \`T.readableLayouts\`; cards disclose every deeper exception.`, '',
    '## Obviousness check and dial','',
    'The greedy check uses public information and retains every tied choice: a visible tray match first, otherwise any free visible pair, otherwise a visible clock, key or thaw neighbour, then any other visible single. A route fails if both of its first two taps belong to those greedy tie sets, recomputing after its first tap. A route also fails when any two tiles needed on its stored pre-clock route are an already free, face-up matching pair at move zero. This is a concrete opening test, not a claim to measure human insight across the whole solution.','',
    'Dial 0 applies both mandatory rejection rules; dial 2 additionally requires at least one proven bait among the greedy first choices. Every card includes the route taps, both complete greedy tie sets, both rejection booleans and any greedy-preferred baits. Spare 1 versus spare 2 remains an independent timing dial.','');
  const failCounts={},buildCounts={},rejections={};let jobs=0,built=0;
  for(const file of fs.existsSync(OUT)?fs.readdirSync(OUT).filter(f=>/^(sweep|collection).*\.json$/.test(f)):[]){
    const data=read(path.join(OUT,file));for(const row of data.rows||[]){jobs++;if(row.ok)built++;if(row.fail)failCounts[row.fail]=(failCounts[row.fail]||0)+1;
      if(row.mode==='build')(buildCounts[row.name]??=[]).push({layout:row.layout,ok:row.ok});
      for(const [k,n]of Object.entries(row.fails||{}))rejections[k]=(rejections[k]||0)+n;
    }
  }
  const rejectionGroups={};for(const [reason,count]of Object.entries(rejections)){const key=reason.startsWith('idle:')?reason.split(':').slice(0,2).join(':'):reason;rejectionGroups[key]=(rejectionGroups[key]||0)+count;}
  fs.writeFileSync(path.join(OUT,'rejection-summary.json'),JSON.stringify({jobs,built,workerFailures:failCounts,attemptRejections:rejections,grouped:rejectionGroups},null,2)+'\n');
  const obvious=Object.entries(rejections).filter(([k])=>k.startsWith('obvious:'));
  lines.push(`Recorded worker jobs: ${jobs}; successful raw/finished jobs: ${built}. Obvious-opening attempt rejections: \`${JSON.stringify(Object.fromEntries(obvious))}\`. These count observed attempts, not impossible hosts; terminated workers only report the last completed attempt.`, '',
    '## Two traps and engine evidence','',
    'Every board has at least two disjoint, separately losing bait decisions on a chain of at least three links. The added free clock, roof key or lookalike is a link in the existing chain. The other bait is an early key or lonely thaw neighbour with at least a two-link dependency. Medium-link evidence identifies the blocked partner or the buried twin and thaw host. The two-front card additionally prices two lonely neighbours on two different icy hosts independently, on the existing connected chain. These qualify under the permitted hard-chain-plus-medium-trap alternative. They share gates and tray room, but the cards do not claim a proven change in the marginal cost of the second mistake after the first.','',
    'Each bait is independently re-priced from k through min(k+3,19). A reported loss means no completion anywhere in that tested horizon; a positive cost is the independently proven extra deadline needed. A bait must lose at the shipped deadline. Each individual ice and lock must shorten the exact clock route when removed, or make a previously losing bait win at the shipped deadline. The complete unrelated visible-pair/single-twin control is also re-priced. Every card lists all these counterfactuals.','',
    '## Tail, visibility and variety','',
    'Tail tuning calls the unchanged `bank/tail.js` with band 0.10–0.28. The reported diagnostic uses seed 977 and 800 playouts. Added face-down tiles target 25% (accepted 23–30%) and are outside the special mechanism and shortest stored pre-clock route. The final verifier checks every hidden tile, not just newly added ones. This diagnostic is the prescribed greedy tail measure, not a player rating.','',
    'The stored tail is rerouted with strict singles so one waiting tile is common: share at one at least 0.40, at two at most 0.20, at three at most 0.05, and no more than six consecutive steps with two or more waiting. Occupancy is counted BEFORE each tail tap and every card gives all four shares and the longest run. Matching removes a waiter, so zero and one naturally alternate on parts of the route.','',
    'Twin separation requires zero visibly close twins, zero close copies within a four-copy picture group, and at most 5% close pairs overall. The history snapshot excludes all thirty lab-7 candidates, including unplayed siblings, and all 53 placed boards at 250–302. Exact special-placement fingerprints and layout-plus-extended-signature pairs are checked against that history and across this bank. These cards are a candidate bank, not a scheduled run of twenty numbered levels; the lead’s placement spacing rules still apply when scheduling them.','',
    '## Failures and limits','',
    'The collection evolved during tuning; totals span those versions. Every shipped card uses the final whole-route obviousness test. Complete counts are in [the rejection summary]('+link+'rejection-summary.json), with representative [finishing traces]('+link+'failure-samples.json). Full raw candidates and development logs stay in ignored local folders.', '',
    '| Worker outcome | Count |','|---|---:|',...Object.entries(failCounts).sort((a,b)=>b[1]-a[1]).map(([reason,n])=>`| ${reason} | ${n} |`), '',
    '| Most common attempt rejection | Count |','|---|---:|',...Object.entries(rejectionGroups).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([reason,n])=>`| ${reason} | ${n} |`), '',
    'The dedicated two-lonely-front placement recipes did not produce a finished host in the recorded bounded sweep. Instead, the existing lookalike/locked-thaw chain on layout 36 had a second already-present lonely neighbour on its other frozen front. Its pictures and positions were kept; both first mistakes were independently priced and the card was rebuilt and re-audited. A connected two-front trap is therefore delivered, without counting the unsuccessful recipes as finished shapes.', '',
    'A failed wall-limited host search is not proof that the host is impossible. Unknown searches never count as losses. Twin repair, hidden-tile placement, tail tuning and tail rerouting are each allowed to reject a raw board. Engine solvability does not predict how Dennis will rate its AHA moment. The report distinguishes structural link count, observed openings and the fixed greedy tail measure from design judgment.','',
    '## Show Dennis first','');
  const preferred=['lookalikeCoverThaw','lookalikeThaw','roofThawKey','waitLookalikeWay','waitThawKey','lookalikeCover'],picks=[];
  for(const n of preferred){const p=examples.filter(p=>p.r.card.trap.type===n).sort((a,b)=>(b.r.card.trap.twoFronts?.length||0)-(a.r.card.trap.twoFronts?.length||0)||a.r.card.layers-b.r.card.layers||b.r.card.trap.obviousness.preferredBaits.length-a.r.card.trap.obviousness.preferredBaits.length)[0];if(p&&picks.length<3)picks.push(p);}
  for(const p of examples)if(picks.length<3&&!picks.includes(p))picks.push(p);
  for(const {file,r}of picks)lines.push(`- [${file.replace('.json','')}](${link}examples/${file.replace('.json','.md')}) ([game image](${file.replace('.json','.png')})): ${r.card.trap.see}`);
  lines.push('','These are my choices for contrasting trap ideas and readable hosts, not human playtest results.','',
    '## Verification and reproduction','',
    `Fresh independent audit: ${audit?.completed||0}/20, ${audit?.ok?'passed':'pending'}. Regression checks: ${tests?.ok?'passed':'pending'}. The audit imports declarative shape metadata and engine helpers, and never imports either story module, calls a story proof, or uses the construction clock-minimum routine. It replays the full strict witness and proves k−1 unsatisfiable directly, re-prices all baits/controls, checks each ablation and every winning first-move claim, and re-measures the tail and visibility facts.`, '',
    'No edits to `trap_stories.js`, `bank/*` or `builder-next/construct.js`. Heavy work reserves cores through `loop/heavy.js`, uses disposable workers with hard outer deadlines, and stays within the shared twelve-core / 80% limit. Each collection run also has a total wall.','',
    '```powershell',
    'node source/tools/builder/loop/heavy.js --label chained-collect --cores 4 -- node source/tools/builder/run_chained_mixes.js --workers 4 --minutes 20 --layers 3 --rounds 2',
    'node source/tools/builder/loop/heavy.js --label chained-check --cores 4 -- node source/tools/builder/check_chained_mixes.js --workers 4',
    'node source/tools/builder/report_chained_mixes.js','```','');
  fs.writeFileSync(path.join(REPORT,'REPORT.md'),lines.join('\n'));
  const cards=[];
  for(const {file,r}of examples){const c=r.card,t=c.trap,o=t.obviousness;
    fs.writeFileSync(path.join(OUT,'examples',file.replace('.json','.svg')),R.svg(r));
    const md=R.cardMarkdown(r,file)+`\n## Chain and opening facts\n\nSignature: \`${t.signature}\`. Chain links: ${t.links}. Layers: ${c.layers}.\n\nTwo traps: ${JSON.stringify(t.twoTraps)}\n\nTwo frozen fronts: ${JSON.stringify(t.twoFronts||[])}\n\nObviousness dial ${o.dial}: first route taps ${o.firstTwo.join(', ')}; greedy sets ${JSON.stringify(o.greedyFirst)} / ${JSON.stringify(o.greedySecond)}. Greedy prefix: ${o.greedyPrefix}; ready free route pair: ${o.rightFreePairs}; greedy-preferred baits: ${JSON.stringify(o.preferredBaits)}.\n\nTail waiting shares (before taps), 0 / 1 / 2 / 3: ${c.tailOccupancy.share.join(' / ')}. Longest 2+ run: ${c.tailOccupancy.longest2plus}.\n`;
    fs.writeFileSync(path.join(OUT,'examples',file.replace('.json','.md')),md);cards.push(`[${file}](${file.replace('.json','.md')})`);
  }
  fs.writeFileSync(path.join(OUT,'examples','CARDS.md'),'# Chained mix cards\n\n'+cards.map(x=>'- '+x).join('\n')+'\n');
  const output={ready,examples:examples.length,shapes:shapes.length,report:path.join(REPORT,'REPORT.md'),picks:picks.map(p=>p.file)};console.log(JSON.stringify(output));return output;
}
if(require.main===module)run();module.exports={run,REPORT};
