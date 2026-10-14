'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const H=require('../../www/hard'),A=require('./audit_information'),{game}=require('./tighten_clocks');
const OUT=path.resolve(__dirname,'../../analysis/live-information-80-150'),read=f=>JSON.parse(fs.readFileSync(path.join(OUT,f),'utf8'));
const pct=(a,b,d=2)=>b?(100*a/b).toFixed(d)+'%':'—';
(async()=>{
 const m=read('source-manifest.json'),r=read('measurements.json'),route=read('route-audit.json');
 if(!r.finishedAt||r.rows.length!==m.to-m.from+1)throw Error('Measurement incomplete');
 const checks=[];for(const f of m.files){if(A.hash(fs.readFileSync(path.join(OUT,'snapshot',f.file)))!==f.sha256)throw Error('Snapshot hash mismatch: '+f.file);}checks.push('All captured live assets match the manifest');
 const T=vm.runInNewContext(fs.readFileSync(path.join(OUT,'snapshot/v',m.version,'levels-hard.js'),'utf8')+';HARD_LEVELS');
 if(A.hash(H.play.toString())!==r.observerHash)throw Error('Observer changed');
 let replayed=0;
 for(let lv=m.from;lv<=m.to;lv++){
  const row=r.rows[lv-m.from],packed=T.levels[lv-T.from],d=H.unpack(lv,packed),g=game(d);
  if(row.lv!==lv||row.boardHash!==A.hash(JSON.stringify(packed)))throw Error('Wrong board at '+lv);
  if(row.wins+Object.values(row.failureReasons).reduce((a,b)=>a+b,0)!==r.runs)throw Error('Run accounting mismatch at '+lv);
  if(!H.validSolution(g,row.witness))throw Error('Winning witness fails at '+lv);
  for(const [kind,example] of Object.entries(row.examples))if(example){
   const result=H.play(g,r.profile,example.seed);if(!result.win||(kind==='zeroUnknownPartnerWin'&&result.blind!==0))throw Error('Example fails at '+lv);
   const sequence=Array.from(result.at,(_,i)=>i).sort((a,b)=>result.at[a]-result.at[b]);if(!H.validSolution(g,sequence))throw Error('Sample winning route fails at '+lv);replayed++;
  }
  const searched=route.rows[lv-m.from];if(searched.lv!==lv||searched.boardHash!==row.boardHash)throw Error('Route audit uses different boards');
  for(const v of ['uncovered','all-face-up'])if(searched[v].actions)A.verify(d,searched[v].actions,v);
 }
 checks.push('All 71 winning witnesses validate against the live board data');checks.push('All per-level game counts reconcile');checks.push(replayed+' recorded winning examples reproduce and have valid complete paths');checks.push('Every bounded route-search result refers to the same live boards');
 for(const [f,h] of Object.entries(m.protectedGameHashes))if(A.hash(fs.readFileSync(path.resolve(OUT,'../..',f)))!==h)throw Error('Game file changed: '+f);checks.push('Game sources and unpublished boards unchanged');
 const version=await (await fetch(m.base+'version.json',{cache:'no-store',signal:AbortSignal.timeout(30000)})).json();if(version.v!==m.version)throw Error('Live version changed during measurement');
 const liveBytes=Buffer.from(await (await fetch(m.base+'v/'+m.version+'/levels-hard.js',{cache:'no-store',signal:AbortSignal.timeout(30000)})).arrayBuffer());
 if(A.hash(liveBytes)!==m.files.find(f=>f.file==='v/'+m.version+'/levels-hard.js').sha256)throw Error('Live levels changed during measurement');checks.push('Live version and level table rechecked after measurement');
 const s=r.summary,checksReport={passed:checks.length,checks,replayedExamples:replayed,verifiedAt:new Date().toISOString(),gameChanged:false,published:false};
 fs.writeFileSync(path.join(OUT,'checks.json'),JSON.stringify(checksReport,null,2)+'\n');
 const zeroLevels=r.rows.filter(x=>x.zeroUnknownPartnerWins>0).map(x=>x.lv),noWins=r.rows.filter(x=>x.wins===0).map(x=>x.lv);
 const out=[
 '# Current live levels 80–150: solvability and uncertainty',
 '',
 `**Measured the actual live app, version ${m.version}, levels ${m.from}–${m.to} inclusive (${s.levels} levels). No unpublished level data was measured here.**`,
 '',
 `Downloaded the live browser assets and the app update bundle at ${m.verifiedAt}. Their level tables match byte-for-byte. The live legality rules also match the audit oracle. Version and level table were checked again after measurement. The deployed level-table SHA-256 is \`${m.files.find(f=>f.file==='v/'+m.version+'/levels-hard.js').sha256}\`.`,
 '',
 '## What the audit establishes',
 '',
 `- **${s.validWinningRoutes}/${s.levels} levels have a verified complete winning route**, respecting the tray, ice, locks and clock. This proves they are beatable.`,
 `- **${s.games.toLocaleString('en-US')} fresh games**: ${r.runs.toLocaleString('en-US')} per level, using the clock-focused player. There were ${s.wins.toLocaleString('en-US')} wins. These are bot results, not human first-try win chances.`,
 `- **${s.zeroUnknownPartnerWins.toLocaleString('en-US')} winning games**, across **${s.levelsWithZeroUnknownPartnerWin}/${s.levels} levels**, contained no deliberate selection of a single tile with an unseen matching partner. These levels were: ${zeroLevels.join(', ')||'none'}.`,
 `- Across ${s.decisions.toLocaleString('en-US')} scored decisions, ${s.unknownPartnerSelections.toLocaleString('en-US')} (${pct(s.unknownPartnerSelections,s.decisions)}) selected a tile with no known partner.`,
 `- The bot did not win in this sample on ${noWins.length} levels: ${noWins.join(', ')||'none'}. Their verified winning routes still pass.`,
 '',
 '**A universal no-guess guarantee is not proved. These results also do not prove that guessing is unavoidable.** An unmatched tile can be a safe information-gathering move; choosing between known pairs can still involve hidden-future uncertainty. A failed or bounded search cannot establish that every possible player strategy needs a guess.',
 '',
 '## Measurement model and limits',
 '',
 'The measurement uses the corrected observation-only audit player with the same focused profile as live 1.49. The older simulation code shipped with 1.49 could let newly uncovered hidden faces affect a candidate score; it is unsuitable for a guessing audit. Correcting the observer does not alter the live boards or game.',
 '',
 'The audit player knows takeable face-down faces through idealised free peeks, and treats face-up tiles without an exact-position covering tile as readable. It does not simulate blocked-tap x-ray, all deductions from tile counts, or every human strategy. Consequently its win rates must not be read as your win chances or the probability of requiring a guess. Its failure on a level you already beat is evidence of that model limitation.',
 '',
 'The same seed set is used for every board, and is independent of previous level selection. Candidate choices use the corrected frozen knowledge state, not future revealed faces.',
 '',
 '## Bounded searches for routes using known partners',
 '',
 'A separate search allows free peeks and their automatic matches, but deliberately parks only identified tiles with a known matching partner elsewhere. It can use hindsight to choose route order. This restricted condition is not equivalent to deduction-only play. Fixed-order free inspection also excludes other possible strategies.',
 '',
 '| Visibility model | Conditional route certificates | Hit 30,000-node limit | No route under restricted policy |',
 '|---|---:|---:|---:|',
 ...['uncovered','all-face-up'].map(v=>`| ${v==='uncovered'?'Only fully uncovered face-up faces known':'All face-up identities granted known, including covered tiles'} | ${route.summary[v].certificates} | ${route.summary[v].searchLimits} | ${route.summary[v].restrictedFailures} |`),
 '',
 'The second model grants extra information. Its certificates, if any, are conditional witnesses. Neither row certifies a universal no-guess strategy, and neither failure column proves guessing is necessary.',
 '',
 '## Every live level',
 '',
 'All rows use 4,096 games. “No unseen-partner wins” is a count of winning games, not a proof that their move order is logically deducible. “Clock losses” counts games ending specifically on the countdown.',
 '',
 '| Level | Bot wins | Bot win rate | No unseen-partner wins | Clock losses | Winning route |',
 '|---|---:|---:|---:|---:|---|',
 ...r.rows.map(x=>`| ${x.lv} | ${x.wins} | ${pct(x.wins,r.runs)} | ${x.zeroUnknownPartnerWins} | ${x.clockLosses} | Verified |`),
 '',
 '## Files and reproduction',
 '',
 '- `source-manifest.json`: fetched URLs, timestamps and SHA-256 hashes.',
 '- `snapshot/`: captured live browser assets and app update bundle.',
 '- `measurements.json`: complete per-level metrics, winning witnesses and seeds for sample wins.',
 '- `measurements.csv`: per-level results for a spreadsheet.',
 '- `route-audit.json`: bounded search outcomes and any conditional certificates.',
 '- `checks.json`: source, accounting, witness and example-replay checks.',
 '',
 'Run from the project root:',
 '',
 '```powershell',
 'node tools/sim/measure_live_information.js 4096',
 'node tools/sim/audit_live_information_routes.js',
 'node tools/sim/report_live_information.js',
 '```',
 '',
 `All ${checks.length} consistency checks passed. The game, live levels, unpublished levels and player progress were left unchanged. Nothing was published.`,
 ''
 ];
 fs.writeFileSync(path.join(OUT,'report.md'),out.join('\n'));console.log(JSON.stringify({summary:s,checks:checksReport,zeroLevels,noWins},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
