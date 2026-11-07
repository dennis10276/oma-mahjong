'use strict';
const fs = require('fs'), path = require('path'), Lab = require('../factory/batch_lab.js');
function build(root) {
  const out = Lab.build(path.join(root, 'example-boards.jsonl'), path.join(root, 'playable-examples'));
  const ideasFile = path.join(out, 'lab-ideas.js'); let code = fs.readFileSync(ideasFile, 'utf8');
  const ideas = JSON.parse(code.slice(code.indexOf('=') + 1).trim().replace(/;$/, ''));
  ideas.heading = 'Why boards are hard · diagnostic examples';
  ideas.intro = 'Three Task10 research puzzles. Local study labels 9001–9003; see EXAMPLES.md for numbered mistakes and winning alternatives. Your progress in the published game is unchanged.';
  for (const [k, idea] of ideas.ideas.entries()) { idea.title = String.fromCharCode(65 + k) + ' · ' + idea.shape; idea.idea = 'Diagnostic study puzzle; local play only.'; }
  fs.writeFileSync(ideasFile, 'const LAB_IDEAS = ' + JSON.stringify(ideas) + ';\n');
  const numbering = `<style>.task11-number{position:absolute;left:2px;bottom:1px;font:700 9px/1 sans-serif;background:#fff;color:#111;border-radius:2px;padding:1px;pointer-events:none;z-index:9}</style><script>
  new MutationObserver(function(){ if(!window.__mj || !__mj.G) return; __mj.G.tiles.forEach(function(t,i){if(t.el && !t.el.querySelector('.task11-number')){var n=document.createElement('span');n.className='task11-number';n.textContent=i+1;t.el.appendChild(n);}}); }).observe(document.body,{childList:true,subtree:true});
  </script>`;
  for (const name of ['index.html', 'lab.html']) {
    const f = path.join(out, name); let html = fs.readFileSync(f, 'utf8');
    html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="connect-src \'self\'">');
    // lab.html lacks a charset; insert before any script as well.
    if (!html.includes('Content-Security-Policy')) html = '<meta http-equiv="Content-Security-Policy" content="connect-src \'self\'">' + html;
    html = html.includes('</body>') ? html.replace('</body>', numbering + '</body>') : html + numbering;
    fs.writeFileSync(f, html);
  }
  return out;
}
if (require.main === module) console.log(build(path.resolve(process.argv[2])));
module.exports = { build };
