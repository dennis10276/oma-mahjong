# Retune of the placed levels 250-302 (the part after the trap harder)

Dennis 2026-11-14 (lab 6, level 250): "After the trap tray pressure may increase. Its too easy after. Maybe more face down as well after the trap" / "Dont overdo on tray pressure. 1 in tray is enough after a hard trap."
Tail = share of careless greedy playouts that clear the board after the clock (lower = harder). Band: std 0.10-0.28 (the window moves down the ramp: 0.19-0.28 at 250, 0.10-0.17 at 302), hard tier 0.06-0.18 (was 0.15-0.40 / 0.08-0.22). Face-down = share of all tiles; the extra ones lie after the clock only.
Pressure = share of tail steps of the stored route with 0/1/2/3 tiles waiting in the tray, and the longest stretch with 2+ waiting (stored route before: see retune.json). The stored tail order is re-searched to keep about one tile waiting.

| level | source | tail before | tail after | face-down before | face-down after | score before | score after | waiting 0/1/2/3 after | note |
|---|---|---|---|---|---|---|---|---|---|
| 250 | batch 250 | 0.3738 | 0.1725 | 0.198 | 0.271 | 3.38 | 5.13 | 0.341/0.5/0.159/0 (run 1) | windows tried: 0.1-0.28 -> tail 0.3775 miss 0; 0.19-0.28 -> tail 0.1725 miss 0 |
| 251 | batch 251 | 0.3862 | 0.2037 | 0.200 | 0.275 | 3.32 | 4.87 | 0.348/0.455/0.152/0.045 (run 7) | windows tried: 0.1-0.28 -> tail 0.2037 miss 0.24; 0.19-0.28 -> tail 0.2037 miss 0.24; 0.22-0.28 -> tail 0.2125 miss 0.24 |
| 252 | batch 252 | 0.3663 | 0.1487 | 0.194 | 0.278 | 3.34 | 5.18 | 0.313/0.469/0.188/0.031 (run 5) | face-down set rejected (staticGates): tiles one by one; windows tried: 0.1-0.28 -> tail 0.1487 miss 0.056; 0.19-0.28 -> tail 0.1888 miss 0.062; 0.22-0.28 -> tail 0.2087 miss 0.252 |
| 253 | batch 253 | 0.3725 | 0.1837 | 0.200 | 0.275 | 3.41 | 4.96 | 0.314/0.5/0.186/0 (run 1) | face-down set rejected (staticGates): tiles one by one |
| 254 | batch 254 | 0.3275 | 0.1688 | 0.197 | 0.276 | 3.46 | 4.87 | 0.333/0.5/0.167/0 (run 1) |  |
| 255 | older release163-175 | | | | | | | | older board, copied unchanged |
| 256 | batch 255 | 0.365 | 0.1563 | 0.197 | 0.276 | 3.81 | 5.57 | 0.309/0.471/0.191/0.029 (run 5) | windows tried: 0.1-0.28 -> tail 0.1563 miss 0.05; 0.19-0.28 -> tail 0.2112 miss 0.05; 0.22-0.28 -> tail 0.2425 miss 0.05 |
| 257 | bank lab-273 | | | | | | | | older board, copied unchanged |
| 258 | batch 257 | 0.37 | 0.1325 | 0.205 | 0.273 | 4.26 | 6.3 | 0.346/0.5/0.154/0 (run 1) |  |
| 259 | chain lab-293 | | | | | | | | older board, copied unchanged |
| 260 | batch 260 | 0.365 | 0.2175 | 0.198 | 0.271 | 4.4 | 5.63 | 0.329/0.494/0.165/0.012 (run 2) | windows tried: 0.1-0.28 -> tail 0.1938 miss 0.08; 0.19-0.28 -> tail 0.2175 miss 0 |
| 261 | batch 258 | | | | | | | | not retuned: tail 0.3162 stays outside 0.1-0.28 (face-down set rejected (staticGates): tiles one by one | band not reached with 6 extra face-down tiles: trying 3 | band not reached with 3 extra face-down tiles: trying 0 | windows tried: 0.165-0.265 -> tail 0.3162 miss 0.062; 0.19-0.28 -> tail 0.3162 miss 0.062; 0.22-0.28 -> tail 0.3162 miss 0.062) |
| 262 | older factory4-176 | | | | | | | | older board, copied unchanged |
| 263 | batch 261 | 0.3787 | 0.2075 | 0.200 | 0.275 | 4.51 | 5.94 | 0.343/0.493/0.149/0.015 (run 2) | swaps refused by the proof: {"trapProof":1}, kept 6 |
| 264 | bank lab-262 | | | | | | | | older board, copied unchanged |
| 265 | batch 262 | 0.315 | 0.1737 | 0.200 | 0.275 | 4.74 | 5.95 | 0.324/0.485/0.176/0.015 (run 3) | face-down set rejected (staticGates): tiles one by one |
| 266 | batch 263 | 0.3912 | 0.1975 | 0.200 | 0.275 | 4.3 | 5.89 | 0.31/0.493/0.183/0.014 (run 2) | swaps refused by the proof: {"trapProof":1}, kept 6 |
| 267 | chain lab-292 | | | | | | | | older board, copied unchanged |
| 268 | batch 264 | 0.3088 | 0.215 | 0.197 | 0.211 | 4.86 | 5.63 | 0.302/0.508/0.19/0 (run 1) | face-down set rejected (staticGates): tiles one by one; windows tried: 0.148-0.248 -> tail 0.1412 miss 0.12; 0.19-0.28 -> tail 0.215 miss 0 |
| 269 | batch 265 | 0.2988 | 0.115 | 0.197 | 0.276 | 4.68 | 6.3 | 0.333/0.47/0.167/0.03 (run 5) | windows tried: 0.146-0.246 -> tail 0.115 miss 0.05; 0.19-0.28 -> tail 0.2137 miss 0.05; 0.22-0.28 -> tail 0.2525 miss 0.05 |
| 270 | batch 270 | 0.3488 | 0.2313 | 0.198 | 0.271 | 4.85 | 5.85 | 0.267/0.477/0.233/0.023 (run 5) | windows tried: 0.144-0.244 -> tail 0.1825 miss 0.268; 0.19-0.28 -> tail 0.2013 miss 0.294; 0.22-0.28 -> tail 0.2313 miss 0.116 |
| 271 | older q217-1233c8 | | | | | | | | older board, copied unchanged |
| 272 | batch 266 | 0.29 | 0.2387 | 0.203 | 0.257 | 5.33 | 5.79 | 0.246/0.508/0.246/0 (run 1) | face-down set rejected (staticGates): tiles one by one; windows tried: 0.139-0.239 -> tail 0.2387 miss 0.092; 0.19-0.28 -> tail 0.2387 miss 0.092; 0.22-0.28 -> tail 0.2387 miss 0.092 |
| 273 | older factory4-175 | | | | | | | | older board, copied unchanged |
| 274 | batch 267 | 0.2938 | 0.1613 | 0.197 | 0.276 | 5.54 | 6.68 | 0.108/0.446/0.385/0.062 (run 5) | face-down set rejected (staticGates): tiles one by one; windows tried: 0.135-0.235 -> tail 0.1475 miss 0.778; 0.19-0.28 -> tail 0.1613 miss 0.612; 0.22-0.28 -> tail 0.2662 miss 1.5 |
| 275 | batch 268 | 0.295 | 0.1775 | 0.200 | 0.263 | 5.12 | 6.13 | 0.387/0.5/0.113/0 (run 1) |  |
| 276 | batch 269 | 0.2925 | 0.2188 | 0.194 | 0.278 | 4.9 | 5.58 | 0.302/0.476/0.19/0.032 (run 4) | windows tried: 0.13-0.23 -> tail 0.1313 miss 0.442; 0.19-0.28 -> tail 0.2 miss 0.252; 0.22-0.28 -> tail 0.2188 miss 0.012 |
| 277 | older blind1-187 | | | | | | | | older board, copied unchanged |
| 278 | batch 271 | 0.355 | 0.2475 | 0.197 | 0.263 | 5.62 | 6.55 | 0.333/0.508/0.159/0 (run 1) | face-down set rejected (staticGates): tiles one by one; windows tried: 0.125-0.225 -> tail 0.3488 miss 0; 0.19-0.28 -> tail 0.2975 miss 0; 0.22-0.28 -> tail 0.2475 miss 0 |
| 279 | chain lab-291 | | | | | | | | older board, copied unchanged |
| 280 | batch 272 | 0.2238 | 0.1062 | 0.200 | 0.275 | 5.47 | 6.56 | 0.352/0.493/0.141/0.014 (run 2) | swaps refused by the proof: {"staticGates":1}, kept 6 |
| 281 | batch 273 | 0.2238 | 0.2275 | 0.197 | 0.276 | 5.78 | 5.82 | 0.305/0.492/0.186/0.017 (run 2) |  |
| 282 | older blind1-194 | | | | | | | | older board, copied unchanged |
| 283 | batch 274 | 0.175 | 0.1663 | 0.197 | 0.276 | 6.05 | 6.19 | 0.167/0.47/0.333/0.03 (run 5) | windows tried: 0.06-0.18 -> tail 0.1663 miss 0.316; 0.12-0.18 -> tail 0.1663 miss 0.316 |
| 284 | older q225-869ece | | | | | | | | older board, copied unchanged |
| 285 | batch 275 | 0.24 | 0.2125 | 0.200 | 0.225 | 6.07 | 6.31 | 0.344/0.484/0.156/0.016 (run 3) | face-down set rejected (staticGates): tiles one by one |
| 286 | older factory2-175 | | | | | | | | older board, copied unchanged |
| 287 | batch 276 | 0.1675 | 0.1275 | 0.200 | 0.275 | 6.16 | 6.59 | 0.296/0.493/0.197/0.014 (run 3) | face-down set rejected (staticGates): tiles one by one |
| 288 | older factory6-188 | | | | | | | | older board, copied unchanged |
| 289 | batch 277 | 0.1837 | 0.1313 | 0.197 | 0.237 | 6.33 | 6.82 | 0.262/0.477/0.231/0.031 (run 3) | face-down set rejected (staticGates): tiles one by one; windows tried: 0.06-0.18 -> tail 0.155 miss 0.092; 0.12-0.18 -> tail 0.1313 miss 0.068 |
| 290 | batch 280 | 0.1487 | 0.095 | 0.198 | 0.271 | 6.46 | 7.05 | 0.253/0.458/0.241/0.048 (run 3) | windows tried: 0.06-0.18 -> tail 0.095 miss 0.19; 0.12-0.18 -> tail 0.095 miss 0.19 |
| 291 | batch 278 | 0.2188 | 0.1762 | 0.200 | 0.263 | 6.48 | 6.88 | 0.382/0.485/0.118/0.015 (run 3) | face-down set rejected (staticGates): tiles one by one |
| 292 | batch 279 | 0.1575 | 0.1575 | 0.203 | 0.257 | 6.76 | 6.81 | 0.367/0.467/0.133/0.033 (run 3) | face-down set rejected (staticGates): tiles one by one |
| 293 | batch 281 | 0.1212 | 0.0975 | 0.200 | 0.275 | 6.58 | 6.87 | 0.338/0.485/0.162/0.015 (run 3) |  |
| 294 | batch 282 | 0.1913 | 0.1 | 0.197 | 0.250 | 6.66 | 7.52 | 0.226/0.484/0.274/0.016 (run 3) | windows tried: 0.06-0.18 -> tail 0.1 miss 0.148; 0.12-0.18 -> tail 0.0925 miss 0.16 |
| 295 | batch 283 | 0.185 | 0.135 | 0.202 | 0.202 | 6.82 | 7.25 | 0.319/0.486/0.181/0.014 (run 3) | face-down set rejected (staticGates): tiles one by one; band not reached with 4 extra face-down tiles: trying 2; band not reached with 4 extra face-down tiles: trying 0 |
| 296 | batch 284 | 0.1862 | 0.175 | 0.197 | 0.276 | 6.5 | 6.67 | 0.338/0.492/0.154/0.015 (run 2) | face-down set rejected (staticGates): tiles one by one; windows tried: 0.06-0.18 -> tail 0.1925 miss 0; 0.12-0.18 -> tail 0.175 miss 0 |
| 297 | batch 285 | 0.1837 | 0.1663 | 0.197 | 0.276 | 6.96 | 7.17 | 0.276/0.431/0.224/0.069 (run 5) | windows tried: 0.06-0.18 -> tail 0.1663 miss 0.332; 0.12-0.18 -> tail 0.1663 miss 0.332 |
| 298 | batch 286 | 0.1938 | 0.1725 | 0.197 | 0.263 | 6.93 | 7.16 | 0.339/0.492/0.153/0.017 (run 2) |  |
| 299 | batch 287 | 0.1787 | 0.1175 | 0.197 | 0.263 | 6.99 | 7.59 | 0.338/0.477/0.154/0.031 (run 3) | face-down set rejected (staticGates): tiles one by one |
| 300 | batch 288 | 0.1138 | 0.1062 | 0.200 | 0.275 | 6.97 | 7.11 | 0.333/0.493/0.159/0.014 (run 2) | face-down set rejected (staticGates): tiles one by one |
| 301 | older blind1-185 | | | | | | | | older board, copied unchanged |
| 302 | batch 289 | 0.09 | 0.085 | 0.200 | 0.275 | 7.51 | 7.63 | 0.03/0.433/0.463/0.075 (run 7) | face-down set rejected (staticGates): tiles one by one; windows tried: 0.06-0.18 -> tail 0.085 miss 0.946; 0.12-0.18 -> tail 0.1062 miss 1.006 |
