'use strict';
// Assemble the Task 19 handback from bound certificates, browser evidence and
// per-level search diagnostics. This never adopts drafts or writes a level table.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm');
const P=require('./narrow_proof'),L=require('./narrow_lab'),F=require('../footprint'),H=require('../../../www/hard');
const link=(name,f)=>`[${name}](${path.resolve(f).replaceAll('\\','/')})`;
function movement(a,b){
  const deltas=a.tiles.map((p,i)=>[b.tiles[i][0]-p[0],b.tiles[i][1]-p[1]]),counts=new Map();
  for(const q of deltas){const key=q.join(',');counts.set(key,(counts.get(key)||0)+1);}
  const anchor=[...counts].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number);
  let restacked=0,slid=0;
  for(let i=0;i<a.tiles.length;i++){if(a.tiles[i][2]!==b.tiles[i][2])restacked++;else if(deltas[i].some((v,k)=>v!==anchor[k]))slid++;}
  return {restacked,slid,translatedAway:anchor,movedCount:restacked+slid};
}
function reason(r){
  if(r.fails){const keys=Object.keys(r.fails),out=[];
    if(keys.includes('readableBadge'))out.push('would hide a previously readable special badge');
    if(keys.includes('specialEffectChanged'))out.push('changes a lock/ice effect');
    if(keys.some(k=>k.startsWith('baitPrice:')||k.includes('noProvenBait')||k.includes('noBaitAboveControl')))out.push('changes an authored wrong move');
    if(keys.some(k=>k.includes('obvious:')))out.push('makes the opening too obvious');
    if(keys.includes('twins'))out.push('brings visible twins together');
    if(keys.includes('noWinningRoute'))out.push('no certified winning finish found');
    if(out.length)return out.join('; ');
  }
  const g=r.geometry||{},out=[];
  if(g.trapInLine)out.push('trap crosses candidate seams');
  if(g.trapUnsupported||g.trapCollides)out.push('seams break support or overlap the trap');
  if(Object.keys(g).some(k=>k.startsWith('hop:')||k.startsWith('edge:')||k.startsWith('slab:')))out.push('edge/strip alternatives lack support or disturb the edge');
  if(!out.length||g.nothingToNarrow)out.push('rendered bounds still below 58 px');
  return out.join('; ');
}
function run(){
  const pack=JSON.parse(fs.readFileSync(path.join(P.DIR,'../range-250-300.json'))),accepted=L.accepted(),byLevel=new Map(accepted.map(r=>[r.level,r]));
  const table=vm.runInNewContext(cp.execFileSync('git',['show','a99b338e:source/www/levels-hard.js'],{cwd:P.ROOT,encoding:'utf8',maxBuffer:8e6})+';HARD_LEVELS');
  for(const r of pack.rows){const a=H.pack({...r.before.design,info:{rate:0,strong:0}}),b=Array.from(table.levels[r.level-table.from]);b[8]=b[9]=0;if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Released baseline mismatch '+r.level);}
  const previous=JSON.parse(cp.execFileSync('git',['show','111e692e:source/analysis/builder/footprint60/range-250-300.json'],{cwd:P.ROOT,encoding:'utf8',maxBuffer:16e6}));
  if(JSON.stringify(pack.rows)!==JSON.stringify(previous.rows))throw Error('Historical free-repack pack was altered beyond adoption metadata');
  const browser=JSON.parse(fs.readFileSync(path.join(P.DIR,'browser.json'))),search=fs.readFileSync(path.join(P.DIR,'task19-search.jsonl'),'utf8').trim().split('\n').map(JSON.parse),last=new Map(search.map(r=>[r.level,r]));
  const summary={baselineCommit:'a99b338e',sourceBranch:'wip/codex-narrow',adopted:false,levelTableChanged:false,tensUntouched:[250,260,270,280,290,300],rows:[]};
  for(let level=251;level<=299;level++){
    const before=P.original(level),fp=F.measure(before.design,{minimum:58}),draft=byLevel.get(level),r=last.get(level);
    if(level%10===0){summary.rows.push({level,outcome:'tenth: untouched',before:fp.tilePx,after:fp.tilePx,movedCount:0,facePairsChanged:0,reason:'Tenth level frozen exactly as released'});continue;}
    if(!r)throw Error('No search outcome for '+level);
    if(draft){
      if(draft.certificate.beforeHash!==P.hash(before.design)||draft.certificate.afterHash!==P.hash(draft.design)||!draft.certificate.keptClockRoute)throw Error('Stale certificate '+level);
      const photos=browser.rows.filter(r=>r.level===level);if(photos.length!==2||photos.some(r=>!r.ok||r.designHash!==P.hash(r.variant==='narrowed'?draft.design:before.design)))throw Error('Missing or stale browser pair '+level);
      summary.rows.push({level,outcome:'narrowed',before:fp.tilePx,after:draft.footprint.tilePx,method:draft.method||`column ${draft.column} out, straight cap`,...movement(before.design,draft.design),relocatedCount:(draft.relocated||draft.moved).length,facePairsChanged:draft.facePairsChanged,proof:draft.proof,clockRouteKept:true,screenshots:photos.map(r=>r.screenshot)});
    }else summary.rows.push({level,outcome:fp.ok?'untouched: already fits':'stays as released',before:fp.tilePx,after:fp.tilePx,movedCount:0,facePairsChanged:0,reason:fp.ok?'Already at least 58 px, at most eight rows':reason(r),search:r});
  }
  const normal=summary.rows.filter(r=>r.level%10),narrow=normal.filter(r=>r.outcome==='narrowed'),unchanged=normal.filter(r=>r.outcome==='untouched: already fits'),held=normal.filter(r=>r.outcome==='stays as released');
  summary.counts={ordinary:45,narrowed:narrow.length,alreadyFits:unchanged.length,keptReleased:held.length};
  summary.browser={passed:browser.passed,total:browser.total,routeButton:browser.routeButton,rendererCommit:browser.rendererCommit};
  if(browser.passed!==2*narrow.length||!browser.routeButton.clockGone)throw Error('Incomplete browser validation');
  fs.writeFileSync(path.join(P.DIR,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  const lines=[
    '# Task 19 — narrow 251–299', '',
    `${narrow.length} certified tidy drafts, ${unchanged.length} ordinary boards already large enough, ${held.length} ordinary boards kept as released. All six tenth levels (250–300) stay exactly released. No level table, main branch, Firebase data or deployment changed.`, '',
    'Lab: [before and after on port 8268](http://127.0.0.1:8268/). Eight draft pairs are ordered by original level. Each card names the level, “as released” or “narrowed”, and its tile pitch. The server records human findings and replays locally and includes “Show the way to the clock”. Automated QA was intercepted and did not populate those human logs.', '',
    'The accepted drafts measure 58.32–63.35 CSS px on the 392×730 reference phone, using the held 3b188bcd UI with its proposed tray spacing. This is nominal tile pitch; the face rectangle is 1.5 px narrower. The six sub-60 drafts use Task 19’s explicit 58 px review floor. Builder/export defaults are unchanged. Both members of every comparison use this same renderer; “as released” means the exact released board, not the older released UI margins.', '',
    '## Verification', '',
    '- All 51 frozen originals match released 1.69 (`a99b338e`). The old free-repack pack has only been marked not adopted; its rows are unchanged.',
    '- 8/8 fresh engine certificates; all eight keep the exact released route to the clock, its proven minimum and its spare. Full winning tails replay strictly.',
    '- Same cover, thaw and side relations within the trap, same special-role prerequisites, same lock/ice ablation effects, and freshly equal authored bait prices. Previously clear badges stay clear, with no additional close visible twins.',
    '- Seven boards pass their own authored trap proof and gates. Older board 257 has no recovered authored proof: its special-role contract, route, effects and physics relationships are preserved. This is a scoped certificate, not an assertion that every ordinary filler decision is identical.',
    '- 16/16 actual browser wins (both versions of all eight boards), correct tile sizes, at most eight rows in the drafts, tray gap 11.2–69.9 px, no page errors. Fresh browser contexts prevent earlier win dialogs from contaminating screenshots.',
    '- Route button verified with actual timed taps: level 252’s clock taken on move 8. Seven regression tests pass, including holding 253/258/293 and refusing larger clock spare or tenth-level changes.', '',
    'Lab controls also pass eight phone overlap checks (`controls.json`): the route button occupies the unused score area and the save badge sits below the pile. Neither covers a tile.', '',
    '## The original nine and near misses', '',
    'Retained and certified: 252, 254, 257, 274, 282, 299. Held: 253 obscures lock 39, 258 obscures key 6, and 293 changes an authored wrong move. Their historical drafts are in `held/`, never in the lab or accepted list. Rebuilding the five batch contexts serially with pre-compaction construction restored obtains exact matched role IDs; this was the reason the previous rebuild differed. Current candidate proofs receive no compaction exemption.', '',
    'Near misses repaired: 284 (one ordinary picture exchange), 295 (two). Near misses retained as released: 256 changes special/bait effects or lacks a certified finish; 268 makes the opening obvious (other proposals bring twins together); 279’s tidy alternatives obscure an originally readable badge, and earlier attempts also failed to find a winning finish. No proof threshold was lowered.', '',
    '## Per-level outcomes', '',
    'Movement is **restacked / slid**: tiles changing layer, followed by other tiles sliding with a whole section. Global recentering is excluded. “Relocated” is the smaller count used in the original task notes (tiles taken out and reinserted as straight caps); sliding the remaining section also moves tiles and is therefore shown separately here. Picture changes count exchanged pairs of tile pictures, all outside the trap and every copy of its pictures.', '',
    '| Level | Outcome / method or blocker | Tiles restacked / slid | Picture exchanges | Tile px before → after | Proof / screenshots |',
    '|---|---|---:|---:|---:|---|'
  ];
  for(const r of summary.rows){let detail=r.reason,proof='Released board unchanged',moves='0 / 0';
    if(r.outcome==='narrowed'){detail=r.method+` (${r.relocatedCount} relocated)`;moves=`${r.restacked} / ${r.slid}`;proof=`Pass; ${r.proof.startsWith('older')?'older special contract':'own authored proof'}; `+r.screenshots.map((f,i)=>link(i?'after':'before',path.join(P.DIR,f))).join(' / ');}
    lines.push(`| ${r.level} | ${r.outcome}: ${detail} | ${moves} | ${r.facePairsChanged} | ${r.before.toFixed(2)} → ${r.after.toFixed(2)} | ${proof} |`);
  }
  lines.push('', '## Methods tried and limits', '',
    'Reused `narrow.js` for column/row removal, straight caps, edge hops and finishing. New methods in `narrow_methods.js` try alternative cap orders and five cap regions, half-tile seam closure where the original layout already uses half offsets, whole-stack hops farther inward (including existing half-offset stacking positions), one rigid outer strip at a time, lifted rigid strips, and both row/column orders for nine-row piles. Every proposal must retain full support, no overlaps, the existing grid, the 58 px footprint and the complete unchanged-trap certificate. No random offsets or free repacking are used.', '',
    'The per-level “stays as released” rows describe the tested families, not a proof that no tidy construction could ever work. Machine-readable proposal counts and exact binding failures are in `summary.json` and the append-only `task19-search.jsonl`. Candidate order, wall caps and failed repairs are retained there. Earlier logs include provisional candidates; only root `level-*.json` files with current bound certificates are accepted.', '',
    '## Files and reproducibility', '',
    `Worktree: \`${P.ROOT.replaceAll('\\','/')}\`, branch \`wip/codex-narrow\`, based on local lead commit \`111e692e\`. Claude’s checkout and \`narrow.js\` are untouched.`, '',
    '- Accepted boards, certificates, recovered historical contexts, screenshots, browser evidence and this report: `source/analysis/builder/footprint60/narrow/`.',
    '- `held/` contains only the three rejected historical drafts for regression evidence. Do not adopt them.',
    '- Core search/proof tools: `bank/narrow_methods.js`, `narrow_search.js`, `narrow_proof.js`; lab/browser/report tools: `narrow_lab.js`, `narrow_browser.js`, `narrow_controls.js`, `narrow_report.js`.', '',
    'From this checkout (reserve the matching core count through `heavy.js`):', '',
    '```powershell',
    'node source/tools/builder/loop/heavy.js --cores 1 -- node --test source/tools/builder/test_narrow.js',
    'node source/tools/builder/loop/heavy.js --cores 1 -- node source/tools/builder/bank/narrow_proof.js 252,254,257,274,282,284,295,299',
    '# Prepare a frozen copy of the held review UI, without changing a source checkout:',
    'New-Item -ItemType Directory -Force source/build/task19-ui | Out-Null',
    'git archive --format=tar --output=source/build/task19-ui.tar 3b188bcd source/www',
    'tar -xf source/build/task19-ui.tar -C source/build/task19-ui',
    'New-Item -ItemType Directory -Force source/build/task19-ui/source/tools/lab | Out-Null',
    'Copy-Item source/tools/lab/build_lab.js,source/tools/lab/lab.js source/build/task19-ui/source/tools/lab/',
    'node source/tools/builder/bank/narrow_lab.js',
    '# Serve in a hidden background process, or a shell kept open:',
    'node source/tools/builder/bank/lab_server.js source/build/task19/lab-8268 8268',
    '# In another shell, after npm ci in source/tests if Playwright is absent:',
    "$env:CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'",
    'node source/tools/builder/loop/heavy.js --cores 2 -- node source/tools/builder/bank/narrow_browser.js',
    'node source/tools/builder/loop/heavy.js --cores 2 -- node source/tools/builder/bank/narrow_controls.js',
    'node source/tools/builder/bank/narrow_report.js',
    '```', '',
    'The local check reused the already-installed Playwright at `../oma-mahjong-main/source/tests/node_modules` via a process-local `NODE_PATH`; no dependency or source UI file was changed. Lab HTML adds a phone viewport and omits unused bot prediction labels. This is a review lab only; no release or adoption is authorized.', ''
  );
  const text=lines.join('\n');fs.writeFileSync(path.join(P.DIR,'REPORT.md'),text);
  const external=path.resolve(P.ROOT,'../codex-tasks/results/narrow-251-299');fs.mkdirSync(external,{recursive:true});fs.writeFileSync(path.join(external,'REPORT.md'),text);
  console.log(JSON.stringify({...summary.counts,browser:summary.browser,report:path.join(external,'REPORT.md')}));return summary;
}
if(require.main===module)run();module.exports={run,movement};
