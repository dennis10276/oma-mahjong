module.exports = {
 "id": "i86",
 "title": "The silver key belongs to the second half",
 "idea": "After the clock a silver chain begins; one silver key is free from the start, the other appears only when the clock is gone. Taken early, the free key waits through the whole first chain.",
 "layout": 1006,
 "block": [
  71,
  69,
  47,
  11,
  63,
  41,
  52,
  10,
  61,
  64,
  38,
  9,
  28,
  22
 ],
 "target": 37,
 "limit": 15,
 "fixed": {
  "1": "p100",
  "9": "p99",
  "10": "p3",
  "11": "p2",
  "22": "silver",
  "28": "silver",
  "38": "p1",
  "41": "p60",
  "47": "p3",
  "52": "p60",
  "61": "p0",
  "63": "p100",
  "64": "p0",
  "69": "p2",
  "71": "p1"
 },
 "free": [],
 "down": [
  52
 ],
 "locks2": [
  37
 ],
 "keys2": [
  28,
  22
 ],
 "ice": {
  "9": 3
 },
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
  "clock": 9,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   52
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
