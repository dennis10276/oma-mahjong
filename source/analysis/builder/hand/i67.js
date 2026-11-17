module.exports = {
 "id": "i67",
 "title": "Don't take the clock: its twin needs the escape",
 "idea": "The clock is free, but its twin lies at the bottom of a dig that fills the tray and needs a face-down escape. Taken first, the clock takes the slot that plan needs.",
 "layout": 1022,
 "block": [
  63,
  45,
  61,
  39,
  49,
  13,
  70,
  56,
  53,
  37,
  69,
  54,
  33,
  12
 ],
 "target": 11,
 "limit": 15,
 "fixed": {
  "0": "g500",
  "1": "clockTwin",
  "4": "g500",
  "11": "clockTwin",
  "12": "g502",
  "13": "g503",
  "33": "g504",
  "37": "g505",
  "39": "g506",
  "45": "g506",
  "49": "g505",
  "53": "g500",
  "54": "g507",
  "56": "g500",
  "61": "g502",
  "63": "g503",
  "69": "g504",
  "70": "g507"
 },
 "free": [],
 "down": [
  53
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
    1
   ],
   "tray0": [
    "clockTwin"
   ]
  }
 ],
 "hand": {
  "clock": 1,
  "clockN": 17,
  "peek": true,
  "spare": 1,
  "routeTest": "dig",
  "routeSuffix": [
   1
  ],
  "downTiles": [
   53
  ],
  "baits": [
   {
    "at": 1,
    "take": [
     1
    ],
    "why": "take the free clock first"
   }
  ]
 }
};
