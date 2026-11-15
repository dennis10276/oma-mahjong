'use strict';
// Geometry placement adapted from Gemini f4c0eb04; never writes boards or changes pictures.
const L = require('../../../www/layouts.js');
const clone = x => JSON.parse(JSON.stringify(x));
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

function enumerateWindows(d) {
    const b = bbox(d.tiles);
    const pos = moveStepMap(d);
    const ci = clockStep(d);
    const spec = specialSet(d);
    const cands = [];
    const maxWx0 = Math.max(b.minX, b.maxX - 10);
    
    const maxWy0 = Math.max(b.minY, b.maxY - 12);
    for (let wx0 = b.minX; wx0 <= maxWx0; wx0++) {
        const wx1 = wx0 + 10;
        for (let wy0 = b.minY; wy0 <= maxWy0; wy0++) {
            if (wy0 > maxWy0) continue;
            let specOut = 0, preOut = 0, totalOut = 0, parity = 0;
            for (let i = 0; i < d.tiles.length; i++) {
                const [x, y, z] = d.tiles[i];
                const inside = x >= wx0 && x <= wx1 && y >= wy0 && y <= wy0 + 12;
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
    if (cx < wx0 || cx > wx1 || cy < wy0 || cy > wy0 + 12) return false;

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
        if (x >= wx0 && x <= wx1 && y >= wy0 && y <= wy0 + 12) continue;
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
        if (shiftRes.liftedDuringShift.has(i) || x < wx0 || x > wx1 || y < wy0 || y > wy0 + 12) {
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
            const distEdge = Math.min(tiles[i][0] - wx0, wx1 - tiles[i][0], tiles[i][1] - wy0, wy0 + 12 - tiles[i][1]);
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
                    for (let cy = wy0 + marginY; cy <= wy0 + 12; cy++) {
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
                const onEdge = (tiles[v][0] === wx0 || tiles[v][0] === wx1 || tiles[v][1] === wy0 || tiles[v][1] === wy0 + 12) ? 0 : 1;
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

module.exports = { enumerateWindows, buildRestackedTiles, bbox };
