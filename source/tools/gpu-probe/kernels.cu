// CUDA C++ playout and verification kernels for Oma's Mahjong GPU Probe (Task G1).
// Compiled at runtime via CuPy NVRTC (no host MSVC / CUDA Toolkit required).

typedef unsigned char      uint8_t;
typedef int                int32_t;
typedef unsigned int       uint32_t;
typedef unsigned long long uint64_t;

#define MAX_TILES 128
#define WORDS 4

struct PackedBoard {
    int32_t  n;
    int32_t  clockI;
    int32_t  clockN;
    int32_t  hasLocks;
    uint32_t aboveMask[MAX_TILES * WORDS];
    uint32_t leftMask[MAX_TILES * WORDS];
    uint32_t rightMask[MAX_TILES * WORDS];
    uint32_t iceMask[MAX_TILES * WORDS];
    uint32_t downMask[WORDS];
    uint32_t lockMask[WORDS];
    uint32_t keyMask[WORDS];
    uint32_t initAlive[WORDS];
    uint8_t  iceH[MAX_TILES];
    uint8_t  faces[MAX_TILES];
};

__device__ __forceinline__ uint32_t init_rng(uint32_t baseSeed, uint32_t gid) {
    return (baseSeed + gid * 0x9E3779B9u) ^ 0x85EBCA6Bu;
}

__device__ __forceinline__ uint32_t step_rng(uint32_t &state) {
    state += 0x6D2B79F5u;
    uint32_t z = state;
    uint32_t t1 = (z ^ (z >> 15)) * (1u | z);
    uint32_t t2 = t1 + ((t1 ^ (t1 >> 7)) * (61u | t1));
    uint32_t t3 = t2 ^ t1;
    return t3 ^ (t3 >> 14);
}

__device__ __forceinline__ bool is_bit_set4(uint32_t m0, uint32_t m1, uint32_t m2, uint32_t m3, int i) {
    uint32_t bit = 1u << (i & 31);
    int w = i >> 5;
    if (w == 0) return (m0 & bit) != 0u;
    if (w == 1) return (m1 & bit) != 0u;
    if (w == 2) return (m2 & bit) != 0u;
    return (m3 & bit) != 0u;
}

__device__ __forceinline__ void set_bit4(uint32_t &m0, uint32_t &m1, uint32_t &m2, uint32_t &m3, int i) {
    uint32_t bit = 1u << (i & 31);
    int w = i >> 5;
    if (w == 0) m0 |= bit;
    else if (w == 1) m1 |= bit;
    else if (w == 2) m2 |= bit;
    else m3 |= bit;
}

__device__ __forceinline__ void clear_bit4(uint32_t &m0, uint32_t &m1, uint32_t &m2, uint32_t &m3, int i) {
    uint32_t mask = ~(1u << (i & 31));
    int w = i >> 5;
    if (w == 0) m0 &= mask;
    else if (w == 1) m1 &= mask;
    else if (w == 2) m2 &= mask;
    else m3 &= mask;
}

__device__ __forceinline__ int nth_bit_32(uint32_t w, uint32_t k) {
    while (k > 0u) {
        w &= (w - 1u);
        k--;
    }
    return __ffs((int)w) - 1;
}

__device__ __forceinline__ int nth_bit_128(uint32_t m0, uint32_t m1, uint32_t m2, uint32_t m3, uint32_t k) {
    uint32_t c0 = (uint32_t)__popc(m0);
    if (k < c0) return nth_bit_32(m0, k);
    k -= c0;
    uint32_t c1 = (uint32_t)__popc(m1);
    if (k < c1) return 32 + nth_bit_32(m1, k);
    k -= c1;
    uint32_t c2 = (uint32_t)__popc(m2);
    if (k < c2) return 64 + nth_bit_32(m2, k);
    k -= c2;
    return 96 + nth_bit_32(m3, k);
}

__device__ __forceinline__ int pop_lowest_128(uint32_t &u0, uint32_t &u1, uint32_t &u2, uint32_t &u3) {
    if (u0 != 0u) { int b = __ffs((int)u0) - 1; u0 &= (u0 - 1u); return b; }
    if (u1 != 0u) { int b = __ffs((int)u1) - 1; u1 &= (u1 - 1u); return 32 + b; }
    if (u2 != 0u) { int b = __ffs((int)u2) - 1; u2 &= (u2 - 1u); return 64 + b; }
    if (u3 != 0u) { int b = __ffs((int)u3) - 1; u3 &= (u3 - 1u); return 96 + b; }
    return -1;
}

__device__ __forceinline__ void load_shared_board(const PackedBoard* __restrict__ src, PackedBoard &dst) {
    const uint32_t* s32 = reinterpret_cast<const uint32_t*>(src);
    uint32_t* d32 = reinterpret_cast<uint32_t*>(&dst);
    const int totalWords = (int)(sizeof(PackedBoard) / sizeof(uint32_t));
    for (int idx = threadIdx.x; idx < totalWords; idx += blockDim.x) {
        d32[idx] = s32[idx];
    }
    __syncthreads();
}

__device__ __forceinline__ bool tile_can_take(
    const PackedBoard &sb,
    uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3,
    uint32_t na0, uint32_t na1, uint32_t na2, uint32_t na3,
    bool keysRemaining,
    int i
) {
    if (!is_bit_set4(a0, a1, a2, a3, i)) return false;
    if (keysRemaining && is_bit_set4(sb.lockMask[0], sb.lockMask[1], sb.lockMask[2], sb.lockMask[3], i)) {
        return false;
    }
    int base = i * 4;
    if (((a0 & sb.aboveMask[base]) | (a1 & sb.aboveMask[base + 1]) |
         (a2 & sb.aboveMask[base + 2]) | (a3 & sb.aboveMask[base + 3])) != 0u) {
        return false;
    }
    bool blockedL = ((a0 & sb.leftMask[base]) | (a1 & sb.leftMask[base + 1]) |
                     (a2 & sb.leftMask[base + 2]) | (a3 & sb.leftMask[base + 3])) != 0u;
    if (blockedL) {
        bool blockedR = ((a0 & sb.rightMask[base]) | (a1 & sb.rightMask[base + 1]) |
                         (a2 & sb.rightMask[base + 2]) | (a3 & sb.rightMask[base + 3])) != 0u;
        if (blockedR) return false;
    }
    uint8_t h = sb.iceH[i];
    if (h > 0u) {
        int gone = __popc(na0 & sb.iceMask[base]) + __popc(na1 & sb.iceMask[base + 1]) +
                   __popc(na2 & sb.iceMask[base + 2]) + __popc(na3 & sb.iceMask[base + 3]);
        if (gone < (int)h) return false;
    }
    return true;
}

__device__ __forceinline__ void apply_chosen_move(
    const PackedBoard &sb,
    uint32_t tk0, uint32_t tk1, uint32_t tk2, uint32_t tk3,
    uint32_t m0, uint32_t m1, uint32_t m2, uint32_t m3,
    uint32_t tkCount, uint32_t matchCount,
    uint32_t faceMultiLo, uint32_t faceMultiHi,
    uint32_t &a0, uint32_t &a1, uint32_t &a2, uint32_t &a3,
    uint32_t &trayLo, uint32_t &trayHi, int &trayLen,
    int &left, int &moves, int &clockAlive,
    uint32_t &rng,
    bool &terminated, int &winOut,
    int32_t* traceOut, int &traceLen
) {
    uint32_t d0 = sb.downMask[0], d1 = sb.downMask[1], d2 = sb.downMask[2], d3 = sb.downMask[3];
    int clockI = sb.clockI;

    // Priority 1: Tray match
    if (matchCount > 0u) {
        uint32_t k = (matchCount > 1u) ? (step_rng(rng) % matchCount) : 0u;
        int chosen = nth_bit_128(m0, m1, m2, m3, k);
        if (traceOut != nullptr) traceOut[traceLen++] = chosen;

        clear_bit4(a0, a1, a2, a3, chosen);
        uint8_t cf = sb.faces[chosen];
        if (cf < 32u) trayLo ^= (1u << cf);
        else trayHi ^= (1u << (cf - 32u));
        trayLen--;
        left--;
        moves++;
        if (chosen == clockI) clockAlive = 0;
        return;
    }

    // Priority 2: Free pair (peek pair always valid; face-up pair valid when trayLen < 3)
    if ((faceMultiLo | faceMultiHi) != 0u) {
        uint32_t c0 = 0u, c1 = 0u, c2 = 0u, c3 = 0u;
        uint32_t t0 = tk0, t1 = tk1, t2 = tk2, t3 = tk3;
        for (;;) {
            int ti = pop_lowest_128(t0, t1, t2, t3);
            if (ti < 0) break;
            uint8_t f = sb.faces[ti];
            bool mult = (f < 32u) ? ((faceMultiLo & (1u << f)) != 0u) : ((faceMultiHi & (1u << (f - 32u))) != 0u);
            if (mult) set_bit4(c0, c1, c2, c3, ti);
        }

        uint32_t pairCount = 0u;
        {
            uint32_t oi0 = c0, oi1 = c1, oi2 = c2, oi3 = c3;
            for (;;) {
                int i = pop_lowest_128(oi0, oi1, oi2, oi3);
                if (i < 0) break;
                uint8_t fi = sb.faces[i];
                bool di = is_bit_set4(d0, d1, d2, d3, i);
                uint32_t oj0 = oi0, oj1 = oi1, oj2 = oi2, oj3 = oi3;
                for (;;) {
                    int j = pop_lowest_128(oj0, oj1, oj2, oj3);
                    if (j < 0) break;
                    if (sb.faces[j] != fi) continue;
                    bool dj = is_bit_set4(d0, d1, d2, d3, j);
                    if (di || dj || trayLen < 3) pairCount++;
                }
            }
        }

        if (pairCount > 0u) {
            uint32_t target = (pairCount > 1u) ? (step_rng(rng) % pairCount) : 0u;
            uint32_t cur = 0u;
            int pi = -1, pj = -1;
            uint32_t oi0 = c0, oi1 = c1, oi2 = c2, oi3 = c3;
            for (;;) {
                int i = pop_lowest_128(oi0, oi1, oi2, oi3);
                if (i < 0 || pi >= 0) break;
                uint8_t fi = sb.faces[i];
                bool di = is_bit_set4(d0, d1, d2, d3, i);
                uint32_t oj0 = oi0, oj1 = oi1, oj2 = oi2, oj3 = oi3;
                for (;;) {
                    int j = pop_lowest_128(oj0, oj1, oj2, oj3);
                    if (j < 0) break;
                    if (sb.faces[j] != fi) continue;
                    bool dj = is_bit_set4(d0, d1, d2, d3, j);
                    if (di || dj || trayLen < 3) {
                        if (cur == target) { pi = i; pj = j; break; }
                        cur++;
                    }
                }
            }

            bool di = is_bit_set4(d0, d1, d2, d3, pi);
            bool dj = is_bit_set4(d0, d1, d2, d3, pj);
            if (di || dj) {
                if (traceOut != nullptr) {
                    int x = pi, y = pj;
                    if (!dj || (di && clockI >= 0 && pj == clockI)) { x = pj; y = pi; }
                    traceOut[traceLen++] = ((x + 1) << 8) | y;
                }
                clear_bit4(a0, a1, a2, a3, pi);
                clear_bit4(a0, a1, a2, a3, pj);
                left -= 2;
                moves += 2;
                if (pi == clockI || pj == clockI) clockAlive = 0;
                return;
            } else {
                int first = (clockAlive != 0 && pj == clockI) ? pj : pi;
                if (traceOut != nullptr) traceOut[traceLen++] = first;
                clear_bit4(a0, a1, a2, a3, first);
                uint8_t ff = sb.faces[first];
                if (ff < 32u) trayLo |= (1u << ff);
                else trayHi |= (1u << (ff - 32u));
                trayLen++;
                left--;
                moves++;
                if (first == clockI) clockAlive = 0;
                return;
            }
        }
    }

    // Priority 3: Random free tile
    if (trayLen >= 3) {
        if (traceOut != nullptr) {
            uint32_t k = (tkCount > 1u) ? (step_rng(rng) % tkCount) : 0u;
            traceOut[traceLen++] = nth_bit_128(tk0, tk1, tk2, tk3, k);
        }
        terminated = true;
        winOut = 0;
        return;
    }

    uint32_t k = (tkCount > 1u) ? (step_rng(rng) % tkCount) : 0u;
    int chosen = nth_bit_128(tk0, tk1, tk2, tk3, k);
    if (traceOut != nullptr) traceOut[traceLen++] = chosen;

    clear_bit4(a0, a1, a2, a3, chosen);
    uint8_t cf = sb.faces[chosen];
    if (cf < 32u) trayLo |= (1u << cf);
    else trayHi |= (1u << (cf - 32u));
    trayLen++;
    left--;
    moves++;
    if (chosen == clockI) clockAlive = 0;
}

/**
 * Kernel 1: One CUDA thread per independent game.
 */
extern "C" __global__ void playout_thread_kernel(
    const PackedBoard* __restrict__ g_board,
    uint32_t numGames,
    uint32_t baseSeed,
    uint32_t* __restrict__ g_wins,
    uint64_t* __restrict__ g_totalMoves
) {
    __shared__ PackedBoard sb;
    __shared__ uint32_t sh_wins[8];
    __shared__ uint64_t sh_moves[8];

    load_shared_board(g_board, sb);

    uint32_t localWins = 0u;
    uint64_t localMoves = 0ull;

    uint32_t stride = gridDim.x * blockDim.x;
    for (uint32_t gid = blockIdx.x * blockDim.x + threadIdx.x; gid < numGames; gid += stride) {
        uint32_t a0 = sb.initAlive[0], a1 = sb.initAlive[1], a2 = sb.initAlive[2], a3 = sb.initAlive[3];
        int left = sb.n;
        int moves = 0;
        uint32_t trayLo = 0u, trayHi = 0u;
        int trayLen = 0;
        int clockAlive = (sb.clockI >= 0) ? 1 : 0;
        uint32_t rng = init_rng(baseSeed, gid);

        int winOut = 0;
        bool terminated = false;
        int dummyLen = 0;

        while (!terminated) {
            if (left == 0) {
                winOut = (trayLen == 0) ? 1 : 0;
                break;
            }
            if (clockAlive != 0 && moves >= sb.clockN) {
                winOut = 0;
                break;
            }

            bool keysRemaining = (sb.hasLocks != 0) &&
                (((a0 & sb.keyMask[0]) | (a1 & sb.keyMask[1]) |
                  (a2 & sb.keyMask[2]) | (a3 & sb.keyMask[3])) != 0u);
            uint32_t na0 = ~a0, na1 = ~a1, na2 = ~a2, na3 = ~a3;

            uint32_t tk0 = 0u, tk1 = 0u, tk2 = 0u, tk3 = 0u;
            uint32_t m0 = 0u, m1 = 0u, m2 = 0u, m3 = 0u;
            uint32_t tkCount = 0u, matchCount = 0u;
            uint32_t faceOnceLo = 0u, faceOnceHi = 0u;
            uint32_t faceMultiLo = 0u, faceMultiHi = 0u;

            for (int i = 0; i < sb.n; i++) {
                if (!tile_can_take(sb, a0, a1, a2, a3, na0, na1, na2, na3, keysRemaining, i)) continue;
                set_bit4(tk0, tk1, tk2, tk3, i);
                tkCount++;

                uint8_t f = sb.faces[i];
                if (f < 32u) {
                    uint32_t fbit = 1u << f;
                    if ((trayLo & fbit) != 0u) {
                        set_bit4(m0, m1, m2, m3, i);
                        matchCount++;
                    } else {
                        faceMultiLo |= (faceOnceLo & fbit);
                        faceOnceLo |= fbit;
                    }
                } else {
                    uint32_t fbit = 1u << (f - 32u);
                    if ((trayHi & fbit) != 0u) {
                        set_bit4(m0, m1, m2, m3, i);
                        matchCount++;
                    } else {
                        faceMultiHi |= (faceOnceHi & fbit);
                        faceOnceHi |= fbit;
                    }
                }
            }

            if (tkCount == 0u) {
                winOut = 0;
                break;
            }

            apply_chosen_move(
                sb, tk0, tk1, tk2, tk3, m0, m1, m2, m3, tkCount, matchCount,
                faceMultiLo, faceMultiHi,
                a0, a1, a2, a3, trayLo, trayHi, trayLen,
                left, moves, clockAlive, rng, terminated, winOut,
                nullptr, dummyLen
            );
        }

        localWins += (uint32_t)winOut;
        localMoves += (uint64_t)moves;
    }

    // Warp-level reduction
    for (int offset = 16; offset > 0; offset >>= 1) {
        localWins += __shfl_down_sync(0xffffffffu, localWins, offset);
        localMoves += __shfl_down_sync(0xffffffffu, localMoves, offset);
    }
    int lane = threadIdx.x & 31;
    int warpId = threadIdx.x >> 5;
    if (lane == 0) {
        sh_wins[warpId] = localWins;
        sh_moves[warpId] = localMoves;
    }
    __syncthreads();

    if (warpId == 0) {
        int numWarps = blockDim.x >> 5;
        uint32_t bw = (lane < numWarps) ? sh_wins[lane] : 0u;
        uint64_t bm = (lane < numWarps) ? sh_moves[lane] : 0ull;
        for (int offset = 16; offset > 0; offset >>= 1) {
            bw += __shfl_down_sync(0xffffffffu, bw, offset);
            bm += __shfl_down_sync(0xffffffffu, bm, offset);
        }
        if (lane == 0) {
            atomicAdd(g_wins, bw);
            atomicAdd(g_totalMoves, bm);
        }
    }
}

/**
 * Kernel 2: One CUDA warp (32 lanes) per independent game, with dynamic persistent
 * work-stealing and parallel __ballot_sync tile evaluation (zero intra-warp divergence).
 */
extern "C" __global__ void playout_warp_kernel(
    const PackedBoard* __restrict__ g_board,
    uint32_t numGames,
    uint32_t baseSeed,
    uint32_t* __restrict__ g_nextGame,
    uint32_t* __restrict__ g_wins,
    uint64_t* __restrict__ g_totalMoves
) {
    __shared__ PackedBoard sb;
    load_shared_board(g_board, sb);

    int lane = threadIdx.x & 31;
    uint32_t warpWins = 0u;
    uint64_t warpMoves = 0ull;
    int chunks = (sb.n + 31) >> 5;

    for (;;) {
        uint32_t gid = 0u;
        if (lane == 0) {
            gid = atomicAdd(g_nextGame, 1u);
        }
        gid = __shfl_sync(0xffffffffu, gid, 0);
        if (gid >= numGames) break;

        uint32_t a0 = sb.initAlive[0], a1 = sb.initAlive[1], a2 = sb.initAlive[2], a3 = sb.initAlive[3];
        int left = sb.n;
        int moves = 0;
        uint32_t trayLo = 0u, trayHi = 0u;
        int trayLen = 0;
        int clockAlive = (sb.clockI >= 0) ? 1 : 0;
        uint32_t rng = init_rng(baseSeed, gid);

        int winOut = 0;
        bool terminated = false;
        int dummyLen = 0;

        while (!terminated) {
            if (left == 0) {
                winOut = (trayLen == 0) ? 1 : 0;
                break;
            }
            if (clockAlive != 0 && moves >= sb.clockN) {
                winOut = 0;
                break;
            }

            bool keysRemaining = (sb.hasLocks != 0) &&
                (((a0 & sb.keyMask[0]) | (a1 & sb.keyMask[1]) |
                  (a2 & sb.keyMask[2]) | (a3 & sb.keyMask[3])) != 0u);
            uint32_t na0 = ~a0, na1 = ~a1, na2 = ~a2, na3 = ~a3;

            uint32_t tk0 = 0u, tk1 = 0u, tk2 = 0u, tk3 = 0u;
            uint32_t m0 = 0u, m1 = 0u, m2 = 0u, m3 = 0u;

            // 32-lane parallel board scan via __ballot_sync!
            for (int w = 0; w < chunks; w++) {
                int i = (w << 5) + lane;
                bool can = (i < sb.n) && tile_can_take(sb, a0, a1, a2, a3, na0, na1, na2, na3, keysRemaining, i);
                bool match = false;
                if (can) {
                    uint8_t f = sb.faces[i];
                    match = (f < 32u) ? ((trayLo & (1u << f)) != 0u) : ((trayHi & (1u << (f - 32u))) != 0u);
                }
                uint32_t bCan = __ballot_sync(0xffffffffu, can);
                uint32_t bMatch = __ballot_sync(0xffffffffu, match);
                if (w == 0) { tk0 = bCan; m0 = bMatch; }
                else if (w == 1) { tk1 = bCan; m1 = bMatch; }
                else if (w == 2) { tk2 = bCan; m2 = bMatch; }
                else { tk3 = bCan; m3 = bMatch; }
            }

            uint32_t tkCount = (uint32_t)(__popc(tk0) + __popc(tk1) + __popc(tk2) + __popc(tk3));
            if (tkCount == 0u) {
                winOut = 0;
                break;
            }

            uint32_t matchCount = (uint32_t)(__popc(m0) + __popc(m1) + __popc(m2) + __popc(m3));
            uint32_t faceOnceLo = 0u, faceOnceHi = 0u;
            uint32_t faceMultiLo = 0u, faceMultiHi = 0u;

            if (matchCount == 0u) {
                uint32_t u0 = tk0, u1 = tk1, u2 = tk2, u3 = tk3;
                for (;;) {
                    int ti = pop_lowest_128(u0, u1, u2, u3);
                    if (ti < 0) break;
                    uint8_t f = sb.faces[ti];
                    if (f < 32u) {
                        uint32_t fbit = 1u << f;
                        faceMultiLo |= (faceOnceLo & fbit);
                        faceOnceLo |= fbit;
                    } else {
                        uint32_t fbit = 1u << (f - 32u);
                        faceMultiHi |= (faceOnceHi & fbit);
                        faceOnceHi |= fbit;
                    }
                }
            }

            apply_chosen_move(
                sb, tk0, tk1, tk2, tk3, m0, m1, m2, m3, tkCount, matchCount,
                faceMultiLo, faceMultiHi,
                a0, a1, a2, a3, trayLo, trayHi, trayLen,
                left, moves, clockAlive, rng, terminated, winOut,
                nullptr, dummyLen
            );
        }

        if (lane == 0) {
            warpWins += (uint32_t)winOut;
            warpMoves += (uint64_t)moves;
        }
    }

    if (lane == 0 && (warpWins > 0u || warpMoves > 0ull)) {
        atomicAdd(g_wins, warpWins);
        atomicAdd(g_totalMoves, warpMoves);
    }
}

/**
 * Kernel 3: Trace recording kernel — records the exact sequence of action codes chosen
 * by the GPU simple bot for `numGames` games so Node can verify every step against E.step.
 */
extern "C" __global__ void trace_games_kernel(
    const PackedBoard* __restrict__ g_board,
    uint32_t numGames,
    uint32_t baseSeed,
    int32_t* __restrict__ g_traces,    // [numGames * MAX_TILES]
    int32_t* __restrict__ g_traceLens, // [numGames]
    int32_t* __restrict__ g_outcomes   // [numGames]
) {
    __shared__ PackedBoard sb;
    load_shared_board(g_board, sb);

    uint32_t gid = blockIdx.x * blockDim.x + threadIdx.x;
    if (gid >= numGames) return;

    uint32_t a0 = sb.initAlive[0], a1 = sb.initAlive[1], a2 = sb.initAlive[2], a3 = sb.initAlive[3];
    int left = sb.n;
    int moves = 0;
    uint32_t trayLo = 0u, trayHi = 0u;
    int trayLen = 0;
    int clockAlive = (sb.clockI >= 0) ? 1 : 0;
    uint32_t rng = init_rng(baseSeed, gid);

    int32_t* traceOut = g_traces + gid * MAX_TILES;
    int traceLen = 0;
    int winOut = 0;
    bool terminated = false;

    while (!terminated) {
        if (left == 0) {
            winOut = (trayLen == 0) ? 1 : 0;
            break;
        }

        bool keysRemaining = (sb.hasLocks != 0) &&
            (((a0 & sb.keyMask[0]) | (a1 & sb.keyMask[1]) |
              (a2 & sb.keyMask[2]) | (a3 & sb.keyMask[3])) != 0u);
        uint32_t na0 = ~a0, na1 = ~a1, na2 = ~a2, na3 = ~a3;

        uint32_t tk0 = 0u, tk1 = 0u, tk2 = 0u, tk3 = 0u;
        uint32_t m0 = 0u, m1 = 0u, m2 = 0u, m3 = 0u;
        uint32_t tkCount = 0u, matchCount = 0u;
        uint32_t faceOnceLo = 0u, faceOnceHi = 0u;
        uint32_t faceMultiLo = 0u, faceMultiHi = 0u;

        for (int i = 0; i < sb.n; i++) {
            if (!tile_can_take(sb, a0, a1, a2, a3, na0, na1, na2, na3, keysRemaining, i)) continue;
            set_bit4(tk0, tk1, tk2, tk3, i);
            tkCount++;
            uint8_t f = sb.faces[i];
            if (f < 32u) {
                uint32_t fbit = 1u << f;
                if ((trayLo & fbit) != 0u) { set_bit4(m0, m1, m2, m3, i); matchCount++; }
                else { faceMultiLo |= (faceOnceLo & fbit); faceOnceLo |= fbit; }
            } else {
                uint32_t fbit = 1u << (f - 32u);
                if ((trayHi & fbit) != 0u) { set_bit4(m0, m1, m2, m3, i); matchCount++; }
                else { faceMultiHi |= (faceOnceHi & fbit); faceOnceHi |= fbit; }
            }
        }

        if (clockAlive != 0 && moves >= sb.clockN) {
            if (tkCount > 0u) {
                traceOut[traceLen++] = nth_bit_128(tk0, tk1, tk2, tk3, 0u);
            }
            winOut = 0;
            break;
        }

        if (tkCount == 0u) {
            winOut = 0;
            break;
        }

        apply_chosen_move(
            sb, tk0, tk1, tk2, tk3, m0, m1, m2, m3, tkCount, matchCount,
            faceMultiLo, faceMultiHi,
            a0, a1, a2, a3, trayLo, trayHi, trayLen,
            left, moves, clockAlive, rng, terminated, winOut,
            traceOut, traceLen
        );
    }

    g_traceLens[gid] = traceLen;
    g_outcomes[gid] = winOut;
}

/**
 * Kernel 4: Fixed move sequence step-verifier on GPU.
 * Steps through `numSteps` encoded actions (act < 256: single, act >= 256: peek pair ((i+1)<<8)|j)
 * and records per-step state snapshots to compare directly against engine.js E.step.
 * Each step writes 12 uint32s:
 *   [status(1=ok, 0=lost, -1=illegal), moves, trayLen, clockAlive, a0, a1, a2, a3, trayLo, trayHi, tk0, tk1]
 */
extern "C" __global__ void replay_fixed_kernel(
    const PackedBoard* __restrict__ g_board,
    const int32_t* __restrict__ g_actions,
    int32_t numSteps,
    uint32_t* __restrict__ g_snapshots // [(numSteps + 1) * 14]
) {
    if (threadIdx.x != 0 || blockIdx.x != 0) return;
    PackedBoard sb = *g_board;

    uint32_t a0 = sb.initAlive[0], a1 = sb.initAlive[1], a2 = sb.initAlive[2], a3 = sb.initAlive[3];
    int left = sb.n;
    int moves = 0;
    uint32_t trayLo = 0u, trayHi = 0u;
    int trayLen = 0;
    int clockAlive = (sb.clockI >= 0) ? 1 : 0;

    auto write_snap = [&](int stepIdx, int status) {
        bool keysRemaining = (sb.hasLocks != 0) &&
            (((a0 & sb.keyMask[0]) | (a1 & sb.keyMask[1]) |
              (a2 & sb.keyMask[2]) | (a3 & sb.keyMask[3])) != 0u);
        uint32_t na0 = ~a0, na1 = ~a1, na2 = ~a2, na3 = ~a3;
        uint32_t tk0 = 0u, tk1 = 0u, tk2 = 0u, tk3 = 0u;
        for (int i = 0; i < sb.n; i++) {
            if (tile_can_take(sb, a0, a1, a2, a3, na0, na1, na2, na3, keysRemaining, i)) {
                set_bit4(tk0, tk1, tk2, tk3, i);
            }
        }
        uint32_t* out = g_snapshots + stepIdx * 14;
        out[0] = (uint32_t)status;
        out[1] = (uint32_t)moves;
        out[2] = (uint32_t)trayLen;
        out[3] = (uint32_t)clockAlive;
        out[4] = a0; out[5] = a1; out[6] = a2; out[7] = a3;
        out[8] = trayLo; out[9] = trayHi;
        out[10] = tk0; out[11] = tk1; out[12] = tk2; out[13] = tk3;
    };

    write_snap(0, 1);

    for (int s = 0; s < numSteps; s++) {
        bool keysRemaining = (sb.hasLocks != 0) &&
            (((a0 & sb.keyMask[0]) | (a1 & sb.keyMask[1]) |
              (a2 & sb.keyMask[2]) | (a3 & sb.keyMask[3])) != 0u);
        uint32_t na0 = ~a0, na1 = ~a1, na2 = ~a2, na3 = ~a3;
        uint32_t tk0 = 0u, tk1 = 0u, tk2 = 0u, tk3 = 0u;
        for (int i = 0; i < sb.n; i++) {
            if (tile_can_take(sb, a0, a1, a2, a3, na0, na1, na2, na3, keysRemaining, i)) {
                set_bit4(tk0, tk1, tk2, tk3, i);
            }
        }

        int32_t code = g_actions[s];
        bool isPair = (code >= 256);
        int i0 = isPair ? ((code >> 8) - 1) : code;
        int i1 = isPair ? (code & 255) : -1;

        if (i0 < 0 || i0 >= sb.n || !is_bit_set4(tk0, tk1, tk2, tk3, i0)) {
            write_snap(s + 1, 2); // illegal
            return;
        }
        if (isPair) {
            if (i1 < 0 || i1 >= sb.n || i0 == i1 || !is_bit_set4(tk0, tk1, tk2, tk3, i1)) {
                write_snap(s + 1, 2);
                return;
            }
            uint8_t f0 = sb.faces[i0], f1 = sb.faces[i1];
            bool d0 = is_bit_set4(sb.downMask[0], sb.downMask[1], sb.downMask[2], sb.downMask[3], i0);
            bool d1 = is_bit_set4(sb.downMask[0], sb.downMask[1], sb.downMask[2], sb.downMask[3], i1);
            bool inTray = (f0 < 32u) ? ((trayLo & (1u << f0)) != 0u) : ((trayHi & (1u << (f0 - 32u))) != 0u);
            if (f0 != f1 || (!d0 && !d1) || inTray) {
                write_snap(s + 1, 2);
                return;
            }
        }

        if (clockAlive != 0 && moves >= sb.clockN) {
            write_snap(s + 1, 0); // lost (null in E.step)
            return;
        }

        if (isPair) {
            clear_bit4(a0, a1, a2, a3, i0);
            clear_bit4(a0, a1, a2, a3, i1);
            left -= 2;
            moves += 2;
            if (i0 == sb.clockI || i1 == sb.clockI) clockAlive = 0;
            write_snap(s + 1, 1);
        } else {
            clear_bit4(a0, a1, a2, a3, i0);
            left--;
            moves++;
            if (i0 == sb.clockI) clockAlive = 0;
            uint8_t f = sb.faces[i0];
            if (f < 32u) {
                uint32_t fbit = 1u << f;
                if ((trayLo & fbit) != 0u) {
                    trayLo ^= fbit;
                    trayLen--;
                } else {
                    if (trayLen >= 3) {
                        write_snap(s + 1, 0); // 4th tile lost
                        return;
                    }
                    trayLo |= fbit;
                    trayLen++;
                }
            } else {
                uint32_t fbit = 1u << (f - 32u);
                if ((trayHi & fbit) != 0u) {
                    trayHi ^= fbit;
                    trayLen--;
                } else {
                    if (trayLen >= 3) {
                        write_snap(s + 1, 0);
                        return;
                    }
                    trayHi |= fbit;
                    trayLen++;
                }
            }
            write_snap(s + 1, 1);
        }
    }
}
