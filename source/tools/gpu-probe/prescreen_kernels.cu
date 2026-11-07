// CUDA C++ batch pre-screen kernel for Oma's Mahjong Level Builder (Task G2 Part B).
// Evaluates B candidate boards x C sequential multi-try campaigns (up to 20 tries/campaign
// with cross-try face & objective memory) in a single GPU launch.
// Compiled at runtime via CuPy NVRTC.

typedef unsigned char      uint8_t;
typedef int                int32_t;
typedef unsigned int       uint32_t;
typedef unsigned long long uint64_t;

#define MAX_TILES 128
#define WORDS 4
#define MAX_ROUTE_KEYS 4

struct PackedScreenBoard {
    int32_t  n;
    int32_t  clockI;
    int32_t  clockN;
    int32_t  hasLocks;
    int32_t  routeLen;
    int32_t  clockShortestK;
    int32_t  numKeys;
    int32_t  keyIdxPacked;
    uint32_t aboveMask[MAX_TILES * WORDS];
    uint32_t leftMask[MAX_TILES * WORDS];
    uint32_t rightMask[MAX_TILES * WORDS];
    uint32_t iceMask[MAX_TILES * WORDS];
    uint32_t downMask[WORDS];
    uint32_t lockMask[WORDS];
    uint32_t keyMask[WORDS];
    uint32_t initAlive[WORDS];
    uint32_t routeMask[WORDS];
    uint32_t toClockMask[WORDS];
    uint32_t initRoleVisMask[WORDS];
    uint32_t initExposedMask[WORDS];
    uint32_t clockConeMask[WORDS];
    uint32_t keyConeMask[MAX_ROUTE_KEYS * WORDS];
    uint8_t  iceH[MAX_TILES];
    uint8_t  faces[MAX_TILES];
    uint8_t  routeOrder[MAX_TILES];
    uint8_t  openScore[MAX_TILES];
};

struct ProxyParams {
    float w_match;            // 0: immediate tray / openPeek match bonus
    float key_retention;      // 1: cross-try retention rate (0..1) for discovered hidden keys/clock
    float w_route;            // 2: bonus for tiles on precomputed clockShortest route while clock pending
    float w_route_order;      // 3: preference for earlier steps along clockShortest (-0.5..1.0)
    float w_to_clock;         // 4: bonus for tiles in direct toClock cone off shortest route
    float w_hidden_route;     // 5: multiplier (0..1) on w_route when objective key/clock is hidden/frozen
    float w_urgency;          // 6: clock slack urgency factor
    float w_pair;             // 7: pair temptation weight (peek pairs & face-up pairs)
    float w_out;              // 8: 1-step unblocking of tray-waiting match or key
    float w_open;             // 9: structural height + unblocking + ice-melting preference
    float w_peek;             // 10: bonus for flipping an unseen free face-down tile
    float w_peek_patience;    // 11: penalty per consecutive flip without a commit
    float w_lookahead_dead;   // 12: 1-step look-ahead penalty when 3rd tray tile leaves 0 outs & 0 flips
    float w_lookahead_risky;  // 13: 1-step look-ahead penalty when 3rd tray tile has no known match/pair
    float temperature;        // 14: Gumbel softmax temperature (> 0)
    float retention;          // 15: cross-try face memory retention rate (0..1)
};

__device__ __forceinline__ uint32_t init_rng(uint32_t baseSeed, uint32_t boardIdx, uint32_t campIdx) {
    uint32_t h = baseSeed ^ (boardIdx * 0x9E3779B9u) ^ (campIdx * 0x85EBCA6Bu + 0xC2B2AE35u);
    h ^= h >> 16;
    h *= 0x7FEB352Du;
    h ^= h >> 15;
    return h;
}

__device__ __forceinline__ uint32_t step_rng(uint32_t &state) {
    state += 0x6D2B79F5u;
    uint32_t z = state;
    uint32_t t1 = (z ^ (z >> 15)) * (1u | z);
    uint32_t t2 = t1 + ((t1 ^ (t1 >> 7)) * (61u | t1));
    uint32_t t3 = t2 ^ t1;
    return t3 ^ (t3 >> 14);
}

__device__ __forceinline__ float rng_uniform01(uint32_t &state) {
    return ((float)(step_rng(state) >> 8) + 0.5f) * (1.0f / 16777216.0f);
}

__device__ __forceinline__ bool is_bit_set4(uint32_t m0, uint32_t m1, uint32_t m2, uint32_t m3, int i) {
    uint32_t bit = 1u << (i & 31);
    int w = i >> 5;
    if (w == 0) return (m0 & bit) != 0u;
    if (w == 1) return (m1 & bit) != 0u;
    if (w == 2) return (m2 & bit) != 0u;
    return (m3 & bit) != 0u;
}

__device__ __forceinline__ bool is_mask_set(const uint32_t* m, int i) {
    return (m[i >> 5] & (1u << (i & 31))) != 0u;
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

__device__ __forceinline__ int pop_lowest_128(uint32_t &u0, uint32_t &u1, uint32_t &u2, uint32_t &u3) {
    if (u0 != 0u) { int b = __ffs((int)u0) - 1; u0 &= (u0 - 1u); return b; }
    if (u1 != 0u) { int b = __ffs((int)u1) - 1; u1 &= (u1 - 1u); return 32 + b; }
    if (u2 != 0u) { int b = __ffs((int)u2) - 1; u2 &= (u2 - 1u); return 64 + b; }
    if (u3 != 0u) { int b = __ffs((int)u3) - 1; u3 &= (u3 - 1u); return 96 + b; }
    return -1;
}

__device__ __forceinline__ int popcount_128(uint32_t u0, uint32_t u1, uint32_t u2, uint32_t u3) {
    return __popc(u0) + __popc(u1) + __popc(u2) + __popc(u3);
}

__device__ __forceinline__ bool tile_no_above(
    const PackedScreenBoard &sb,
    uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3,
    int i
) {
    int base = i * 4;
    return ((a0 & sb.aboveMask[base]) | (a1 & sb.aboveMask[base + 1]) |
            (a2 & sb.aboveMask[base + 2]) | (a3 & sb.aboveMask[base + 3])) == 0u;
}

__device__ __forceinline__ int tile_ice_remaining(
    const PackedScreenBoard &sb,
    uint32_t na0, uint32_t na1, uint32_t na2, uint32_t na3,
    int i
) {
    uint8_t h = sb.iceH[i];
    if (h == 0u) return 0;
    int base = i * 4;
    int gone = __popc(na0 & sb.iceMask[base]) + __popc(na1 & sb.iceMask[base + 1]) +
               __popc(na2 & sb.iceMask[base + 2]) + __popc(na3 & sb.iceMask[base + 3]);
    return gone >= (int)h ? 0 : ((int)h - gone);
}

__device__ __forceinline__ bool tile_can_take_ex(
    const PackedScreenBoard &sb,
    uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3,
    uint32_t na0, uint32_t na1, uint32_t na2, uint32_t na3,
    bool keysRemaining,
    bool relieved,
    int i
) {
    if (!is_bit_set4(a0, a1, a2, a3, i)) return false;
    if (!tile_no_above(sb, a0, a1, a2, a3, i)) return false;
    int base = i * 4;
    bool blockedL = ((a0 & sb.leftMask[base]) | (a1 & sb.leftMask[base + 1]) |
                     (a2 & sb.leftMask[base + 2]) | (a3 & sb.leftMask[base + 3])) != 0u;
    if (blockedL) {
        bool blockedR = ((a0 & sb.rightMask[base]) | (a1 & sb.rightMask[base + 1]) |
                         (a2 & sb.rightMask[base + 2]) | (a3 & sb.rightMask[base + 3])) != 0u;
        if (blockedR) return false;
    }
    if (!relieved) {
        if (keysRemaining && is_mask_set(sb.lockMask, i)) {
            return false;
        }
        if (tile_ice_remaining(sb, na0, na1, na2, na3, i) > 0) return false;
    }
    return true;
}

__device__ __forceinline__ float route_vis_mult(
    const PackedScreenBoard &sb,
    const ProxyParams &sp,
    uint32_t a0, uint32_t a1, uint32_t a2, uint32_t a3,
    bool keysRemaining,
    bool clockSeen,
    uint32_t seenKeys,
    int i
) {
    if (sb.numKeys <= 0) {
        return 1.0f;
    }
    bool objVisible = false;
    uint32_t packedKeys = (uint32_t)sb.keyIdxPacked;
    for (int m = 0; m < sb.numKeys; m++) {
        int k = (int)((packedKeys >> (m * 8)) & 0xffu);
        if (k < sb.n) {
            bool keyKnown = !is_bit_set4(a0, a1, a2, a3, k) || ((seenKeys & (1u << m)) != 0u);
            if (keyKnown && is_mask_set(&sb.keyConeMask[m * WORDS], i)) {
                objVisible = true;
                break;
            }
        }
    }
    if (!objVisible && is_mask_set(sb.clockConeMask, i)) {
        if (!keysRemaining || !is_mask_set(sb.lockMask, sb.clockI) || seenKeys != 0u) {
            return 1.0f;
        }
        return 0.35f > sp.w_hidden_route ? 0.35f : sp.w_hidden_route;
    }
    return objVisible ? 1.0f : sp.w_hidden_route;
}

extern "C" __global__ void prescreen_batch_kernel(
    const PackedScreenBoard* __restrict__ g_boards,
    const ProxyParams* __restrict__ g_params,
    uint32_t numBoards,
    uint32_t campaignsPerBoard,
    uint32_t maxTries,
    uint32_t baseSeed,
    float* __restrict__ g_expectedTries,
    float* __restrict__ g_firstTryRate,
    float* __restrict__ g_clearRate,
    float* __restrict__ g_clockLossRate
) {
    uint32_t boardIdx = blockIdx.x;
    if (boardIdx >= numBoards) return;

    __shared__ PackedScreenBoard sb;
    __shared__ ProxyParams sp;
    __shared__ int sh_tries[8];
    __shared__ int sh_first[8];
    __shared__ int sh_cleared[8];
    __shared__ int sh_clockLosses[8];

    const uint32_t* s32 = reinterpret_cast<const uint32_t*>(g_boards + boardIdx);
    uint32_t* d32 = reinterpret_cast<uint32_t*>(&sb);
    const int totalWords = (int)(sizeof(PackedScreenBoard) / sizeof(uint32_t));
    for (int idx = threadIdx.x; idx < totalWords; idx += blockDim.x) {
        d32[idx] = s32[idx];
    }
    if (threadIdx.x < (int)(sizeof(ProxyParams) / sizeof(float))) {
        reinterpret_cast<float*>(&sp)[threadIdx.x] = reinterpret_cast<const float*>(g_params)[threadIdx.x];
    }
    __syncthreads();

    uint32_t campIdx = threadIdx.x;
    int triesUsed = 0;
    int wonFirst = 0;
    int cleared = 0;
    int clockLosses = 0;

    if (campIdx < campaignsPerBoard) {
        uint32_t rng = init_rng(baseSeed, boardIdx, campIdx);
        uint32_t mem0 = 0u, mem1 = 0u, mem2 = 0u, mem3 = 0u;
        bool memClockSeen = false;
        uint32_t memSeenKeys = 0u;

        uint32_t d0 = sb.downMask[0], d1 = sb.downMask[1], d2 = sb.downMask[2], d3 = sb.downMask[3];
        uint32_t rm0 = sb.routeMask[0], rm1 = sb.routeMask[1], rm2 = sb.routeMask[2], rm3 = sb.routeMask[3];
        uint32_t tc0 = sb.toClockMask[0], tc1 = sb.toClockMask[1], tc2 = sb.toClockMask[2], tc3 = sb.toClockMask[3];
        float temp = sp.temperature > 1e-4f ? sp.temperature : 1e-4f;
        const float trayCostUnit = 3.0f;

        int wonOn = 0;
        for (uint32_t attempt = 1u; attempt <= maxTries; attempt++) {
            if (attempt > 1u) {
                if (sp.retention <= 0.0f) {
                    mem0 = 0u; mem1 = 0u; mem2 = 0u; mem3 = 0u;
                } else if (sp.retention < 1.0f) {
                    uint32_t u0 = mem0, u1 = mem1, u2 = mem2, u3 = mem3;
                    uint32_t nm0 = 0u, nm1 = 0u, nm2 = 0u, nm3 = 0u;
                    for (;;) {
                        int idx = pop_lowest_128(u0, u1, u2, u3);
                        if (idx < 0) break;
                        if (rng_uniform01(rng) < sp.retention) {
                            set_bit4(nm0, nm1, nm2, nm3, idx);
                        }
                    }
                    mem0 = nm0; mem1 = nm1; mem2 = nm2; mem3 = nm3;
                }

                if (sp.key_retention <= 0.0f) {
                    memClockSeen = false;
                    memSeenKeys = 0u;
                } else if (sp.key_retention < 1.0f) {
                    if (memClockSeen && rng_uniform01(rng) >= sp.key_retention) {
                        memClockSeen = false;
                    }
                    uint32_t nk = 0u;
                    for (int m = 0; m < sb.numKeys; m++) {
                        if ((memSeenKeys & (1u << m)) != 0u && rng_uniform01(rng) < sp.key_retention) {
                            nk |= (1u << m);
                        }
                    }
                    memSeenKeys = nk;
                }
            }

            // Initially exposed face-up tiles (including staggered pyramids) are visible immediately
            mem0 |= (sb.initExposedMask[0] & ~d0);
            mem1 |= (sb.initExposedMask[1] & ~d1);
            mem2 |= (sb.initExposedMask[2] & ~d2);
            mem3 |= (sb.initExposedMask[3] & ~d3);

            uint32_t a0 = sb.initAlive[0], a1 = sb.initAlive[1], a2 = sb.initAlive[2], a3 = sb.initAlive[3];
            uint32_t pk0 = 0u, pk1 = 0u, pk2 = 0u, pk3 = 0u;
            bool clockSeen = memClockSeen;
            uint32_t seenKeys = memSeenKeys;
            int left = sb.n;
            int moves = 0;
            uint8_t tf0 = 255u, tf1 = 255u, tf2 = 255u;
            int trayLen = 0;
            int openPeek = -1;
            bool relieved = false;
            int peekStreak = 0;
            int tapCount = 0;
            bool attemptWon = false;

            while (left > 0 && tapCount < 512) {
                bool clockAlive = (sb.clockI >= 0) && is_bit_set4(a0, a1, a2, a3, sb.clockI);
                if (clockAlive && moves >= sb.clockN) {
                    clockLosses++;
                    break;
                }

                bool keysRemaining = !relieved && (sb.hasLocks != 0) &&
                    (((a0 & sb.keyMask[0]) | (a1 & sb.keyMask[1]) |
                      (a2 & sb.keyMask[2]) | (a3 & sb.keyMask[3])) != 0u);
                uint32_t na0 = ~a0, na1 = ~a1, na2 = ~a2, na3 = ~a3;

                if (sb.clockI >= 0 && !clockSeen) {
                    if (!clockAlive || is_mask_set(sb.initRoleVisMask, sb.clockI) || tile_no_above(sb, a0, a1, a2, a3, sb.clockI)) {
                        clockSeen = true;
                        memClockSeen = true;
                    }
                }
                if (sb.numKeys > 0) {
                    uint32_t packedKeys = (uint32_t)sb.keyIdxPacked;
                    for (int m = 0; m < sb.numKeys; m++) {
                        if ((seenKeys & (1u << m)) != 0u) continue;
                        int k = (int)((packedKeys >> (m * 8)) & 0xffu);
                        if (k >= sb.n) continue;
                        if (!is_bit_set4(a0, a1, a2, a3, k)) {
                            seenKeys |= (1u << m);
                            memSeenKeys |= (1u << m);
                        } else {
                            bool roleExp = is_mask_set(sb.initRoleVisMask, k) || tile_no_above(sb, a0, a1, a2, a3, k);
                            bool thawed = relieved || (tile_ice_remaining(sb, na0, na1, na2, na3, k) == 0);
                            if (roleExp && thawed) {
                                seenKeys |= (1u << m);
                                memSeenKeys |= (1u << m);
                            }
                        }
                    }
                }

                uint32_t tk0 = 0u, tk1 = 0u, tk2 = 0u, tk3 = 0u;
                uint32_t fr0 = 0u, fr1 = 0u, fr2 = 0u, fr3 = 0u;
                int tkCount = 0;

                for (int i = 0; i < sb.n; i++) {
                    if (!is_bit_set4(a0, a1, a2, a3, i)) continue;
                    if (!tile_no_above(sb, a0, a1, a2, a3, i)) continue;

                    if (!is_bit_set4(d0, d1, d2, d3, i)) {
                        set_bit4(mem0, mem1, mem2, mem3, i);
                    }

                    int base = i * 4;
                    bool blockedL = (((a0 & sb.leftMask[base]) | (a1 & sb.leftMask[base + 1]) |
                                      (a2 & sb.leftMask[base + 2]) | (a3 & sb.leftMask[base + 3])) != 0u);
                    if (blockedL) {
                        bool blockedR = (((a0 & sb.rightMask[base]) | (a1 & sb.rightMask[base + 1]) |
                                          (a2 & sb.rightMask[base + 2]) | (a3 & sb.rightMask[base + 3])) != 0u);
                        if (blockedR) continue;
                    }
                    set_bit4(fr0, fr1, fr2, fr3, i);

                    if (!relieved) {
                        if (keysRemaining && is_mask_set(sb.lockMask, i)) continue;
                        if (tile_ice_remaining(sb, na0, na1, na2, na3, i) > 0) continue;
                    }
                    set_bit4(tk0, tk1, tk2, tk3, i);
                    tkCount++;
                }

                if (tkCount == 0 && !relieved && trayLen < 4 && ((fr0 | fr1 | fr2 | fr3) != 0u)) {
                    relieved = true;
                    keysRemaining = false;
                    tk0 = fr0; tk1 = fr1; tk2 = fr2; tk3 = fr3;
                    tkCount = popcount_128(tk0, tk1, tk2, tk3);
                }
                if (tkCount == 0) {
                    if (clockAlive) clockLosses++;
                    break;
                }

                // Summarize known legal pairs and unseen flips among tk
                uint64_t knownOnce = 0ull, knownMulti = 0ull;
                uint64_t knownPeekPairFaces = 0ull;
                uint64_t knownDownOnce = 0ull;
                int unseenFlips = 0;
                {
                    uint32_t u0 = tk0, u1 = tk1, u2 = tk2, u3 = tk3;
                    for (;;) {
                        int i = pop_lowest_128(u0, u1, u2, u3);
                        if (i < 0) break;
                        bool isDown = is_bit_set4(d0, d1, d2, d3, i);
                        bool isKnown = is_bit_set4(mem0, mem1, mem2, mem3, i);
                        if (!isKnown) {
                            if (isDown) unseenFlips++;
                            continue;
                        }
                        uint8_t f = sb.faces[i];
                        bool inTray = (trayLen > 0 && tf0 == f) || (trayLen > 1 && tf1 == f) || (trayLen > 2 && tf2 == f);
                        if (!inTray) {
                            uint64_t fb = 1ull << (f & 63u);
                            if ((knownOnce & fb) != 0ull) {
                                knownMulti |= fb;
                                if (isDown || (knownDownOnce & fb) != 0ull) {
                                    knownPeekPairFaces |= fb;
                                }
                            }
                            knownOnce |= fb;
                            if (isDown) knownDownOnce |= fb;
                        }
                    }
                }

                // 1-horizon partner & tray-out unblocking masks over known blocked tiles (partnerHorizon=1)
                uint32_t trayOut0 = 0u, trayOut1 = 0u, trayOut2 = 0u, trayOut3 = 0u;
                uint32_t selfTwin0 = 0u, selfTwin1 = 0u, selfTwin2 = 0u, selfTwin3 = 0u;
                {
                    uint32_t bk0 = mem0 & a0 & ~tk0;
                    uint32_t bk1 = mem1 & a1 & ~tk1;
                    uint32_t bk2 = mem2 & a2 & ~tk2;
                    uint32_t bk3 = mem3 & a3 & ~tk3;
                    for (;;) {
                        int j = pop_lowest_128(bk0, bk1, bk2, bk3);
                        if (j < 0) break;
                        if (!relieved && keysRemaining && is_mask_set(sb.lockMask, j)) continue;
                        int iceRem = relieved ? 0 : tile_ice_remaining(sb, na0, na1, na2, na3, j);
                        if (iceRem > 1) continue;

                        uint8_t fj = sb.faces[j];
                        bool jMatchesTray = (trayLen > 0 && tf0 == fj) || (trayLen > 1 && tf1 == fj) || (trayLen > 2 && tf2 == fj);
                        int baseJ = j * 4;
                        uint32_t ab0 = a0 & sb.aboveMask[baseJ], ab1 = a1 & sb.aboveMask[baseJ + 1];
                        uint32_t ab2 = a2 & sb.aboveMask[baseJ + 2], ab3 = a3 & sb.aboveMask[baseJ + 3];
                        int upCnt = popcount_128(ab0, ab1, ab2, ab3);

                        uint32_t lf0 = a0 & sb.leftMask[baseJ], lf1 = a1 & sb.leftMask[baseJ + 1];
                        uint32_t lf2 = a2 & sb.leftMask[baseJ + 2], lf3 = a3 & sb.leftMask[baseJ + 3];
                        uint32_t rt0 = a0 & sb.rightMask[baseJ], rt1 = a1 & sb.rightMask[baseJ + 1];
                        uint32_t rt2 = a2 & sb.rightMask[baseJ + 2], rt3 = a3 & sb.rightMask[baseJ + 3];
                        int lCnt = popcount_128(lf0, lf1, lf2, lf3);
                        int rCnt = popcount_128(rt0, rt1, rt2, rt3);
                        bool sideFree = (lCnt == 0) || (rCnt == 0);

                        if (iceRem == 0) {
                            if (upCnt == 1 && sideFree) {
                                int b = pop_lowest_128(ab0, ab1, ab2, ab3);
                                if (jMatchesTray) set_bit4(trayOut0, trayOut1, trayOut2, trayOut3, b);
                                if (sb.faces[b] == fj) set_bit4(selfTwin0, selfTwin1, selfTwin2, selfTwin3, b);
                            } else if (upCnt == 0 && !sideFree) {
                                if (lCnt == 1) {
                                    int bL = pop_lowest_128(lf0, lf1, lf2, lf3);
                                    if (jMatchesTray) set_bit4(trayOut0, trayOut1, trayOut2, trayOut3, bL);
                                    if (sb.faces[bL] == fj) set_bit4(selfTwin0, selfTwin1, selfTwin2, selfTwin3, bL);
                                }
                                if (rCnt == 1) {
                                    int bR = pop_lowest_128(rt0, rt1, rt2, rt3);
                                    if (jMatchesTray) set_bit4(trayOut0, trayOut1, trayOut2, trayOut3, bR);
                                    if (sb.faces[bR] == fj) set_bit4(selfTwin0, selfTwin1, selfTwin2, selfTwin3, bR);
                                }
                            }
                        } else if (iceRem == 1 && upCnt == 0 && sideFree) {
                            uint32_t ic0 = a0 & tk0 & sb.iceMask[baseJ];
                            uint32_t ic1 = a1 & tk1 & sb.iceMask[baseJ + 1];
                            uint32_t ic2 = a2 & tk2 & sb.iceMask[baseJ + 2];
                            uint32_t ic3 = a3 & tk3 & sb.iceMask[baseJ + 3];
                            if (jMatchesTray) {
                                trayOut0 |= ic0; trayOut1 |= ic1; trayOut2 |= ic2; trayOut3 |= ic3;
                            }
                        }
                    }
                }

                bool openPeekLegal = (openPeek >= 0) && is_bit_set4(tk0, tk1, tk2, tk3, openPeek);
                float urgency = 1.0f;
                if (clockAlive && sp.w_urgency > 0.0f) {
                    int remRoute = popcount_128(a0 & rm0, a1 & rm1, a2 & rm2, a3 & rm3);
                    int slack = (sb.clockN - moves) - (remRoute > 0 ? remRoute : 1);
                    float tightness = (slack <= 0) ? 1.0f : (2.0f / (float)(slack + 1));
                    urgency = 1.0f + sp.w_urgency * tightness;
                }

                int bestIdx = -1;
                float bestNoisy = -1e30f;
                int fallbackIdx = -1;

                uint32_t u0 = tk0, u1 = tk1, u2 = tk2, u3 = tk3;
                for (;;) {
                    int i = pop_lowest_128(u0, u1, u2, u3);
                    if (i < 0) break;
                    if (fallbackIdx < 0) fallbackIdx = i;

                    uint8_t f = sb.faces[i];
                    bool isDown = is_bit_set4(d0, d1, d2, d3, i);
                    bool isKnown = is_bit_set4(mem0, mem1, mem2, mem3, i);
                    bool inTrayF = (trayLen > 0 && tf0 == f) || (trayLen > 1 && tf1 == f) || (trayLen > 2 && tf2 == f);
                    bool isOpenTwin = openPeekLegal && (openPeek != i) && (sb.faces[openPeek] == f) && !inTrayF;
                    bool onRoute = is_bit_set4(rm0, rm1, rm2, rm3, i);
                    float visMult = (clockAlive && onRoute)
                        ? route_vis_mult(sb, sp, a0, a1, a2, a3, keysRemaining, clockSeen, seenKeys, i)
                        : 0.0f;

                    float openBonus = sp.w_open * ((float)sb.openScore[i] * 0.08f);
                    float rawOut = is_bit_set4(trayOut0, trayOut1, trayOut2, trayOut3, i) ? sp.w_out : 0.0f;
                    float outBonus = (clockAlive && trayLen < 2 && !onRoute) ? (0.2f * rawOut) : rawOut;
                    if (keysRemaining && is_mask_set(sb.keyMask, i)) {
                        outBonus += (clockAlive && !onRoute) ? (0.25f * sp.w_out) : (0.8f * sp.w_out + 6.0f);
                    }

                    float S = 0.0f;

                    if (isKnown && (inTrayF || isOpenTwin)) {
                        S = sp.w_match + openBonus + 0.5f * outBonus;
                        if (clockAlive) {
                            if (i == sb.clockI || (isOpenTwin && openPeek == sb.clockI)) {
                                S += sp.w_route * 2.5f + 25.0f;
                            } else if (onRoute) {
                                S += sp.w_route * visMult * urgency;
                            } else if (is_bit_set4(tc0, tc1, tc2, tc3, i)) {
                                S += sp.w_to_clock * urgency;
                            }
                        }
                    } else if (isDown && !isKnown) {
                        S = sp.w_peek - sp.w_peek_patience * (float)peekStreak + 0.5f * openBonus;
                        if (trayLen >= 3) S += 12.0f;
                        if (clockAlive && is_bit_set4(tc0, tc1, tc2, tc3, i)) {
                            S += 0.5f * sp.w_to_clock * urgency;
                        }
                    } else {
                        uint64_t fb = 1ull << (f & 63u);
                        bool hasLegalTwin = (knownMulti & fb) != 0ull;
                        bool canFlipSafeAt3 = isDown && (openPeek != i) && hasLegalTwin;
                        if (trayLen >= 3 && !canFlipSafeAt3) {
                            S = -500.0f;
                        } else {
                            bool unblocksOwnTwin = is_bit_set4(selfTwin0, selfTwin1, selfTwin2, selfTwin3, i);
                            S = canFlipSafeAt3
                                ? (sp.w_pair + openBonus + 0.5f * outBonus)
                                : (-trayCostUnit * (float)(trayLen + 1) + openBonus + outBonus);

                            if (!canFlipSafeAt3) {
                                if (hasLegalTwin) {
                                    S += sp.w_pair;
                                } else if (unblocksOwnTwin) {
                                    S += 0.85f * sp.w_pair;
                                }
                            }
                            if (isDown && openPeek != i) {
                                S -= 1.2f;
                                if (openPeekLegal && is_bit_set4(pk0, pk1, pk2, pk3, i) && !hasLegalTwin) {
                                    S -= 6.0f;
                                }
                            }

                            if (clockAlive) {
                                if (i == sb.clockI) {
                                    S += sp.w_route * 2.5f + 25.0f;
                                } else if (onRoute) {
                                    float orderMult = 1.0f;
                                    if (sb.routeLen > 1 && sb.routeOrder[i] > 0u) {
                                        float frac = (float)(sb.routeOrder[i] - 1u) / (float)(sb.routeLen - 1);
                                        orderMult = (1.0f + 0.5f * sp.w_route_order) - sp.w_route_order * frac;
                                    }
                                    S += sp.w_route * visMult * orderMult * urgency;
                                } else if (is_bit_set4(tc0, tc1, tc2, tc3, i)) {
                                    S += sp.w_to_clock * urgency;
                                }
                            }

                            if (trayLen == 2 && !hasLegalTwin && !unblocksOwnTwin && outBonus == 0.0f) {
                                bool safeEscape = (knownPeekPairFaces != 0ull);
                                if (!safeEscape) {
                                    uint32_t a2_0 = a0, a2_1 = a1, a2_2 = a2, a2_3 = a3;
                                    clear_bit4(a2_0, a2_1, a2_2, a2_3, i);
                                    uint32_t na2_0 = ~a2_0, na2_1 = ~a2_1, na2_2 = ~a2_2, na2_3 = ~a2_3;
                                    bool keysAfter = !relieved && (sb.hasLocks != 0) &&
                                        (((a2_0 & sb.keyMask[0]) | (a2_1 & sb.keyMask[1]) |
                                          (a2_2 & sb.keyMask[2]) | (a2_3 & sb.keyMask[3])) != 0u);
                                    uint32_t km0 = mem0 & a2_0, km1 = mem1 & a2_1, km2 = mem2 & a2_2, km3 = mem3 & a2_3;
                                    for (;;) {
                                        int j = pop_lowest_128(km0, km1, km2, km3);
                                        if (j < 0) break;
                                        uint8_t fj = sb.faces[j];
                                        if (fj == tf0 || fj == tf1 || fj == f) {
                                            if (tile_can_take_ex(sb, a2_0, a2_1, a2_2, a2_3, na2_0, na2_1, na2_2, na2_3, keysAfter, relieved, j)) {
                                                safeEscape = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (!safeEscape) {
                                    int flipsLeft = unseenFlips - ((isDown && !isKnown) ? 1 : 0);
                                    if (flipsLeft <= 0) S -= sp.w_lookahead_dead;
                                    else S -= sp.w_lookahead_risky;
                                }
                            }
                        }
                    }

                    float gumbel = -__logf(-__logf(rng_uniform01(rng)));
                    float noisy = S + temp * gumbel;
                    if (noisy > bestNoisy) {
                        bestNoisy = noisy;
                        bestIdx = i;
                    }
                }

                if (bestIdx < 0) bestIdx = fallbackIdx;
                tapCount++;

                uint8_t cf = sb.faces[bestIdx];
                bool cDown = is_bit_set4(d0, d1, d2, d3, bestIdx);
                bool cInTray = (trayLen > 0 && tf0 == cf) || (trayLen > 1 && tf1 == cf) || (trayLen > 2 && tf2 == cf);
                bool cOpenTwin = openPeekLegal && (openPeek != bestIdx) && (sb.faces[openPeek] == cf) && !cInTray;
                bool wasPeeked = is_bit_set4(pk0, pk1, pk2, pk3, bestIdx);
                bool inOpts = !cDown || (openPeek == bestIdx) || (wasPeeked && (cInTray || cOpenTwin));

                set_bit4(mem0, mem1, mem2, mem3, bestIdx);

                if (!inOpts) {
                    set_bit4(pk0, pk1, pk2, pk3, bestIdx);
                    if (!(cInTray || cOpenTwin)) {
                        openPeek = bestIdx;
                        peekStreak++;
                        continue;
                    }
                }

                peekStreak = 0;
                if (clockAlive && moves >= sb.clockN) {
                    clockLosses++;
                    break;
                }
                clear_bit4(a0, a1, a2, a3, bestIdx);
                if (openPeek == bestIdx) openPeek = -1;
                left--;
                moves++;

                if (cInTray) {
                    if (tf0 == cf) { tf0 = tf1; tf1 = tf2; tf2 = 255u; }
                    else if (tf1 == cf) { tf1 = tf2; tf2 = 255u; }
                    else { tf2 = 255u; }
                    trayLen--;
                } else if (cOpenTwin) {
                    clear_bit4(a0, a1, a2, a3, openPeek);
                    openPeek = -1;
                    left--;
                    moves++;
                } else {
                    if (inOpts && trayLen >= 3) {
                        bool clockStillAlive = (sb.clockI >= 0) && is_bit_set4(a0, a1, a2, a3, sb.clockI);
                        if (clockStillAlive) clockLosses++;
                        break;
                    }
                    if (trayLen == 0) tf0 = cf;
                    else if (trayLen == 1) tf1 = cf;
                    else tf2 = cf;
                    trayLen++;
                }

                if (left == 0) {
                    attemptWon = (trayLen == 0);
                    break;
                }
            }

            if (attemptWon) {
                wonOn = (int)attempt;
                break;
            }
        }

        if (wonOn > 0) {
            triesUsed = wonOn;
            cleared = 1;
            if (wonOn == 1) wonFirst = 1;
        } else {
            triesUsed = (int)maxTries;
        }
    }

    for (int offset = 16; offset > 0; offset >>= 1) {
        triesUsed += __shfl_down_sync(0xffffffffu, triesUsed, offset);
        wonFirst += __shfl_down_sync(0xffffffffu, wonFirst, offset);
        cleared += __shfl_down_sync(0xffffffffu, cleared, offset);
        clockLosses += __shfl_down_sync(0xffffffffu, clockLosses, offset);
    }
    int lane = threadIdx.x & 31;
    int warpId = threadIdx.x >> 5;
    if (lane == 0) {
        sh_tries[warpId] = triesUsed;
        sh_first[warpId] = wonFirst;
        sh_cleared[warpId] = cleared;
        sh_clockLosses[warpId] = clockLosses;
    }
    __syncthreads();

    if (warpId == 0) {
        int numWarps = blockDim.x >> 5;
        int bt = (lane < numWarps) ? sh_tries[lane] : 0;
        int bf = (lane < numWarps) ? sh_first[lane] : 0;
        int bc = (lane < numWarps) ? sh_cleared[lane] : 0;
        int bcl = (lane < numWarps) ? sh_clockLosses[lane] : 0;
        for (int offset = 4; offset > 0; offset >>= 1) {
            bt += __shfl_down_sync(0xffffffffu, bt, offset);
            bf += __shfl_down_sync(0xffffffffu, bf, offset);
            bc += __shfl_down_sync(0xffffffffu, bc, offset);
            bcl += __shfl_down_sync(0xffffffffu, bcl, offset);
        }
        if (lane == 0) {
            float invC = 1.0f / (float)campaignsPerBoard;
            g_expectedTries[boardIdx] = (float)bt * invC;
            g_firstTryRate[boardIdx] = (float)bf * invC;
            g_clearRate[boardIdx] = (float)bc * invC;
            g_clockLossRate[boardIdx] = (float)bcl * invC;
        }
    }
}
