'use strict';

// Restack 9-row boards in levels 250-300 into <= 7x8 (<= 12x14 units, <= 8 rows)
// preserving traps (clock k/spare, specials, bait proofs, readability).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../..');
const WWW_DIR = path.join(ROOT, 'source/www');
const BANK_DIR = path.join(ROOT, 'source/analysis/builder/bank');
const OUT_DIR = path.join(BANK_DIR, 'placed-all');
const IN_DIR = fs.existsSync(path.join(BANK_DIR, 'placed-all-before-restack'))
  ? path.join(BANK_DIR, 'placed-all-before-restack')
  : OUT_DIR;
const TRAPS_DIR = path.join(ROOT, 'source/build/traps');

global.Layouts = require(path.join(WWW_DIR, 'layouts.js'));
const L = global.Layouts;
const Hard = require(path.join(WWW_DIR, 'hard.js'));
const E = require(path.join(ROOT, 'source/tools/builder/engine.js'));
const B = require(path.join(ROOT, 'source/tools/builder/builder.js'));
const T = require(path.join(ROOT, 'source/tools/builder/trap_stories.js'));
const R = require(path.join(__dirname, 'retune.js'));
const Tl = require(path.join(__dirname, 'tail.js'));
const SEP = require(path.join(__dirname, 'separate.js'));
const SG = require(path.join(ROOT, 'source/tools/builder/loop/static_gates.js'));
const PS = require(path.join(ROOT, 'source/tools/factory/placement_score.js'));
const Orig = require(path.join(ROOT, 'source/tools/factory/originality.js'));
const V = require(path.join(ROOT, 'source/tools/builder/verify_trap_mixes.js'));
const VC = require(path.join(ROOT, 'source/tools/builder/verify_chained_mixes.js'));
const { SHAPES } = require(path.join(ROOT, 'source/tools/builder/chained_shapes.js'));

const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

function hash32(a, b, c, d, e) {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647 + (d || 0) * 1597334677 + (e || 0) * 3812015801) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function bbox(tiles) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxZ = 0;
    for (const [x, y, z] of tiles) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }
    return {
        minX, maxX, minY, maxY, maxZ,
        w: maxX - minX,
        h: maxY - minY,
        cols: (maxX - minX) / 2 + 1,
        rows: (maxY - minY) / 2 + 1,
        layers: maxZ + 1,
    };
}

function fits6x8(tiles) {
    const b = bbox(tiles);
    return b.w <= 12 && b.h <= 14;
}

function tilePx(tiles) {
    let l = 1e9, r = -1e9, t0 = 1e9, b = -1e9;
    for (const [tx, ty, tz] of tiles) {
        const x = tx / 2 - tz * 0.14;
        const y = ty / 2 * 1.24 - tz * 0.14;
        l = Math.min(l, x);
        r = Math.max(r, x + 1);
        t0 = Math.min(t0, y);
        b = Math.max(b, y + 1.24);
    }
    return Math.min(384 / (r - l + 0.125), 592 / (b - t0 + 0.16));
}

function gameOf(d) {
    const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z }));
    const nb = L.neighbors(tiles);
    const down = new Uint8Array(tiles.length);
    (d.down || []).forEach((i) => { down[i] = 1; });
    const ob = d.obst;
    const has = ob && (Object.keys(ob.ice || {}).length || (ob.keys || []).length);
    const rules = has ? {
        iceNb: L.iceNeighbors(tiles),
        ice: ob.ice || {},
        locks: (ob.keys || []).length ? new Set(ob.locks || []) : null,
        keys: ob.keys || [],
    } : null;
    return { tiles, nb, faces: d.faces, down, rules, clock: d.clock || null };
}

function parseArgs(argv) {
    const opts = { audit: false, dry: false, write: false, only: null, from: 250, to: 300, verbose: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--audit') opts.audit = true;
        else if (a === '--dry') opts.dry = true;
        else if (a === '--write') opts.write = true;
        else if (a === '--verbose') opts.verbose = true;
        else if (a === '--only') {
            opts.only = new Set(argv[++i].split(',').map((s) => Number(s.trim())).filter(Boolean));
        } else if (a === '--from') opts.from = Number(argv[++i]);
        else if (a === '--to') opts.to = Number(argv[++i]);
    }
    return opts;
}

function moveStepMap(d) {
    const pos = new Int32Array(d.tiles.length).fill(-1);
    const sol = d.solution || [];
    for (let i = 0; i < sol.length; i++) pos[sol[i]] = i;
    return pos;
}

function clockStep(d) {
    if (!d.clock || d.clock.i == null) return -1;
    return moveStepMap(d)[d.clock.i];
}

function specialSet(d) {
    const set = new Set();
    if (d.clock && d.clock.i != null) set.add(d.clock.i);
    const ob = d.obst || {};
    for (const x of (ob.locks || [])) set.add(x);
    for (const x of (ob.keys || [])) set.add(x);
    for (const k of Object.keys(ob.ice || {})) set.add(Number(k));
    return set;
}

function overlapsXY(a, b) {
    return Math.abs(a[0] - b[0]) < 2 && Math.abs(a[1] - b[1]) < 2;
}

function sameZNeighbor(a, b, dir) {
    if (a[2] !== b[2]) return false;
    if (Math.abs(a[1] - b[1]) >= 2) return false;
    return dir < 0 ? b[0] === a[0] - 2 : b[0] === a[0] + 2;
}

function isIceAdjacent(a, b) {
    const dx = Math.abs(a[0] - b[0]);
    const dy = Math.abs(a[1] - b[1]);
    const dz = Math.abs(a[2] - b[2]);
    if (dz === 0) return dx <= 2 && dy <= 2 && (dx < 2 || dy < 2);
    return dz === 1 && dx < 2 && dy < 2;
}

// Provenance loader matching all source types in levels 250-300
let cachedLabIdeas = null;
function loadLabLookalikeCoverThaw() {
    if (cachedLabIdeas) return cachedLabIdeas;
    const t = fs.readFileSync(path.join(BANK_DIR, 'chained-v2/lab-ideas-original.js'), 'utf8');
    const obj = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    const sel = rd(path.join(BANK_DIR, 'chained-v2/lab-selection-original.json'));
    const rows = sel.boards || sel.selection || sel;
    const k = rows.findIndex((r) => r.file === 'lookalikeCoverThaw-L12-s12-p2.json');
    cachedLabIdeas = k >= 0 ? { card: { trap: null, clock: { spare: 2 } }, brief: { layout: 12 }, design: obj.ideas[k].board } : null;
    return cachedLabIdeas;
}

function findPoolJob(poolId) {
    if (!poolId) return null;
    const candidates = [poolId];
    const parts = poolId.split('-');
    // Handle "<base>-rp-std" or "<base>-std"
    if (parts.length > 1) candidates.push(parts.slice(0, -1).join('-'));
    if (parts.length > 2) candidates.push(parts.slice(0, -2).join('-'));
    for (const stem of candidates) {
        for (const sub of ['batch-pool', 'batch-pool-2']) {
            const p = path.join(TRAPS_DIR, sub, `${stem}.json`);
            if (fs.existsSync(p)) return rd(p).job;
        }
    }
    return null;
}

function loadProvenance(rec, origD) {
    const src = rec.source || '';
    if (/^batch (\d+)$/.test(src)) {
        const m = RegExp.$1;
        const bf = [
            path.join(BANK_DIR, `batch-250-289/level-${m}.json`),
            path.join(BANK_DIR, `batch-250-289/rejected/level-${m}.json`),
        ].find((f) => fs.existsSync(f));
        const b = bf ? rd(bf) : null;
        const job = b && b.card ? findPoolJob(b.card.poolId) : null;
        let rebuilt = null;
        if (job) {
            try { rebuilt = R.rebuild(job, b.design || origD).r; } catch (_) { rebuilt = null; }
        }
        return { kind: 'batch', rec, b, job, rebuilt };
    }
    if (/^batch2 (\d+)$/.test(src)) {
        const m = RegExp.$1;
        const bf = path.join(BANK_DIR, `batch-303-342/level-${m}.json`);
        const b = fs.existsSync(bf) ? rd(bf) : null;
        const job = b && b.card ? findPoolJob(b.card.poolId) : null;
        let rebuilt = null;
        if (job) {
            try { rebuilt = R.rebuild(job, b.design || origD).r; } catch (_) { rebuilt = null; }
        }
        return { kind: 'batch2', rec, b, job, rebuilt };
    }
    if (/^chain lab-(\d+)$/.test(src)) {
        const lab = Number(RegExp.$1);
        const map = { 291: 'chain-11-46.json', 292: 'chain-15-12.json', 293: 'chain-5-9.json' };
        const ex = map[lab] ? rd(path.join(TRAPS_DIR, 'examples2', map[lab])) : null;
        return { kind: 'chain', rec, ex };
    }
    if (/^bank lab-(\d+)$/.test(src)) {
        const lab = Number(RegExp.$1);
        const map = {
            262: 'eadb34f1069985e26b23abea27ce09307055b5de3fd7c44d34bbe8e1f0e54a35.json',
            273: 'daf285e590a2bd4432f89c3b8bf39c97fc9a6ff91143ed93f8867b9c0c78649e.json',
        };
        const ex = map[lab] ? rd(path.join(BANK_DIR, 'puzzles', map[lab])) : null;
        return { kind: 'bank', rec, ex };
    }
    if (/^chained (.+)$/.test(src)) {
        const id = RegExp.$1;
        const paths = [
            path.join(BANK_DIR, 'chained-gentle', `${id}.json`),
            path.join(BANK_DIR, 'chained-v1/examples', `${id}.json`),
            path.join(BANK_DIR, 'chained-v2/examples', `${id}.json`),
        ];
        let ex = null;
        for (const p of paths) if (fs.existsSync(p)) { ex = rd(p); break; }
        if (!ex && id === 'lookalikeCoverThaw-L12-s12-p2') ex = loadLabLookalikeCoverThaw();
        return { kind: 'chained', rec, ex, shape: id.split('-')[0] };
    }
    return { kind: 'older', rec };
}

function enumerateWindows(d) {
    const b = bbox(d.tiles);
    const pos = moveStepMap(d);
    const ci = clockStep(d);
    const spec = specialSet(d);
    const cands = [];
    const maxWx0 = b.minX;
    const wx1 = b.maxX;
    const maxWy0 = Math.max(b.minY, b.maxY - 14);
    for (let wx0 = b.minX; wx0 <= maxWx0; wx0++) {
        for (const wy0 of [b.minY + 2, b.minY]) {
            if (wy0 > maxWy0) continue;
            let specOut = 0, preOut = 0, totalOut = 0, parity = 0;
            for (let i = 0; i < d.tiles.length; i++) {
                const [x, y, z] = d.tiles[i];
                const inside = x >= wx0 && x <= wx1 && y >= wy0 && y <= wy0 + 14;
                if (!inside) {
                    totalOut++;
                    if (spec.has(i)) specOut++;
                    if (ci >= 0 && pos[i] <= ci) preOut++;
                } else if (z === 0 && ((x - wx0) % 2 === 0) && ((y - wy0) % 2 === 0)) {
                    parity++;
                }
            }
            cands.push({ wx0, wx1, wy0, specOut, preOut, totalOut, parity });
        }
    }
    // Keep top windows under two orderings:
    // 1) safeguard specials + pre-clock first
    // 2) minimal total outside tiles first (crucial for 272 where one key is on x=12)
    const bySafe = [...cands].sort((a, b2) =>
        a.specOut - b2.specOut || a.preOut - b2.preOut || a.totalOut - b2.totalOut || b2.parity - a.parity
    );
    const byMinOut = [...cands].sort((a, b2) =>
        a.preOut - b2.preOut || a.totalOut - b2.totalOut || a.specOut - b2.specOut || b2.parity - a.parity
    );
    const byTotal = [...cands].sort((a, b2) =>
        a.totalOut - b2.totalOut || a.preOut - b2.preOut || b2.parity - a.parity
    );
    const seen = new Set();
    const out = [];
    for (const list of [bySafe, byMinOut, byTotal]) {
        for (const w of list) {
            const k = `${w.wx0},${w.wy0}`;
            if (!seen.has(k)) { seen.add(k); out.push(w); }
        }
    }
    return out;
}

// Check if tile `idx` can be placed at `cand = [cx, cy, cz]` with active tile set (ignoring `placed === false` or `idx`).
function canPlaceAt(tiles, placed, idx, cand, pos, ci, specSet, downSet, iceMap, opts) {
    const [cx, cy, cz] = cand;
    if (cx < 0 || cy < 0 || cx > 63 || cy > 63 || cz < 0 || cz > 4) return false;
    const { wx0, wx1, wy0, allowCoverPre, allowCoverSpec, allowSingleSup, forbidHorizPre } = opts;
    if (cx < wx0 || cx > wx1 || cy < wy0 || cy > wy0 + 14) return false;

    // Overlap at same z
    for (let j = 0; j < tiles.length; j++) {
        if (j === idx || !placed[j]) continue;
        if (tiles[j][2] === cz && overlapsXY(tiles[j], cand)) return false;
    }

    // Any tile strictly BELOW cand (z_j < cz, matching L.neighbors) is blocked by cand until idx leaves!
    if (cz > 0) {
        let sup = 0;
        let exactCenter = false;
        for (let j = 0; j < tiles.length; j++) {
            if (j === idx || !placed[j]) continue;
            if (tiles[j][2] < cz && overlapsXY(tiles[j], cand)) {
                // Supporter / lower tile j MUST leave AFTER idx leaves!
                if (pos[j] <= pos[idx]) return false;
                if (!allowCoverPre && !(opts.mustCoverDown && opts.mustCoverDown.has(j)) && ci >= 0 && pos[j] <= ci) return false;
                if (!allowCoverSpec && specSet.has(j) && iceMap[j] == null) return false;
                if (tiles[j][2] === cz - 1) {
                    sup++;
                    if (tiles[j][0] === cx && tiles[j][1] === cy) exactCenter = true;
                }
            }
        }
        if (sup === 0) return false;
        if (sup === 1 && !exactCenter) return false;
    }

    // Any tile strictly ABOVE cand (z_j > cz, matching L.neighbors) blocks idx until it leaves!
    let hasAbove = false;
    for (let j = 0; j < tiles.length; j++) {
        if (j === idx || !placed[j]) continue;
        if (tiles[j][2] > cz && overlapsXY(tiles[j], cand)) {
            hasAbove = true;
            if (pos[j] >= pos[idx]) return false;
        }
    }

    // Horizontal blocking check for idx AND its same-z neighbors j
    let leftBlockIdx = false, rightBlockIdx = false;
    for (let j = 0; j < tiles.length; j++) {
        if (j === idx || !placed[j]) continue;
        const tj = tiles[j];
        if (sameZNeighbor(cand, tj, -1) && pos[j] > pos[idx]) leftBlockIdx = true;
        if (sameZNeighbor(cand, tj, +1) && pos[j] > pos[idx]) rightBlockIdx = true;
        if (tj[2] === cz && Math.abs(tj[1] - cy) < 2 && (tj[0] === cx - 2 || tj[0] === cx + 2)) {
            if (forbidHorizPre && ci >= 0 && pos[j] <= ci) return false;
            if (pos[idx] > pos[j]) {
                // j must be open on the opposite side when removed at pos[j]
                const otherDir = tj[0] < cx ? -1 : +1;
                for (let k = 0; k < tiles.length; k++) {
                    if (k === j || k === idx || !placed[k]) continue;
                    if (sameZNeighbor(tj, tiles[k], otherDir) && pos[k] > pos[j]) return false;
                }
            }
        }
    }
    if (leftBlockIdx && rightBlockIdx) return false;

    // Face-down tile must not start completely free (allow deferred capping during placement)
    if (downSet.has(idx)) {
        if (cz === 0 && (cx % 2 !== 0 || cy % 2 !== 0)) return false;
        let hasL = false, hasR = false;
        for (let j = 0; j < tiles.length; j++) {
            if (j === idx || !placed[j]) continue;
            if (sameZNeighbor(cand, tiles[j], -1)) hasL = true;
            if (sameZNeighbor(cand, tiles[j], +1)) hasR = true;
        }
        if (!hasAbove && !(hasL && hasR)) {
            const covExisting = opts.mustCoverDown && [...opts.mustCoverDown].some((m) =>
                placed[m] && ((tiles[m][2] < cz && overlapsXY(tiles[m], cand)) ||
                ((sameZNeighbor(cand, tiles[m], -1) || sameZNeighbor(cand, tiles[m], 1)) && pos[idx] > pos[m]))
            );
            const netStacks = (opts.mustCoverDown ? opts.mustCoverDown.size : 0) + (covExisting ? 0 : 1);
            if (!opts.allowDeferDownCover || cz >= 4 || (cz >= 1 && cx < wx0 + 1) || (opts.remCaps || 0) < netStacks) return false;
        }
    }

    // If idx itself is an ice tile, ensure enough ice neighbors are removed before pos[idx]
    if (iceMap[idx] != null) {
        let earlier = 0;
        for (let j = 0; j < tiles.length; j++) {
            if (j === idx || !placed[j]) continue;
            if (isIceAdjacent(cand, tiles[j]) && pos[j] < pos[idx]) earlier++;
        }
        if (earlier < iceMap[idx]) return false;
    }

    return true;
}

// Find horizontal contiguous wing/row strips that extend outside [wx0..wx0+10]
// and can shift horizontally by dx (-2, -1, +1, +2) without colliding with anything.
function applyAutoStripShifts(d, wx0, wy0) {
    const tiles = clone(d.tiles);
    const n = tiles.length;
    const pos = moveStepMap(d);

    // Group z=0 tiles by y, find connected components with |dx| <= 2
    const rows = new Map();
    for (let i = 0; i < n; i++) {
        if (tiles[i][2] !== 0) continue;
        const y = tiles[i][1];
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push(i);
    }

    // Check full-row shift on outer rows whose width <= 10 (e.g. y=14 in L251 or y=0 in L286)
    // OR left/right wing shift if there is a gap inside the row.
    const ci = clockStep(d);
    const spec = specialSet(d);
    const liftedDuringShift = new Set();

    for (const [y, idxs] of rows) {
        idxs.sort((a, b) => tiles[a][0] - tiles[b][0]);
        // First ignore post-clock non-special rim tiles on this row that would widen it beyond 10
        const activeIdxs = idxs.filter((i) => {
            const x = tiles[i][0];
            if ((x < wx0 || x > wx0 + 10) && (ci < 0 || pos[i] > ci) && !spec.has(i)) {
                // Only drop this outlier from shift consideration if the remaining row still has width <= 10
                return false;
            }
            return true;
        });
        const workList = activeIdxs.length ? activeIdxs : idxs;
        const comps = [];
        let cur = [workList[0]];
        for (let k = 1; k < workList.length; k++) {
            if (tiles[workList[k]][0] - tiles[workList[k - 1]][0] <= 2.5) cur.push(workList[k]);
            else { comps.push(cur); cur = [workList[k]]; }
        }
        comps.push(cur);

        for (const comp of comps) {
            const minX = tiles[comp[0]][0];
            const maxX = tiles[comp[comp.length - 1]][0];
            if (maxX - minX > 10) continue;
            let dx = 0;
            if (minX < wx0 && maxX <= wx0 + 10) dx = wx0 - minX;
            else if (maxX > wx0 + 10 && minX >= wx0) dx = (wx0 + 10) - maxX;
            if (!dx || Math.abs(dx) > 2) continue;

            // Collect this component + any upper tiles resting exclusively on it
            const shiftSet = new Set(comp);
            let changed = true;
            while (changed) {
                changed = false;
                for (let j = 0; j < n; j++) {
                    if (shiftSet.has(j) || tiles[j][2] === 0) continue;
                    const sups = [];
                    for (let k = 0; k < n; k++) {
                        if (tiles[k][2] === tiles[j][2] - 1 && overlapsXY(tiles[k], tiles[j])) sups.push(k);
                    }
                    if (sups.length && sups.every((k) => shiftSet.has(k))) {
                        shiftSet.add(j);
                        changed = true;
                    }
                }
            }

            // Ensure no tile in shiftSet overlaps an unshifted tile after +dx
            // (allow ignoring post-clock non-special z>=1 bridge tiles that will be relocated below)
            let safe = true;
            const bridgeUnplace = [];
            for (const i of shiftSet) {
                const cand = [tiles[i][0] + dx, tiles[i][1], tiles[i][2]];
                if (cand[0] < wx0 || cand[0] > wx0 + 10) { safe = false; break; }
                for (let j = 0; j < n; j++) {
                    if (shiftSet.has(j) || liftedDuringShift.has(j)) continue;
                    if (tiles[j][2] === cand[2] && overlapsXY(tiles[j], cand)) {
                        safe = false; break;
                    }
                    if (Math.abs(tiles[j][2] - cand[2]) === 1 && overlapsXY(tiles[j], tiles[i])) {
                        // A z>=1 post-clock non-special bridge tile can simply be relocated later
                        if (tiles[j][2] > tiles[i][2] && (ci < 0 || pos[j] > ci) && !spec.has(j)) {
                            bridgeUnplace.push(j);
                        } else {
                            safe = false; break;
                        }
                    }
                    if (tiles[j][2] === cand[2] && Math.abs(tiles[j][1] - cand[1]) < 2 &&
                        (cand[0] === tiles[j][0] - 2 || cand[0] === tiles[j][0] + 2) &&
                        pos[i] > pos[j]) {
                        safe = false; break;
                    }
                }
                if (!safe) break;
            }
            if (safe) {
                for (const i of shiftSet) tiles[i][0] += dx;
                for (const j of bridgeUnplace) liftedDuringShift.add(j);
            }
        }
    }
    return { tiles, liftedDuringShift };
}

function buildRestackedTiles(origD, lv, win, cfg) {
    const d = clone(origD);
    const n = d.tiles.length;
    const pos = moveStepMap(d);
    const ci = clockStep(d);
    const spec = specialSet(d);
    const downSet = new Set(d.down || []);
    const iceMap = (d.obst && d.obst.ice) || {};
    const { wx0, wx1, wy0 } = win;

    // 1) Optional strip shifts first
    const shiftRes = cfg.useStripShift ? applyAutoStripShifts(d, wx0, wy0) : { tiles: clone(d.tiles), liftedDuringShift: new Set() };
    const tiles = shiftRes.tiles;
    const nbOrig = L.neighbors(tiles.map(([x, y, z]) => ({ x, y, z })));

    // 2) Record which inner tiles were horizontally blocked by each outside tile,
    // and which remaining face-down tiles would become exposed at start when moveSet is lifted.
    const blockedByOut = new Map();
    const blockedPreTargets = new Set();
    for (let i = 0; i < n; i++) {
        const [x, y] = tiles[i];
        if (x >= wx0 && x <= wx1 && y >= wy0 && y <= wy0 + 14) continue;
        const targets = new Set([...nbOrig.left[i], ...nbOrig.right[i]]);
        for (const m of targets) {
            if (pos[m] > pos[i]) {
                if (!blockedByOut.has(i)) blockedByOut.set(i, new Set());
                blockedByOut.get(i).add(m);
                if (ci >= 0 && pos[m] <= ci) blockedPreTargets.add(m);
            }
        }
    }

    // 3) Identify outside tiles (+ any bridge tiles lifted by strip shift) to relocate
    const placed = new Array(n).fill(true);
    const moveSet = new Set();
    for (let i = 0; i < n; i++) {
        const [x, y] = tiles[i];
        if (shiftRes.liftedDuringShift.has(i) || x < wx0 || x > wx1 || y < wy0 || y > wy0 + 14) {
            moveSet.add(i);
            placed[i] = false;
        }
    }

    // If a moved tile was supporting something above it that was INSIDE the window, unplace those too
    let prop = true;
    while (prop) {
        prop = false;
        for (let j = 0; j < n; j++) {
            if (!placed[j] || tiles[j][2] === 0) continue;
            let supLeft = 0;
            for (let k = 0; k < n; k++) {
                if (placed[k] && tiles[k][2] === tiles[j][2] - 1 && overlapsXY(tiles[k], tiles[j])) supLeft++;
            }
            if (supLeft === 0) {
                moveSet.add(j);
                placed[j] = false;
                prop = true;
            }
        }
    }

    // Identify any placed face-down tiles that became start-free after removing moveSet (must be re-covered or pinned)
    const mustCoverDown = new Set();
    for (const m of downSet) {
        if (!placed[m]) continue;
        let hasAb = false, hasL = false, hasR = false;
        for (let j = 0; j < n; j++) {
            if (!placed[j] || j === m) continue;
            if (tiles[j][2] > tiles[m][2] && overlapsXY(tiles[j], tiles[m])) hasAb = true;
            if (sameZNeighbor(tiles[m], tiles[j], -1)) hasL = true;
            if (sameZNeighbor(tiles[m], tiles[j], +1)) hasR = true;
        }
        if (!hasAb && !(hasL && hasR)) mustCoverDown.add(m);
    }

    // Record original blockers for pre-clock moved tiles so we can prefer placing them under their original blocker
    const origBlockerOf = new Map();
    for (const i of moveSet) {
        if (ci >= 0 && pos[i] <= ci && nbOrig.above[i].length > 0) {
            origBlockerOf.set(i, new Set(nbOrig.above[i]));
        }
    }

    // 4) Pick extra uncovered post-clock z=0 (or z=1) non-special tiles to build 4-5 layers & originality
    if (cfg.extraCount > 0) {
        const cands = [];
        for (let i = 0; i < n; i++) {
            if (moveSet.has(i) || tiles[i][2] !== 0) continue;
            if (ci >= 0 && pos[i] <= ci) continue;
            if (spec.has(i) || downSet.has(i)) continue;
            if (nbOrig.above[i].length > 0) continue;
            // Also skip if i has any neighbor with pos <= ci (could open a pre-clock blocker!)
            const hor = [...nbOrig.left[i], ...nbOrig.right[i]];
            if (hor.some((j) => ci >= 0 && pos[j] <= ci)) continue;
            // Skip if i is an ice neighbor of an ice tile whose thaw count would drop
            let hurtsIce = false;
            for (const [kStr, h] of Object.entries(iceMap)) {
                const k = Number(kStr);
                if (pos[i] < pos[k] && isIceAdjacent(tiles[i], tiles[k])) hurtsIce = true;
            }
            if (hurtsIce) continue;
            const distEdge = Math.min(tiles[i][0] - wx0, wx1 - tiles[i][0], tiles[i][1] - wy0, wy0 + 14 - tiles[i][1]);
            cands.push({ i, distEdge, j: hash32(lv, cfg.seed, i, 1, 0) });
        }
        cands.sort((a, b2) => a.distEdge - b2.distEdge || a.j - b2.j);
        for (const c of cands.slice(0, cfg.extraCount)) {
            // Double check none of its horizontal neighbors gets newly exposed inappropriately; wait - c already skipped hor<=ci
            moveSet.add(c.i);
            placed[c.i] = false;
        }
    }

    // 5) Place relocated tiles in descending order of removal step pos[i] (latest removed -> lower z supporting earlier)
    const queue = [...moveSet].sort((a, b2) => pos[b2] - pos[a]);
    const currentMaxZ = () => tiles.reduce((mx, t, idx) => (placed[idx] && t[2] > mx ? t[2] : mx), 0);

    function findBestSlot(idx) {
        const isPre = ci >= 0 && pos[idx] <= ci;
        const maxZNow = currentMaxZ();
        const wantZ4 = maxZNow < 3 ? 3 : 4;
        const commonOpts = {
            wx0, wx1, wy0,
            mustCoverDown,
            allowDeferDownCover: queue.length > 0,
            remCaps: queue.filter((q) => !downSet.has(q)).length,
        };
        const passConfigs = [
            { ...commonOpts, allowCoverPre: false, allowCoverSpec: false, allowSingleSup: false, forbidHorizPre: true, strictNoShadow: false, zOrder: [4, 3, 2, 1, 0] },
            { ...commonOpts, allowCoverPre: false, allowCoverSpec: false, allowSingleSup: false, forbidHorizPre: false, strictNoShadow: false, zOrder: [4, 3, 2, 1, 0] },
            { ...commonOpts, allowCoverPre: isPre, allowCoverSpec: false, allowSingleSup: false, forbidHorizPre: false, strictNoShadow: false, zOrder: [4, 3, 2, 1, 0] },
            { ...commonOpts, allowCoverPre: isPre, allowCoverSpec: false, allowSingleSup: true, forbidHorizPre: false, strictNoShadow: false, zOrder: [4, 3, 2, 1, 0] },
        ];

        for (const pOpts of passConfigs) {
            let best = null;
            for (const cz of pOpts.zOrder) {
                const marginX = cz >= 4 ? 2 : cz >= 1 ? 1 : 0;
                const marginY = 0;
                for (let cx = wx0 + marginX; cx <= wx1; cx++) {
                    for (let cy = wy0 + marginY; cy <= wy0 + 14; cy++) {
                        // Never allow horizontal shadow overhang to widen a 7-col board
                        if (cx / 2 - cz * 0.14 < wx0 / 2 - 0.001) continue;
                        const cand = [cx, cy, cz];
                        if (!canPlaceAt(tiles, placed, idx, cand, pos, ci, spec, downSet, iceMap, pOpts)) continue;

                        let score = 0;
                        if (cz === wantZ4) score += 25;
                        else if (cz === 3) score += 18;
                        else if (cz === 2) score += 12;
                        else if (cz === 1) score += 5;
                        else score -= 8;

                        let sup = 0, exactSup = 0, sameZHor = 0;
                        let coversBlockedDecoy = 0;
                        let coversExposedDown = 0;
                        let helpsIce = 0;
                        let underOrigBlocker = 0;
                        const pinSet = blockedByOut.get(idx);
                        const blockers = origBlockerOf.get(idx);
                        for (let j = 0; j < n; j++) {
                            if (j === idx || !placed[j]) continue;
                            if (tiles[j][2] < cz && overlapsXY(tiles[j], cand)) {
                                if (tiles[j][2] === cz - 1) sup++;
                                if (tiles[j][0] === cx && tiles[j][1] === cy) exactSup++;
                                if (pinSet && pinSet.has(j)) coversBlockedDecoy++;
                                if (mustCoverDown.has(j)) coversExposedDown++;
                            }
                            if (tiles[j][2] > cz && overlapsXY(tiles[j], cand) && blockers && blockers.has(j)) {
                                underOrigBlocker++;
                            }
                            if (sameZNeighbor(cand, tiles[j], -1) || sameZNeighbor(cand, tiles[j], +1)) {
                                sameZHor++;
                                if (mustCoverDown.has(j) && pos[idx] > pos[j]) coversExposedDown++;
                            }
                            if (iceMap[j] != null && pos[idx] < pos[j] && isIceAdjacent(cand, tiles[j])) {
                                helpsIce++;
                            }
                        }
                        if (cz > 0 && sup >= 2) score += 20;
                        if (cz > 0 && sup >= 4) score += 8;
                        if (cz > 0 && exactSup > 0 && sup === 1) score -= 20;
                        if (sameZHor === 0) score += 15;
                        if (coversBlockedDecoy > 0) score += 80;
                        if (coversExposedDown > 0) score += 4000;
                        if (downSet.has(idx)) score -= cz * 30;
                        if (underOrigBlocker > 0) score += 120;
                        score += helpsIce * 3;
                        if (isPre) score += sameZHor === 0 ? 15 : 0;
                        const distCenter = Math.abs(cx - (wx0 + 5)) + Math.abs(cy - (wy0 + 7));
                        score -= distCenter * 0.4;
                        if (cx / 2 - cz * 0.14 < wx0 / 2 - 0.01) score -= 25;
                        if (cy / 2 * 1.24 - cz * 0.14 < wy0 / 2 * 1.24 - 0.01) score -= 25;
                        score += hash32(lv, cfg.seed, idx, cx, cy * 17 + cz) * 4.0;

                        if (!best || score > best.score) best = { score, cand };
                    }
                }
            }
            if (best) return best.cand;
        }
        return null;
    }

    let vacates = 0;
    const vacatedBefore = new Set();
    while (queue.length > 0) {
        const idx = queue.shift();
        let cand = findBestSlot(idx);
        if (!cand && vacates < 24) {
            const vCands = [];
            for (let v = 0; v < n; v++) {
                if (!placed[v] || tiles[v][2] !== 0 || vacatedBefore.has(v)) continue;
                if (spec.has(v)) continue;
                if (ci >= 0 && pos[v] <= ci) continue;
                if (pos[v] >= pos[idx]) continue;
                const riders = [v];
                let bad = false;
                for (let u = 0; u < n; u++) {
                    if (!placed[u] || u === v) continue;
                    if (tiles[u][2] > 0 && overlapsXY(tiles[u], tiles[v])) {
                        let otherSup = 0;
                        for (let w = 0; w < n; w++) {
                            if (placed[w] && w !== v && tiles[w][2] === tiles[u][2] - 1 && overlapsXY(tiles[w], tiles[u])) otherSup++;
                        }
                        if (otherSup < 2) {
                            if (spec.has(u) || (ci >= 0 && pos[u] <= ci) || pos[u] >= pos[idx]) { bad = true; break; }
                            riders.push(u);
                        }
                    }
                }
                if (bad) continue;
                const onEdge = (tiles[v][0] === wx0 || tiles[v][0] === wx1 || tiles[v][1] === wy0 || tiles[v][1] === wy0 + 14) ? 0 : 1;
                vCands.push({ v, riders, score: riders.length * 100 + onEdge * 40 + pos[v] });
            }
            vCands.sort((a, b2) => a.score - b2.score);
            for (const vc of vCands) {
                vacatedBefore.add(vc.v);
                for (const u of vc.riders) placed[u] = false;
                const retry = findBestSlot(idx);
                if (retry) {
                    cand = retry;
                    vacates++;
                    for (const u of vc.riders) queue.push(u);
                    queue.sort((a, b2) => pos[b2] - pos[a]);
                    break;
                } else {
                    for (const u of vc.riders) placed[u] = true;
                }
            }
        }
        if (!cand) return null;
        tiles[idx] = cand;
        placed[idx] = true;
        mustCoverDown.delete(idx);
        if (downSet.has(idx)) {
            let hA = false, hL = false, hR = false;
            for (let j = 0; j < n; j++) {
                if (j === idx || !placed[j]) continue;
                if (tiles[j][2] > cand[2] && overlapsXY(tiles[j], cand)) hA = true;
                if (sameZNeighbor(cand, tiles[j], -1)) hL = true;
                if (sameZNeighbor(cand, tiles[j], +1)) hR = true;
            }
            if (!hA && !(hL && hR)) mustCoverDown.add(idx);
        }
        // Check if placing idx covered any exposed mustCoverDown tile or opened none
        for (const m of [...mustCoverDown]) {
            if (placed[m] && (overlapsXY(tiles[m], cand) && cand[2] > tiles[m][2])) mustCoverDown.delete(m);
        }
    }

    // Shift to keep all coords non-negative if any became < 0
    const b = bbox(tiles);
    if (b.minX < 0 || b.minY < 0) {
        const sdx = b.minX < 0 ? -b.minX : 0;
        const sdy = b.minY < 0 ? -b.minY : 0;
        for (const t of tiles) { t[0] += sdx; t[1] += sdy; }
    }
    d.tiles = tiles;
    return d;
}

function checkOriginality(d, prevLive, prevRestacked) {
    for (const p of prevLive) {
        const c = Orig.compare({ design: d }, p, 0.75);
        if (c) return { ok: false, clash: `live-${p.level}: ${c.reason || c.why || JSON.stringify(c)}` };
    }
    for (const p of prevRestacked) {
        const c = Orig.compare({ design: d }, { level: p.level, design: p.design }, 0.75);
        if (c) return { ok: false, clash: `restack-${p.level}: ${c.reason || c.why || JSON.stringify(c)}` };
    }
    return { ok: true };
}

function gatesPreserved(candSg, origSg) {
    if (origSg && origSg.pass) return candSg.pass === true;
    for (const g of ['A1', 'A2', 'A3', 'A9']) {
        if (candSg.gates && candSg.gates[g] && !candSg.gates[g].pass) return false;
    }
    if (origSg && origSg.gates) {
        for (const [k, v] of Object.entries(origSg.gates)) {
            if (v && v.pass && candSg.gates && candSg.gates[k] && !candSg.gates[k].pass) return false;
        }
    }
    return true;
}

function firstFailedGateNames(sg) {
    if (!sg || !sg.gates) return 'unknown';
    return Object.entries(sg.gates)
        .filter(([, v]) => !v.pass)
        .map(([k, v]) => `${k}(${(v.detail && v.detail.why || []).join('; ')})`)
        .join(', ');
}

function verifyCandidate(lv, prov, cand, origD, origK, origSgChain, origSgDeep, baseDownFree, origReadable, prevLive, prevRestacked, extraCount) {
    if (!fits6x8(cand.tiles)) return { ok: false, why: 'bbox > 7x8' };
    const px = tilePx(cand.tiles);
    if (px < 53.4) return { ok: false, why: `tilePx ${px.toFixed(2)} < 53.4` };
    if (bbox(cand.tiles).layers < 3) return { ok: false, why: `layers=${bbox(cand.tiles).layers} < 3` };

    // Fast downFree check before expensive solver calls
    const newDownFree = (() => {
        const nbN = L.neighbors(cand.tiles.map(([x, y, z]) => ({ x, y, z })));
        const alN = new Uint8Array(cand.tiles.length).fill(1);
        return (cand.down || []).filter((i) => L.isFree(i, alN, nbN)).length;
    })();
    if (prov.kind !== 'older' && newDownFree > 0) return { ok: false, why: `downFree=${newDownFree}` };
    if (prov.kind === 'older' && newDownFree > baseDownFree) return { ok: false, why: `new downFree ${newDownFree} > ${baseDownFree}` };

    const rep = E.replay(cand, cand.solution, { strict: true });
    if (!rep.ok) return { ok: false, why: 'replay: ' + rep.why };

    const vs = Hard.validSolution(gameOf(cand), cand.solution);
    if (vs !== true && !(vs && vs.ok)) return { ok: false, why: 'Hard.validSolution failed' };

    const downSet = new Set(cand.down || []);
    if (cand.solution && downSet.has(cand.solution[0])) {
        return { ok: false, why: 'move-0 face-down' };
    }

    const pr = PS.readable(cand);
    const prOk = pr === true || (pr && pr.ok === true);
    if (prov.kind !== 'older' && !prOk) return { ok: false, why: 'unreadable' };
    if (prov.kind === 'older' && origReadable && !prOk) return { ok: false, why: 'unreadable (orig was readable)' };

    if (extraCount > 0 && prov.kind !== 'older') {
        const og = checkOriginality(cand, prevLive, prevRestacked);
        if (!og.ok) return { ok: false, why: 'originality: ' + og.clash };
    }

    const cs = cand.clock ? E.clockShortest(E.game(clone(cand)), { nodes: 400000, ms: 30000 }) : null;
    if (cand.clock && (!cs || cs.k !== origK)) {
        return { ok: false, why: `clockShortest k changed: ${cs && cs.k} vs orig ${origK}` };
    }

    // Source-specific verifications
    let cur = cand;
    const kind = prov.kind;

    if (kind === 'batch' || kind === 'batch2') {
        if (SEP.closeTwins(cur).visible > 0) {
            const rr = Tl.reroute(clone(cur), { gentle: true });
            if (rr.ok && rr.design) {
                const rrCs = rr.design.clock ? E.clockShortest(E.game(clone(rr.design)), { nodes: 400000, ms: 30000 }) : null;
                if ((!cur.clock || (rrCs && rrCs.k === origK)) && SEP.closeTwins(rr.design).visible === 0) {
                    cur = rr.design;
                }
            }
        }
        if (SEP.closeTwins(cur).visible > 0) {
            try {
                const ss = SEP.swapStage(clone(cur), { k: origK, wallMs: 4000 });
                const d2 = ss && ss.design ? ss.design : (ss && ss.tiles ? ss : null);
                if (d2 && SEP.closeTwins(d2).visible === 0 && E.replay(d2, d2.solution, { strict: true }).ok) {
                    const ssCs = d2.clock ? E.clockShortest(E.game(clone(d2)), { nodes: 400000, ms: 30000 }) : null;
                    if (!d2.clock || (ssCs && ssCs.k === origK)) cur = d2;
                }
            } catch (_) {}
        }
        if (SEP.closeTwins(cur).visible > 0) return { ok: false, why: 'closeTwins visible > 0' };

        const sg = SG.staticGates(cur, { story: 'chain' });
        if (!gatesPreserved(sg, origSgChain)) {
            return { ok: false, why: 'staticGates: ' + firstFailedGateNames(sg) };
        }

        if (prov.rebuilt && prov.rebuilt.roles && prov.rebuilt.brief) {
            const card = prov.rebuilt.card || (prov.b && prov.b.card);
            const origTp = T.reprove('chain', origD, prov.rebuilt.roles, prov.rebuilt.brief, card.clock.spare, card.clock.k);
            const tp = T.reprove('chain', cur, prov.rebuilt.roles, prov.rebuilt.brief, card.clock.spare, card.clock.k);
            if (origTp.ok && !tp.ok) return { ok: false, why: 'T.reprove: ' + tp.why };
            if (!origTp.ok && prov.b && prov.b.card && prov.b.card.trap) {
                const st = V.structure(cur, prov.b.card.trap);
                if (st && st.ok === false) return { ok: false, why: 'V.structure: ' + st.why };
            }
        } else if (prov.b && prov.b.card && prov.b.card.trap) {
            const st = V.structure(cur, prov.b.card.trap);
            if (st && st.ok === false) return { ok: false, why: 'V.structure: ' + st.why };
        }
        return { ok: true, design: cur, px, cs };
    }

    if (kind === 'chain') {
        const sg = SG.staticGates(cur, { story: 'chain' });
        if (!gatesPreserved(sg, origSgChain)) {
            return { ok: false, why: 'staticGates(chain): ' + firstFailedGateNames(sg) };
        }
        if (prov.ex && prov.ex.card && prov.ex.card.trap) {
            const st = V.structure(cur, prov.ex.card.trap);
            if (st && st.ok === false) return { ok: false, why: 'V.structure: ' + st.why };
        }
        return { ok: true, design: cur, px, cs };
    }

    if (kind === 'bank') {
        const sg = SG.staticGates(cur, { story: 'deepClock' });
        if (!gatesPreserved(sg, origSgDeep)) {
            return { ok: false, why: 'staticGates(deepClock): ' + firstFailedGateNames(sg) };
        }
        return { ok: true, design: cur, px, cs };
    }

    if (kind === 'chained') {
        const sg = SG.staticGates(cur, { story: 'chain' });
        if (!gatesPreserved(sg, origSgChain)) {
            return { ok: false, why: 'staticGates(chained): ' + firstFailedGateNames(sg) };
        }
        const vc = V.checkDesign(cur);
        if (vc && vc.ok === false) return { ok: false, why: 'V.checkDesign: ' + vc.why };
        if (prov.ex && prov.ex.card && prov.ex.card.trap) {
            const st = V.structure(cur, prov.ex.card.trap);
            if (st && st.ok === false) return { ok: false, why: 'V.structure: ' + st.why };
            if (SHAPES[prov.shape]) {
                const csCh = VC.chainStructure({ ...prov.ex, design: cur }, SHAPES[prov.shape]);
                if (csCh && csCh.ok === false) return { ok: false, why: 'VC.chainStructure: ' + csCh.why };
            }
        }
        return { ok: true, design: cur, px, cs };
    }

    // older boards: preserve all baseline checks + specials + replay + k + readability
    if (cur.down && cur.down.length / cur.tiles.length > origD.down.length / origD.tiles.length + 1e-6) {
        return { ok: false, why: 'down ratio grew' };
    }
    return { ok: true, design: cur, px, cs };
}

function restackLevel(lv, rec, prevLive, prevRestacked, verbose) {
    const origD = rec.design;
    const origCs = origD.clock ? E.clockShortest(E.game(clone(origD)), { nodes: 400000, ms: 30000 }) : null;
    const origK = origCs ? origCs.k : null;
    const origB = bbox(origD.tiles);
    const origPx = tilePx(origD.tiles);

    if (fits6x8(origD.tiles)) {
        return {
            ok: true,
            kept: true,
            design: origD,
            origB, origPx,
            newB: origB, newPx: origPx,
            k: origK, spare: origD.clock ? origD.clock.n - origK : null,
        };
    }

    const prov = loadProvenance(rec, origD);
    const origSgChain = (prov.kind === 'batch' || prov.kind === 'batch2' || prov.kind === 'chain' || prov.kind === 'chained')
        ? SG.staticGates(origD, { story: 'chain' })
        : null;
    const origSgDeep = prov.kind === 'bank' ? SG.staticGates(origD, { story: 'deepClock' }) : null;
    const baseDownFree = (() => {
        const nbB = L.neighbors(origD.tiles.map(([x, y, z]) => ({ x, y, z })));
        const alB = new Uint8Array(origD.tiles.length).fill(1);
        return (origD.down || []).filter((i) => L.isFree(i, alB, nbB)).length;
    })();
    const origReadable = PS.readable(origD) === true;

    const windows = enumerateWindows(origD);
    const extras = [0, 2, 4, 6, 8];
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const failures = [];

    for (const useStripShift of [false]) {
        for (const win of windows.slice(0, 6)) {
            for (const extraCount of extras) {
                for (const seed of seeds) {
                    const cand = buildRestackedTiles(origD, lv, win, { useStripShift, extraCount, seed });
                    if (!cand) continue;
                    const res = verifyCandidate(lv, prov, cand, origD, origK, origSgChain, origSgDeep, baseDownFree, origReadable, prevLive, prevRestacked, extraCount);
                    if (res.ok) {
                        return {
                            ok: true,
                            kept: false,
                            design: res.design,
                            origB, origPx,
                            newB: bbox(res.design.tiles),
                            newPx: res.px,
                            k: origK,
                            spare: origD.clock ? origD.clock.n - origK : null,
                            cfg: { win: `[${win.wx0}..${win.wx1},${win.wy0}..${win.wy0 + 14}]`, useStripShift, extraCount, seed },
                        };
                    }
                    if (failures.length < 10) failures.push(`${win.wx0},${win.wy0} s=${useStripShift} e=${extraCount}: ${res.why}`);
                }
            }
        }
    }

    return { ok: false, lv, source: rec.source, origB, origPx, failures };
}

function runAudit(opts) {
    let fitCount = 0;
    const summary = [];
    for (let lv = opts.from; lv <= opts.to; lv++) {
        if (opts.only && !opts.only.has(lv)) continue;
        const f = path.join(IN_DIR, `level-${lv}.json`);
        if (!fs.existsSync(f)) continue;
        const rec = rd(f);
        const d = rec.design;
        const b = bbox(d.tiles);
        const fits = fits6x8(d.tiles);
        const px = tilePx(d.tiles);
        if (fits) fitCount++;
        const wins = enumerateWindows(d);
        const w0 = wins[0];
        const ci = clockStep(d);
        const pos = moveStepMap(d);
        const spec = specialSet(d);
        const outTiles = [];
        for (let i = 0; i < d.tiles.length; i++) {
            const [x, y] = d.tiles[i];
            if (x < w0.wx0 || x > w0.wx1 || y < w0.wy0 || y > w0.wy0 + 14) {
                outTiles.push({
                    i, pos: pos[i], xyz: d.tiles[i],
                    pre: ci >= 0 && pos[i] <= ci,
                    spec: spec.has(i),
                    down: (d.down || []).includes(i),
                    ice: d.obst && d.obst.ice ? d.obst.ice[i] : undefined,
                });
            }
        }
        const cs = d.clock ? E.clockShortest(E.game(clone(d)), { nodes: 400000, ms: 30000 }) : null;
        console.log(
            `L${lv} [${rec.source}]: ${b.cols}x${b.rows}x${b.layers} n=${d.tiles.length} px=${px.toFixed(2)} fits=${fits} ` +
            `win=[${w0.wx0}..${w0.wx1},${w0.wy0}..${w0.wy0 + 14}] out=${w0.totalOut} preOut=${w0.preOut} specOut=${w0.specOut} ` +
            `ci=${ci}/${(d.solution.length / 2) - 1} clockN=${d.clock && d.clock.n} k=${cs && cs.k} spare=${d.clock && cs ? d.clock.n - cs.k : 'n/a'}`
        );
        summary.push({ lv, fits });
    }
    console.log(`Total audited: ${summary.length}, already fit <=7x8: ${fitCount}, need restack: ${summary.length - fitCount}`);
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.audit || (!opts.dry && !opts.write)) {
        runAudit(opts);
        return;
    }

    const prevLive = Orig.previousBoards([{ level: 200 }], 'source/www/levels-hard.js').filter((p) => p.level < 200);
    const prevRestacked = [];
    const okList = [];
    const failList = [];

    for (let lv = opts.from; lv <= opts.to; lv++) {
        const f = path.join(IN_DIR, `level-${lv}.json`);
        if (!fs.existsSync(f)) continue;
        const rec = rd(f);
        if (opts.only && !opts.only.has(lv)) {
            const existingOut = path.join(OUT_DIR, `level-${lv}.json`);
            const dKeep = fs.existsSync(existingOut) ? rd(existingOut).design : rec.design;
            prevRestacked.push({ level: lv, tiles: dKeep.tiles, design: dKeep });
            continue;
        }

        const res = restackLevel(lv, rec, prevLive, prevRestacked, opts.verbose);
        if (res.ok) {
            okList.push(res);
            prevRestacked.push({ level: lv, tiles: res.design.tiles, design: res.design });
            console.log(
                `L${lv} [${rec.source}] ${res.kept ? 'KEPT' : 'OK'}: ` +
                `${res.origB.cols}x${res.origB.rows}x${res.origB.layers} (${res.origPx.toFixed(2)}px) -> ` +
                `${res.newB.cols}x${res.newB.rows}x${res.newB.layers} (${res.newPx.toFixed(2)}px) ` +
                `k=${res.k} spare=${res.spare}` +
                (res.cfg ? ` ${res.cfg.win} strip=${res.cfg.useStripShift} ext=${res.cfg.extraCount} s=${res.cfg.seed}` : '')
            );
            if (opts.write) {
                const outRec = { ...rec, design: res.design };
                fs.writeFileSync(path.join(OUT_DIR, `level-${lv}.json`), JSON.stringify(outRec));
            }
        } else {
            failList.push(res);
            console.log(`L${lv} [${rec.source}] FAIL: ${res.origB.cols}x${res.origB.rows}x${res.origB.layers}`);
            res.failures.slice(0, 6).forEach((m) => console.log('   -', m));
        }
    }
    console.log(`\nSummary: ok=${okList.length}, fail=${failList.length}`);
    if (failList.length > 0) process.exitCode = 1;
}

main();
