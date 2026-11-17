module.exports = {
 "id": "i73",
 "title": "The silver key belongs to the second half",
 "idea": "After the clock a silver chain begins; one silver key is free from the start, the other appears only when the clock is gone. Taken early, the free key waits through the whole first chain.",
 "layout": 1012,
 "block": [
  68,
  58,
  70,
  60,
  66,
  54,
  63,
  29,
  62,
  42,
  47,
  36,
  38,
  46,
  6,
  7,
  28,
  3
 ],
 "target": 52,
 "limit": 19,
 "fixed": {
  "3": "silver",
  "6": "g1",
  "16": "g110",
  "28": "silver",
  "29": "g500",
  "36": "g4",
  "38": "g2",
  "42": "g501",
  "46": "g2",
  "47": "g501",
  "54": "g3",
  "58": "g0",
  "60": "g0",
  "62": "g1",
  "63": "g500",
  "66": "g110",
  "68": "g3",
  "70": "g4"
 },
 "free": [],
 "down": [
  47
 ],
 "locks2": [
  52
 ],
 "keys2": [
  28,
  3
 ],
 "tests": [
  {
   "name": "dig",
   "expect": "win",
   "peekForced": false
  },
  {
   "name": "silverFirst",
   "expect": "none",
   "gone": [
    28
   ],
   "tray0": [
    "silver"
   ]
  }
 ],
 "hand": {
  "clock": 7,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   47
  ],
  "secondChain": true,
  "baits": [
   {
    "at": 1,
    "take": [
     28
    ],
    "why": "take the free silver key now"
   }
  ]
 }
};
