module.exports = {
 "id": "i71",
 "title": "Escape, then silver (two chains)",
 "idea": "After the clock a silver chain begins; one silver key is free from the start, the other appears only when the clock is gone. Taken early, the free key waits through the whole first chain.",
 "layout": 1042,
 "block": [
  76,
  71,
  50,
  42,
  83,
  67,
  54,
  36,
  80,
  58,
  24,
  46,
  25,
  26,
  55,
  3
 ],
 "target": 31,
 "limit": 17,
 "fixed": {
  "3": "silver",
  "24": "p4",
  "25": "p3",
  "26": "p99",
  "29": "p100",
  "36": "p1",
  "42": "p2",
  "46": "p4",
  "50": "p2",
  "54": "p60",
  "55": "silver",
  "58": "p0",
  "67": "p60",
  "71": "p1",
  "76": "p100",
  "80": "p3",
  "83": "p0"
 },
 "free": [],
 "down": [
  54
 ],
 "locks2": [
  31
 ],
 "keys2": [
  55,
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
    55
   ],
   "tray0": [
    "silver"
   ]
  }
 ],
 "hand": {
  "clock": 26,
  "peek": true,
  "peekNeeded": true,
  "spare": 1,
  "routeTest": "dig",
  "downTiles": [
   54
  ],
  "secondChain": true,
  "baits": [
   {
    "at": 1,
    "take": [
     55
    ],
    "why": "take the free silver key now"
   }
  ]
 }
};
