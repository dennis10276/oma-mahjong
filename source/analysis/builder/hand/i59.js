module.exports = {
 "id": "i59",
 "title": "Don't take the clock: its twin needs the escape",
 "idea": "The clock is free, but its twin lies at the bottom of a dig that fills the tray and needs a face-down escape. Taken first, the clock takes the slot that plan needs.",
 "layout": 1000,
 "block": [
  70,
  68,
  55,
  27,
  65,
  51,
  60,
  45,
  5,
  26,
  58,
  39,
  47
 ],
 "target": 25,
 "limit": 14,
 "fixed": {
  "0": "clockTwin",
  "5": "p60",
  "25": "clockTwin",
  "26": "p4",
  "27": "p1",
  "39": "p2",
  "45": "p60",
  "47": "p0",
  "48": "p100",
  "51": "p3",
  "55": "p4",
  "58": "p0",
  "60": "p100",
  "65": "p3",
  "68": "p2",
  "70": "p1"
 },
 "free": [],
 "down": [
  5
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
   5
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
