module.exports = {
 "id": "i68",
 "title": "Don't take the clock: its twin needs the escape",
 "idea": "The clock is free, but its twin lies at the bottom of a dig that fills the tray and needs a face-down escape. Taken first, the clock takes the slot that plan needs.",
 "layout": 1006,
 "block": [
  70,
  68,
  46,
  6,
  62,
  40,
  67,
  7,
  61,
  64,
  38
 ],
 "target": 8,
 "limit": 12,
 "fixed": {
  "6": "p2",
  "7": "p3",
  "8": "clockTwin",
  "23": "p100",
  "28": "clockTwin",
  "38": "p1",
  "40": "p60",
  "46": "p3",
  "61": "p0",
  "62": "p100",
  "64": "p0",
  "67": "p60",
  "68": "p2",
  "70": "p1"
 },
 "free": [],
 "down": [
  67
 ],
 "tests": [
  {
   "name": "dig",
   "expect": "win",
   "peekForced": true
  },
  {
   "name": "clockFirst",
   "expect": "none",
   "gone": [
    28
   ],
   "tray0": [
    "clockTwin"
   ]
  }
 ],
 "hand": {
  "clock": 28,
  "clockN": 14,
  "peek": true,
  "spare": 1,
  "routeTest": "dig",
  "routeSuffix": [
   28
  ],
  "downTiles": [
   67
  ],
  "baits": [
   {
    "at": 1,
    "take": [
     28
    ],
    "why": "take the free clock first"
   }
  ]
 }
};
