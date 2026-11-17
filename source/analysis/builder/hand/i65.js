module.exports = {
 "id": "i65",
 "title": "Don't take the clock: its twin needs the escape",
 "idea": "The clock is free, but its twin lies at the bottom of a dig that fills the tray and needs a face-down escape. Taken first, the clock takes the slot that plan needs.",
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
  46
 ],
 "target": 24,
 "limit": 14,
 "fixed": {
  "0": "clockTwin",
  "20": "p100",
  "22": "p4",
  "23": "p2",
  "24": "clockTwin",
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
    0
   ],
   "tray0": [
    "clockTwin"
   ]
  }
 ],
 "hand": {
  "clock": 0,
  "clockN": 16,
  "peek": true,
  "spare": 1,
  "routeTest": "dig",
  "routeSuffix": [
   0
  ],
  "downTiles": [
   66,
   44
  ],
  "baits": [
   {
    "at": 1,
    "take": [
     0
    ],
    "why": "take the free clock first"
   }
  ]
 }
};
