module.exports = {
 "id": "i72",
 "title": "The silver key belongs to the second half",
 "idea": "After the clock a silver chain begins; one silver key is free from the start, the other appears only when the clock is gone. Taken early, the free key waits through the whole first chain.",
 "layout": 1000,
 "block": [
  71,
  69,
  65,
  54,
  22,
  50,
  61,
  44,
  66,
  23,
  58,
  38,
  46,
  24,
  0,
  18
 ],
 "target": 28,
 "limit": 17,
 "fixed": {
  "0": "silver",
  "18": "silver",
  "20": "p100",
  "22": "p4",
  "23": "p2",
  "24": "p99",
  "38": "p3",
  "44": "p60",
  "46": "p0",
  "50": "p4",
  "54": "p3",
  "58": "p0",
  "61": "p100",
  "65": "p1",
  "66": "p60",
  "69": "p2",
  "71": "p1"
 },
 "free": [],
 "down": [
  66,
  44
 ],
 "locks2": [
  28
 ],
 "keys2": [
  0,
  18
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
    0
   ],
   "tray0": [
    "silver"
   ]
  }
 ],
 "hand": {
  "clock": 24,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   66,
   44
  ],
  "secondChain": true,
  "baits": [
   {
    "at": 1,
    "take": [
     0
    ],
    "why": "take the free silver key now"
   }
  ]
 }
};
